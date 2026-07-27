const nodemailer = require("nodemailer");

class GmailProvider {
  constructor() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_APP_PASSWORD;
    if (!user || !pass) {
      throw new Error(
        "GmailProvider: EMAIL_USER or EMAIL_APP_PASSWORD not set in environment",
      );
    }
    this.user = user;
    this.pass = pass;
  }

  // Returns a fresh nodemailer transporter instance.
  // Per-nodemailer docs it's safe to share a transporter, but creating on
  // each call keeps the door open for transient overrides later.
  getTransporter() {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: this.user, pass: this.pass },
    });
  }

  // Used as the "from" address when composing mail.
  getFromAddress() {
    return `"MindX Support Tools" <${this.user}>`;
  }
}

module.exports = { GmailProvider };
