// Email template for the per-teacher feedback reminder.
//
// Inputs:
//   teacherName      - string
//   pendingClasses   - [{ className, date, studentCount, isLate }]
//   dashboardUrl     - string (defaults to LMS base)
//   meta             - { dayKey, classSummary } (optional, included in return)
//
// Returns { subject, html, text }.

const VIETNAM_TZ = "Asia/Ho_Chi_Minh";

function formatVietnamDate(dateVal) {
  if (!dateVal) return "N/A";
  // dateVal may be "DD/MM/YYYY" or "YYYY-MM-DD..." — normalize first.
  let yyyyMmDd;
  if (typeof dateVal === "string" && dateVal.includes("/")) {
    const [d, m, y] = dateVal.split("/").map(Number);
    yyyyMmDd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  } else {
    yyyyMmDd = String(dateVal).split("T")[0];
  }
  // Anchor at noon Vietnam time to avoid DST/tz edge cases.
  const d = new Date(`${yyyyMmDd}T12:00:00+07:00`);
  if (isNaN(d.getTime())) return dateVal;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderClassListRow(cls) {
  const dateLabel = formatVietnamDate(cls.date);
  const statusBadge = cls.isLate
    ? `<span style="background:#d32f2f;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Quá hạn</span>`
    : `<span style="background:#f57c00;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Sắp tới hạn</span>`;
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <strong>${escapeHtml(cls.className)}</strong>
        <div style="color:#666;font-size:13px;margin-top:2px;">Buổi học ngày: ${escapeHtml(dateLabel)}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${cls.studentCount} HV</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${statusBadge}</td>
    </tr>
  `;
}

function renderReminderHtml({ teacherName, pendingClasses, dashboardUrl }) {
  const rows = pendingClasses.map(renderClassListRow).join("");
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width:640px;">
      <h2 style="color:#d32f2f;margin-bottom:8px;">Nhắc nhở: Đánh giá học viên sau buổi học</h2>
      <p>Chào ${escapeHtml(teacherName)},</p>
      <p>Hệ thống ghi nhận bạn có các buổi học đã kết thúc nhưng chưa hoàn thành việc đánh giá (chấm điểm / nhận xét) học viên trên hệ thống LMS. Việc đánh giá kịp thời giúp học viên và phụ huynh nắm bắt được tình hình học tập.</p>
      <p>Danh sách các buổi học cần đánh giá:</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;margin:12px 0;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #eee;">Lớp</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #eee;">HV chưa chấm</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #eee;">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="3" style="padding:12px;color:#666;text-align:center;">Không có buổi học nào cần chấm.</td></tr>`}
        </tbody>
      </table>
      <p>Vui lòng đăng nhập vào hệ thống LMS để hoàn thành việc đánh giá trong thời gian sớm nhất: <a href="${escapeHtml(dashboardUrl)}">${escapeHtml(dashboardUrl)}</a></p>
      <br/>
      <p>Trân trọng,</p>
      <p><strong>Hệ thống tự động MindX Support Tools</strong></p>
      <p style="color:#888;font-size:12px;"><em>Đây là email tự động, vui lòng không trả lời email này.</em></p>
    </div>
  `;
}

function renderReminderText({ teacherName, pendingClasses, dashboardUrl }) {
  const lines = [];
  lines.push("Nhac nho: Danh gia hoc vien sau buoi hoc");
  lines.push("");
  lines.push(`Chao ${teacherName || "ban"},`);
  lines.push("");
  lines.push(
    "He thong ghi nhan ban co cac buoi hoc da ket thuc nhung chua hoan thanh viec danh gia (cham diem / nhan xet) hoc vien tren he thong LMS.",
  );
  lines.push("");
  lines.push("Danh sach cac buoi hoc can danh gia:");
  lines.push("");
  for (const c of pendingClasses) {
    lines.push(
      `- ${c.className} (ngay ${formatVietnamDate(c.date)}): ${c.studentCount} HV chua cham - ${c.isLate ? "QUA HAN" : "sap toi han"}`,
    );
  }
  lines.push("");
  lines.push(`Vui long dang nhap: ${dashboardUrl}`);
  lines.push("");
  lines.push("He thong tu dong MindX Support Tools");
  lines.push("(Email nay tu dong, vui long khong tra loi.)");
  return lines.join("\n");
}

function renderReminderEmail({
  teacherName,
  pendingClasses,
  dashboardUrl,
  meta,
}) {
  const url =
    dashboardUrl || process.env.APP_DASHBOARD_URL || "https://lms.mindx.edu.vn";
  const safeClasses = Array.isArray(pendingClasses) ? pendingClasses : [];
  const lateCount = safeClasses.filter((c) => c.isLate).length;
  const total = safeClasses.length;
  const subject = `[MindX] Nhắc nhở: Bạn có ${total} buổi học cần đánh giá (${lateCount} quá hạn)`;
  return {
    subject,
    html: renderReminderHtml({
      teacherName,
      pendingClasses: safeClasses,
      dashboardUrl: url,
    }),
    text: renderReminderText({
      teacherName,
      pendingClasses: safeClasses,
      dashboardUrl: url,
    }),
    meta,
  };
}

module.exports = { renderReminderEmail, formatVietnamDate };
