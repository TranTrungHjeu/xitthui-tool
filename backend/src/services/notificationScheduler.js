const cron = require("node-cron");
const FirestoreNotification = require("../storage/notificationStorage");
const LMSClient = require("./lmsClient");
const ClassCacheService = require("./classCache");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { extractHHMM, getVietnamNow } = require("../utils/classHelpers");
const { withRetry, runWithStatusTracking } = require("../utils/schedulerUtils");
const { getTdmCentreId } = require("../constants/centreIds");

const SCHEDULER_NAME = "NotificationScheduler";

class NotificationScheduler {
  static start() {
    // Chạy mỗi 30 phút theo giờ Việt Nam
    cron.schedule(
      "*/30 * * * *",
      async () => {
        console.log(
          `[${SCHEDULER_NAME}] Starting periodic notification sync...`,
        );
        await this.runSyncWithRetry();
      },
      {
        timezone: "Asia/Ho_Chi_Minh",
      },
    );
    console.log(`[${SCHEDULER_NAME}] Initialized.`);

    // Chạy một lần lúc khởi động
    setTimeout(() => {
      this.runSyncWithRetry();
    }, 10000); // Đợi 10s sau khi start server

    // Khởi động weekly digest scheduler với retry logic
    const WeeklyDigestScheduler = require("./weeklyDigestScheduler");
    const MAX_SCHEDULER_RETRIES = 3;
    const SCHEDULER_RETRY_DELAY_MS = 1000;

    async function startWeeklyDigestSchedulerWithRetry(attempt = 1) {
      try {
        WeeklyDigestScheduler.start();
        console.log("[NotificationScheduler] Weekly digest scheduler started successfully.");
      } catch (e) {
        if (attempt < MAX_SCHEDULER_RETRIES) {
          const delay = SCHEDULER_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(
            `[NotificationScheduler] Failed to start weekly digest scheduler (attempt ${attempt}/${MAX_SCHEDULER_RETRIES}): ${e.message}. Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          return startWeeklyDigestSchedulerWithRetry(attempt + 1);
        } else {
          console.error(
            `[NotificationScheduler] CRITICAL: Failed to start weekly digest scheduler after ${MAX_SCHEDULER_RETRIES} attempts. Weekly digest notifications will not be sent. Error: ${e.message}`,
            e.stack
          );
        }
      }
    }

    startWeeklyDigestSchedulerWithRetry();
  }

  /**
   * Run the sync with retry logic and status tracking
   */
  static async runSyncWithRetry(forceSendEmails = false) {
    return runWithStatusTracking(
      SCHEDULER_NAME,
      () => this.syncAllNotifications(forceSendEmails),
      { maxRetries: 3, baseDelayMs: 2000 },
    );
  }

  static async sendReminderEmails() {
    console.log(`[${SCHEDULER_NAME}] Manual sendReminderEmails triggered.`);
    await this.runSyncWithRetry(true);
  }

  static async syncAllNotifications(forceSendEmails = false) {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        console.warn(
          "[NotificationScheduler] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping background sync.",
        );
        return;
      }

      console.log(
        "[NotificationScheduler] Authenticating with Master Account...",
      );
      let authData;
      try {
        // Thử login bằng username flow trước
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword,
        );
      } catch (authErr) {
        console.warn(
          "[NotificationScheduler] Username login failed, trying Firebase flow...",
        );
        try {
          // Fallback sang Firebase flow nếu username không hoạt động
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword,
          );
        } catch (fallbackErr) {
          console.error(
            "[NotificationScheduler] Master authentication failed on both flows. Skipping sync.",
            fallbackErr.message,
          );
          return;
        }
      }

      const { lmsToken: token, mindxUser } = authData;
      const { teacherId, centreIds, appRoles: roles } = mindxUser;

      // Mặc định trung tâm Thủ Dầu Một nếu không có centreIds
      const tdmCentreId = getTdmCentreId();
      const finalCentreIds =
        centreIds && centreIds.length > 0
          ? centreIds
          : [tdmCentreId];

      console.log(
        `[NotificationScheduler] Master authenticated successfully. Processing classes for centres:`,
        finalCentreIds,
      );

      const processedClassIds = new Set();

      try {
        // Lấy danh sách toàn bộ lớp chạy theo centre của tài khoản Master
        const allEnrichedClasses = await ClassCacheService.getEnrichedClasses(
          token,
          teacherId,
          finalCentreIds,
          roles,
          ["OPEN", "RUNNING", "FINISHED"],
        );

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const runningClasses = allEnrichedClasses.filter((cls) => {
          if (["OPEN", "RUNNING"].includes(cls.status)) return true;
          if (cls.status === "FINISHED" && cls.endDate) {
            try {
              const endD = new Date(cls.endDate);
              return endD >= thirtyDaysAgo;
            } catch (e) {
              return false;
            }
          }
          return false;
        });

        const classIdsToFetch = [];
        const classCentres = {}; // Map classId -> centreIds

        for (const cls of runningClasses) {
          if (!processedClassIds.has(cls.id)) {
            classIdsToFetch.push(cls.id);
            processedClassIds.add(cls.id);
            // Lưu lại centreId để gán vào ticket
            if (cls.centre?.id) {
              classCentres[cls.id] = [cls.centre.id];
            } else if (cls.course?.centre?.id) {
              classCentres[cls.id] = [cls.course.centre.id];
            } else {
              classCentres[cls.id] = [];
            }
          }
        }

        if (classIdsToFetch.length === 0) {
          console.log("[NotificationScheduler] No classes to process.");
          return;
        }

        // Fetch chi tiết lớp học
        const client = new LMSClient(token);

        // Chunk để tránh nghẽn
        const chunkSize = 5;
        const fetchedDetails = [];

        for (let i = 0; i < classIdsToFetch.length; i += chunkSize) {
          const chunk = classIdsToFetch.slice(i, i + chunkSize);
          try {
            const fetchPromises = chunk.map((id) =>
              client.getClassesNotificationsDetails([id]),
            );
            const results = await Promise.all(fetchPromises);
            fetchedDetails.push(...results.flat());
          } catch (err) {
            console.error(
              `[NotificationScheduler] Error fetching chunk details for teacher ${teacherId}:`,
              err.message,
            );
          }
        }

        // Tính toán ticket
        const now = new Date();
        const vietnamNow = getVietnamNow(now);
        const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

        const getTeacherNamesAndEmails = (teachersList, roleShortName) => {
          if (!Array.isArray(teachersList)) return { name: "N/A", emails: [] };
          const matched = teachersList.filter(
            (t) => t.role?.shortName === roleShortName && t.isActive !== false,
          );
          if (matched.length > 0) {
            const name = matched
              .map((t) => t.teacher?.fullName)
              .filter(Boolean)
              .join(", ");
            const emails = matched
              .map((t) => t.teacher?.email) // Chỉ dùng email công việc, không fallback personalEmail
              .filter(Boolean);
            return { name, emails };
          }
          return { name: "N/A", emails: [] };
        };

        const ticketsByClass = {};
        const emailNotificationsByTeacher = {};

        for (const cls of fetchedDetails) {
          if (!cls || !cls.id || !cls.slots || cls.slots.length === 0) continue;

          // Sắp xếp các slot theo trình tự thời gian để tính fallback index
          const parseSlotDateForSorting = (dateVal, timeVal) => {
            if (!dateVal) return 0;
            let dateStr;
            if (typeof dateVal === "string" && dateVal.includes("/")) {
              const [d, m, y] = dateVal.split("/").map(Number);
              dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            } else {
              dateStr = String(dateVal).split("T")[0];
            }
            if (!timeVal) return new Date(`${dateStr}T00:00:00+07:00`).getTime();
            const parts = timeVal.split(":");
            const hour = parseInt(parts[0], 10) || 0;
            const minute = parseInt(parts[1], 10) || 0;
            return new Date(
              `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`
            ).getTime();
          };

          const sortedSlots = [...cls.slots].sort((a, b) => {
            return parseSlotDateForSorting(a.date, a.startTime) - parseSlotDateForSorting(b.date, b.startTime);
          });

          const classTickets = [];
          cls.slots.forEach((slot) => {
            if (!slot.date || !slot.endTime) return;

            let slotEndDateTime;
            try {
              // Extract date part
              let dateStr;
              if (typeof slot.date === "string" && slot.date.includes("/")) {
                const [d, m, y] = slot.date.split("/").map(Number);
                dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              } else {
                dateStr = String(slot.date).split("T")[0];
              }

              // Extract wall-clock HH:mm directly (avoids +08:00 vs +07:00 offset bug)
              const hhmm = extractHHMM(slot.endTime);
              if (!hhmm) return;

              // Build Vietnam-time Date with explicit +07:00 offset.
              slotEndDateTime = new Date(
                `${dateStr}T${String(hhmm.hour).padStart(2, "0")}:${String(hhmm.minute).padStart(2, "0")}:00+07:00`,
              );
              if (isNaN(slotEndDateTime.getTime())) return;
            } catch (e) {
              return;
            }

            const timeDiff = now.getTime() - slotEndDateTime.getTime();

            if (timeDiff > 0) {
              const studentsNeedingFeedback = (
                slot.studentAttendance || []
              ).filter(
                (sa) =>
                  (sa.status === "PRESENT" ||
                    sa.status === "ATTENDED" ||
                    sa.status === "LATE" ||
                    sa.status === "LATE_ARRIVED") &&
                  (!sa.comment || sa.comment.trim() === ""),
              );

              if (studentsNeedingFeedback.length > 0) {
                const isLate = timeDiff > FORTY_EIGHT_HOURS;

                const teachersToUse =
                  slot.teachers && slot.teachers.length > 0
                    ? slot.teachers
                    : cls.teachers;
                const taData = getTeacherNamesAndEmails(teachersToUse, "TA");
                const lecData = getTeacherNamesAndEmails(teachersToUse, "LEC");
                const teData = getTeacherNamesAndEmails(teachersToUse, "TE");

                const taName = taData.name;
                const lecName = lecData.name;
                const teName = teData.name;

                // Chuẩn bị dữ liệu gửi email
                const notificationInfo = {
                  classId: cls.id,
                  className: cls.name,
                  date: slot.date,
                  studentCount: studentsNeedingFeedback.length,
                  isLate,
                };

                const addEmailNotifications = (emails, name) => {
                  emails.forEach((email) => {
                    if (!emailNotificationsByTeacher[email]) {
                      emailNotificationsByTeacher[email] = {
                        teacherName: name, // lấy tên đại diện
                        pendingClasses: [],
                      };
                    }
                    emailNotificationsByTeacher[email].pendingClasses.push(
                      notificationInfo,
                    );
                  });
                };

                // Chỉ gửi email cho LEC của buổi học đó
                if (lecData.emails.length > 0) {
                  addEmailNotifications(lecData.emails, lecName);
                }

                // Lấy danh sách ID các giáo viên để filter
                const teacherIdsForSlot = teachersToUse
                  .filter((t) => t.isActive !== false && t.teacher?.id)
                  .map((t) => t.teacher.id);

                // Xác định sessionIndex (ưu tiên slot.index, nếu không có hoặc null thì dùng vị trí trong sortedSlots)
                let resolvedSessionIndex = slot.index;
                if (resolvedSessionIndex === undefined || resolvedSessionIndex === null) {
                  resolvedSessionIndex = sortedSlots.findIndex(
                    (s) => s.date === slot.date && s.startTime === slot.startTime
                  );
                  if (resolvedSessionIndex === -1) resolvedSessionIndex = 0;
                }

                classTickets.push({
                  classId: cls.id,
                  className: cls.name,
                  date: slot.date,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  sessionIndex: resolvedSessionIndex,
                  studentCount: studentsNeedingFeedback.length,
                  isLate,
                  lec: lecName !== "N/A" ? lecName : null,
                  ta: taName !== "N/A" ? taName : null,
                  te: teName !== "N/A" ? teName : null,
                  teacherIds: teacherIdsForSlot,
                  centreIds: classCentres[cls.id] || [],
                });
              }
            }
          });

          ticketsByClass[cls.id] = classTickets;
        }

        // Lưu theo batch
        for (const [classId, tickets] of Object.entries(ticketsByClass)) {
          await FirestoreNotification.saveBatchTickets(tickets, classId);
        }

        // Dọn dẹp các ticket mồ côi của các lớp không còn được giám sát (không thuộc OPEN/RUNNING hay FINISHED dưới 30 ngày)
        try {
          const { Class, NotificationTicket } = require("../storage/mongoModels");
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const activeClasses = await Class.find({
            $or: [
              { status: { $in: ["OPEN", "RUNNING"] } },
              { status: "FINISHED", endDate: { $gte: thirtyDaysAgo.toISOString().split("T")[0] } }
            ]
          }).select("_id").lean();
          const activeClassIds = activeClasses.map(c => c._id);
          const deleteResult = await NotificationTicket.deleteMany({ classId: { $nin: activeClassIds } });
          if (deleteResult.deletedCount > 0) {
            console.log(`[NotificationScheduler] Cleared ${deleteResult.deletedCount} orphaned tickets for non-active classes.`);
          }
        } catch (cleanupErr) {
          console.error("[NotificationScheduler] Error cleaning up orphaned tickets:", cleanupErr.message);
        }

        // Gửi email
        const emailService = require("./emailService");
        const NotificationEmailLog = require("../storage/emailLogModel");

        // Chỉ gửi email nếu đang là giờ hành chính (ví dụ 8h sáng) để tránh spam mỗi 30 phút.
        const currentHour = vietnamNow.hour;
        const dayKey = vietnamNow.dayKey;

        if (forceSendEmails || (currentHour >= 8 && currentHour < 9)) {
          const emails = Object.keys(emailNotificationsByTeacher);
          console.log(
            `[NotificationScheduler] Sending emails for ${emails.length} teachers (forceSendEmails=${forceSendEmails}).`,
          );

          // Build list of dedupe ids for the bulk lookup. Dedupe key = dayKey
          // so the same teacher doesn't get the same reminder twice on the
          // same day, even across multiple 30-min cron ticks.
          const dedupeIds = emails.map(
            (email) => `reminder:${email}:${dayKey}`,
          );

          let alreadySent = new Set();
          try {
            const existing = await NotificationEmailLog.find({
              _id: { $in: dedupeIds },
              status: "sent",
            })
              .select("_id")
              .lean();
            alreadySent = new Set(existing.map((d) => d._id));
          } catch (logErr) {
            console.warn(
              "[NotificationScheduler] Failed to read email log (continuing):",
              logErr.message,
            );
          }

          let sentCount = 0;
          let skippedCount = 0;
          let failedCount = 0;

          for (const email of emails) {
            const data = emailNotificationsByTeacher[email];
            const logId = `reminder:${email}:${dayKey}`;
            if (!forceSendEmails && alreadySent.has(logId)) {
              skippedCount += 1;
              continue;
            }
            let result;
            try {
              result = await emailService.sendReminderEmail(
                email,
                data.teacherName,
                data.pendingClasses,
                { dayKey, classSummary: data.pendingClasses.length },
              );
            } catch (sendErr) {
              console.error(
                `[NotificationScheduler] Unhandled send error for ${email}:`,
                sendErr.message,
              );
              result = { ok: false, error: sendErr.message };
            }
            const ok = result === true || (result && result.ok === true);
            const messageId = result && result.messageId ? result.messageId : null;
            const errorMsg = ok
              ? null
              : (result && result.error) || "send failed";
            if (ok) sentCount += 1;
            else failedCount += 1;

            try {
              await NotificationEmailLog.findOneAndUpdate(
                { _id: logId },
                {
                  _id: logId,
                  kind: "reminder",
                  email,
                  dedupeKey: dayKey,
                  teacherName: data.teacherName,
                  subject: "[MindX] Nhắc nhở đánh giá học viên",
                  messageId,
                  status: ok ? "sent" : "failed",
                  error: errorMsg,
                  context: { classCount: data.pendingClasses.length },
                  sentAt: new Date(),
                  updatedAt: new Date(),
                },
                { upsert: true },
              );
            } catch (logErr) {
              console.warn(
                `[NotificationScheduler] Failed to write email log for ${email}:`,
                logErr.message,
              );
            }
          }

          console.log(
            `[NotificationScheduler] Email send summary: sent=${sentCount}, skipped=${skippedCount}, failed=${failedCount}.`,
          );
        } else {
          console.log(
            `[NotificationScheduler] Skip sending emails (Current hour is ${currentHour}, emails are only sent between 8-9 AM).`,
          );
        }
      } catch (err) {
        console.error(
          `[NotificationScheduler] Error syncing for Master Account:`,
          err.message,
        );
      }

      console.log(
        `[NotificationScheduler] Completed sync. Processed ${processedClassIds.size} classes.`,
      );
    } catch (err) {
      console.error(
        "[NotificationScheduler] Fatal error during sync:",
        err.message,
      );
    }
  }
}

module.exports = NotificationScheduler;
