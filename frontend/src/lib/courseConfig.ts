export type CourseCategory = "coding" | "robotics" | "art" | "unknown";

export interface CourseLevel {
  code: string;
  name: string;
  category: CourseCategory;
}

export const COURSE_DICTIONARY: Record<string, CourseLevel> = {
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

export interface CheckpointInfo {
  checkpoint1: number;
  checkpoint2: number;
  demo: number;
}

/**
 * Trích xuất mã khoá học từ tên lớp (VD: "XART-VAA-02.TDM" -> "VAA")
 */
export function extractCourseCode(className: string): string {
  if (!className) return "";
  const upperName = className.toUpperCase();

  // Sắp xếp keys theo chiều dài giảm dần để ưu tiên match chuỗi dài hơn trước (nếu có trùng lặp)
  const keys = Object.keys(COURSE_DICTIONARY).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of keys) {
    if (upperName.includes(key)) {
      // Đảm bảo match chính xác ranh giới từ (ví dụ không match 'SA' trong 'JSA')
      const regex = new RegExp(`(^|[-_ .])${key}([-_ .]|$)`);
      if (regex.test(upperName)) {
        return key;
      }
    }
  }

  return "";
}

/**
 * Lấy danh mục của khoá học (coding, robotics, art)
 */
export function getCourseCategory(
  courseCodeOrClassName: string,
): CourseCategory {
  const code =
    extractCourseCode(courseCodeOrClassName) ||
    courseCodeOrClassName.toUpperCase();

  if (COURSE_DICTIONARY[code]) {
    return COURSE_DICTIONARY[code].category;
  }

  // Fallback heuristics
  if (courseCodeOrClassName.toUpperCase().includes("XART")) return "art";
  if (courseCodeOrClassName.toUpperCase().includes("RBT")) return "robotics";

  return "unknown";
}

/**
 * Lấy thông tin buổi học của các bài kiểm tra (checkpoint, demo) dựa vào loại khoá học
 */
export function getCourseMilestones(
  courseCodeOrClassName: string,
): CheckpointInfo {
  const category = getCourseCategory(courseCodeOrClassName);

  if (category === "robotics") {
    // RBT robotics sẽ là buổi 4 và buổi 8, demo buổi 14
    return {
      checkpoint1: 4,
      checkpoint2: 8,
      demo: 14,
    };
  }

  // Các môn Coding và Art: buổi 5 và 9, demo buổi 14
  return {
    checkpoint1: 5,
    checkpoint2: 9,
    demo: 14,
  };
}

/**
 * Kiểm tra xem buổi học thứ `sessionIndex` có phải là buổi kiểm tra hay không
 */
export function getSessionExamType(
  courseCodeOrClassName: string,
  sessionIndex: number,
): "checkpoint1" | "checkpoint2" | "demo" | null {
  const milestones = getCourseMilestones(courseCodeOrClassName);

  if (sessionIndex === milestones.checkpoint1) return "checkpoint1";
  if (sessionIndex === milestones.checkpoint2) return "checkpoint2";
  if (sessionIndex === milestones.demo) return "demo";

  return null;
}

/**
 * Trả về chuỗi mô tả thân thiện của buổi học
 */
export function getSessionExamLabel(
  courseCodeOrClassName: string,
  sessionIndex: number,
): string {
  const type = getSessionExamType(courseCodeOrClassName, sessionIndex);
  if (type === "checkpoint1") return "Checkpoint 1";
  if (type === "checkpoint2") return "Checkpoint 2";
  if (type === "demo") return "Demo Cuối Khóa";
  return `Buổi ${sessionIndex}`;
}
