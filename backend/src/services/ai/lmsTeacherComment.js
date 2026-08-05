/**
 * LMS Teacher Comment AI Service
 *
 * Port of sub-project `ai-core/agents/lms-teacher-comment.ts` to Node.js
 * using the existing Vertex AI client (`@google-cloud/vertexai`).
 *
 * The service takes raw teacher observations + a criteria template and
 * returns a polished, parent-facing Vietnamese teacher comment in markdown
 * format. It is intentionally self-contained and stateless so it can be
 * called from controllers, schedulers, or future agent runtimes.
 *
 * Output contract:
 *   {
 *     text: string,         // final formatted comment (markdown)
 *     sections: string[],   // detected section titles
 *     raw: string           // unprocessed model response (for debugging)
 *   }
 *
 * The service never throws on model errors — it returns a fallback string
 * with `text: null` so the controller can map it to a 200 with a graceful
 * `aiUnavailable: true` flag instead of a 500.
 */

const { VertexAI } = require("@google-cloud/vertexai");
const { loadServiceAccountCredentials } = require("../../utils/googleCredentials");
const { childLogger } = require("../../utils/logger.js");

const log = childLogger("LmsTeacherCommentAI");

// -----------------------------------------------------------------------------
// Vertex AI bootstrap (mirrors the pattern from controllers/class/_shared.js).
// Lazily initialised so missing credentials don't crash module load.
// -----------------------------------------------------------------------------
let generativeModel = null;
let initError = null;

function ensureModel() {
  if (generativeModel) return generativeModel;
  if (initError) throw initError;

  let credentials = null;
  try {
    credentials = loadServiceAccountCredentials();
  } catch (err) {
    initError = new Error(
      `Vertex AI credentials unavailable: ${err.message}`,
    );
    throw initError;
  }

  if (!credentials) {
    initError = new Error(
      "Vertex AI credentials not configured (set GOOGLE_SERVICE_ACCOUNT_BASE64 or GOOGLE_APPLICATION_CREDENTIALS).",
    );
    throw initError;
  }

  const vertexAI = new VertexAI({
    project: process.env.VERTEX_AI_PROJECT_ID || "xitthui-tool",
    location: process.env.VERTEX_AI_LOCATION || "us-central1",
    googleAuthOptions: {
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  generativeModel = vertexAI.getGenerativeModel({
    model: process.env.LMS_AI_MODEL || "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      topP: 0.95,
    },
  });

  log.info("[LmsTeacherCommentAI] Vertex AI model initialised.");
  return generativeModel;
}

// -----------------------------------------------------------------------------
// System prompt (Vietnamese teacher voice; matches sub-project
// `LMS_TEACHER_COMMENT_SYSTEM_PROMPT`).
// -----------------------------------------------------------------------------
const SYSTEM_PROMPT = `Bạn là giáo viên lâu năm tại trung tâm lập trình thiếu nhi, viết nhận xét gửi phụ huynh sau mỗi buổi học. Phong cách: thẳng thắn, rõ ràng, chuyên nghiệp. Không tâng bốc, không văn chương. Nói đúng thực tế, kèm hướng cải thiện cụ thể khi cần.

Người đọc duy nhất là phụ huynh.
- Chủ thể hành động trong khuyến nghị: "em" hoặc "phụ huynh"
- KHÔNG viết "giáo viên cần / giáo viên sẽ..." — đây là thông tin nội bộ

Một mục chỉ xuất ra output khi thỏa ÍT NHẤT MỘT:
  A. Có trong "Nhận xét hiện tại" (ghi chú thô của GV)
  B. Được đề cập trong "Yêu cầu cải thiện"

Cấu trúc mỗi bullet (2–3 câu):
  Câu 1: Nhận định cụ thể — em làm được gì / chưa làm được gì
  Câu 2: Bằng chứng / ngữ cảnh
  Câu 3: Hướng cải thiện (nếu cần) — chủ thể là em hoặc phụ huynh

Cấm dùng:
  - Tâng bốc: "hành trình", "chinh phục tri thức", "đáng trân trọng", "tràn đầy nhiệt huyết"
  - Ghi chú thô chưa chỉnh: "Em sai nhiều.", "Không hiểu bài."
  - Câu mơ hồ: "Em cần cố gắng hơn."
  - Chỉ đạo nội bộ: "Giáo viên cần..."

Từ gợi ý:
  Tiến bộ: "nắm được", "áp dụng được", "ổn định hơn", "tự xử lý được"
  Cần cải thiện: "còn lúng túng", "chưa ổn định", "hay bỏ sót", "cần nhắc"
  Hành động: "Em cần...", "Em nên...", "Phụ huynh có thể nhắc em..."

ĐỊNH DẠNG OUTPUT:
Chỉ trả về nhận xét. Không giải thích, không preamble, không thẻ XML.

Tên tiêu chí
- Nhận xét hoàn chỉnh

Tên tiêu chí tiếp theo
- Nhận xét hoàn chỉnh`;

// -----------------------------------------------------------------------------
// Default fallback criteria when callers don't pass one.
// -----------------------------------------------------------------------------
const DEFAULT_CRITERIA = {
  coding: [
    {
      title: "Tư duy lập trình",
      criteria: [
        { id: "td_lt", label: "Tư duy lập trình" },
        { id: "kh_nt", label: "Khả năng tiếp thu" },
      ],
    },
    {
      title: "Kỹ năng thực hành",
      criteria: [
        { id: "kn_th", label: "Kỹ năng thực hành" },
        { id: "kn_lt", label: "Kỹ năng làm việc nhóm" },
      ],
    },
    {
      title: "Định hướng tiếp theo",
      criteria: [{ id: "dh_tt", label: "Định hướng tiếp theo" }],
    },
  ],
  robotic: [
    {
      title: "Tư duy kỹ thuật",
      criteria: [
        { id: "td_kt", label: "Tư duy kỹ thuật" },
        { id: "td_lt", label: "Tư duy lập trình" },
      ],
    },
    {
      title: "Kỹ năng thực hành",
      criteria: [
        { id: "kn_lk", label: "Kỹ năng lắp ráp" },
        { id: "kn_lt", label: "Kỹ năng làm việc nhóm" },
      ],
    },
  ],
  art: [
    {
      title: "Tư duy sáng tạo",
      criteria: [
        { id: "td_st", label: "Tư duy sáng tạo" },
        { id: "kn_th", label: "Kỹ năng thực hành" },
      ],
    },
    {
      title: "Thẩm mỹ",
      criteria: [{ id: "th_my", label: "Thẩm mỹ" }],
    },
  ],
  general: [
    {
      title: "Đánh giá chung",
      criteria: [
        { id: "tt_ch", label: "Tinh thần tham gia" },
        { id: "kn_th", label: "Kỹ năng thực hành" },
      ],
    },
  ],
};

function getDefaultCriteria(subject) {
  return DEFAULT_CRITERIA[subject] || DEFAULT_CRITERIA.general;
}

// -----------------------------------------------------------------------------
// Prompt builder
// -----------------------------------------------------------------------------
function buildUserPrompt({ studentName, sessionNumber, criteria, rawNote, historyContext, criteriaTemplateName }) {
  const parts = [];

  if (studentName) parts.push(`Thông tin học sinh: ${studentName}`);
  if (sessionNumber) parts.push(`Buổi học hiện tại: Buổi ${sessionNumber}`);

  if (criteria && Array.isArray(criteria) && criteria.length > 0) {
    let block = `\nBộ tiêu chí: ${criteriaTemplateName || "Mặc định"}\nCấu trúc tiêu chí:\n`;
    criteria.forEach((section) => {
      block += `\n[${section.title}]\n`;
      (section.criteria || []).forEach((c) => {
        const label = c.label || c.id || "";
        const value = c.value ? `: ${c.value}` : "";
        block += `- ${label}${value}\n`;
      });
    });
    block += "\n(Đây là CẤU TRÚC DUY NHẤT trong output. Không được thêm, bớt, hoặc đổi tên mục.)";
    parts.push(block);
  }

  if (historyContext) parts.push(historyContext);

  if (rawNote) parts.push(`\nNhận xét hiện tại của giáo viên:\n${rawNote}`);

  return parts.join("\n");
}

function buildHistoryContext(historyItems) {
  if (!Array.isArray(historyItems) || historyItems.length === 0) return "";
  let ctx = "\n\nLịch sử nhận xét các buổi học trước:\n";
  historyItems.forEach((item) => {
    if (!item) return;
    const { session, comment } = item;
    if (!comment) return;
    ctx += `\nBuổi ${session || "?"}:\n${comment}\n`;
  });
  return ctx;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Generate a teacher comment using Gemini.
 *
 * @param {Object} options
 * @param {string} [options.studentName]   - Student's full name (optional)
 * @param {number} [options.sessionNumber] - Current session index
 * @param {string} [options.rawNote]       - Raw observation from teacher
 * @param {Array}  [options.criteria]      - Criteria sections [{title, criteria:[{label,value,id}]}]
 * @param {string} [options.criteriaTemplateName]
 * @param {Array}  [options.history]       - [{session, comment}] older notes
 * @param {string} [options.subject]       - 'coding' | 'robotic' | 'art' | 'general'
 * @returns {Promise<{text: string, sections: string[], raw: string, aiUnavailable?: boolean}>}
 */
async function generateTeacherComment({
  studentName,
  sessionNumber,
  rawNote,
  criteria,
  criteriaTemplateName,
  history,
  subject,
} = {}) {
  const effectiveSubject = subject || "general";
  const effectiveCriteria =
    Array.isArray(criteria) && criteria.length > 0
      ? criteria
      : getDefaultCriteria(effectiveSubject);

  const userPrompt = buildUserPrompt({
    studentName,
    sessionNumber,
    criteria: effectiveCriteria,
    rawNote,
    historyContext: buildHistoryContext(history),
    criteriaTemplateName,
  });

  let model;
  try {
    model = ensureModel();
  } catch (err) {
    log.warn("[LmsTeacherCommentAI] Model not available: %s", err.message);
    return {
      text: null,
      sections: [],
      raw: "",
      aiUnavailable: true,
      reason: err.message,
    };
  }

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
    });

    const response = result?.response;
    const raw = (response?.text?.() || "").trim();

    if (!raw) {
      log.warn("[LmsTeacherCommentAI] Empty response from model");
      return {
        text: null,
        sections: [],
        raw: "",
        aiUnavailable: true,
        reason: "empty-response",
      };
    }

    const sections = extractSectionTitles(raw);
    return { text: raw, sections, raw };
  } catch (err) {
    log.error("[LmsTeacherCommentAI] generateContent failed: %s", err.message);
    return {
      text: null,
      sections: [],
      raw: "",
      aiUnavailable: true,
      reason: err.message,
    };
  }
}

/**
 * Quick free-form chat with the AI for the LMS chatbox tab.
 *
 * @param {Object} options
 * @param {string} options.userMessage
 * @param {Array}  [options.history]  - [{role:'user'|'assistant', content:string}]
 * @param {string} [options.systemPrompt]
 * @returns {Promise<{text: string|null, aiUnavailable?: boolean}>}
 */
async function chat({ userMessage, history, systemPrompt } = {}) {
  if (!userMessage || !String(userMessage).trim()) {
    return { text: null, aiUnavailable: false };
  }

  let model;
  try {
    model = ensureModel();
  } catch (err) {
    log.warn("[LmsTeacherCommentAI] chat: model unavailable: %s", err.message);
    return { text: null, aiUnavailable: true, reason: err.message };
  }

  const sysPrompt =
    systemPrompt ||
    `Bạn là trợ lý AI thông minh hỗ trợ giáo viên trong hệ thống LMS.
Bạn có thể hỗ trợ:
- Soạn nhận xét học viên theo phong cách chuyên nghiệp
- Tư vấn phương pháp giảng dạy coding, robotics, art
- Giải thích các khái niệm giáo dục
- Gợi ý cách cải thiện bài dạy

Trả lời ngắn gọn, rõ ràng, thân thiện bằng tiếng Việt.`;

  const contents = [];
  if (Array.isArray(history)) {
    history.forEach((m) => {
      if (!m || !m.content) return;
      const role = m.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: String(m.content) }] });
    });
  }
  contents.push({ role: "user", parts: [{ text: String(userMessage) }] });

  try {
    const result = await model.generateContent({
      contents,
      systemInstruction: {
        role: "system",
        parts: [{ text: sysPrompt }],
      },
    });
    const text = (result?.response?.text?.() || "").trim();
    if (!text) {
      return { text: null, aiUnavailable: true, reason: "empty-response" };
    }
    return { text };
  } catch (err) {
    log.error("[LmsTeacherCommentAI] chat failed: %s", err.message);
    return { text: null, aiUnavailable: true, reason: err.message };
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function extractSectionTitles(text) {
  if (!text) return [];
  const titles = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.length > 80) continue;
    titles.push(trimmed);
  }
  return titles;
}

module.exports = {
  generateTeacherComment,
  chat,
  getDefaultCriteria,
  // Exported for tests / future internal callers
  _internal: {
    buildUserPrompt,
    buildHistoryContext,
    extractSectionTitles,
  },
};
