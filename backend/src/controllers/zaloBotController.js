const zaloClient = require("../services/zaloClient");
const ZaloData = require("../storage/zaloStorage");
const classController = require("./classController");
const {
  refreshLmsToken,
  loginWithCredentials,
  loginWithUsernameFlow,
} = require("../services/lmsAuth");
const FirestoreZalo = require("../storage/zaloStorage");
const LMSClient = require("../services/lmsClient");
const ClassCacheService = require("../services/classCache");
const { getSessionExamType, getCourseCategory } = require("../utils/courseConfig");

const COMMANDS = {
  HELP: ["help", "h", "trợ giúp", "?"],
  BIND_GROUP: ["bind_group", "bg", "liên kết nhóm"],
  STATUS: ["status", "st", "trạng thái", "tinhtrang", "tình trạng"],
  REPORT: ["report", "rp", "báo cáo", "kiem tra", "kiểm tra", "danh sách lớp"],
  CHECK_HOMEWORK: ["checkbaitap", "cbt", "homework", "bt", "bài tập", "baitap"],
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
  return "📌 Các lệnh hỗ trợ:\n";
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

    const menuImageUrl =
      "https://res.cloudinary.com/drmck7diu/image/upload/v1781969846/mindxsupportbotmenu_egrhty.webp";

    if (eventName === "follow") {
      const followCaption =
        "👋 Chào mừng bạn đến với MindX LMS Bot!\n" +
        "Hãy thêm mình vào nhóm lớp để mình có thể hỗ trợ nhắc nhở tiến độ tự động nhé.\n\n" +
        getMainMenu();
      await zaloClient.sendPhoto(userId, menuImageUrl, followCaption);
      return;
    }

    if (eventName === "unfollow") return;

    if (!text) {
      await zaloClient.sendText(userId, "Vui lòng gửi tin nhắn văn bản.");
      return;
    }

    if (matchCommand(text, COMMANDS.HELP)) {
      await zaloClient.sendPhoto(userId, menuImageUrl, getMainMenu());
      return;
    }

    if (matchCommand(text, COMMANDS.BIND_GROUP)) {
      const config = await ZaloData.getGlobalConfig();
      config.targetChatId = userId; // userId here represents the chat/group ID
      await ZaloData.saveGlobalConfig(config);
      await zaloClient.sendText(userId, "LIÊN KẾT KÊNH THÀNH CÔNG!");
      return;
    }

    if (matchCommand(text, COMMANDS.STATUS)) {
      const globalConfig = await ZaloData.getGlobalConfig();
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
      await zaloClient.sendText(userId, "Vui lòng đợi trong giây lát...");
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
        `Đang xác thực tài khoản ${username}...`,
      );

      try {
        let authData;
        if (username.includes("@")) {
          authData = await loginWithCredentials(username, password);
        } else {
          authData = await loginWithUsernameFlow(username, password);
        }

        // Lưu session vào Firestore
        await FirestoreZalo.saveUserSession(userId, authData);

        const fullName = authData.mindxUser.name || authData.mindxUser.username;
        await zaloClient.sendText(
          userId,
          `ĐĂNG NHẬP THÀNH CÔNG\n\n` +
            `Xin chào thầy/cô: ${fullName} 👋\n\n` +
            `Tài khoản đã được liên kết với MINDX LMS Bot.\n\n` +
            `📌 Các lệnh cá nhân:\n` +
            `• ld | lichday      → Xem lịch giảng dạy\n` +
            `• cnx | chuanhanxet → Kiểm tra lớp cần nhận xét\n` +
            `• cbt | checkbaitap → Kiểm tra bài tập chưa chấm\n\n` +
            `💡 Gõ một trong các lệnh trên để bắt đầu.`,
        );
      } catch (error) {
        await zaloClient.sendText(
          userId,
          `ĐĂNG NHẬP THẤT BẠI!\n\n` +
            `Chi tiết lỗi: ${error.message}\n` +
            `Vui lòng kiểm tra kỹ lại email và mật khẩu của bạn.`,
        );
      }
      return;
    }

    const tokens = text.trim().split(/\s+/);
    const cmdToken = tokens[0].toLowerCase();
    const cmdArg = tokens.slice(1).join(" ").trim();

    // Xử lý lệnh đăng xuất: "logout" hoặc "lo"
    if (cmdToken === "logout" || cmdToken === "lo") {
      await FirestoreZalo.deleteUserSession(userId);
      await zaloClient.sendText(userId, "ĐĂNG XUẤT THÀNH CÔNG!");
      return;
    }

    // Xử lý lệnh cá nhân: lichday (ld), chuanhanxet (cnx), checkbaitap (cbt)
    const isScheduleCommand = cmdToken === "lichday" || cmdToken === "ld";
    const isFeedbackCommand = cmdToken === "chuanhanxet" || cmdToken === "cnx";
    const isHomeworkCommand = COMMANDS.CHECK_HOMEWORK.includes(cmdToken);

    if (isScheduleCommand || isFeedbackCommand || isHomeworkCommand) {
      let commandType = "";
      if (isScheduleCommand) commandType = "lichday";
      else if (isFeedbackCommand) commandType = "chuanhanxet";
      else if (isHomeworkCommand) commandType = "checkbaitap";

      const session = await FirestoreZalo.getUserSession(userId);
      if (!session || !session.lmsToken) {
        await zaloClient.sendText(
          userId,
          `⚠️ CHƯA ĐĂNG NHẬP\n\n` +
            `Bạn cần đăng nhập để sử dụng các tính năng cá nhân.\n\n` +
            `🔑 Cú pháp:\nlogin <email/username> <mật_khẩu>\n\n` +
            `📝 Ví dụ:\nlogin teacher@mindx.edu.vn 123456\nhoặc: login teacher_username 123456\n\n` +
            `💡 Sau khi đăng nhập, bạn có thể sử dụng:\n` +
            `• ld  → Xem lịch dạy\n` +
            `• cnx → Xem lớp cần nhận xét\n` +
            `• cbt → Kiểm tra bài tập chưa chấm`,
        );
        return;
      }

      await zaloClient.sendText(
        userId,
        "Đang tải dữ liệu cá nhân của thầy/cô...",
      );

      // Call personal command handler
      await handlePersonalCommand(userId, commandType, session, cmdArg);
      return;
    }

    // Default: unknown command
    const menuCaption = `Trợ lý chưa hiểu lệnh "${text}".\n\n` + getMainMenu();
    await zaloClient.sendPhoto(userId, menuImageUrl, menuCaption);
  } catch (err) {
    console.error("[ZaloBot] handleWebhook error:", err.message);
  }
}

/**
 * Xử lý lệnh cá nhân của giáo viên đã đăng nhập
 */
async function handlePersonalCommand(userId, command, session, commandArg = "") {
  try {
    let lmsToken = session.lmsToken;
    let lmsClient = new LMSClient(lmsToken);

    // Helper to execute operations with auto-token-refresh
    const executeWithRetry = async (operation) => {
      try {
        return await operation(lmsClient);
      } catch (e) {
        const isAuthError = 
          e.message?.includes("401") ||
          e.message?.includes("Authentication failed") ||
          e.response?.status === 401 ||
          e.message?.includes("Unauthorized") ||
          (e.response?.data?.errors && e.response.data.errors.some(err => 
            err.message?.includes("Unauthorized") || 
            err.message?.includes("Authentication failed") ||
            err.message?.includes("401")
          ));

        if (isAuthError && session.lmsRefreshToken) {
          try {
            console.log("[ZaloBot] LMS token expired. Attempting refresh...");
            const refreshed = await refreshLmsToken(session.lmsRefreshToken);
            lmsToken = refreshed.idToken;
            session.lmsToken = lmsToken;
            if (refreshed.refreshToken) {
              session.lmsRefreshToken = refreshed.refreshToken;
            }
            await FirestoreZalo.saveUserSession(userId, session);
            lmsClient = new LMSClient(lmsToken);
            console.log("[ZaloBot] LMS token refreshed successfully. Retrying operation...");
            return await operation(lmsClient);
          } catch (refreshErr) {
            console.error("[ZaloBot] Failed to refresh token:", refreshErr.message);
            throw e;
          }
        }
        throw e;
      }
    };

    if (command === "lichday") {
      const now = new Date();
      const end = new Date(now);
      end.setDate(now.getDate() + 7);

      const dateGte = now.toISOString();
      const dateLte = end.toISOString();

      const schedules = await executeWithRetry((client) =>
        client.getTeacherSchedules(session.mindxUser.teacherId, dateGte, dateLte)
      );

      if (!schedules || schedules.length === 0) {
        const fromStr = now.toLocaleDateString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        });
        const toStr = end.toLocaleDateString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        });
        await zaloClient.sendText(
          userId,
          `✨ Tuyệt vời! Bạn không có lịch dạy nào từ ${fromStr} đến ${toStr}.`,
        );
        return;
      }

      // Sắp xếp lịch dạy theo thời gian tăng dần (sớm nhất lên đầu)
      schedules.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // Lấy danh sách classId duy nhất để gọi API lấy thông tin buổi (slots.index) chính xác
      const uniqueClassIds = new Set();
      schedules.forEach((s) => {
        if (s.type === "CLASS_SESSION" && s.classSite?.class?.id) {
          uniqueClassIds.add(s.classSite.class.id);
        }
      });

      const classDetailsMap = new Map();
      await Promise.all(
        Array.from(uniqueClassIds).map(async (classId) => {
          try {
            const details = await executeWithRetry((client) => client.getClassById(classId));
            if (details) {
              classDetailsMap.set(classId, details);
            }
          } catch (err) {
            console.error(
              `[ZaloBot] Failed to fetch class details for ${classId}:`,
              err.message,
            );
          }
        }),
      );

      // Tính số buổi theo từng lớp để hiển thị "Buổi X/Y" trong lịch Zalo
      const classSessionIndexMap = new Map();
      const classTotalSessionsMap = new Map();

      schedules
        .filter((s) => s.type === "CLASS_SESSION" && s.classSite?.class?.name)
        .forEach((s) => {
          const className = s.classSite.class.name;
          if (!classSessionIndexMap.has(className)) {
            classSessionIndexMap.set(className, []);
          }
          classSessionIndexMap.get(className).push(s);

          const classDetails = classDetailsMap.get(s.classSite.class.id);
          const totalSessions =
            classDetails?.numberOfSessions ||
            s.classSite?.class?.numberOfSessions;
          if (totalSessions && !classTotalSessionsMap.has(className)) {
            classTotalSessionsMap.set(className, Number(totalSessions));
          }
        });

      for (const [
        className,
        classSchedules,
      ] of classSessionIndexMap.entries()) {
        classSchedules.sort(
          (a, b) => new Date(a.startTime) - new Date(b.startTime),
        );
      }

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
        } else {
          // Fallback if date is invalid, though it shouldn't be with ISO strings
          dateKey = s.date ? s.date.split("T")[0] : dateKey;
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
          let displayName = s.classSite?.class?.name || s.title || "Không rõ";
          if (s.type === "CLASS_SESSION" && s.classSite?.class?.name) {
            const className = s.classSite.class.name;
            const classId = s.classSite.class.id;

            let sessionInfo = "";
            let computedSession = null;

            // Lấy chính xác buổi số của lớp học từ slots của API getClassById
            if (classId) {
              const classDetails = classDetailsMap.get(classId);
              if (classDetails && classDetails.slots) {
                const slot = classDetails.slots.find(
                  (slot) =>
                    slot.startTime === s.startTime &&
                    slot.endTime === s.endTime,
                );
                if (slot && typeof slot.index === "number") {
                  // API trả về index bắt đầu từ 0 (0-based)
                  computedSession = slot.index + 1;
                }
              }
            }

            if (computedSession !== null) {
              const examType = getSessionExamType(className, computedSession);
              if (examType === "checkpoint1") sessionInfo = "Checkpoint 1";
              else if (examType === "checkpoint2") sessionInfo = "Checkpoint 2";
              else if (examType === "demo") sessionInfo = "Demo";
              else {
                sessionInfo = `Buổi ${computedSession}`;
              }
            }

            // Fallback 1: Parse từ title
            if (!sessionInfo && s.title) {
              const titleLower = s.title.toLowerCase();
              if (titleLower.includes("checkpoint")) {
                const match = s.title.match(/checkpoint\s*\d*/i);
                sessionInfo = match ? match[0] : "Checkpoint";
              } else if (titleLower.includes("demo")) {
                const match = s.title.match(/demo\s*\d*/i);
                sessionInfo = match ? match[0] : "Demo";
              } else {
                const matchBuoi = s.title.match(/buổi\s*(\d+)(?:\/\d+)?/i);
                if (matchBuoi) {
                  sessionInfo = `Buổi ${matchBuoi[1]}`;
                } else if (s.title !== className) {
                  const cleaned = s.title
                    .replace(className, "")
                    .replace(/^[\s-:]+|[\s-:]+$/g, "");
                  if (cleaned) sessionInfo = cleaned;
                }
              }
            }

            // Fallback 2: Parse từ description
            if (!sessionInfo && s.description) {
              const matchSessionIndex = s.description.match(
                /(?:buổi|lesson|session)\s*(\d+)/i,
              );
              if (matchSessionIndex && matchSessionIndex[1]) {
                const sessionNum = parseInt(matchSessionIndex[1], 10);
                const examType = getSessionExamType(className, sessionNum);
                if (examType === "checkpoint1") sessionInfo = "Checkpoint 1";
                else if (examType === "checkpoint2")
                  sessionInfo = "Checkpoint 2";
                else if (examType === "demo") sessionInfo = "Demo";
                else {
                  sessionInfo = `Buổi ${sessionNum}`;
                }
              }
            }

            // Fallback 3: Lấy luôn title nếu khác class name mà chưa clean ra được
            if (!sessionInfo && s.title && s.title !== className) {
              let cleaned = s.title
                .replace(className, "")
                .replace(/^[\s-:]+|[\s-:]+$/g, "");
              cleaned = cleaned.replace(/buổi\s*(\d+)(?:\/\d+)?/i, "Buổi $1");
              sessionInfo = cleaned;
            }

            displayName = sessionInfo
              ? `${className} (${sessionInfo})`
              : className;
          }

          // Dùng icon đồng hồ dựa trên giờ bắt đầu nếu có thể, mặc định dùng 🕗
          let timeIcon = "🕗";
          if (start.startsWith("10:") || start.startsWith("11:"))
            timeIcon = "🕙";
          else if (start.startsWith("14:") || start.startsWith("15:"))
            timeIcon = "🕑";
          else if (start.startsWith("18:") || start.startsWith("19:"))
            timeIcon = "🕕";

          msg += `📚 ${displayName}\n${timeIcon} ${start} - ${end}\n\n`;
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
            roles: [], // Pass empty roles to bypass TE logic and fetch strictly this teacher's classes
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

      await executeWithRetry(async (client) => {
        await runQuery(client.token);
      });

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
    } else if (command === "checkbaitap") {
      const runningClasses = await executeWithRetry((client) =>
        ClassCacheService.getEnrichedClasses(
          client.token,
          session.mindxUser.teacherId,
          null, // centreIds
          [], // roles
          ["OPEN", "RUNNING"]
        )
      );

      if (!runningClasses || runningClasses.length === 0) {
        await zaloClient.sendText(
          userId,
          "🎉 Không tìm thấy lớp học đang hoạt động nào của thầy/cô.",
        );
        return;
      }

      // Filter out Robotics classes entirely
      const homeworkClasses = runningClasses.filter(
        (cls) => getCourseCategory(cls.name || cls.course?.shortName || "") !== "robotics"
      );

      if (homeworkClasses.length === 0) {
        await zaloClient.sendText(
          userId,
          "🎉 Không tìm thấy lớp học có bài tập nào đang hoạt động.",
        );
        return;
      }

      if (!commandArg) {
        // Fetch student submissions for each homework class and count ungraded & unsubmitted homework
        const summaryPromises = homeworkClasses.map(async (cls) => {
          try {
            const submissionsData = await executeWithRetry((client) =>
              client.getStudentSubmissionsByClass(cls.id)
            );
            const submissions = submissionsData.submissions || [];
            const students = submissionsData.students || [];
            const lessons = submissionsData.lessons || [];

            // Active lessons
            const activeLessons = lessons.filter((l) => l.isActive !== false);

            let ungradedCount = 0;
            let unsubmittedCount = 0;

            students.forEach((student) => {
              activeLessons.forEach((lesson) => {
                const studentSubs = submissions.filter(
                  (s) => s.studentUid === student.studentUid && s.lessonId === lesson.id
                );

                // Determine required components
                const classLessonSubs = submissions.filter((s) => s.lessonId === lesson.id);
                const classHasQuiz = classLessonSubs.some((s) => s.type === "QUIZ");
                const classHasFile = classLessonSubs.some((s) => s.type !== "QUIZ");

                const requiresQuiz = classHasQuiz || (!classHasQuiz && !classHasFile);
                const requiresFile = classHasFile || (!classHasQuiz && !classHasFile);

                let qDone = false;
                let qUngraded = false;
                if (requiresQuiz) {
                  const qSub = studentSubs.find((s) => s.type === "QUIZ");
                  if (qSub) {
                    qDone = ["GRADED", "MARKED", "SUBMITTED", "RE_SUBMITTED"].includes(qSub.status) ||
                            (qSub.score !== null && qSub.score !== undefined && qSub.score > 0);
                    qUngraded = ["SUBMITTED", "RE_SUBMITTED"].includes(qSub.status);
                  }
                }

                let fDone = false;
                let fUngraded = false;
                if (requiresFile) {
                  const fSub = studentSubs.find((s) => s.type !== "QUIZ");
                  if (fSub) {
                    fDone = ["GRADED", "MARKED", "SUBMITTED", "RE_SUBMITTED"].includes(fSub.status) ||
                            (fSub.score !== null && fSub.score !== undefined && fSub.score > 0);
                    fUngraded = ["SUBMITTED", "RE_SUBMITTED"].includes(fSub.status);
                  }
                }

                const isFullySubmitted = (!requiresQuiz || qDone) && (!requiresFile || fDone);

                if (isFullySubmitted) {
                  if ((requiresQuiz && qUngraded) || (requiresFile && fUngraded)) {
                    ungradedCount++;
                  }
                } else {
                  unsubmittedCount++;
                }
              });
            });

            return {
              className: cls.name,
              ungradedCount,
              unsubmittedCount,
            };
          } catch (err) {
            console.error(`[ZaloBot] Failed to get submissions for class ${cls.name}:`, err.message);
            return {
              className: cls.name,
              ungradedCount: null,
              unsubmittedCount: null,
            };
          }
        });

        const summaries = await Promise.all(summaryPromises);
        let msg = "📝 *TIẾN ĐỘ BÀI TẬP VỀ NHÀ*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━\n\n";

        const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

        summaries.forEach((s, idx) => {
          const classEmoji = numberEmojis[idx] || `${idx + 1}.`;
          if (s.ungradedCount === null) {
            msg += `${classEmoji} 🏫 *Lớp*: ${s.className}\n   ⚠️ Lỗi khi tải dữ liệu bài tập\n\n`;
          } else {
            msg += `${classEmoji} 🏫 *Lớp*: ${s.className}\n`;
            msg += `   ➜ 🟡 Chưa chấm: *${s.ungradedCount}* bài\n`;
            msg += `   ➜ 🔴 Chưa nộp: *${s.unsubmittedCount}* bài\n\n`;
          }
        });

        msg += "━━━━━━━━━━━━━━━━━━━━\n";
        msg += `💡 *Mẹo*: Gõ "cbt <số_thứ_tự>" hoặc "cbt <tên_lớp>" để xem chi tiết bài chưa hoàn thành.\nVí dụ: cbt 1`;
        await zaloClient.sendText(userId, msg);
        return;
      }

      // Search for the matching class in homeworkClasses only
      const queryTrimmed = commandArg.trim();
      let matchedClass = null;

      const targetIndex = parseInt(queryTrimmed, 10);
      if (!isNaN(targetIndex) && targetIndex > 0) {
        if (targetIndex <= homeworkClasses.length) {
          matchedClass = homeworkClasses[targetIndex - 1];
        } else {
          await zaloClient.sendText(
            userId,
            `❌ Số thứ tự ${targetIndex} vượt quá danh sách lớp có bài tập (tối đa ${homeworkClasses.length} lớp).`,
          );
          return;
        }
      } else {
        const queryLower = queryTrimmed.toLowerCase();
        matchedClass = homeworkClasses.find(
          (cls) =>
            cls.name.toLowerCase().includes(queryLower) ||
            cls.id.toLowerCase() === queryLower
        );
      }

      if (!matchedClass) {
        await zaloClient.sendText(
          userId,
          `❌ Không tìm thấy lớp học có bài tập nào khớp với từ khóa "${commandArg}".\n\nDanh sách lớp có bài tập:\n` +
            homeworkClasses.map((cls) => `• ${cls.name}`).join("\n"),
        );
        return;
      }

      // Fetch class detail to get teacher information
      let classData = null;
      try {
        classData = await executeWithRetry((client) => client.getClassById(matchedClass.id));
      } catch (err) {
        console.error(`[ZaloBot] Failed to get class details for ${matchedClass.name}:`, err.message);
        await zaloClient.sendText(
          userId,
          `❌ Không thể tải thông tin chi tiết lớp ${matchedClass.name}. Vui lòng thử lại sau.`,
        );
        return;
      }

      // Fetch submissions
      let submissionsData = null;
      try {
        submissionsData = await executeWithRetry((client) => client.getStudentSubmissionsByClass(matchedClass.id));
      } catch (err) {
        console.error(`[ZaloBot] Failed to get student submissions for ${matchedClass.name}:`, err.message);
        await zaloClient.sendText(
          userId,
          `❌ Không thể tải dữ liệu bài nộp lớp ${matchedClass.name}. Vui lòng thử lại sau.`,
        );
        return;
      }

      // 1. Map studentUid to the teacher who graded their past homework
      const studentToTeacherMap = new Map(); // studentUid -> teacherInfo (from classData.teachers)
      
      const classTeachers = classData.teachers || [];
      const submissions = submissionsData.submissions || [];
      const studentsList = submissionsData.students || [];
      const lessonsList = submissionsData.lessons || [];

      // Helper to find teacher in classTeachers by markedBy (which could be ID, username, code, email)
      const findTeacherByMarkedBy = (markedBy) => {
        if (!markedBy) return null;
        const normalizedMarkedBy = markedBy.toLowerCase().trim();
        return classTeachers.find((tAssignment) => {
          const t = tAssignment.teacher;
          if (!t) return false;
          return (
            (t.id && t.id.toLowerCase() === normalizedMarkedBy) ||
            (t.username && t.username.toLowerCase() === normalizedMarkedBy) ||
            (t.code && t.code.toLowerCase() === normalizedMarkedBy) ||
            (t.email && t.email.toLowerCase() === normalizedMarkedBy)
          );
        });
      };

      submissions.forEach((sub) => {
        const isGraded =
          ["GRADED", "MARKED"].includes(sub.status) ||
          (sub.score !== null && sub.score !== undefined && sub.score > 0) ||
          (sub.markedBy && sub.markedBy.trim() !== "");

        if (isGraded && sub.markedBy) {
          const matchedTeacher = findTeacherByMarkedBy(sub.markedBy);
          if (matchedTeacher) {
            studentToTeacherMap.set(sub.studentUid, matchedTeacher);
          }
        }
      });

      const activeTAs = classTeachers.filter(
        (t) => t.role?.shortName === "TA" && t.isActive !== false
      );
      const activeLECs = classTeachers.filter(
        (t) => t.role?.shortName === "LEC" && t.isActive !== false
      );

      let defaultFallbackTeacher = null;
      if (activeTAs.length === 1) {
        defaultFallbackTeacher = activeTAs[0];
      } else if (activeTAs.length === 0 && activeLECs.length === 1) {
        defaultFallbackTeacher = activeLECs[0];
      }

      // Find all taught lesson IDs from past slots and existing submissions
      const now = new Date();
      const taughtLessonIds = new Set();
      
      // 1. From past slots
      (classData.slots || []).forEach((slot) => {
        const start = new Date(slot.startTime);
        if (!isNaN(start.getTime()) && start < now && slot.learningLessonId) {
          taughtLessonIds.add(slot.learningLessonId);
        }
      });
      
      // 2. From any existing submissions (in case slot time is missing or incorrect)
      submissions.forEach((sub) => {
        if (sub.lessonId) {
          taughtLessonIds.add(sub.lessonId);
        }
      });

      let activeLessons = lessonsList.filter((lesson) => taughtLessonIds.has(lesson.id));
      if (activeLessons.length === 0) {
        // Fallback to active lessons in lessonsList
        activeLessons = lessonsList.filter((lesson) => lesson.isActive !== false);
      }

      // Grouping structure: teacherFullName -> Map<lessonName, Array<{ studentName, status, statusText }>>
      const groupedReport = new Map();
      let totalUngradedCount = 0;
      let totalUnsubmittedCount = 0;

      studentsList.forEach((student) => {
        let responsibleTeacher = studentToTeacherMap.get(student.studentUid) || defaultFallbackTeacher;
        
        let teacherKey = "Chưa phân công";
        if (responsibleTeacher && responsibleTeacher.teacher) {
          const roleSuffix = responsibleTeacher.role?.shortName 
            ? ` (${responsibleTeacher.role.shortName})` 
            : "";
          teacherKey = `${responsibleTeacher.teacher.fullName}${roleSuffix}`;
        }

        if (!groupedReport.has(teacherKey)) {
          groupedReport.set(teacherKey, new Map());
        }
        const teacherMap = groupedReport.get(teacherKey);

        activeLessons.forEach((lesson) => {
          const studentSubs = submissions.filter(
            (s) => s.studentUid === student.studentUid && s.lessonId === lesson.id
          );

          // Determine required components for this lesson based on type and name heuristics
          const nameLower = lesson.name.toLowerCase();
          const isCheckpoint = nameLower.includes("checkpoint") || 
                               nameLower.includes("kiểm tra") || 
                               nameLower.includes("test") || 
                               nameLower.includes("demo") || 
                               nameLower.includes("cuối khóa");

          let requiresQuiz = false;
          let requiresFile = false;

          if (isCheckpoint) {
            requiresFile = true;
          } else if (lesson.type === "QUIZ") {
            requiresQuiz = true;
          } else {
            // Standard homework usually requires both.
            // Check if there are any submissions in the class for this lesson.
            const classLessonSubs = submissions.filter((s) => s.lessonId === lesson.id);
            const hasQuizSub = classLessonSubs.some((s) => s.type === "QUIZ");
            const hasFileSub = classLessonSubs.some((s) => s.type !== "QUIZ");

            if (hasQuizSub || hasFileSub) {
              requiresQuiz = hasQuizSub;
              requiresFile = hasFileSub;
            } else {
              // Fallback
              requiresQuiz = true;
              requiresFile = true;
            }
          }

          let status = "UNSUBMITTED"; // UNSUBMITTED, UNGRADED, GRADED
          let statusText = "Chưa nộp";

          // Evaluate quiz status
          let qDone = false;
          let qUngraded = false;
          let qReSubmitted = false;

          if (requiresQuiz) {
            const qSub = studentSubs.find((s) => s.type === "QUIZ");
            if (qSub) {
              qDone = ["GRADED", "MARKED", "SUBMITTED", "RE_SUBMITTED"].includes(qSub.status) ||
                      (qSub.score !== null && qSub.score !== undefined && qSub.score > 0);
              qUngraded = ["SUBMITTED", "RE_SUBMITTED"].includes(qSub.status);
              qReSubmitted = qSub.status === "RE_SUBMITTED";
            }
          }

          // Evaluate file status
          let fDone = false;
          let fUngraded = false;
          let fReSubmitted = false;

          if (requiresFile) {
            const fSub = studentSubs.find((s) => s.type !== "QUIZ");
            if (fSub) {
              fDone = ["GRADED", "MARKED", "SUBMITTED", "RE_SUBMITTED"].includes(fSub.status) ||
                      (fSub.score !== null && fSub.score !== undefined && fSub.score > 0);
              fUngraded = ["SUBMITTED", "RE_SUBMITTED"].includes(fSub.status);
              fReSubmitted = fSub.status === "RE_SUBMITTED";
            }
          }

          // Check overall completion
          const isFullySubmitted = (!requiresQuiz || qDone) && (!requiresFile || fDone);

          if (isFullySubmitted) {
            const hasPendingUngraded = (requiresQuiz && qUngraded) || (requiresFile && fUngraded);
            if (hasPendingUngraded) {
              status = "UNGRADED";
              const isReSub = (requiresQuiz && qReSubmitted) || (requiresFile && fReSubmitted);
              statusText = isReSub ? "Chưa chấm (Nộp lại)" : "Chưa chấm";
              totalUngradedCount++;
            } else {
              status = "GRADED";
            }
          } else {
            status = "UNSUBMITTED";
            statusText = "Chưa nộp";
            totalUnsubmittedCount++;
          }

          if (status !== "GRADED") {
            const lessonName = lesson.name;
            if (!teacherMap.has(lessonName)) {
              teacherMap.set(lessonName, []);
            }
            teacherMap.get(lessonName).push({
              studentName: student.displayName || student.fullName || "Học viên ẩn danh",
              status,
              statusText,
            });
          }
        });
      });

      // Format response message using tree structure and grouped status lines
      let msg = `📝 *TIẾN ĐỘ BÀI TẬP CHI TIẾT* - *${matchedClass.name}*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      let hasAnyPending = false;

      groupedReport.forEach((lessonsMap, teacherName) => {
        const entries = Array.from(lessonsMap.entries()).filter(([_, students]) => students.length > 0);
        if (entries.length === 0) return;

        hasAnyPending = true;
        let teacherEmoji = "👤";
        if (teacherName.includes("(LEC)")) {
          teacherEmoji = "👨‍🏫";
        } else if (teacherName.includes("(TA)")) {
          teacherEmoji = "🧑‍💻";
        }
        msg += `${teacherEmoji} *${teacherName}*\n`;

        entries.forEach(([lessonName, students], lIdx) => {
          const isLastLesson = lIdx === entries.length - 1;
          const lessonPrefix = isLastLesson ? " └─ 📘 " : " ├─ 📘 ";
          msg += `${lessonPrefix}*${lessonName}*\n`;

          const unsubmitted = students.filter((s) => s.status === "UNSUBMITTED");
          const ungraded = students.filter((s) => s.status === "UNGRADED");

          const lines = [];
          if (unsubmitted.length > 0) {
            const namesStr = unsubmitted.map((s) => s.studentName).join(", ");
            lines.push({
              emoji: "🔴",
              label: "Chưa nộp",
              val: namesStr,
            });
          }
          if (ungraded.length > 0) {
            const namesStr = ungraded.map((s) => {
              const suffix = s.statusText.includes("Nộp lại") || s.statusText.includes("nộp lại") ? " (Nộp lại)" : "";
              return `${s.studentName}${suffix}`;
            }).join(", ");
            lines.push({
              emoji: "🟡",
              label: "Chưa chấm",
              val: namesStr,
            });
          }

          lines.forEach((line, lineIdx) => {
            const isLastLine = lineIdx === lines.length - 1;
            let linePrefix = "";
            if (isLastLesson) {
              linePrefix = isLastLine ? "    └─ " : "    ├─ ";
            } else {
              linePrefix = isLastLine ? " │  └─ " : " │  ├─ ";
            }
            msg += `${linePrefix}${line.emoji} *${line.label}*: ${line.val}\n`;
          });
        });
        msg += "\n";
      });

      if (!hasAnyPending) {
        await zaloClient.sendText(
          userId,
          `🎉 *Tuyệt vời!* Lớp *${matchedClass.name}* đã hoàn thành 100% việc làm và chấm bài tập về nhà.`,
        );
        return;
      }

      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🔴 *Chưa nộp*: *${totalUnsubmittedCount}* bài\n`;
      msg += `🟡 *Chưa chấm*: *${totalUngradedCount}* bài\n`;
      msg += `👉 *Tổng số việc cần xử lý*: *${totalUnsubmittedCount + totalUngradedCount}* bài`;

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
    const config = await ZaloData.getGlobalConfig();
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
          await ZaloData.saveGlobalConfig(config);

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

const getGlobalBotSettings = async (req, res) => {
  const config = await ZaloData.getGlobalConfig();
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

const updateGlobalBotSettings = async (req, res) => {
  const { reminderTimes, linkCurrentUser } = req.body;
  const config = await ZaloData.getGlobalConfig();

  if (reminderTimes !== undefined) {
    config.reminderTimes = reminderTimes;
  }

  // Link the current logged in user's LMS session to the bot
  if (linkCurrentUser && req.body.lmsToken) {
    config.lmsToken = req.body.lmsToken;
    config.lmsRefreshToken = req.body.lmsRefreshToken || null;
    config.mindxUser = req.body.mindxUser || null;
  }

  await ZaloData.saveGlobalConfig(config);

  // Restart scheduler to pick up new times
  const zaloScheduler = require("../services/zaloScheduler");
  await zaloScheduler.restartScheduler();

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
