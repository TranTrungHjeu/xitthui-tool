// Email template for the weekly per-centre digest (sent to TEs on Monday 8am VN).
//
// Inputs:
//   centreName    - string (e.g. "Thủ Dầu Một")
//   weekRange     - { fromDate, toDate } both formatted as "DD/MM/YYYY"
//   byTeacher     - [{ teacherName, classes: [{ className, date, studentCount, isLate }] }]
//   dashboardUrl  - string
//
// Returns { subject, html, text }.

const { formatVietnamDate } = require("./reminder");

function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderClassRow(cls) {
  const dateLabel = formatVietnamDate(cls.date);
  const statusBadge = cls.isLate
    ? `<span style="background:#d32f2f;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">Quá hạn</span>`
    : `<span style="background:#f57c00;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">Sắp tới hạn</span>`;
  return `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(cls.className)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(dateLabel)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${cls.studentCount}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${statusBadge}</td>
    </tr>
  `;
}

function renderTeacherBlock(teacher) {
  const rows = teacher.classes.map(renderClassRow).join("");
  const lateCount = teacher.classes.filter((c) => c.isLate).length;
  return `
    <h3 style="margin:24px 0 8px 0;color:#333;border-bottom:2px solid #eee;padding-bottom:4px;">
      ${escapeHtml(teacher.teacherName || "Không rõ giáo viên")}
      <span style="font-size:13px;color:#666;font-weight:400;margin-left:8px;">
        ${teacher.classes.length} buổi · ${lateCount} quá hạn
      </span>
    </h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;margin-bottom:8px;">
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #eee;">Lớp</th>
          <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #eee;">Ngày</th>
          <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #eee;">HV chưa chấm</th>
          <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #eee;">Trạng thái</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderDigestHtml({ centreName, weekRange, byTeacher, dashboardUrl }) {
  const blocks = byTeacher.map(renderTeacherBlock).join("");
  const totalClasses = byTeacher.reduce((sum, t) => sum + t.classes.length, 0);
  const totalLate = byTeacher.reduce(
    (sum, t) => sum + t.classes.filter((c) => c.isLate).length,
    0,
  );

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width:720px;">
      <h2 style="color:#1976d2;margin-bottom:4px;">Tổng hợp tuần: Trung tâm ${escapeHtml(centreName)}</h2>
      <p style="color:#666;margin-top:0;">${escapeHtml(weekRange.fromDate)} – ${escapeHtml(weekRange.toDate)}</p>
      <p>Tuần qua, hệ thống ghi nhận <strong>${totalClasses} buổi học</strong> chưa được chấm điểm (trong đó <strong style="color:#d32f2f;">${totalLate} buổi đã quá hạn 48h</strong>) thuộc trung tâm ${escapeHtml(centreName)}.</p>
      ${blocks || `<p style="color:#666;">Không có buổi học nào cần nhắc nhở tuần qua.</p>`}
      <p>Mở dashboard để xem chi tiết: <a href="${escapeHtml(dashboardUrl)}">${escapeHtml(dashboardUrl)}</a></p>
      <br/>
      <p style="color:#888;font-size:12px;"><em>Email tự động gửi mỗi Thứ Hai 8:00 sáng theo giờ Việt Nam. Vui lòng không trả lời.</em></p>
    </div>
  `;
}

function renderDigestText({ centreName, weekRange, byTeacher, dashboardUrl }) {
  const lines = [];
  lines.push(`Tong hop tuan: Trung tam ${centreName}`);
  lines.push(`${weekRange.fromDate} - ${weekRange.toDate}`);
  lines.push("");
  for (const teacher of byTeacher) {
    lines.push(`GV: ${teacher.teacherName || "Khong ro"}`);
    for (const c of teacher.classes) {
      lines.push(
        `  - ${c.className} (${formatVietnamDate(c.date)}): ${c.studentCount} HV - ${c.isLate ? "QUA HAN" : "sap toi han"}`,
      );
    }
    lines.push("");
  }
  lines.push(`Dashboard: ${dashboardUrl}`);
  return lines.join("\n");
}

function renderWeeklyDigestEmail({
  centreName,
  weekRange,
  byTeacher,
  dashboardUrl,
}) {
  const url =
    dashboardUrl || process.env.APP_DASHBOARD_URL || "https://lms.mindx.edu.vn";
  const totalClasses = byTeacher.reduce((sum, t) => sum + t.classes.length, 0);
  const totalLate = byTeacher.reduce(
    (sum, t) => sum + t.classes.filter((c) => c.isLate).length,
    0,
  );
  const subject = `[MindX] Tổng hợp tuần ${centreName} (${weekRange.fromDate} – ${weekRange.toDate}): ${totalClasses} buổi (${totalLate} quá hạn)`;
  return {
    subject,
    html: renderDigestHtml({ centreName, weekRange, byTeacher, dashboardUrl: url }),
    text: renderDigestText({ centreName, weekRange, byTeacher, dashboardUrl: url }),
  };
}

module.exports = { renderWeeklyDigestEmail };
