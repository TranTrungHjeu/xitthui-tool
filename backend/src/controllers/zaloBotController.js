const zaloClient = require("../services/zaloClient");
const ZaloData = require("../storage/zaloData");
const classController = require("./classController");
const {
  refreshLmsToken,
  loginWithCredentials,
} = require("../services/lmsAuth");
const FirestoreZalo = require("../storage/firestoreZalo");
const LMSClient = require("../services/lmsClient");

const COMMANDS = {
  HELP: ["help", "h", "trợ giúp", "?"],
  BIND_GROUP: ["bind_group", "bg", "liên kết nhóm"],
  STATUS: ["status", "st", "trạng thái", "tinhtrang", "tình trạng"],
  REPORT: ["report", "rp", "báo cáo", "kiem tra", "kiểm tra", "danh sách lớp"],
};

function formatTime(isoString) {
  try {
    if (!isoString) return "Không rõ";
    if (/^\d{2}:\d{2}/.test(isoString)) return isoString.substring(0, 5);

    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    });
  } catch (e) {
    return isoString;
  }
}

function matchCommand(input, commandKeys) {
  const normalized = input.toLowerCase().trim();
  return commandKeys.some((cmd) => {
    if (cmd.length <= 2) {
      return normalized === cmd;
    }
    return normalized === cmd || normalized.includes(cmd);
  });
}

function getMainMenu() {
  return (
    "🤖 MÌNH LÀ TRỢ LÝ MINDX LMS BOT\n" +
    "Hỗ trợ theo dõi tiến độ nhận xét học viên và lịch dạy tự động.\n\n" +
    "📌 LỆNH HỆ THỐNG:\n" +
    "▪️ bind_group (bg) ➜ Đặt nhóm này làm kênh nhận thông báo chính.\n" +
    "▪️ report     (rp) ➜ Quét và gửi báo cáo tiến độ nhận xét hiện tại.\n" +
    "▪️ status     (st) ➜ Kiểm tra trạng thái cấu hình và lịch nhắc nhở.\n\n" +
    "👤 LỆNH CÁ NHÂN (Cần đăng nhập):\n" +
    "▪️ login [email] [mật_khẩu]   ➜ Đăng nhập tài khoản LMS của bạn.\n" +
    "▪️ logout                (lo) ➜ Đăng xuất khỏi tài khoản.\n" +
    "▪️ lichday               (ld) ➜ Xem lịch giảng dạy trong 7 ngày tới.\n" +
    "▪️ chuanhanxet          (cnx) ➜ Danh sách lớp bạn cần hoàn thành nhận xét.\n\n" +
    "💡 Gõ lệnh trực tiếp để trợ lý hỗ trợ bạn nhé!"
  );
}

async function handleWebhook(event) {
  try {
    const userId = event?.data?.from || event?.from;
    const messageData = event?.data?.message || event?.message;
    const text = messageData?.text?.trim() || "";
    const eventName = event?.name;

    if (!userId) {
      console.warn("[ZaloBot] No userId in event:", JSON.stringify(event));
      return;
    }

    console.log(
      `[ZaloBot] User ${userId} sent: "${text}" (event: ${eventName})`,
    );

    if (eventName === "follow") {
      await zaloClient.sendText(
        userId,
        "👋 Chào mừng bạn đến với MindX LMS Bot!\n" +
          "Hãy thêm mình vào nhóm lớp để mình có thể hỗ trợ nhắc nhở tiến độ tự động nhé.\n\n" +
          getMainMenu(),
      );
      return;
    }

    if (eventName === "unfollow") return;

    if (!text) {
      await zaloClient.sendText(userId, "Vui lòng gửi tin nhắn văn bản.");
      return;
    }

    if (matchCommand(text, COMMANDS.HELP)) {
      await zaloClient.sendText(userId, getMainMenu());
      return;
    }

    if (matchCommand(text, COMMANDS.BIND_GROUP)) {
      const config = ZaloData.getGlobalConfig();
      config.targetChatId = userId; // userId here represents the chat/group ID
      ZaloData.saveGlobalConfig(config);
      await zaloClient.sendText(
        userId,
        "✅ LIÊN KẾT KÊNH THÀNH CÔNG!\n\n" +
          "Nhóm này đã được chọn làm kênh nhận thông báo chính thức.\n" +
          "Báo cáo tự động sẽ được gửi theo lịch hoặc bất cứ khi nào bạn gõ lệnh [report].",
      );
      return;
    }

    if (matchCommand(text, COMMANDS.STATUS)) {
      const globalConfig = ZaloData.getGlobalConfig();
      let msg = "⚙️ TRẠNG THÁI HỆ THỐNG BOT\n\n";

      if (globalConfig.targetChatId === userId) {
        msg += `📍 Nhận thông báo: Đang hoạt động tại nhóm này\n`;
      } else if (globalConfig.targetChatId) {
        msg += `📍 Nhận thông báo: Được cấu hình ở nhóm khác\n`;
      } else {
        msg += `📍 Nhận thông báo: Chưa thiết lập (Gõ 'bind_group' để liên kết)\n`;
      }

      if (globalConfig.mindxUser) {
        msg += `👤 Tài khoản LMS chung: ${globalConfig.mindxUser.username}\n`;
      } else {
        msg += `👤 Tài khoản LMS chung: Chưa cấu hình trên Web Dashboard!\n`;
      }

      if (globalConfig.reminderTimes && globalConfig.reminderTimes.length > 0) {
        msg += `⏰ Lịch báo cáo tự động: ${globalConfig.reminderTimes.join(", ")}\n`;
      } else {
        msg += `⏰ Lịch báo cáo tự động: Chưa cài đặt\n`;
      }

      await zaloClient.sendText(userId, msg);
      return;
    }

    if (matchCommand(text, COMMANDS.REPORT)) {
      await zaloClient.sendText(
        userId,
        "⏳ Đang truy vấn hệ thống LMS, vui lòng đợi trong giây lát...",
      );
      await sendGlobalReminder(userId);
      return;
    }

    // Xử lý lệnh login: "login username password"
    const loginMatch = text.match(/^login\s+([^\s]+)\s+(.+)$/i);
    if (loginMatch) {
      const username = loginMatch[1].trim();
      const password = loginMatch[2].trim();
      console.log(
        `[ZaloBot] Parsed login credentials - Username: "${username}", Password length: ${password.length}`,
      );
      await zaloClient.sendText(
        userId,
        `⏳ Đang xác thực tài khoản ${username} với hệ thống MindX...`,
      );

      try {
        const authData = await loginWithCredentials(username, password);

        // Lưu session vào Firestore
        await FirestoreZalo.saveUserSession(userId, authData);

        const fullName = authData.mindxUser.name || authData.mindxUser.username;
        await zaloClient.sendText(
          userId,
          `✅ ĐĂNG NHẬP THÀNH CÔNG\n\n` +
            `Xin chào thầy/cô: ${fullName} 👋\n\n` +
            `Tài khoản đã được liên kết với MINDX LMS Bot.\n\n` +
            `📌 Các lệnh cá nhân:\n` +
            `• ld | lichday      → Xem lịch giảng dạy\n` +
            `• cnx | chuanhanxet → Kiểm tra lớp cần nhận xét\n\n` +
            `💡 Gõ một trong các lệnh trên để bắt đầu.`,
        );
      } catch (error) {
        await zaloClient.sendText(
          userId,
          `❌ ĐĂNG NHẬP THẤT BẠI!\n\n` +
            `Chi tiết lỗi: ${error.message}\n` +
            `Vui lòng kiểm tra kỹ lại email và mật khẩu của bạn.`,
        );
      }
      return;
    }

    const normalizedText = text.toLowerCase();

    // Xử lý lệnh đăng xuất: "logout" hoặc "lo"
    if (normalizedText === "logout" || normalizedText === "lo") {
      await FirestoreZalo.deleteUserSession(userId);
      await zaloClient.sendText(
        userId,
        "👋 ĐĂNG XUẤT THÀNH CÔNG!\n\nThầy/cô đã đăng xuất khỏi tài khoản LMS trên Zalo. Hẹn gặp lại nhé!",
      );
      return;
    }

    // Xử lý lệnh cá nhân: lichday (ld), chuanhanxet (cnx)
    const isScheduleCommand =
      normalizedText === "lichday" || normalizedText === "ld";
    const isFeedbackCommand =
      normalizedText === "chuanhanxet" ||
      normalizedText === "cnx" ||
      normalizedText === "nonhanxet";

    if (isScheduleCommand || isFeedbackCommand) {
      const commandType = isScheduleCommand ? "lichday" : "chuanhanxet";
      const session = await FirestoreZalo.getUserSession(userId);
      if (!session || !session.lmsToken) {
        await zaloClient.sendText(
          userId,
          `⚠️ CHƯA ĐĂNG NHẬP\n\n` +
            `Bạn cần đăng nhập để sử dụng các tính năng cá nhân.\n\n` +
            `🔑 Cú pháp:\nlogin <email> <mật_khẩu>\n\n` +
            `📝 Ví dụ:\nlogin teacher@mindx.edu.vn 123456\n\n` +
            `💡 Sau khi đăng nhập, bạn có thể sử dụng:\n` +
            `• ld  → Xem lịch dạy\n` +
            `• cnx → Xem lớp cần nhận xét`,
        );
        return;
      }

      await zaloClient.sendText(
        userId,
        "⏳ Đang tải dữ liệu cá nhân của thầy/cô...",
      );

      // Call personal command handler
      await handlePersonalCommand(userId, commandType, session);
      return;
    }

    // Default: unknown command
    await zaloClient.sendText(
      userId,
      `❓ Trợ lý chưa hiểu lệnh "${text}".\n\n` +
        `Thầy/cô vui lòng tham khảo các lệnh được hỗ trợ dưới đây:\n\n` +
        getMainMenu(),
    );
  } catch (err) {
    console.error("[ZaloBot] handleWebhook error:", err.message);
  }
}

/**
 * Xử lý lệnh cá nhân của giáo viên đã đăng nhập
 */
async function handlePersonalCommand(userId, command, session) {
  try {
    let lmsToken = session.lmsToken;
    let lmsClient = new LMSClient(lmsToken);

    // TODO: Implement refresh token logic if needed
    // Simplified logic for MVP: Assume token is valid. If it throws 401, we will handle it below.

    if (command === "lichday") {
      const now = new Date();
      const end = new Date(now);
      end.setDate(now.getDate() + 7);

      const dateGte = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const dateLte = end.toISOString().split("T")[0];

      let schedules = [];
      try {
        schedules = await lmsClient.getTeacherSchedules(
          session.mindxUser.teacherId,
          dateGte,
          dateLte,
        );
      } catch (e) {
        if (
          e.message.includes("401") ||
          e.message.includes("Authentication failed")
        ) {
          // Refresh token
          const refreshed = await refreshLmsToken(session.lmsRefreshToken);
          lmsToken = refreshed.idToken;
          session.lmsToken = lmsToken;
          if (refreshed.refreshToken)
            session.lmsRefreshToken = refreshed.refreshToken;
          await FirestoreZalo.saveUserSession(userId, session);

          lmsClient = new LMSClient(lmsToken);
          schedules = await lmsClient.getTeacherSchedules(
            session.mindxUser.teacherId,
            dateGte,
            dateLte,
          );
        } else {
          throw e;
        }
      }

      if (!schedules || schedules.length === 0) {
        await zaloClient.sendText(
          userId,
          `✨ Tuyệt vời! Bạn không có lịch dạy nào từ ${dateGte} đến ${dateLte}.`,
        );
        return;
      }

      // Sắp xếp lịch dạy theo thời gian tăng dần (sớm nhất lên đầu)
      schedules.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      let msg = `📅 LỊCH GIẢNG DẠY (7 NGÀY TỚI)\n\n`;

      // Gom nhóm theo ngày
      const groupedSchedules = {};
      schedules.forEach((s) => {
        const dateObj = new Date(s.date);
        let dateKey = s.date;
        let dayOfWeek = "";

        if (!isNaN(dateObj.getTime())) {
          const days = [
            "Chủ Nhật",
            "Thứ Hai",
            "Thứ Ba",
            "Thứ Tư",
            "Thứ Năm",
            "Thứ Sáu",
            "Thứ Bảy",
          ];
          dayOfWeek = days[dateObj.getDay()];
          dateKey = dateObj.toLocaleDateString("en-GB", {
            timeZone: "Asia/Ho_Chi_Minh",
          }); // DD/MM/YYYY
        }

        const fullDateKey = dayOfWeek ? `${dayOfWeek} • ${dateKey}` : dateKey;

        if (!groupedSchedules[fullDateKey]) {
          groupedSchedules[fullDateKey] = [];
        }
        groupedSchedules[fullDateKey].push(s);
      });

      for (const [dateGroup, items] of Object.entries(groupedSchedules)) {
        msg += `🗓️ ${dateGroup}\n━━━━━━━━━━━━━━━━━━\n`;
        items.forEach((s) => {
          const start = formatTime(s.startTime);
          const end = formatTime(s.endTime);
          const className = s.classSite?.class?.name || s.title || "Không rõ";

          // Dùng icon đồng hồ dựa trên giờ bắt đầu nếu có thể, mặc định dùng 🕗
          let timeIcon = "🕗";
          if (start.startsWith("10:") || start.startsWith("11:"))
            timeIcon = "🕙";
          else if (start.startsWith("14:") || start.startsWith("15:"))
            timeIcon = "🕑";
          else if (start.startsWith("18:") || start.startsWith("19:"))
            timeIcon = "🕕";

          msg += `📚 ${className}\n${timeIcon} ${start} - ${end}\n\n`;
        });
      }

      msg += `📌 Tổng số buổi dạy: ${schedules.length}`;
      await zaloClient.sendText(userId, msg);
    } else if (command === "chuanhanxet") {
      let feedbackList = [];
      const runQuery = async (tokenToUse) => {
        let isAuthFailed = false;
        const mockReq = {
          body: {
            token: tokenToUse,
            teacherId: session.mindxUser.teacherId,
            centreIds: null, // Check all centres for personal
            roles: session.mindxUser.appRoles,
            email: session.mindxUser.email,
            statusIn: ["OPEN", "RUNNING"],
          },
          headers: {},
        };

        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (
                (code === 500 || code === 401 || code === 403) &&
                data.error &&
                (data.error.includes("auth") ||
                  data.error.includes("Authentication"))
              ) {
                isAuthFailed = true;
              }
            },
          }),
          json: (data) => {
            if (data.success) {
              feedbackList = data.data;
            } else if (
              data.error &&
              (data.error.includes("auth") ||
                data.error.includes("Authentication"))
            ) {
              isAuthFailed = true;
            }
          },
        };

        await classController.getClassesNotifications(mockReq, mockRes);
        if (isAuthFailed) throw new Error("Authentication failed");
      };

      try {
        await runQuery(lmsToken);
      } catch (e) {
        if (e.message.includes("Authentication failed")) {
          // Refresh token
          const refreshed = await refreshLmsToken(session.lmsRefreshToken);
          lmsToken = refreshed.idToken;
          session.lmsToken = lmsToken;
          if (refreshed.refreshToken)
            session.lmsRefreshToken = refreshed.refreshToken;
          await FirestoreZalo.saveUserSession(userId, session);

          await runQuery(lmsToken);
        } else {
          throw e;
        }
      }

      if (!feedbackList || feedbackList.length === 0) {
        await zaloClient.sendText(
          userId,
          "🎉 Tuyệt vời! Thầy/cô đã hoàn thành 100% tiến độ nhận xét học viên, không còn lớp nào bị tồn đọng.",
        );
        return;
      }

      let msg = "⚠️ DANH SÁCH LỚP CẦN HOÀN THÀNH NHẬN XÉT\n\n";
      feedbackList.forEach((item) => {
        msg += `🏫 Lớp: ${item.className}\n   ➜ Tiến độ: Cần nhận xét thêm ${item.studentCount} học viên${item.isLate ? `\n   🚨 CẢNH BÁO: Đã quá hạn 48 giờ!` : ""}\n\n`;
      });

      await zaloClient.sendText(userId, msg);
    }
  } catch (err) {
    console.error("[ZaloBot] handlePersonalCommand error:", err.message);
    await zaloClient.sendText(
      userId,
      `❌ Có lỗi xảy ra khi lấy dữ liệu: ${err.message}`,
    );
  }
}

/**
 * Send reminder to the configured global group using the global LMS account
 * @param {string|null} overrideChatId - If provided, sends the reminder to this chat ID instead of the configured global target
 */
async function sendGlobalReminder(overrideChatId = null) {
  try {
    const config = ZaloData.getGlobalConfig();
    const { targetChatId, lmsToken, mindxUser } = config;

    const finalChatId = overrideChatId || targetChatId;

    if (!finalChatId) {
      console.log(
        "[ZaloBot] No targetChatId configured. Cannot send global reminder.",
      );
      return;
    }

    if (!lmsToken || !mindxUser) {
      const errMsg =
        "[x] Bot chưa được cấu hình tài khoản LMS từ Web Dashboard.";
      if (overrideChatId) {
        await zaloClient.sendText(overrideChatId, errMsg);
      }
      console.log(`[ZaloBot] ${errMsg}`);
      return;
    }

    let targetCentres = null;
    const isTE = mindxUser.appRoles?.includes("TE");
    if (isTE && mindxUser.teacherCentres) {
      targetCentres = mindxUser.teacherCentres.map((c) => c.id || c);

      // YÊU CẦU: Chỉ lấy những lớp cần nhận xét ở cơ sở TDM
      const tdmCentre = mindxUser.teacherCentres.find((c) => {
        const name =
          typeof c === "object" ? c?.name || c?.shortName : String(c);
        return (
          (name || "").toLowerCase().includes("thủ dầu một") ||
          (name || "").toLowerCase().includes("tdm")
        );
      });
      if (tdmCentre) {
        const id = typeof tdmCentre === "object" ? tdmCentre.id : tdmCentre;
        targetCentres = [id]; // Ghi đè chỉ truy vấn duy nhất cơ sở TDM
      }
    }

    // Tái sử dụng logic của classController để tận dụng bộ nhớ Cache, tránh 502
    let feedbackList = null;
    let authFailed = false;

    const runQuery = async (tokenToUse) => {
      authFailed = false;
      const mockReq = {
        body: {
          token: tokenToUse,
          teacherId: mindxUser.teacherId,
          centreIds: targetCentres,
          roles: mindxUser.appRoles,
          email: mindxUser.email,
          statusIn: ["OPEN", "RUNNING"],
        },
        headers: {},
      };

      const mockRes = {
        status: (code) => ({
          json: (data) => {
            if (
              (code === 500 || code === 401 || code === 403) &&
              data.error &&
              (data.error.includes("Authentication failed") ||
                data.error.includes("auth") ||
                data.error.includes("expired"))
            ) {
              authFailed = true;
            }
          },
        }),
        json: (data) => {
          if (data.success) {
            feedbackList = data.data;
          } else {
            if (
              data.error &&
              (data.error.includes("Authentication failed") ||
                data.error.includes("auth") ||
                data.error.includes("expired"))
            ) {
              authFailed = true;
            }
          }
        },
      };

      await classController.getClassesNotifications(mockReq, mockRes);
    };

    console.log(
      "[ZaloBot] Calling classController.getClassesNotifications to reuse Cache...",
    );
    await runQuery(lmsToken);

    // Nếu token hết hạn, thử refresh tự động bằng refreshLmsToken
    if (authFailed && config.lmsRefreshToken) {
      console.log(
        "[ZaloBot] Token authentication failed. Attempting to refresh token...",
      );
      try {
        const refreshed = await refreshLmsToken(config.lmsRefreshToken);
        if (refreshed && refreshed.idToken) {
          console.log("[ZaloBot] Token refreshed successfully!");

          // Lưu token mới
          config.lmsToken = refreshed.idToken;
          config.lmsRefreshToken =
            refreshed.refreshToken || config.lmsRefreshToken;
          ZaloData.saveGlobalConfig(config);

          // Chạy lại query với token mới
          await runQuery(refreshed.idToken);
        }
      } catch (refreshErr) {
        console.error("[ZaloBot] Failed to refresh token:", refreshErr.message);
        // Để nguyên authFailed = true để đi tới nhánh thông báo đăng nhập thủ công
      }
    }

    if (authFailed) {
      console.log("[ZaloBot] Token expired or invalid. Need manual re-login.");
      if (overrideChatId) {
        await zaloClient.sendText(
          overrideChatId,
          "[x] Phiên đăng nhập của Bot đã hết hạn (Lỗi xác thực).\n\nVui lòng truy cập lại Web Dashboard -> Zalo Bot -> Bấm 'Cập nhật Cấu hình & Token' để làm mới kết nối.",
        );
      }
      return;
    }

    if (!feedbackList) {
      console.log(
        "[ZaloBot] Failed to compute notifications from Cache Service.",
      );
      if (overrideChatId) {
        await zaloClient.sendText(
          overrideChatId,
          "[x] Lỗi hệ thống khi tải dữ liệu lớp học từ bộ nhớ đệm (không phải lỗi xác thực). Vui lòng thử lại sau.",
        );
      }
      return;
    }

    if (feedbackList.length === 0) {
      console.log("[ZaloBot] No pending feedback to remind.");
      if (overrideChatId) {
        await zaloClient.sendText(
          overrideChatId,
          "🚀 HOÀN THÀNH 100% TIẾN ĐỘ!\n\nHiện tại cơ sở Thủ Dầu Một đã hoàn tất toàn bộ đánh giá học viên. Cảm ơn sự tận tụy của các thầy cô! ❤️",
        );
      }
      return;
    }

    let msg = "🔔 BÁO CÁO TIẾN ĐỘ NHẬN XÉT HỌC VIÊN TDM\n\n";
    feedbackList.forEach((item) => {
      msg += `🏫 Lớp: ${item.className}\n   ➜ Cần đánh giá thêm: ${item.studentCount} học viên${item.isLate ? `\n   🚨 CẢNH BÁO: Đã quá hạn 48 giờ!` : ""}\n\n`;
    });
    msg += `💡 Mẹo: Gõ lệnh [rp] bất kỳ lúc nào để lấy báo cáo mới nhất.`;

    await zaloClient.sendText(finalChatId, msg);
    console.log(
      `[ZaloBot] Sent global reminder to chat ${finalChatId} with ${feedbackList.length} items`,
    );
  } catch (err) {
    console.error(`[ZaloBot] sendGlobalReminder error:`, err.message);
  }
}

// === Web APIs for Dashboard Configuration ===

const getGlobalBotSettings = (req, res) => {
  const config = ZaloData.getGlobalConfig();
  res.json({
    success: true,
    data: {
      targetChatId: config.targetChatId,
      reminderTimes: config.reminderTimes || [],
      isLmsConfigured: !!config.lmsToken,
      mindxUsername: config.mindxUser?.username || null,
    },
  });
};

const updateGlobalBotSettings = (req, res) => {
  const { reminderTimes, linkCurrentUser } = req.body;
  const config = ZaloData.getGlobalConfig();

  if (reminderTimes !== undefined) {
    config.reminderTimes = reminderTimes;
  }

  // Link the current logged in user's LMS session to the bot
  if (linkCurrentUser && req.body.lmsToken) {
    config.lmsToken = req.body.lmsToken;
    config.lmsRefreshToken = req.body.lmsRefreshToken || null;
    config.mindxUser = req.body.mindxUser || null;
  }

  ZaloData.saveGlobalConfig(config);

  // Restart scheduler to pick up new times
  const zaloScheduler = require("../services/zaloScheduler");
  zaloScheduler.restartScheduler();

  res.json({ success: true, message: "Settings updated successfully" });
};

const triggerRemindNow = async (req, res) => {
  try {
    await sendGlobalReminder();
    res.json({ success: true, message: "Reminder triggered successfully" });
  } catch (err) {
    console.error("[ZaloBot API] triggerRemindNow error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  handleWebhook,
  sendGlobalReminder,
  getGlobalBotSettings,
  updateGlobalBotSettings,
  triggerRemindNow,
};
