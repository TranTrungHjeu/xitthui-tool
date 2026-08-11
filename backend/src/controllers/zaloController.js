const { ZaloTemplate, Class, Lesson, LessonContent } = require("../storage/mongoModels");
const { childLogger } = require("../utils/logger");
const log = childLogger("ZaloController");

/**
 * GET /zalo/template
 * Returns the Zalo comment template from MongoDB.
 */
async function getTemplate(req, res) {
  try {
    const doc = await ZaloTemplate.findById("zalo");
    if (doc) {
      return res.json({ template: doc.template || "" });
    }
    return res.json({ template: "" });
  } catch (err) {
    console.error("[/zalo/template] Error:", err);
    return res.status(500).json({ error: "Lỗi khi tải template" });
  }
}

/**
 * PUT /zalo/template
 * Body: { template: string }
 * Saves or updates the Zalo comment template.
 */
async function saveTemplate(req, res) {
  try {
    const { template } = req.body;
    if (typeof template !== "string") {
      return res.status(400).json({ error: "template phải là string" });
    }
    await ZaloTemplate.findByIdAndUpdate(
      "zalo",
      { template },
      { upsert: true, new: true }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[/zalo/template PUT] Error:", err);
    return res.status(500).json({ error: "Lỗi khi lưu template" });
  }
}

module.exports = { getTemplate, saveTemplate, getRunningClasses, getLessonMeta, getLessonList, getLessonForClass };

/**
 * GET /zalo/lesson-meta
 * Trả về danh sách subjects + levels (filter) từ MongoDB.
 */
async function getLessonMeta(req, res) {
  try {
    const subjects = await Lesson.distinct("subject");
    const levels = await Lesson.distinct("courseCode");
    return res.json({
      success: true,
      data: {
        subjects: subjects.map(s => ({ id: s.toLowerCase(), name: s })),
        levels: levels.filter(Boolean).map(c => ({ id: c, name: c }))
      }
    });
  } catch (err) {
    log.error("[/zalo/lesson-meta] Error:", err.message);
    return res.status(500).json({ success: false, error: "Lỗi khi tải meta" });
  }
}

/**
 * GET /zalo/lessons?subject=<id>&level=<id>
 * Hoặc GET /zalo/lessons?classId=<id>&session=<n>
 *
 * Lấy danh sách bài học từ MongoDB.
 */
async function getLessonList(req, res) {
  try {
    const { subject, level, classId, session } = req.query;

    // If classId provided, delegate to getLessonForClass logic
    if (classId) {
      const cls = await Class.findById(classId)
        .select({ _id: 1, name: 1, course: 1, "computed.currentSessionIndex": 1 })
        .lean();

      if (!cls) {
        return res.json({ success: true, data: { subjectId: null, levelId: null, subjectName: null, levelName: null, lessons: [], selectedLesson: null } });
      }

      const sessionIndex = session !== undefined
        ? parseInt(session, 10)
        : cls?.computed?.currentSessionIndex || 0;

      const subjectName = detectSubjectFromClass(cls);

      const lessons = await Lesson.find({ subject: subjectName })
        .select({ _id: 1, lessonCode: 1, title: 1, description: 1, lessonNumber: 1, courseCode: 1 })
        .sort({ lessonNumber: 1 })
        .lean();

      const selectedLesson = sessionIndex > 0
        ? lessons.find(l => l.lessonNumber === sessionIndex) || null
        : null;

      return res.json({
        success: true,
        data: {
          subjectId: subjectName.toLowerCase(),
          levelId: null,
          subjectName,
          levelName: null,
          lessons,
          selectedLesson,
        }
      });
    }

    // Filter by subject + level
    const filter = {};
    if (subject) filter.subject = subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
    if (level) filter.courseCode = level;

    const lessons = await Lesson.find(filter)
      .select({ _id: 1, lessonCode: 1, title: 1, description: 1, lessonNumber: 1, courseCode: 1 })
      .sort({ lessonNumber: 1 })
      .lean();

    return res.json({
      success: true,
      data: {
        subjectId: subject || null,
        levelId: level || null,
        subjectName: subject || null,
        levelName: level || null,
        lessons,
        selectedLesson: null,
      }
    });
  } catch (err) {
    log.error("[/zalo/lessons] Error:", err.message);
    return res.status(500).json({ success: false, error: "Lỗi khi tải bài học" });
  }
}

/**
 * Map course code to subject name (matches lessonLoader logic)
 */
const COURSE_CODE_TO_SUBJECT = {
  SB: "Coding", SA: "Coding", SI: "Coding",
  GB: "Coding", GA: "Coding", GI: "Coding",
  PTB: "Coding", PTA: "Coding", PTI: "Coding",
  JSB: "Coding", JSA: "Coding", JSI: "Coding",
  CSB: "Coding", CSA: "Coding", CSI: "Coding",
  KIROB: "Robotics", PREB: "Robotics", PREA: "Robotics", PREI: "Robotics",
  ARMB: "Robotics", ARMA: "Robotics", ARMI: "Robotics",
  SEMIB: "Robotics", SEMIA: "Robotics", SEMII: "Robotics",
  AUTOA: "Robotics",
  XART: "Art", VCI: "Art", VAI: "Art", VAA: "Art",
};

function detectSubjectFromClass(cls) {
  const code = cls.course?.shortName || cls.course?.code || cls.name || "";
  const upper = String(code).toUpperCase();
  
  // Find longest matching code
  const sortedCodes = Object.keys(COURSE_CODE_TO_SUBJECT).sort((a, b) => b.length - a.length);
  for (const c of sortedCodes) {
    if (upper.includes(c)) {
      return COURSE_CODE_TO_SUBJECT[c];
    }
  }
  
  // Fallback: check class name
  const name = cls.name?.toLowerCase() || "";
  if (name.includes("art") || name.includes("vci") || name.includes("vai") || name.includes("xart")) return "Art";
  if (name.includes("robotic") || name.includes("pre") || name.includes("semi") || name.includes("arm")) return "Robotics";
  return "Coding"; // default
}

/**
 * GET /zalo/lesson-for-class?classId=<id>&session=<n>
 * Auto-load bài học theo lớp + số buổi (1-based).
 * Trả về lesson đã chọn sẵn từ MongoDB.
 */
async function getLessonForClass(req, res) {
  try {
    const { classId, session } = req.query;
    if (!classId) {
      return res.status(400).json({ success: false, error: "classId is required" });
    }

    const cls = await Class.findById(classId)
      .select({ _id: 1, name: 1, course: 1, "computed.currentSessionIndex": 1 })
      .lean();

    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const sessionIndex = session !== undefined
      ? parseInt(session, 10)
      : cls?.computed?.currentSessionIndex || 0;

    const subject = detectSubjectFromClass(cls);
    
    // Query lessons from MongoDB
    const lessons = await Lesson.find({
      subject: subject,
      lessonNumber: sessionIndex > 0 ? sessionIndex : { $gte: 1 }
    })
      .select({ _id: 1, lessonCode: 1, title: 1, description: 1, lessonNumber: 1, courseCode: 1 })
      .sort({ lessonNumber: 1 })
      .lean();

    // Get lesson contents
    const lessonIds = lessons.map(l => l._id);
    const contents = await LessonContent.find({ lessonId: { $in: lessonIds } })
      .sort({ lessonId: 1, blockIndex: 1 })
      .lean();

    // Merge lessons with their contents
    const contentByLesson = {};
    for (const c of contents) {
      if (!contentByLesson[c.lessonId]) {
        contentByLesson[c.lessonId] = [];
      }
      contentByLesson[c.lessonId].push({
        id: c._id,
        blockType: c.blockType,
        title: c.title,
        content: c.content,
      });
    }

    const lessonsWithContent = lessons.map(l => ({
      id: l._id,
      lessonCode: l.lessonCode,
      title: l.title,
      description: l.description,
      lessonNumber: l.lessonNumber,
      courseCode: l.courseCode,
      content: (contentByLesson[l._id] || []).map(c => c.content).join("\n\n"),
      blocks: contentByLesson[l._id] || [],
    }));

    // Auto-select the lesson matching sessionIndex
    const selectedLesson = sessionIndex > 0
      ? lessonsWithContent.find(l => l.lessonNumber === sessionIndex) || null
      : (lessonsWithContent[0] || null);

    return res.json({
      success: true,
      data: {
        subjectId: subject.toLowerCase(),
        levelId: null,
        subjectName: subject,
        levelName: null,
        lessons: lessonsWithContent,
        selectedLesson,
      }
    });
  } catch (err) {
    log.error("[/zalo/lesson-for-class] Error:", err.message);
    return res.status(500).json({ success: false, error: "Lỗi" });
  }
}

/**
 * GET /zalo/running-classes
 * Lấy danh sách các lớp đang chạy (status OPEN/RUNNING/PRE_OPEN/PREPARING/PENDING)
 * + số buổi mới nhất vừa xảy ra (computed.currentSessionIndex hoặc slot.index)
 * Đọc trực tiếp từ MongoDB - không cần auth, không gọi LMS.
 */
async function getRunningClasses(req, res) {
  try {
    const ACTIVE_STATUSES = [
      "OPEN",
      "RUNNING",
      "PRE_OPEN",
      "PREPARING",
      "PENDING",
      "IN_PROGRESS",
      "ĐANG_DIỄN_RA",
    ];

    const docs = await Class.find({ status: { $in: ACTIVE_STATUSES } })
      .select({
        _id: 1,
        name: 1,
        status: 1,
        startDate: 1,
        endDate: 1,
        course: 1,
        centre: 1,
        slots: 1,
        totalSlot: 1,
        students: 1,
        "computed.currentSessionIndex": 1,
        "computed.timeRange": 1,
        "computed.weekdays": 1,
      })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const classes = docs.map((c) => {
      const slots = Array.isArray(c.slots) ? c.slots : [];
      const studentCount = Array.isArray(c.students) ? c.students.length : null;

      // Ưu tiên computed.currentSessionIndex do scheduler cập nhật.
      // Fallback: tự suy ra từ slot có date gần nhất trong quá khứ.
      let latestIndex = c?.computed?.currentSessionIndex || 0;

      let latestDate = "";
      let latestStartTime = "";
      let latestEndTime = "";
      if (slots.length > 0) {
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        let pastBest = null;
        let futureBest = null;
        for (const s of slots) {
          if (!s || !s.date) continue;
          let d = null;
          if (s.date.includes("/")) {
            const p = s.date.split("/");
            if (p.length === 3) {
              d = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
            }
          } else {
            d = new Date(s.date);
          }
          if (!d || isNaN(d.getTime())) continue;
          if (d <= now) {
            if (!pastBest || d > pastBest.date) pastBest = { date: d, slot: s };
          } else {
            if (!futureBest || d < futureBest.date) futureBest = { date: d, slot: s };
          }
        }
        const chosen = pastBest?.slot ?? futureBest?.slot;
        if (chosen) {
          if (latestIndex <= 0) {
            latestIndex =
              chosen.index !== undefined
                ? chosen.index
                : chosen.sessionIndex || 0;
          }
          latestDate = chosen.date || "";
          latestStartTime = chosen.startTime || "";
          latestEndTime = chosen.endTime || "";
        }
      }

      return {
        id: c._id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        course: c.course || null,
        centre: c.centre || null,
        totalSlot: typeof c.totalSlot === "number" ? c.totalSlot : 14,
        studentCount,
        currentSessionIndex: latestIndex || 0,
        latestSlot: latestDate
          ? {
              date: latestDate,
              startTime: latestStartTime,
              endTime: latestEndTime,
              index: latestIndex || 0,
            }
          : null,
        slotCount: slots.length,
      };
    });

    // Sắp xếp: lớp có slot mới nhất gần hiện tại nhất lên đầu
    classes.sort((a, b) => {
      const da = a.latestSlot?.date
        ? new Date(a.latestSlot.date.split("/").reverse().join("-")).getTime()
        : 0;
      const db = b.latestSlot?.date
        ? new Date(b.latestSlot.date.split("/").reverse().join("-")).getTime()
        : 0;
      return db - da;
    });

    return res.json({ success: true, data: classes });
  } catch (err) {
    log.error("[/zalo/running-classes] Error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Lỗi khi tải danh sách lớp đang chạy",
    });
  }
}
