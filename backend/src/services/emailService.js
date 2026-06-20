const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_APP_PASSWORD;

    if (!user || !pass) {
      console.warn(
        "[EmailService] EMAIL_USER or EMAIL_APP_PASSWORD not set in .env. Email feature will be disabled.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });

    console.log("[EmailService] Initialized with user:", user);
  }

  async sendReminderEmail(toEmail, teacherName, pendingClasses) {
    if (!this.transporter) {
      console.warn(
        "[EmailService] Cannot send email. Service not initialized.",
      );
      return false;
    }

    if (!toEmail) {
      console.warn("[EmailService] No destination email provided.");
      return false;
    }

    try {
      const classListHtml = pendingClasses
        .map(
          (c) =>
            `<li><strong>${c.className}</strong> (Buổi học ngày: ${new Date(
              c.date,
            ).toLocaleDateString("vi-VN")}): ${
              c.studentCount
            } học viên chưa chấm. Trạng thái: ${
              c.isLate
                ? "<span style='color: red;'>Quá hạn</span>"
                : "<span style='color: orange;'>Sắp tới hạn</span>"
            }</li>`,
        )
        .join("");

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #d32f2f;">Nhắc nhở: Đánh giá học viên sau buổi học</h2>
          <p>Chào ${teacherName},</p>
          <p>Hệ thống ghi nhận bạn có các buổi học đã kết thúc nhưng chưa hoàn thành việc đánh giá (chấm điểm/nhận xét) học viên trên hệ thống LMS. Việc đánh giá kịp thời giúp học viên và phụ huynh nắm bắt được tình hình học tập.</p>
          <p>Danh sách các buổi học cần đánh giá:</p>
          <ul>
            ${classListHtml}
          </ul>
          <p>Vui lòng đăng nhập vào hệ thống LMS để hoàn thành việc đánh giá trong thời gian sớm nhất.</p>
          <br/>
          <p>Trân trọng,</p>
          <p><strong>Hệ thống tự động MindX Support Tools</strong></p>
          <p><em>Đây là email tự động, vui lòng không trả lời email này.</em></p>
        </div>
      `;

      const mailOptions = {
        from: `"MindX Support Tools" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "[Quan trọng] Nhắc nhở hoàn thành đánh giá học viên",
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Email sent to ${toEmail}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(
        `[EmailService] Failed to send email to ${toEmail}:`,
        error,
      );
      return false;
    }
  }
}

module.exports = new EmailService();
