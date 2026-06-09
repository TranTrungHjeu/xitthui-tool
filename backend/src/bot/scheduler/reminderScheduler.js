const cron = require("node-cron");
const LMSClient = require("../../services/lmsClient");
const UserSessionManager = require("../../storage/userSession");
const config = require("../../config");

class ReminderScheduler {
  constructor(bot) {
    this.bot = bot;
    this.job = null;
  }

  start() {
    console.log(
      `⏱️ Reminder scheduler started (check every ${config.reminder.checkInterval} minutes)`,
    );

    // Run every N minutes
    const cronExpression = `*/${config.reminder.checkInterval} * * * *`;
    this.job = cron.schedule(cronExpression, () => {
      this.checkReminders();
    });
  }

  stop() {
    if (this.job) {
      this.job.stop();
      console.log("⏱️ Reminder scheduler stopped");
    }
  }

  async checkReminders() {
    console.log(`\n🔍 Checking reminders at ${new Date().toISOString()}`);

    const sessions = UserSessionManager.getAllSessions();

    for (const [telegramUserId, session] of Object.entries(sessions)) {
      try {
        const lmsClient = new LMSClient(session.token);
        const classes = await lmsClient.getClasses(session.lmsUserId);

        if (!classes || classes.length === 0) continue;

        let reminders = [];
        const now = new Date();

        for (const cls of classes) {
          if (cls.status !== "RUNNING") continue;

          for (const slot of cls.slots) {
            const slotDate = new Date(slot.date);
            // Nếu buổi học đã kết thúc và chưa qua 48h
            if (slotDate < now) {
              const hoursSince = (now - slotDate) / (1000 * 60 * 60);

              // Kiểm tra xem đã có nhận xét chưa (chỉ tính học sinh có đi học)
              const needsReview =
                slot.studentAttendance &&
                slot.studentAttendance.length > 0 &&
                slot.studentAttendance.some(
                  (a) =>
                    (!a.comment || a.comment.trim() === "") &&
                    ["PRESENT", "ATTENDED", "LATE", "LATE_ARRIVED"].includes(
                      a.status,
                    ),
                );

              if (needsReview && hoursSince < 48) {
                reminders.push({
                  className: cls.name,
                  courseName: cls.course?.name || "N/A",
                  date: slot.date,
                  summary: slot.summary || "N/A",
                  timeLeft: Math.round(48 - hoursSince),
                });
              }
            }
          }
        }

        if (reminders.length > 0) {
          await this.sendReminders(telegramUserId, reminders);
        }
      } catch (error) {
        console.error(
          `Error checking reminders for user ${telegramUserId}:`,
          error.message,
        );
      }
    }
  }

  async sendReminders(telegramUserId, reminders) {
    try {
      let message = `⏰ **Cần review gấp (Hạn 48h)**\n\n`;

      reminders.forEach((r, idx) => {
        message +=
          `${idx + 1}. *${r.className}*\n` +
          `   📖 Khóa học: ${r.courseName}\n` +
          `   📅 Buổi: ${new Date(r.date).toLocaleDateString("vi-VN")}\n` +
          `   📝 Nội dung: ${r.summary}\n` +
          `   ⏳ Còn lại: ${r.timeLeft} giờ\n\n`;
      });

      message += "Vui lòng truy cập LMS để review ngay.";

      await this.bot.telegram.sendMessage(telegramUserId, message, {
        parse_mode: "Markdown",
      });

      console.log(
        `✅ Sent ${reminders.length} reminders to user ${telegramUserId}`,
      );
    } catch (error) {
      console.error(
        `Error sending reminders to user ${telegramUserId}:`,
        error.message,
      );
    }
  }
}

module.exports = ReminderScheduler;
