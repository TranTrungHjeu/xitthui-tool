// Email template for the payroll-issue report sent from TE thekhiem
// to the Tech team when GV TDM have flagged "Uncheck vô lý" rows.
//
// Inputs (callers come from the controller):
//   periodLabel      - string, e.g. "Công GV T7/2026"
//   centreName       - string, e.g. "Thủ Dầu Một"
//   lines            - [{ teacherName, className, slotTime, reason }]
//   customIntro      - string (HTML allowed), opens the email body. Optional.
//   customConclusion - string (HTML allowed), closes the email body. Optional.
//   dashboardUrl     - string
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

function buildIntroHtml({ customIntro, centreName, periodLabel, totalLines }) {
  if (customIntro && customIntro.trim()) return customIntro;
  return (
    `<p>Dear team,</p>` +
    `<p>Trước tiên, gửi tới team Tech bảng tổng hợp công lương ` +
    `trung tâm <strong>${escapeHtml(centreName)}</strong> ` +
    `kỳ <strong>${escapeHtml(periodLabel)}</strong> vẫn còn ` +
    `<strong style="color:#d32f2f;">${totalLines} dòng công Uncheck vô lý</strong> ` +
    `do GV TDM phát hiện và báo lại.</p>` +
    `<p>Đề nghị team review và xử lý các dòng sai lệch dưới đây. ` +
    `Nếu cần làm rõ thêm lý do, vui lòng phản hồi email này.</p>`
  );
}

function buildConclusionHtml({ customConclusion }) {
  if (customConclusion && customConclusion.trim()) return customConclusion;
  return (
    `<p>Trên đây là danh sách công lương Uncheck vô lý GV TDM phát hiện. ` +
    `Mong team xem xét và xử lý trong thời gian sớm nhất.</p>` +
    `<p>Trân trọng,</p>` +
    `<p><strong>MindX Support Tools</strong></p>`
  );
}

function renderRow(line, idx) {
  const dateLabel = line.slotTime ? formatVietnamDate(line.slotTime) : "—";
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${idx + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(line.teacherName || "—")}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(line.className || "—")}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;white-space:nowrap;">${escapeHtml(dateLabel)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(line.reason || "—")}</td>
    </tr>
  `;
}

function renderHtml({
  periodLabel,
  centreName,
  lines,
  customIntro,
  customConclusion,
  dashboardUrl,
}) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const rows = safeLines.map(renderRow).join("");
  const intro = buildIntroHtml({
    customIntro,
    centreName,
    periodLabel,
    totalLines: safeLines.length,
  });
  const outro = buildConclusionHtml({ customConclusion });
  const url = dashboardUrl || process.env.APP_DASHBOARD_URL || "https://lms.mindx.edu.vn";

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width:720px;">
      <h2 style="color:#1976d2;margin-bottom:4px;">
        Báo cáo công lương sai - ${escapeHtml(periodLabel)}
      </h2>
      <p style="color:#666;margin-top:0;">
        Trung tâm: <strong>${escapeHtml(centreName)}</strong> ·
        Số dòng sai: <strong style="color:#d32f2f;">${safeLines.length}</strong>
      </p>
      ${intro}
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;margin:16px 0;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #eee;">#</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #eee;">Giáo viên</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #eee;">Lớp</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #eee;">Ngày</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #eee;">Lý do</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows ||
            `<tr><td colspan="5" style="padding:12px;color:#666;text-align:center;">Không có dòng công lương sai nào.</td></tr>`
          }
        </tbody>
      </table>
      <p>Mở dashboard để xem chi tiết: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
      ${outro}
      <p style="color:#888;font-size:12px;"><em>Email gửi tự động từ MindX Support Tools - TDM payroll issue report. Vui lòng không reply email này.</em></p>
    </div>
  `;
}

function renderText({
  periodLabel,
  centreName,
  lines,
  customIntro,
  customConclusion,
  dashboardUrl,
}) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const url = dashboardUrl || process.env.APP_DASHBOARD_URL || "https://lms.mindx.edu.vn";
  const linesOut = [];
  linesOut.push(`Bao cao cong luong sai - ${periodLabel}`);
  linesOut.push(`Trung tam: ${centreName} - So dong sai: ${safeLines.length}`);
  linesOut.push("");
  if (customIntro) {
    linesOut.push(customIntro.replace(/<[^>]+>/g, ""));
    linesOut.push("");
  }
  linesOut.push("Bang chi tiet:");
  safeLines.forEach((line, idx) => {
    const dateLabel = line.slotTime ? formatVietnamDate(line.slotTime) : "—";
    linesOut.push(
      `  ${idx + 1}. ${line.teacherName || "—"} - ${line.className || "—"} ` +
        `(${dateLabel}): ${line.reason || "—"}`,
    );
  });
  linesOut.push("");
  linesOut.push(`Dashboard: ${url}`);
  linesOut.push("");
  if (customConclusion) {
    linesOut.push(customConclusion.replace(/<[^>]+>/g, ""));
    linesOut.push("");
  }
  linesOut.push("MindX Support Tools");
  return linesOut.join("\n");
}

function renderPayrollIssueEmail({
  periodLabel,
  centreName,
  lines,
  customIntro,
  customConclusion,
  dashboardUrl,
}) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const safeCentre = centreName || "TDM";
  const safePeriod = periodLabel || "Tháng hiện tại";
  const subject = `[MindX][TDM] Báo cáo công lương sai - ${safePeriod}`;
  return {
    subject,
    html: renderHtml({
      periodLabel: safePeriod,
      centreName: safeCentre,
      lines: safeLines,
      customIntro,
      customConclusion,
      dashboardUrl,
    }),
    text: renderText({
      periodLabel: safePeriod,
      centreName: safeCentre,
      lines: safeLines,
      customIntro,
      customConclusion,
      dashboardUrl,
    }),
  };
}

module.exports = { renderPayrollIssueEmail };
