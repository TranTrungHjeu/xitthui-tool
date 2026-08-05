const cron = require("node-cron");
const { StudentComment, Class } = require("../storage/mongoModels");
const LMSClient = require("./lmsClient");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { getTdmCentreId } = require("../constants/centreIds");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("StudentCommentsScheduler");

/**
 * StudentCommentsScheduler
 *
 * Populates `StudentComment` collection (one row per classId + studentId +
 * sessionIndex) by walking every RUNNING/ACTIVE class's slots + attendance.
 *
 * Uses the LMS master account so that:
 *  - /lms endpoints stay fully public (no user token required).
 *  - Background work runs even when no teachers are logged in.
 *
 * Schedule: daily at 2:30 AM Vietnam time + once on startup after 20s.
 */
class StudentCommentsScheduler {
  static start() {
    cron.schedule(
      "30 2 * * *",
      async () => {
        log.info("[StudentCommentsScheduler] Starting periodic comment sync...");
        await this.syncAllStudentComments();
      },
      { scheduled: true, timezone: "Asia/Ho_Chi_Minh" }
    );
    log.info("[StudentCommentsScheduler] Initialized (daily at 2:30 AM).");

    setTimeout(() => {
      this.syncAllStudentComments();
    }, 20000);
  }

  static async syncAllStudentComments() {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        log.warn(
          "[StudentCommentsScheduler] LMS_MASTER_USERNAME/PASSWORD not configured. Skipping."
        );
        return;
      }

      log.info("[StudentCommentsScheduler] Authenticating with Master Account...");
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword
        );
      } catch (authErr) {
        log.warn(
          "[StudentCommentsScheduler] Username login failed, trying Firebase flow..."
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword
          );
        } catch (fallbackErr) {
          log.error(
            "[StudentCommentsScheduler] Master auth failed on both flows.",
            fallbackErr.message
          );
          return;
        }
      }

      const { lmsToken: token } = authData;
      const client = new LMSClient(token);

      const activeClasses = await Class.find({
        status: { $in: ["OPEN", "RUNNING", "ACTIVE", "PRE_OPEN", "PREPARING", "PENDING"] },
      })
        .select({ _id: 1, name: 1 })
        .lean();

      if (activeClasses.length === 0) {
        log.info("[StudentCommentsScheduler] No active classes in cache.");
        return;
      }

      log.info(
        `[StudentCommentsScheduler] Fetching details for ${activeClasses.length} classes...`
      );

      const bulkOps = [];
      let totalComments = 0;

      const batchSize = 6;
      for (let i = 0; i < activeClasses.length; i += batchSize) {
        const batch = activeClasses.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((c) =>
            client
              .getClassById(c._id)
              .catch((err) => {
                log.warn(
                  `[StudentCommentsScheduler] getClassById failed for ${c._id}: ${err.message}`
                );
                return null;
              })
          )
        );
        for (let j = 0; j < batch.length; j++) {
          const cls = results[j];
          if (!cls) continue;
          const className = cls.name || batch[j].name || null;
          const slots = Array.isArray(cls.slots) ? cls.slots : [];
          for (const slot of slots) {
            const slotIndex =
              typeof slot.index === "number" ? slot.index : null;
            if (slotIndex === null) continue;
            const attendanceList = Array.isArray(slot.studentAttendance)
              ? slot.studentAttendance
              : [];
            for (const att of attendanceList) {
              const studentId = att?.student?.id;
              if (!studentId) continue;
              const studentName = att.student?.fullName || null;
              const comment = typeof att.comment === "string" ? att.comment.trim() : "";
              const docId = `${cls.id || batch[j]._id}::${studentId}::${slotIndex}`;
              bulkOps.push({
                updateOne: {
                  filter: { _id: docId },
                  update: {
                    $set: {
                      classId: cls.id || batch[j]._id,
                      studentId,
                      sessionIndex: slotIndex,
                      sessionDate: slot.date || null,
                      comment,
                      className,
                      studentName,
                      updatedAt: new Date(),
                    },
                    $setOnInsert: { createdAt: new Date() },
                  },
                  upsert: true,
                },
              });
              totalComments++;
            }
          }
        }
      }

      if (bulkOps.length > 0) {
        const result = await StudentComment.bulkWrite(bulkOps, { ordered: false });
        log.info(
          `[StudentCommentsScheduler] Wrote ${totalComments} comment rows ` +
          `(upserted=${result.upsertedCount || 0}, modified=${result.modifiedCount || 0}, ` +
          `matched=${result.matchedCount || 0}).`
        );
      } else {
        log.info("[StudentCommentsScheduler] No comments to write.");
      }

      log.info("[StudentCommentsScheduler] syncAllStudentComments complete.");
    } catch (err) {
      log.error("[StudentCommentsScheduler] syncAllStudentComments failed:", err.message);
    }
  }
}

module.exports = StudentCommentsScheduler;
