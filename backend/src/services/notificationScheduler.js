const cron = require("node-cron");
const FirestoreNotification = require("../storage/notificationStorage");
const LMSClient = require("./lmsClient");
const ClassCacheService = require("./classCache");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { extractHHMM } = require("../utils/classHelpers");

class NotificationScheduler {
  static start() {
    // Chạy mỗi 30 phút
    cron.schedule("*/30 * * * *", async () => {
      console.log(
        "[NotificationScheduler] Starting periodic notification sync...",
      );
      await this.syncAllNotifications();
    });
    console.log("[NotificationScheduler] Initialized.");

    // Chạy một lần lúc khởi động
    setTimeout(() => {
      this.syncAllNotifications();
    }, 10000); // Đợi 10s sau khi start server
  }

  static async sendReminderEmails() {
    console.log("[NotificationScheduler] Manual sendReminderEmails triggered.");
    await this.syncAllNotifications(true);
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

      // Mặc định trung tâm Thủ Dầu Một ('6443460f94300678908f7974') nếu không có centreIds
      const finalCentreIds =
        centreIds && centreIds.length > 0
          ? centreIds
          : ["6443460f94300678908f7974"];

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
              .map((t) => t.teacher?.email || t.teacher?.personalEmail) // Dùng email công việc MindX, fallback về personalEmail
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

              // Build local-time Date (no timezone suffix → treated as Vietnam local time)
              slotEndDateTime = new Date(
                `${dateStr}T${String(hhmm.hour).padStart(2, "0")}:${String(hhmm.minute).padStart(2, "0")}:00`
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

                addEmailNotifications(taData.emails, taName);
                addEmailNotifications(lecData.emails, lecName);
                addEmailNotifications(teData.emails, teName);

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

        // Chỉ gửi email nếu đang là giờ hành chính (ví dụ 8h sáng) để tránh spam mỗi 30 phút.
        // Tùy theo nhu cầu thực tế. Hiện tại sẽ gửi luôn khi có ticket mới.
        // Bạn có thể comment/uncomment block kiểm tra giờ dưới đây:

        const currentHour = now.getHours();
        // Chỉ gửi email vào lúc 8h đến 9h sáng hoặc khi được gọi thủ công (forceSendEmails = true)
        if (forceSendEmails || (currentHour >= 8 && currentHour < 9)) {
          console.log(
            `[NotificationScheduler] Sending emails for ${Object.keys(emailNotificationsByTeacher).length} teachers (forceSendEmails=${forceSendEmails}).`,
          );
          for (const [email, data] of Object.entries(
            emailNotificationsByTeacher,
          )) {
            await emailService.sendReminderEmail(
              email,
              data.teacherName,
              data.pendingClasses,
            );
          }
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
