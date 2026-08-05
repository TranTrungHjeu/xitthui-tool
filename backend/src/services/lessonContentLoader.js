const fs = require("fs");
const path = require("path");
const { childLogger } = require("../utils/logger");

const log = childLogger("LessonContentLoader");

// Path đến file export Firestore (được export từ sub-project).
// Có thể override bằng env FIREBASE_EXPORT_PATH.
const EXPORT_PATH = path.resolve(
  process.env.FIREBASE_EXPORT_PATH ||
    path.join(__dirname, "..", "..", "firebase-export.json"),
);

// Mapping: course code (trong MongoDB) -> subject id (trong Firestore export)
const COURSE_CODE_TO_SUBJECT = {
  // Coding
  SB: "scratch",
  SA: "scratch",
  SI: "scratch",
  GB: "game",
  GA: "game",
  GI: "game",
  PTB: "app",
  PTA: "app",
  PTI: "app",
  JSB: "web",
  JSA: "web",
  JSI: "web",
  CSB: "cs",
  CSA: "cs",
  CSI: "cs",

  // Robotics
  KIROB: "robotic-pre",
  PREB: "robotic-pre",
  PREA: "robotic-pre",
  PREI: "robotic-pre",
  ARMB: "robotic-arm",
  ARMA: "robotic-arm",
  ARMI: "robotic-arm",
  SEMIB: "robotic-semi",
  SEMIA: "robotic-semi",
  SEMII: "robotic-semi",
  AUTOA: "robotic-auto",
};

// Mapping: level name (course.code suffix B/A/I) -> level id (trong Firestore)
const LEVEL_CODE_TO_ID = {
  B: "basic",
  A: "advance",
  I: "intensive",
};

let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

/**
 * Đọc file JSON export 1 lần, cache trong memory.
 * Trả về { meta, lessons, class }.
 */
function loadExport() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  if (!fs.existsSync(EXPORT_PATH)) {
    log.warn(
      `[lesson] Không tìm thấy file export tại ${EXPORT_PATH}. Endpoint sẽ trả về rỗng.`,
    );
    cached = { meta: null, lessons: {}, class: {} };
    cachedAt = now;
    return cached;
  }

  try {
    const raw = fs.readFileSync(EXPORT_PATH, "utf8");
    const json = JSON.parse(raw);
    const collections = json.collections || {};

    cached = {
      meta: collections.meta?.documents?.[0] || null,
      // Mỗi document trong `lessons` có id = subjectId (game, app, web, ...)
      // và field `lessons` chứa dictionary { basic: [...], advance: [...], intensive: [...] }
      lessons: (collections.lessons?.documents || []).reduce((acc, doc) => {
        if (doc?.id && doc.lessons) {
          acc[doc.id] = doc.lessons;
        }
        return acc;
      }, {}),
      class: (collections.class?.documents || []).reduce((acc, doc) => {
        if (doc?.id) acc[doc.id] = doc;
        return acc;
      }, {}),
    };
    cachedAt = now;
    log.info(
      `[lesson] Đã load firebase-export.json: ${Object.keys(cached.class).length} class, ${Object.keys(cached.lessons).length} subject groups`,
    );
    return cached;
  } catch (err) {
    log.error(`[lesson] Lỗi khi đọc ${EXPORT_PATH}:`, err.message);
    cached = { meta: null, lessons: {}, class: {} };
    cachedAt = now;
    return cached;
  }
}

/**
 * Trích xuất subject id + level id từ course hoặc tên lớp
 * @param {{ course?: { code?: string, name?: string, shortName?: string }, name?: string }} cls
 * @returns {{ subjectId: string|null, levelId: string|null }}
 */
function detectSubjectLevel(cls) {
  if (!cls) return { subjectId: null, levelId: null };

  const codeFromCourse =
    cls.course?.code ||
    cls.course?.shortName ||
    cls.course?.name ||
    cls.name ||
    "";

  const upperCode = String(codeFromCourse).toUpperCase();

  // 1. Thử match trực tiếp từ COURSE_DICTIONARY codes
  let subjectId = null;
  let levelId = null;

  // Tìm code khóa học dài nhất match (VD: SEMIB > SEMI)
  const sortedCodes = Object.keys(COURSE_CODE_TO_SUBJECT).sort(
    (a, b) => b.length - a.length,
  );
  for (const code of sortedCodes) {
    const regex = new RegExp(`(^|[-_ .])${code}([-_ .]|$)`);
    if (regex.test(upperCode)) {
      subjectId = COURSE_CODE_TO_SUBJECT[code];

      // Lấy level từ suffix cuối của code
      const lastChar = code[code.length - 1];
      if (LEVEL_CODE_TO_ID[lastChar]) {
        levelId = LEVEL_CODE_TO_ID[lastChar];
      } else if (code === "KIROB") {
        levelId = "basic";
      } else if (code === "AUTOA") {
        levelId = "advance";
      }
      break;
    }
  }

  // 2. Fallback: từ course.name (case-insensitive contains)
  if (!subjectId) {
    const name = String(cls.course?.name || cls.name || "").toLowerCase();
    if (name.includes("scratch")) subjectId = "scratch";
    else if (name.includes("game")) subjectId = "game";
    else if (name.includes("app producer")) subjectId = "app";
    else if (name.includes("web")) subjectId = "web";
    else if (name.includes("computer scientist")) subjectId = "cs";
    else if (name.includes("robotic") && name.includes("arm")) subjectId = "robotic-arm";
    else if (name.includes("robotic") && name.includes("semi")) subjectId = "robotic-semi";
    else if (name.includes("robotic") && name.includes("auto")) subjectId = "robotic-auto";
    else if (name.includes("robotic") || name.includes("vex") || name.includes("pre"))
      subjectId = "robotic-pre";
  }

  // 3. Level fallback từ course.name
  if (!levelId) {
    const name = String(cls.course?.name || "").toLowerCase();
    if (name.includes("intensive")) levelId = "intensive";
    else if (name.includes("advanced") || name.includes("advance")) levelId = "advance";
    else if (name.includes("basic")) levelId = "basic";
  }

  return { subjectId, levelId };
}

/**
 * Lấy danh sách subjects + levels (cho filter)
 */
function getMeta() {
  const data = loadExport();
  if (!data.meta) {
    return { subjects: [], levels: [] };
  }
  return {
    subjects: data.meta.subjects || [],
    levels: data.meta.levels || [],
  };
}

/**
 * Lấy danh sách bài học theo subject + level
 */
function getLessons(subjectId, levelId) {
  const data = loadExport();
  if (!subjectId || !levelId) return [];
  const lessons = data.lessons[subjectId]?.[levelId] || [];
  // Sắp xếp theo id (numeric)
  return [...lessons].sort(
    (a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0),
  );
}

/**
 * Tự động load bài học theo thẻ lớp
 * @param {object} cls - class object từ MongoDB (có course, name)
 * @param {number} [sessionIndex] - số buổi (1-based) - nếu có sẽ auto-select buổi đó
 */
function getLessonsForClass(cls, sessionIndex) {
  const { subjectId, levelId } = detectSubjectLevel(cls);
  if (!subjectId || !levelId) {
    return {
      subjectId: null,
      levelId: null,
      subjectName: null,
      levelName: null,
      lessons: [],
      selectedLesson: null,
    };
  }

  const meta = getMeta();
  const subjectName = meta.subjects.find((s) => s.id === subjectId)?.name || subjectId;
  const levelName = meta.levels.find((l) => l.id === levelId)?.name || levelId;
  const lessons = getLessons(subjectId, levelId);

  let selectedLesson = null;
  if (sessionIndex && lessons.length > 0) {
    selectedLesson = lessons.find((l) => String(l.id) === String(sessionIndex)) || null;
  }

  return {
    subjectId,
    levelId,
    subjectName,
    levelName,
    lessons,
    selectedLesson,
  };
}

module.exports = {
  loadExport,
  detectSubjectLevel,
  getMeta,
  getLessons,
  getLessonsForClass,
};
