const { createProvider } = require("./emailProviders");
const { renderReminderEmail } = require("./emailTemplates/reminder");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("EmailService");

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromAddress = null;
    this.providerName = process.env.EMAIL_PROVIDER || "gmail";
    this.init();
  }

  init() {
    try {
      const provider = createProvider();
      this.transporter = provider.getTransporter();
      this.fromAddress = provider.getFromAddress();
      log.info(
        `[EmailService] Initialized with provider: ${this.providerName}`,
      );
    } catch (err) {
      log.warn(
        `[EmailService] ${err.message}. Email feature will be disabled.`,
      );
      this.transporter = null;
      this.fromAddress = null;
    }
  }

  isReady() {
    return Boolean(this.transporter && this.fromAddress);
  }

  // Generic send: caller passes already-rendered subject/html/text.
  // Returns { ok: true, messageId } or { ok: false, error }.
  async sendMail({ to, subject, html, text }) {
    if (!this.isReady()) {
      log.warn("[EmailService] Cannot send email. Service not initialized.");
      return { ok: false, error: "service_not_initialized" };
    }
    if (!to) {
      log.warn("[EmailService] No destination email provided.");
      return { ok: false, error: "no_destination" };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
        text,
      });
      log.info(`[EmailService] Email sent to ${to}: ${info.messageId}`);
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      log.error(`[EmailService] Failed to send email to ${to}:`, err);
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  // Convenience wrapper used by the notification scheduler.
  // Returns boolean (legacy contract) so existing callers don't have to change,
  // plus an optional richer object via the second param.
  async sendReminderEmail(toEmail, teacherName, pendingClasses, meta) {
    const rendered = renderReminderEmail({
      teacherName,
      pendingClasses,
      meta,
    });
    const result = await this.sendMail({
      to: toEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    return result;
  }
}

module.exports = new EmailService();
