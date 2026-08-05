/**
 * LMS Controller
 *
 * Public (no-auth) endpoints that power the `/lms` page on the frontend.
 *
 * The page is intentionally public — anyone with a valid LMS token can:
 *   - Generate teacher comments via Gemini
 *   - Sync class data from MindX LMS
 *   - Browse / save custom criteria templates
 *
 * When the caller is logged in (i.e. provides a valid `sessionId`), the
 * LMS token is sourced from their session and stored criteria are owned
 * by them. Otherwise, the token is taken directly from the request body
 * (Bearer fallback) and criteria are stored without an owner.
 */

const LMSClient = require("../services/lmsClient");
const { generateTeacherComment, chat } = require("../services/ai/lmsTeacherComment");
const { LMSCriteria, Class, StudentComment } = require("../storage/mongoModels");
const SessionStorage = require("../storage/sessionStorage");
const { isLmsAuthError } = require("../utils/authError");
const { childLogger } = require("../utils/logger.js");

const log = childLogger("LmsController");

// -----------------------------------------------------------------------------
// Token resolution helper
// -----------------------------------------------------------------------------
async function resolveToken(req) {
  const fromBody = req.body?.token || req.query?.token;
  const fromHeader = req.headers?.authorization?.split(" ")[1];
  if (fromBody) return { token: fromBody, user: null, source: "body" };
  if (fromHeader) return { token: fromHeader, user: null, source: "header" };

  const sessionId =
    req.body?.sessionId ||
    req.query?.sessionId ||
    req.headers?.["x-session-id"] ||
    null;

  if (sessionId) {
    const session = await SessionStorage.getSession(sessionId);
    if (session && session.isValid !== false && session.lmsRefreshToken) {
      return {
        token: session.lmsRefreshToken,
        user: { id: session.userId, teacherId: session.teacherId },
        source: "session",
      };
    }
  }
  return { token: null, user: null, source: null };
}

function sendError(res, err, fallbackStatus = 500) {
  const status = isLmsAuthError(err) ? 401 : fallbackStatus;
  log.error("[LmsController] %s: %s", err.message, err.stack);
  return res.status(status).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
}

// -----------------------------------------------------------------------------
// POST /lms/generate-comment
// -----------------------------------------------------------------------------
const generateComment = async (req, res) => {
  try {
    const {
      classId,
      studentId,
      criteria,
      rawNote,
      studentName,
      sessionNumber,
      history,
      subject,
      criteriaTemplateName,
    } = req.body || {};

    if (!rawNote || !String(rawNote).trim()) {
      return res.status(400).json({
        success: false,
        error: "rawNote is required (the teacher's raw observation)",
      });
    }

    const result = await generateTeacherComment({
      studentName: studentName || null,
      sessionNumber: sessionNumber || null,
      rawNote: String(rawNote).trim(),
      criteria: Array.isArray(criteria) ? criteria : null,
      criteriaTemplateName: criteriaTemplateName || null,
      history: Array.isArray(history) ? history : [],
      subject: subject || "general",
    });

    if (result.aiUnavailable) {
      return res.json({
        success: true,
        aiUnavailable: true,
        reason: result.reason,
        data: { text: null, sections: [] },
      });
    }

    return res.json({
      success: true,
      data: {
        text: result.text,
        sections: result.sections,
        classId: classId || null,
        studentId: studentId || null,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// -----------------------------------------------------------------------------
// POST /lms/sync-class — read class + students from Mongo (ClassScheduler has
// already populated this from LMS). No token required.
// -----------------------------------------------------------------------------
const syncClass = async (req, res) => {
  try {
    const { classId } = req.body || {};
    if (!classId) {
      return res.status(400).json({
        success: false,
        error: "classId is required",
      });
    }

    const cls = await Class.findById(classId).lean().catch((err) => {
      log.warn("[LmsController] sync-class Class.findById failed: %s", err.message);
      return null;
    });

    if (!cls) {
      return res.status(404).json({
        success: false,
        error: "Class not found in cache. Please wait for the scheduler to sync this class.",
      });
    }

    const students = Array.isArray(cls.students)
      ? cls.students
          .map((s) => {
            const stu = s?.student || s;
            if (!stu || !stu.id) return null;
            return {
              id: stu.id,
              fullName: stu.fullName || stu.name || "",
              username: stu.username || "",
              email: stu.email || "",
            };
          })
          .filter(Boolean)
      : [];

    return res.json({
      success: true,
      data: {
        class: {
          id: cls._id,
          name: cls.name,
          status: cls.status,
          course: cls.course || null,
          centre: cls.centre || null,
        },
        students,
        submissions: [],
        lessons: [],
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// -----------------------------------------------------------------------------
// GET /lms/criteria?subject=coding
//
// Trả về criteria do user/admin lưu trong MongoDB. KHÔNG có fallback default
// trong code — nếu collection `lmscriterias` rỗng thì response là `[]` và
// frontend phải hướng dẫn người dùng tạo bộ tiêu chí mới.
// -----------------------------------------------------------------------------
const getCriteria = async (req, res) => {
  try {
    const subject = (req.query?.subject || "general").toString();
    const { user } = await resolveToken(req);

    const filter = { subject };
    const customDocs = await LMSCriteria.find(filter).lean().catch((err) => {
      log.warn("[LmsController] getCriteria find failed: %s", err.message);
      return [];
    });

    const list = customDocs.map(toClientShape);

    return res.json({
      success: true,
      data: list,
      subject,
      ownerId: user?.id || null,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

function toClientShape(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    id: doc._id,
    name: doc.name,
    subject: doc.subject,
    type: doc.type || "custom",
    sections: doc.sections || [],
    createdBy: doc.createdBy || null,
    updatedAt: doc.updatedAt,
  };
}

// -----------------------------------------------------------------------------
// POST /lms/save-criteria
// -----------------------------------------------------------------------------
const saveCriteria = async (req, res) => {
  try {
    const { id, name, subject, sections, type } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        error: "name is required",
      });
    }
    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: "sections must be an array",
      });
    }

    const { user } = await resolveToken(req);
    const effectiveSubject = ["coding", "robotic", "art"].includes(subject)
      ? subject
      : "general";

    const docId =
      id ||
      `${effectiveSubject}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      _id: docId,
      name: String(name).trim(),
      subject: effectiveSubject,
      type: type === "default" ? "default" : "custom",
      sections: sections.map((s) => ({
        title: s.title || "",
        criteria: Array.isArray(s.criteria)
          ? s.criteria.map((c) => ({
              id: c.id || `c_${Math.random().toString(36).slice(2, 9)}`,
              label: c.label || "",
              value: c.value || "",
            }))
          : [],
      })),
      createdBy: user?.id || null,
      updatedAt: new Date(),
    };

    const saved = await LMSCriteria.findOneAndUpdate(
      { _id: docId },
      { $set: payload, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, data: toClientShape(saved.toObject()) });
  } catch (err) {
    return sendError(res, err);
  }
};

// -----------------------------------------------------------------------------
// POST /lms/chat (bonus — used by LmsChatbox component)
// -----------------------------------------------------------------------------
const chatEndpoint = async (req, res) => {
  try {
    const { message, history, systemPrompt } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }
    const result = await chat({
      userMessage: String(message).trim(),
      history: Array.isArray(history) ? history : [],
      systemPrompt: systemPrompt || null,
    });
    if (result.aiUnavailable) {
      return res.json({
        success: true,
        aiUnavailable: true,
        reason: result.reason,
        data: { text: null },
      });
    }
    return res.json({ success: true, data: { text: result.text } });
  } catch (err) {
    return sendError(res, err);
  }
};

// -----------------------------------------------------------------------------
// GET /lms/classes — list classes from Mongo (cached LMS data)
// -----------------------------------------------------------------------------
const CLASS_LIST_DEFAULT_STATUSES = ["RUNNING", "ACTIVE"];
const CLASS_LIST_RUNNING_STATUSES = ["RUNNING", "ACTIVE", "INTAKE", "INPROGRESS", "ONGOING"];

function pickSubjectFromClass(cls) {
  const courseName = cls?.course?.shortName || cls?.course?.name || "";
  const haystack = courseName.toLowerCase();
  if (haystack.includes("coding") || haystack.includes("lap trinh") || haystack.includes("lập trình")) return "coding";
  if (haystack.includes("robot")) return "robotic";
  if (haystack.includes("art")) return "art";
  return cls?.computed?.category || "general";
}

function mapClassToSummary(cls) {
  if (!cls) return null;
  return {
    id: cls._id,
    name: cls.name,
    status: cls.status,
    subject: pickSubjectFromClass(cls),
    level: cls.level || null,
    isOwner: true,
    course: cls.course
      ? {
          id: cls.course.id || null,
          name: cls.course.name || null,
          shortName: cls.course.shortName || null,
        }
      : null,
    centre: cls.centre
      ? {
          id: cls.centre.id || null,
          name: cls.centre.name || null,
          shortName: cls.centre.shortName || null,
        }
      : null,
  };
}

const getClasses = async (req, res) => {
  try {
    const statusFilter = (req.query?.status || "RUNNING").toString().toUpperCase();
    const teacherCode = (req.query?.teacherCode || "").toString().trim();
    const search = (req.query?.search || "").toString().trim();

    let allowedStatuses;
    if (statusFilter === "ALL") {
      allowedStatuses = null;
    } else if (statusFilter === "RUNNING") {
      allowedStatuses = CLASS_LIST_RUNNING_STATUSES;
    } else if (statusFilter === "FINISHED") {
      allowedStatuses = ["FINISHED", "COMPLETED", "CLOSED", "ENDED"];
    } else {
      allowedStatuses = CLASS_LIST_DEFAULT_STATUSES;
    }

    const filter = {};
    if (allowedStatuses && allowedStatuses.length) {
      filter.status = { $in: allowedStatuses };
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "course.name": { $regex: search, $options: "i" } },
        { "centre.name": { $regex: search, $options: "i" } },
      ];
    }

    const docs = await Class.find(filter).lean().catch((err) => {
      log.warn("[LmsController] getClasses find failed: %s", err.message);
      return [];
    });

    const summaries = docs
      .map(mapClassToSummary)
      .filter(Boolean);

    summaries.sort((a, b) => {
      const aRunning = a.status === "RUNNING" || a.status === "ACTIVE" ? 0 : 1;
      const bRunning = b.status === "RUNNING" || b.status === "ACTIVE" ? 0 : 1;
      if (aRunning !== bRunning) return aRunning - bRunning;
      const aTime = docs.find((d) => d._id === a.id)?.startDate || "";
      const bTime = docs.find((d) => d._id === b.id)?.startDate || "";
      return bTime.localeCompare(aTime);
    });

    // teacherCode is accepted for forward-compat (filter by teacher). Currently unused:
    // when implemented, look up teacher in `teachers` Mixed array and filter by `id`.
    void teacherCode;

    return res.json({
      success: true,
      data: summaries,
      count: summaries.length,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// -----------------------------------------------------------------------------
// GET /lms/comment-history — previous session comments for a student in a class.
// Reads from `StudentComment` collection (populated by `studentCommentsScheduler`,
// which uses master credentials). No token required.
// -----------------------------------------------------------------------------
const getCommentHistory = async (req, res) => {
  try {
    const classId = (req.query?.classId || "").toString().trim();
    const studentId = (req.query?.studentId || "").toString().trim();
    const upToSessionRaw = req.query?.upToSession;
    const upToSession = upToSessionRaw ? Number.parseInt(upToSessionRaw, 10) : 14;

    if (!classId) {
      return res.status(400).json({
        success: false,
        error: "classId is required",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: "studentId is required",
      });
    }

    const docs = await StudentComment.find({
      classId,
      studentId,
      sessionIndex: { $lt: upToSession, $ne: null },
      comment: { $exists: true, $ne: "" },
    })
      .sort({ sessionIndex: 1 })
      .lean()
      .catch((err) => {
        log.warn("[LmsController] comment-history StudentComment.find failed: %s", err.message);
        return [];
      });

    const history = docs.map((d) => ({
      session: typeof d.sessionIndex === "number" ? d.sessionIndex : null,
      date: d.sessionDate || null,
      comment: d.comment || "",
    }));

    return res.json({
      success: true,
      data: { history },
      classId,
      studentId,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

module.exports = {
  generateComment,
  syncClass,
  getClasses,
  getCommentHistory,
  getCriteria,
  saveCriteria,
  chatEndpoint,
};
