const LMSClient = require("../../services/lmsClient");
const UserSessionManager = require("../../storage/userSession");

class TelegramHandlers {
  static async handleStart(ctx) {
    const userId = ctx.from.id;
    const session = UserSessionManager.getUserSession(userId);

    if (session) {
      await ctx.reply(
        "👋 Xin chào! Bạn đã đăng nhập rồi.\n\nCác lệnh có sẵn:\n" +
          "/info - Xem thông tin tài khoản\n" +
          "/classes - Xem danh sách lớp\n" +
          "/reminders - Xem nhắc nhở cần review\n" +
          "/logout - Đăng xuất",
      );
    } else {
      await ctx.reply(
        "👋 Chào mừng bạn đến với MindX LMS Bot!\n\n" +
          "Bot này sẽ giúp bạn nhắc nhở về deadline review học sinh.\n\n" +
          "Để bắt đầu, vui lòng đăng nhập bằng token của bạn.\n\n" +
          "📖 Hướng dẫn lấy token:\n" +
          "1. Truy cập https://lms.mindx.edu.vn\n" +
          "2. Mở DevTools (F12) -> Network\n" +
          "3. Tìm request GraphQL (ví dụ /)\n" +
          "4. Copy Authorization header (bỏ 'Bearer ')\n" +
          "5. Gửi lệnh: /login <YOUR_TOKEN>",
      );
    }
  }

  static async handleLogin(ctx) {
    const userId = ctx.from.id;
    const token = ctx.match[1]?.trim();

    if (!token) {
      await ctx.reply("❌ Vui lòng cung cấp token.\nCú pháp: /login <TOKEN>");
      return;
    }

    try {
      await ctx.reply("⏳ Đang xác thực và tìm Teacher ID...");

      let uid;
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString(),
        );
        uid = payload.user_id || payload.uid || payload.sub;
      } catch (e) {
        throw new Error("Token không đúng định dạng JWT.");
      }

      if (!uid) throw new Error("Không tìm thấy UID trong token.");

      const lmsClient = new LMSClient(token);
      const teacherId = await lmsClient.getTeacherId(uid);
      UserSessionManager.saveUserSession(userId, teacherId, token);

      await ctx.reply(
        `✅ Đăng nhập thành công!\n\n` +
          `LMS Teacher ID: \`${teacherId}\`\n\n` +
          `Gõ /classes để xem danh sách lớp của bạn.\n` +
          `Bot sẽ tự động nhắc nhở bạn khi có buổi học cần review học sinh.`,
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Login error:", error);
      await ctx.reply(
        `❌ Đăng nhập thất bại!\n\nLỗi: ${error.message}\n\n` +
          `Vui lòng kiểm tra lại token của bạn.`,
      );
    }
  }

  static async handleInfo(ctx) {
    const userId = ctx.from.id;
    const session = UserSessionManager.getUserSession(userId);
    if (!session) {
      await ctx.reply("❌ Bạn chưa đăng nhập.");
      return;
    }
    await ctx.reply(
      `👤 **Thông tin tài khoản**\n\nLMS Teacher ID: ${session.lmsUserId}`,
      { parse_mode: "Markdown" },
    );
  }

  static async handleClasses(ctx) {
    const userId = ctx.from.id;
    const session = UserSessionManager.getUserSession(userId);

    if (!session) {
      await ctx.reply("❌ Bạn chưa đăng nhập.");
      return;
    }

    try {
      await ctx.reply("⏳ Đang lấy danh sách lớp...");
      const lmsClient = new LMSClient(session.token);
      const classes = await lmsClient.getClasses(session.lmsUserId);

      if (!classes || classes.length === 0) {
        await ctx.reply("📚 Bạn hiện chưa có lớp nào.");
        return;
      }

      let message = `📚 **Danh sách lớp và Lịch dạy** (${classes.length})\n\n`;
      classes.forEach((cls, index) => {
        const role =
          cls.teachers.find((t) => t.teacher.id === session.lmsUserId)?.role
            ?.name || "N/A";

        const courseName = cls.course?.name || "N/A";
        const centreName = cls.centre?.name || "N/A";

        // Lấy buổi học gần nhất hoặc sắp tới
        const now = new Date();
        const upcomingSlot = cls.slots
          .map((s) => ({ ...s, time: new Date(s.startTime || s.date) }))
          .filter((s) => s.time >= now)
          .sort((a, b) => a.time - b.time)[0];

        const lastSlot = cls.slots
          .map((s) => ({ ...s, time: new Date(s.startTime || s.date) }))
          .filter((s) => s.time < now)
          .sort((a, b) => b.time - a.time)[0];

        message +=
          `${index + 1}. *${cls.name}*\n` +
          `   📖 Khóa học: ${courseName}\n` +
          `   🏢 Trung tâm: ${centreName}\n` +
          `   🔹 Vai trò: ${role}\n` +
          `   🔹 Trạng thái: ${cls.status}\n`;

        if (upcomingSlot) {
          message += `   📅 Sắp tới: ${upcomingSlot.time.toLocaleString("vi-VN")} - ${upcomingSlot.summary || "N/A"}\n`;
        }
        if (lastSlot) {
          message += `   🕒 Vừa xong: ${lastSlot.time.toLocaleString("vi-VN")} - ${lastSlot.summary || "N/A"}\n`;
        }
        message += `\n`;
      });

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Classes error:", error);
      await ctx.reply("❌ Lỗi khi lấy danh sách lớp.");
    }
  }

  static async handleReminders(ctx) {
    const userId = ctx.from.id;
    const session = UserSessionManager.getUserSession(userId);

    if (!session) {
      await ctx.reply("❌ Bạn chưa đăng nhập.");
      return;
    }

    try {
      await ctx.reply("⏳ Đang kiểm tra nhắc nhở cần review...");
      const lmsClient = new LMSClient(session.token);
      const classes = await lmsClient.getClasses(session.lmsUserId);

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

      if (reminders.length === 0) {
        await ctx.reply("✅ Bạn không có buổi học nào cần review gấp!");
      } else {
        let message = `⏰ **Cần review gấp (Hạn 48h)**\n\n`;
        reminders.forEach((r, idx) => {
          message +=
            `${idx + 1}. *${r.className}*\n` +
            `   📖 Khóa học: ${r.courseName}\n` +
            `   📅 Buổi: ${new Date(r.date).toLocaleDateString("vi-VN")}\n` +
            `   📝 Nội dung: ${r.summary}\n` +
            `   ⏳ Còn lại: ${r.timeLeft} giờ\n\n`;
        });
        await ctx.reply(message, { parse_mode: "Markdown" });
      }
    } catch (error) {
      console.error("Reminders error:", error);
      await ctx.reply("❌ Lỗi khi kiểm tra nhắc nhở.");
    }
  }

  static async handleLogout(ctx) {
    const userId = ctx.from.id;
    UserSessionManager.deleteUserSession(userId);
    await ctx.reply("✅ Bạn đã đăng xuất.");
  }
}

module.exports = TelegramHandlers;
