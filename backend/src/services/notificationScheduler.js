const cron = require("node-cron");
const FirestoreNotification = require("../storage/notificationStorage");
const LMSClient = require("./lmsClient");
const ClassCacheService = require("./classCache");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { extractHHMM, getVietnamNow } = require("../utils/classHelpers");
const { runWithStatusTracking } = require("../utils/schedulerUtils");
const { getTdmCentreId } = require("../constants/centreIds");
const { ATTENDED_STATUSES } = require("../constants/attendanceStatuses");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("NotificationScheduler");

const SCHEDULER_NAME = "NotificationScheduler";

// Two triggers only:
//   1. Cron "0 0 * * *" Asia/Ho_Chi_Minh -> daily 00:00 send reminder emails.
//   2. POST /api/classes/notifications/send-emails-now -> manual send for TE role.
class NotificationScheduler {
  static start() {
    cron.schedule(
      "0 0 * * *",
      async () => {
        log.info(`[${SCHEDULER_NAME}] Daily 00:00 tick: sending reminder emails.`);
        await this.runEmailSend();
      },
      { timezone: "Asia/Ho_Chi_Minh" },
    );
    log.info(`[${SCHEDULER_NAME}] Initialized (daily 00:00 cron registered).`);

    // Weekly digest scheduler is independent and out of scope here.
    const WeeklyDigestScheduler = require("./weeklyDigestScheduler");
    try {
      WeeklyDigestScheduler.start();
    } catch (e) {
      log.error(
        `[${SCHEDULER_NAME}] Failed to start weekly digest scheduler: ${e.message}`,
        e.stack,
      );
    }
  }

  // Triggered by cron 0h. Always sends.
  static runEmailSend() {
    return runWithStatusTracking(
      SCHEDULER_NAME,
      () => this.syncAndSendEmails(),
      { maxRetries: 3, baseDelayMs: 2000 },
    );
  }

  // Triggered by manual button (TE role). Always sends (no dedupe).
  static async sendReminderEmailsNow() {
    log.info(`[${SCHEDULER_NAME}] Manual send triggered.`);
    return this.syncAndSendEmails();
  }

  // Triggered by the TE dashboard sync button. Refreshes tickets without email.
  static async syncTicketsOnly() {
    log.info(`[${SCHEDULER_NAME}] Ticket-only sync triggered.`);
    await this.syncAndSendEmails(false);
    const { caches } = require("../controllers/class/_shared");
    caches.notificationCache.flushAll();
  }

  static async syncAndSendEmails(sendEmails = true) {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        log.warn(
          `[${SCHEDULER_NAME}] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping.`,
        );
        return;
      }

      log.info(`[${SCHEDULER_NAME}] Authenticating with Master Account...`);
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword,
        );
      } catch (authErr) {
        log.warn(
          `[${SCHEDULER_NAME}] Username login failed, trying Firebase flow...`,
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword,
          );
        } catch (fallbackErr) {
          log.error(
            `[${SCHEDULER_NAME}] Master authentication failed on both flows. Skipping sync.`,
            fallbackErr.message,
          );
          return;
        }
      }

      const { lmsToken: token, mindxUser } = authData;
      const { teacherId, centreIds, appRoles: roles } = mindxUser;

      const tdmCentreId = getTdmCentreId();
      const finalCentreIds =
        centreIds && centreIds.length > 0 ? centreIds : [tdmCentreId];

      log.info(
        `[${SCHEDULER_NAME}] Master authenticated. Processing classes for centres:`,
        finalCentreIds,
      );

      const processedClassIds = new Set();

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
      const classCentres = {};

      for (const cls of runningClasses) {
        if (!processedClassIds.has(cls.id)) {
          classIdsToFetch.push(cls.id);
          processedClassIds.add(cls.id);
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
        log.info(`[${SCHEDULER_NAME}] No classes to process.`);
        return;
      }

      const client = new LMSClient(token);
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
          log.error(
            `[${SCHEDULER_NAME}] Error fetching chunk details for teacher ${teacherId}:`,
            err.message,
          );
        }
      }

      const now = new Date();
      const vietnamNow = getVietnamNow(now);
      const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

      const getTeacherEmailsByRole = (teachersList, roleShortName) => {
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
            .map((t) => t.teacher?.email)
            .filter(Boolean);
          return { name, emails };
        }
        return { name: "N/A", emails: [] };
      };

      const ticketsByClass = {};
      const emailNotificationsByTeacher = {};

      for (const cls of fetchedDetails) {
        if (!cls || !cls.id || !cls.slots || cls.slots.length === 0) continue;

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
            `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`,
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
            let dateStr;
            if (typeof slot.date === "string" && slot.date.includes("/")) {
              const [d, m, y] = slot.date.split("/").map(Number);
              dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            } else {
              dateStr = String(slot.date).split("T")[0];
            }

            const hhmm = extractHHMM(slot.endTime);
            if (!hhmm) return;

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
                ATTENDED_STATUSES.includes(sa.status) &&
                (!sa.comment || sa.comment.trim() === ""),
            );

            if (studentsNeedingFeedback.length > 0) {
              const isLate = timeDiff > FORTY_EIGHT_HOURS;

              const teachersToUse =
                slot.teachers && slot.teachers.length > 0
                  ? slot.teachers
                  : cls.teachers;
              const taData = getTeacherEmailsByRole(teachersToUse, "TA");
              const lecData = getTeacherEmailsByRole(teachersToUse, "LEC");
              const teData = getTeacherEmailsByRole(teachersToUse, "TE");

              const taName = taData.name;
              const lecName = lecData.name;
              const teName = teData.name;

              const notificationInfo = {
                classId: cls.id,
                className: cls.name,
                date: slot.date,
                studentCount: studentsNeedingFeedback.length,
                isLate,
              };

              // Send emails only to LEC of this slot — work email only (no personal fallback).
              if (lecData.emails.length > 0) {
                lecData.emails.forEach((email) => {
                  if (!emailNotificationsByTeacher[email]) {
                    emailNotificationsByTeacher[email] = {
                      teacherName: lecName,
                      pendingClasses: [],
                    };
                  }
                  emailNotificationsByTeacher[email].pendingClasses.push(
                    notificationInfo,
                  );
                });
              }

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
                teacherIds: teachersToUse
                  .filter((t) => t.isActive !== false && t.teacher?.id)
                  .map((t) => t.teacher.id),
                centreIds: classCentres[cls.id] || [],
              });
            }
          }
        });

        ticketsByClass[cls.id] = classTickets;
      }

      for (const [classId, tickets] of Object.entries(ticketsByClass)) {
        await FirestoreNotification.saveBatchTickets(tickets, classId);
      }

      try {
        const { Class, NotificationTicket } = require("../storage/mongoModels");
        const thirtyDaysAgo2 = new Date();
        thirtyDaysAgo2.setDate(thirtyDaysAgo2.getDate() - 30);
        const activeClasses = await Class.find({
          $or: [
            { status: { $in: ["OPEN", "RUNNING"] } },
            { status: "FINISHED", endDate: { $gte: thirtyDaysAgo2.toISOString().split("T")[0] } }
          ]
        }).select("_id").lean();
        const activeClassIds = activeClasses.map(c => c._id);
        const deleteResult = await NotificationTicket.deleteMany({ classId: { $nin: activeClassIds } });
        if (deleteResult.deletedCount > 0) {
          log.info(`[${SCHEDULER_NAME}] Cleared ${deleteResult.deletedCount} orphaned tickets for non-active classes.`);
        }
      } catch (cleanupErr) {
        log.error(`[${SCHEDULER_NAME}] Error cleaning up orphaned tickets:`, cleanupErr.message);
      }

      if (!sendEmails) {
        log.info(`[${SCHEDULER_NAME}] Email send skipped. Tickets synchronized only.`);
        return;
      }

      // Send emails. Both cron and manual triggers always send (no dedupe).
      const emailService = require("./emailService");
      const NotificationEmailLog = require("../storage/emailLogModel");
      const dayKey = vietnamNow.dayKey;

      const emails = Object.keys(emailNotificationsByTeacher);
      log.info(
        `[${SCHEDULER_NAME}] Sending emails for ${emails.length} teachers.`,
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const email of emails) {
        const data = emailNotificationsByTeacher[email];
        const logId = `reminder:${email}:${dayKey}`;
        let result;
        try {
          result = await emailService.sendReminderEmail(
            email,
            data.teacherName,
            data.pendingClasses,
            { dayKey, classSummary: data.pendingClasses.length },
          );
        } catch (sendErr) {
          log.error(
            `[${SCHEDULER_NAME}] Unhandled send error for ${email}:`,
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
          log.warn(
            `[${SCHEDULER_NAME}] Failed to write email log for ${email}:`,
            logErr.message,
          );
        }
      }

      log.info(
        `[${SCHEDULER_NAME}] Email send summary: sent=${sentCount}, failed=${failedCount}.`,
      );
      log.info(
        `[${SCHEDULER_NAME}] Completed. Processed ${processedClassIds.size} classes.`,
      );
    } catch (err) {
      log.error(
        `[${SCHEDULER_NAME}] Fatal error during sync:`,
        err.message,
      );
      throw err;
    }
  }
}

module.exports = NotificationScheduler;