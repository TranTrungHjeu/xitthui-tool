/**
 * Lesson Controller
 *
 * Public route — no auth required. CRUD for Lesson + LessonContent plus
 * a QR endpoint that returns a Google Chart API URL for client-side rendering
 * (avoids pulling in a new npm dependency).
 */

const { Lesson, LessonContent } = require("../storage/mongoModels");
const { childLogger } = require("../utils/logger");

const log = childLogger("LessonController");

const VALID_SUBJECTS = ["Coding", "Robotics", "Art", "Kiro"];
const VALID_BLOCK_TYPES = ["intro", "concept", "activity", "quiz", "wrap-up"];

function sanitizeString(value, max = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeStringArray(value, maxItems = 50, maxLen = 200) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === "string")
    .map((v) => v.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeResources(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r) => r && typeof r === "object")
    .map((r) => ({
      url: sanitizeString(r.url, 1000),
      label: sanitizeString(r.label, 200)
    }))
    .filter((r) => r.url)
    .slice(0, 20);
}

function sanitizeLessonInput(body) {
  if (!body || typeof body !== "object") return null;
  const title = sanitizeString(body.title, 200);
  const subject = sanitizeString(body.subject, 50);
  if (!title || !VALID_SUBJECTS.includes(subject)) return null;
  return {
    title,
    description: sanitizeString(body.description, 2000),
    subject,
    courseCode: sanitizeString(body.courseCode, 50),
    courseName: sanitizeString(body.courseName, 200),
    lessonNumber: Number.isFinite(body.lessonNumber) ? body.lessonNumber : 0,
    duration: Number.isFinite(body.duration) ? body.duration : 60,
    objectives: sanitizeStringArray(body.objectives),
    prerequisites: sanitizeStringArray(body.prerequisites),
    materials: sanitizeStringArray(body.materials),
    tags: sanitizeStringArray(body.tags, 30, 50)
  };
}

function sanitizeContentInput(body) {
  if (!body || typeof body !== "object") return null;
  const blockType = sanitizeString(body.blockType, 20);
  if (!VALID_BLOCK_TYPES.includes(blockType)) return null;
  return {
    blockType,
    blockIndex: Number.isFinite(body.blockIndex) ? body.blockIndex : 0,
    title: sanitizeString(body.title, 200),
    content: sanitizeString(body.content, 20000),
    resources: sanitizeResources(body.resources),
    estimatedMinutes: Number.isFinite(body.estimatedMinutes)
      ? body.estimatedMinutes
      : 0
  };
}

function buildLessonId(courseCode, lessonNumber) {
  const safeCourse = (courseCode || "default")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 32) || "default";
  return `lsn_${safeCourse}_${lessonNumber}`;
}

function buildContentId(lessonId, blockIndex) {
  return `cnt_${lessonId}_${blockIndex}`;
}

function optionalAuthor(req) {
  const header = req.headers["x-actor-id"];
  const name = req.headers["x-actor-name"];
  if (header) return { id: String(header).slice(0, 100), name: name ? String(name).slice(0, 200) : "" };
  return { id: null, name: "" };
}

exports.getLessons = async (req, res) => {
  try {
    const { subject, courseCode, q } = req.query;
    const filter = {};
    if (subject && VALID_SUBJECTS.includes(subject)) filter.subject = subject;
    if (courseCode) filter.courseCode = courseCode;
    if (q && typeof q === "string" && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex }
      ];
    }
    const lessons = await Lesson.find(filter)
      .sort({ subject: 1, courseCode: 1, lessonNumber: 1, title: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: lessons });
  } catch (err) {
    log.error("getLessons failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to load lessons" });
  }
};

exports.getLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ success: false, error: "Lesson not found" });
    const blocks = await LessonContent.find({ lessonId: id })
      .sort({ blockIndex: 1 })
      .lean();
    res.json({ success: true, data: { ...lesson, blocks } });
  } catch (err) {
    log.error("getLesson failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to load lesson" });
  }
};

exports.createLesson = async (req, res) => {
  try {
    const sanitized = sanitizeLessonInput(req.body);
    if (!sanitized) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid `title` / `subject`"
      });
    }
    const author = optionalAuthor(req);
    const lessonNumber = sanitized.lessonNumber || 1;
    const _id = req.body?.id ? sanitizeString(req.body.id, 100) : buildLessonId(sanitized.courseCode, lessonNumber);
    const existing = await Lesson.findById(_id);
    if (existing) {
      return res.status(409).json({ success: false, error: "Lesson with this id already exists" });
    }
    const doc = await Lesson.create({
      _id,
      ...sanitized,
      createdBy: author.id,
      createdByName: author.name
    });
    res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    log.error("createLesson failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to create lesson" });
  }
};

exports.updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const sanitized = sanitizeLessonInput(req.body);
    if (!sanitized) {
      return res.status(400).json({ success: false, error: "Missing or invalid body" });
    }
    const updated = await Lesson.findByIdAndUpdate(id, sanitized, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: "Lesson not found" });
    res.json({ success: true, data: updated.toObject() });
  } catch (err) {
    log.error("updateLesson failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to update lesson" });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Lesson.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, error: "Lesson not found" });
    await LessonContent.deleteMany({ lessonId: id });
    res.json({ success: true, data: { id } });
  } catch (err) {
    log.error("deleteLesson failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to delete lesson" });
  }
};

exports.generateQR = async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ success: false, error: "Lesson not found" });
    const targetUrl =
      req.query.url || `${req.protocol}://${req.get("host")}/lesson/${id}`;
    const chartUrl = `https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${encodeURIComponent(
      String(targetUrl)
    )}&chld=M|0`;
    res.json({
      success: true,
      data: {
        lessonId: id,
        targetUrl,
        qrUrl: chartUrl,
        hint: "qrcode"
      }
    });
  } catch (err) {
    log.error("generateQR failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to generate QR" });
  }
};

exports.getContentBlocks = async (req, res) => {
  try {
    const { id } = req.params;
    const blocks = await LessonContent.find({ lessonId: id })
      .sort({ blockIndex: 1 })
      .lean();
    res.json({ success: true, data: blocks });
  } catch (err) {
    log.error("getContentBlocks failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to load content blocks" });
  }
};

exports.addContentBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ success: false, error: "Lesson not found" });
    const sanitized = sanitizeContentInput(req.body);
    if (!sanitized) {
      return res.status(400).json({ success: false, error: "Invalid blockType" });
    }
    const blockIndex = sanitized.blockIndex;
    const _id = req.body?.id ? sanitizeString(req.body.id, 100) : buildContentId(id, blockIndex);
    const existing = await LessonContent.findById(_id);
    if (existing) {
      return res.status(409).json({ success: false, error: "Content block already exists" });
    }
    const author = optionalAuthor(req);
    const doc = await LessonContent.create({
      _id,
      lessonId: id,
      lessonTitle: lesson.title,
      ...sanitized,
      createdBy: author.id,
      createdByName: author.name
    });
    res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    log.error("addContentBlock failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to add content block" });
  }
};

exports.updateContentBlock = async (req, res) => {
  try {
    const { contentId } = req.params;
    const existing = await LessonContent.findById(contentId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Content block not found" });
    }
    const sanitized = sanitizeContentInput(req.body);
    if (!sanitized) {
      return res.status(400).json({ success: false, error: "Invalid blockType" });
    }
    const updated = await LessonContent.findByIdAndUpdate(
      contentId,
      sanitized,
      { new: true }
    );
    res.json({ success: true, data: updated.toObject() });
  } catch (err) {
    log.error("updateContentBlock failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to update content block" });
  }
};

exports.deleteContentBlock = async (req, res) => {
  try {
    const { contentId } = req.params;
    const deleted = await LessonContent.findByIdAndDelete(contentId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Content block not found" });
    }
    res.json({ success: true, data: { id: contentId } });
  } catch (err) {
    log.error("deleteContentBlock failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to delete content block" });
  }
};
