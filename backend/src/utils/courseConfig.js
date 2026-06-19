/**
 * Cấu hình các khoá học MindX và quy định buổi kiểm tra (Checkpoint / Demo)
 *
 * 3 danh mục lớp: coding, robotics, art
 *
 * Quy định:
 * - Coding & Art: Checkpoint 1 = buổi 5, Checkpoint 2 = buổi 9, Demo = buổi 14
 * - Robotics: Checkpoint 1 = buổi 4, Checkpoint 2 = buổi 8, Demo = buổi 14
 */

const COURSE_DICTIONARY = {
  // CODING - Scratch Creator
  SB: { code: "SB", name: "Scratch Creator Basic", category: "coding" },
  SA: { code: "SA", name: "Scratch Creator Advanced", category: "coding" },
  SI: { code: "SI", name: "Scratch Creator Intensive", category: "coding" },

  // CODING - Game Creator
  GB: { code: "GB", name: "Game Creator Basic", category: "coding" },
  GA: { code: "GA", name: "Game Creator Advanced", category: "coding" },
  GI: { code: "GI", name: "Game Creator Intensive", category: "coding" },

  // CODING - App Producer
  PTB: { code: "PTB", name: "App Producer Basic", category: "coding" },
  PTA: { code: "PTA", name: "App Producer Advanced", category: "coding" },
  PTI: { code: "PTI", name: "App Producer Intensive", category: "coding" },

  // CODING - Web Developer
  JSB: { code: "JSB", name: "Web Developer Basic", category: "coding" },
  JSA: { code: "JSA", name: "Web Developer Advanced", category: "coding" },
  JSI: { code: "JSI", name: "Web Developer Intensive", category: "coding" },

  // CODING - Computer Scientist
  CSB: { code: "CSB", name: "Computer Scientist Basic", category: "coding" },
  CSA: { code: "CSA", name: "Computer Scientist Advanced", category: "coding" },
  CSI: {
    code: "CSI",
    name: "Computer Scientist Intensive",
    category: "coding",
  },

  // ROBOTICS
  KIROB: { code: "KIROB", name: "Robotics 4+ (Vex 123)", category: "robotics" },

  PREB: { code: "PREB", name: "Pre Basic", category: "robotics" },
  PREA: { code: "PREA", name: "Pre Advanced", category: "robotics" },
  PREI: { code: "PREI", name: "Pre Intensive", category: "robotics" },

  ARMB: { code: "ARMB", name: "Arm Basic", category: "robotics" },
  ARMA: { code: "ARMA", name: "Arm Advanced", category: "robotics" },
  ARMI: { code: "ARMI", name: "Arm Intensive", category: "robotics" },

  SEMIB: { code: "SEMIB", name: "Semi Basic", category: "robotics" },
  SEMIA: { code: "SEMIA", name: "Semi Advanced", category: "robotics" },
  SEMII: { code: "SEMII", name: "Semi Intensive", category: "robotics" },

  AUTOA: { code: "AUTOA", name: "Auto Advanced", category: "robotics" },

  // ART (Mã đầu có thể có XART)
  KAB: { code: "KAB", name: "Kids Art Basic", category: "art" },
  KAA: { code: "KAA", name: "Kids Art Advanced", category: "art" },
  KAI: { code: "KAI", name: "Kids Art Intensive", category: "art" },

  VAB: { code: "VAB", name: "Visual Art Basic", category: "art" },
  VAA: { code: "VAA", name: "Visual Art Advanced", category: "art" },
  VAI: { code: "VAI", name: "Visual Art Intensive", category: "art" },

  VCB: { code: "VCB", name: "Visual Creation Basic", category: "art" },
  VCA: { code: "VCA", name: "Visual Creation Advanced", category: "art" },
  VCI: { code: "VCI", name: "Visual Creation Intensive", category: "art" },

  GDB: { code: "GDB", name: "Graphic Design Basic", category: "art" },
  GDA: { code: "GDA", name: "Graphic Design Advanced", category: "art" },
  GDI: { code: "GDI", name: "Graphic Design Intensive", category: "art" },

  MDB: { code: "MDB", name: "Multimedia Design Basic", category: "art" },
  MDA: { code: "MDA", name: "Multimedia Design Advanced", category: "art" },
  MDI: { code: "MDI", name: "Multimedia Design Intensive", category: "art" },

  DAB: { code: "DAB", name: "Digital Animation Basic", category: "art" },
  DAA: { code: "DAA", name: "Digital Animation Advanced", category: "art" },
  DAI: { code: "DAI", name: "Digital Animation Intensive", category: "art" },

  IDB: { code: "IDB", name: "Interaction Design Basic", category: "art" },
  IDA: { code: "IDA", name: "Interaction Design Advanced", category: "art" },
  IDI: { code: "IDI", name: "Interaction Design Intensive", category: "art" },
};

/**
 * Trích xuất mã khoá học từ tên lớp (VD: "XART-VAA-02.TDM" -> "VAA")
 * @param {string} className
 * @returns {string}
 */
function extractCourseCode(className) {
  if (!className) return "";
  const upperName = className.toUpperCase();

  const keys = Object.keys(COURSE_DICTIONARY).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of keys) {
    if (upperName.includes(key)) {
      const regex = new RegExp(`(^|[-_ .])${key}([-_ .]|$)`);
      if (regex.test(upperName)) {
        return key;
      }
    }
  }

  return "";
}

/**
 * Lấy danh mục của khoá học (coding, robotics, art, unknown)
 * @param {string} courseCodeOrClassName
 * @returns {"coding"|"robotics"|"art"|"unknown"}
 */
function getCourseCategory(courseCodeOrClassName) {
  const code =
    extractCourseCode(courseCodeOrClassName) ||
    courseCodeOrClassName.toUpperCase();

  if (COURSE_DICTIONARY[code]) {
    return COURSE_DICTIONARY[code].category;
  }

  if (courseCodeOrClassName.toUpperCase().includes("XART")) return "art";
  if (courseCodeOrClassName.toUpperCase().includes("RBT")) return "robotics";

  return "unknown";
}

/**
 * Lấy thông tin buổi checkpoint và demo dựa vào loại khoá học
 * @param {string} courseCodeOrClassName
 * @returns {{ checkpoint1: number, checkpoint2: number, demo: number }}
 */
function getCourseMilestones(courseCodeOrClassName) {
  const category = getCourseCategory(courseCodeOrClassName);

  if (category === "robotics") {
    return { checkpoint1: 4, checkpoint2: 8, demo: 14 };
  }

  return { checkpoint1: 5, checkpoint2: 9, demo: 14 };
}

/**
 * Kiểm tra buổi thứ `sessionIndex` có phải buổi kiểm tra hay không
 * @param {string} courseCodeOrClassName
 * @param {number} sessionIndex - số buổi (1-based)
 * @returns {"checkpoint1"|"checkpoint2"|"demo"|null}
 */
function getSessionExamType(courseCodeOrClassName, sessionIndex) {
  const milestones = getCourseMilestones(courseCodeOrClassName);

  if (sessionIndex === milestones.checkpoint1) return "checkpoint1";
  if (sessionIndex === milestones.checkpoint2) return "checkpoint2";
  if (sessionIndex === milestones.demo) return "demo";

  return null;
}

/**
 * Trả về nhãn mô tả thân thiện cho buổi học
 * @param {string} courseCodeOrClassName
 * @param {number} sessionIndex
 * @returns {string}
 */
function getSessionExamLabel(courseCodeOrClassName, sessionIndex) {
  const type = getSessionExamType(courseCodeOrClassName, sessionIndex);
  if (type === "checkpoint1") return "Checkpoint 1";
  if (type === "checkpoint2") return "Checkpoint 2";
  if (type === "demo") return "Demo Cuối Khóa";
  return `Buổi ${sessionIndex}`;
}

module.exports = {
  COURSE_DICTIONARY,
  extractCourseCode,
  getCourseCategory,
  getCourseMilestones,
  getSessionExamType,
  getSessionExamLabel,
};
