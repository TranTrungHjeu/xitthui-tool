/**
 * Catalog of Zalo message templates exposed by /zalo/templates.
 *
 * Each template declares:
 *   - id          stable identifier (sent from the client)
 *   - type        UI label kind ("reminder" | "warning" | "update" | "general")
 *   - label       Vietnamese display name
 *   - description short explanation
 *   - body        ordered array of message body parts. Each part is either a
 *                 literal line or a `{{placeholder}}` token the dynamic form
 *                 needs to fill. Format hint (* / ** / ***) drives the
 *                 Zalo preview styling via zaloFormat.formatLine.
 *   - fields      ordered list of placeholder definitions used by the
 *                 frontend DynamicForm to render the right inputs.
 *
 * Keep this list identical between backend and frontend (the frontend mirrors
 * a copy in `frontend/src/app/zalo-bot/components/zalo-format.ts`).
 */

const TEMPLATES = [
  {
    id: "lesson-reminder",
    type: "reminder",
    label: "Nhắc lịch học",
    description:
      "Gửi nhắc nhở học sinh về buổi học sắp tới (ngày, giờ, lớp).",
    body: [
      "***LỊCH HỌC SẮP TỚI***",
      "Chào phụ huynh/anh chị,",
      "MindX xin thông báo lịch học của con như sau:",
      "**Học sinh:** {{studentName}}",
      "**Lớp:** {{className}}",
      "**Ngày:** {{date}}",
      "**Giờ:** {{time}}",
      "*Xin anh/chị sắp xếp để con đi học đúng giờ. Trân trọng!*",
    ],
    fields: [
      { key: "studentName", label: "Tên học sinh", required: true },
      { key: "className", label: "Tên lớp", required: true },
      { key: "date", label: "Ngày học (dd/mm/yyyy)", required: true },
      { key: "time", label: "Giờ học (HH:mm)", required: true },
    ],
  },
  {
    id: "attendance-warning",
    type: "warning",
    label: "Cảnh báo chuyên cần",
    description:
      "Nhắc nhở khi học sinh vắng / đi trễ nhiều buổi liên tiếp.",
    body: [
      "***THÔNG BÁO CHUYÊN CẦN***",
      "Kính gửi phụ huynh/anh chị,",
      "MindX ghi nhận con {{studentName}} đã {{absentCount}} buổi liên tiếp vắng/đi trễ.",
      "**Lớp:** {{className}}",
      "**Buổi vắng gần nhất:** {{lastAbsentDate}}",
      "*Rất mong phụ huynh phối hợp để con theo kịp chương trình. Trân trọng!*",
    ],
    fields: [
      { key: "studentName", label: "Tên học sinh", required: true },
      { key: "absentCount", label: "Số buổi vắng/đi trễ", required: true },
      { key: "className", label: "Tên lớp", required: true },
      { key: "lastAbsentDate", label: "Ngày vắng gần nhất (dd/mm/yyyy)", required: true },
    ],
  },
  {
    id: "parent-update",
    type: "update",
    label: "Cập nhật cho phụ huynh",
    description: "Thông tin tiến độ / nội dung buổi học gửi phụ huynh.",
    body: [
      "***CẬP NHẬT TIẾN ĐỘ HỌC TẬP***",
      "Kính gửi phụ huynh,",
      "Buổi học gần nhất của {{studentName}} ({{className}}) đã hoàn thành với các nội dung:",
      "**Ngày:** {{date}}",
      "**Nội dung chính:**",
      "{{summary}}",
      "*Anh/chị có thắc mắc xin phản hồi lại tin nhắn. Trân trọng!*",
    ],
    fields: [
      { key: "studentName", label: "Tên học sinh", required: true },
      { key: "className", label: "Tên lớp", required: true },
      { key: "date", label: "Ngày học (dd/mm/yyyy)", required: true },
      { key: "summary", label: "Tóm tắt nội dung buổi học", required: true, multiline: true },
    ],
  },
  {
    id: "general",
    type: "general",
    label: "Tin nhắn chung",
    description: "Tin nhắn tự do — nhập nội dung bất kỳ.",
    body: ["{{message}}"],
    fields: [
      { key: "message", label: "Nội dung tin nhắn", required: true, multiline: true },
    ],
  },
];

const DEFAULT_TEMPLATE_ID = "lesson-reminder";

const findTemplate = (id) =>
  TEMPLATES.find((t) => t.id === id) || null;

/**
 * Build the fully-rendered text (with the actual field values substituted)
 * for a given template + input fields. Missing required fields become
 * `{{key}}` placeholders so the user can spot them in the preview.
 */
const renderTemplate = (templateId, values) => {
  const tpl = findTemplate(templateId);
  if (!tpl) return "";
  return tpl.body
    .map((line) => {
      return String(line).replace(/\{\{([\w]+)\}\}/g, (_, key) => {
        const v = values && values[key];
        if (v === undefined || v === null || v === "") return `{{${key}}}`;
        return String(v);
      });
    })
    .join("\n");
};

const validateInput = (templateId, values) => {
  const tpl = findTemplate(templateId);
  if (!tpl) {
    return { valid: false, error: `Template not found: ${templateId}` };
  }
  const missing = [];
  for (const field of tpl.fields) {
    if (!field.required) continue;
    const v = values && values[field.key];
    if (v === undefined || v === null || String(v).trim() === "") {
      missing.push(field.key);
    }
  }
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Thiếu trường bắt buộc: ${missing.join(", ")}`,
      missing,
    };
  }
  return { valid: true };
};

module.exports = {
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  findTemplate,
  renderTemplate,
  validateInput,
};
