const cron = require("node-cron");
const { Schedule } = require("../storage/mongoModels");
const LMSClient = require("./lmsClient");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { getTdmCentreId } = require("../constants/centreIds");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("ScheduleScheduler");

class ScheduleScheduler {
  static start() {
    // Run once a day at 2:10 AM (Asia/Ho_Chi_Minh)
    cron.schedule(
      "10 2 * * *",
      async () => {
        log.info("[ScheduleScheduler] Starting periodic teacher schedules sync...");
        await this.syncAllSchedules();
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );
    log.info("[ScheduleScheduler] Initialized (scheduled daily at 2:10 AM).");

    // Run once on startup after 20 seconds
    setTimeout(() => {
      this.syncAllSchedules();
    }, 20000);
  }

  static async syncAllSchedules() {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        log.warn(
          "[ScheduleScheduler] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping schedule sync.",
        );
        return;
      }

      log.info("[ScheduleScheduler] Authenticating with Master Account...");
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword,
        );
      } catch (authErr) {
        log.warn(
          "[ScheduleScheduler] Username login failed, trying Firebase flow...",
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword,
          );
        } catch (fallbackErr) {
          log.error(
            "[ScheduleScheduler] Master authentication failed on both flows. Skipping schedule sync.",
            fallbackErr.message,
          );
          return;
        }
      }

      const { lmsToken: token, mindxUser } = authData;
      const { centreIds } = mindxUser;

      // Default centre if empty
      const finalCentreIds =
        centreIds && centreIds.length > 0
          ? centreIds
          : [getTdmCentreId()];

      log.info(
        `[ScheduleScheduler] Master authenticated. Fetching teachers for centres:`,
        finalCentreIds,
      );

      const client = new LMSClient(token);
      // Fetch up to 150 teachers at once
      const teachersRes = await client.getTeachers(finalCentreIds, 0, 150);
      const teachers = teachersRes.data || [];
      const teacherIds = teachers.map((t) => t.id).filter(Boolean);

      if (teacherIds.length === 0) {
        log.info("[ScheduleScheduler] No teachers found to sync schedules.");
        return;
      }

      // Calculate 7-week sync range (3 weeks before, current week, 3 weeks after)
      const { startDate, endDate } = getScheduleSyncRange();
      const dateGte = startDate.toISOString();
      const dateLte = endDate.toISOString();

      log.info(
        `[ScheduleScheduler] Fetching schedules for ${teacherIds.length} teachers in range: ${dateGte} -> ${dateLte}`
      );

      const rawSchedules = await client.getTeacherSchedulesBatch(
        teacherIds,
        dateGte,
        dateLte
      );

      log.info(
        `[ScheduleScheduler] Got ${rawSchedules.length} schedules from LMS. Syncing to MongoDB...`
      );

      // 1. Bulk upsert schedules
      const bulkOps = rawSchedules.map((sch) => {
        const doc = {
          teacherId: sch.teacherId,
          title: sch.title,
          description: sch.description,
          date: sch.date,
          startTime: sch.startTime,
          endTime: sch.endTime,
          type: sch.type,
          classSite: sch.classSite,
          officeHour: sch.officeHour,
          updatedAt: new Date(),
        };

        return {
          updateOne: {
            filter: { _id: sch.id },
            update: { $set: doc },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0) {
        const writeResult = await Schedule.bulkWrite(bulkOps);
        log.info(
          `[ScheduleScheduler] Upserted/modified ${
            writeResult.upsertedCount + writeResult.modifiedCount
          } schedules in MongoDB.`
        );
      }

      // 2. Reasonable cleanup: delete schedules in DB for these teachers inside date range that are NOT returned by LMS
      const fetchedIds = rawSchedules.map((s) => s.id);
      const deleteResult = await Schedule.deleteMany({
        teacherId: { $in: teacherIds },
        startTime: { $gte: dateGte },
        endTime: { $lte: dateLte },
        _id: { $nin: fetchedIds },
      });

      if (deleteResult.deletedCount > 0) {
        log.info(
          `[ScheduleScheduler] Deleted ${deleteResult.deletedCount} obsolete/cancelled schedules from MongoDB.`
        );
      }
    } catch (err) {
      log.error("[ScheduleScheduler] syncAllSchedules failed:", err.message);
    }
  }
}

// --- Date Range Helper ---
function getScheduleSyncRange() {
  const now = new Date();

  // Find current Monday
  const currentMonday = new Date(now);
  const day = currentMonday.getDay();
  const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
  currentMonday.setDate(diff);
  currentMonday.setHours(0, 0, 0, 0);

  const startDate = new Date(currentMonday);
  startDate.setDate(startDate.getDate() - 21); // 3 weeks before Monday

  const endDate = new Date(currentMonday);
  endDate.setDate(endDate.getDate() + 28); // 4 weeks after (includes current week + 3 weeks after)
  endDate.setMilliseconds(-1); // Go back 1ms to get end of Sunday

  return { startDate, endDate };
}

module.exports = {
  ScheduleScheduler,
  getScheduleSyncRange
};
