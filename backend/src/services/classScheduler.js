const cron = require("node-cron");
const { Class } = require("../storage/mongoModels");
const LMSClient = require("./lmsClient");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { getCourseCategory } = require("../utils/courseConfig");
const {
  getClassWeekdayIndexes,
  getRealTeacherByRole,
  getClassTimeRange,
  getClassWeekdays,
  getCurrentSessionIndex,
} = require("../utils/classHelpers");

class ClassScheduler {
  static start() {
    // Run once a day at 2:00 AM (Asia/Ho_Chi_Minh)
    cron.schedule(
      "0 2 * * *",
      async () => {
        console.log("[ClassScheduler] Starting periodic class data sync...");
        await this.syncAllClasses();
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );
    console.log("[ClassScheduler] Initialized (scheduled daily at 2:00 AM).");

    // Run once on startup after 5 seconds
    setTimeout(() => {
      this.syncAllClasses();
    }, 5000);
  }

  static async syncAllClasses() {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        console.warn(
          "[ClassScheduler] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping class sync.",
        );
        return;
      }

      console.log("[ClassScheduler] Authenticating with Master Account...");
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword,
        );
      } catch (authErr) {
        console.warn(
          "[ClassScheduler] Username login failed, trying Firebase flow...",
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword,
          );
        } catch (fallbackErr) {
          console.error(
            "[ClassScheduler] Master authentication failed on both flows. Skipping class sync.",
            fallbackErr.message,
          );
          return;
        }
      }

      const { lmsToken: token } = authData;
      console.log("[ClassScheduler] Master authenticated. Fetching classes from LMS...");
      const client = new LMSClient(token);
      
      // Fetch all classes across all centres and statuses
      const rawClasses = await client.getClasses(null, null, null, true);
      console.log(`[ClassScheduler] Got ${rawClasses.length} classes from LMS.`);

      if (rawClasses.length === 0) {
        console.log("[ClassScheduler] No classes fetched.");
        return;
      }

      // Delete obsolete classes that are no longer returned by LMS
      const rawClassIds = rawClasses.map(cls => cls.id);
      const deleteResult = await Class.deleteMany({ _id: { $nin: rawClassIds } });
      if (deleteResult.deletedCount > 0) {
        console.log(`[ClassScheduler] Deleted ${deleteResult.deletedCount} obsolete classes from MongoDB.`);
      }

      // Fetch full class details (roster, slots with studentAttendance) for active classes
      const activeStatuses = ["OPEN", "RUNNING", "PRE_OPEN", "PREPARING", "PENDING"];
      const activeClasses = rawClasses.filter(cls => activeStatuses.includes(cls.status));
      const activeClassIds = activeClasses.map(cls => cls.id);

      console.log(`[ClassScheduler] Fetching full details for ${activeClassIds.length} active classes from LMS...`);
      const detailedMap = new Map();
      try {
        const details = await client.getClassesDetails(activeClassIds);
        if (Array.isArray(details)) {
          details.forEach(item => {
            if (item && item.id) {
              detailedMap.set(item.id, item);
            }
          });
        }
      } catch (detailErr) {
        console.error("[ClassScheduler] Failed to fetch detailed classes:", detailErr.message);
      }

      const bulkOps = rawClasses.map(cls => {
        // Use detailed class data if available
        const detailedCls = detailedMap.get(cls.id) || cls;

        const weekdayIndexes = getClassWeekdayIndexes(detailedCls);
        const lecName = getRealTeacherByRole(detailedCls, "LEC") || "-";
        const taName = getRealTeacherByRole(detailedCls, "TA") || "-";
        const timeRange = getClassTimeRange(detailedCls);
        const weekdays = getClassWeekdays(detailedCls);
        const category = getCourseCategory(detailedCls.name || detailedCls.course?.name || "");
        const currentSessionIndex = getCurrentSessionIndex(detailedCls);
        const searchString = [
          detailedCls.name,
          detailedCls.course?.shortName,
          detailedCls.centre?.name,
          detailedCls.centre?.shortName,
          lecName,
          taName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const doc = {
          name: detailedCls.name,
          status: detailedCls.status,
          startDate: detailedCls.startDate,
          endDate: detailedCls.endDate,
          course: detailedCls.course,
          centre: detailedCls.centre,
          teachers: detailedCls.teachers,
          slots: detailedCls.slots,
          students: detailedCls.students, // Undefined if detailed info not fetched (e.g. finished classes)
          computed: {
            weekdayIndexes,
            lecName,
            taName,
            timeRange,
            weekdays,
            searchString,
            category,
            currentSessionIndex
          },
          updatedAt: new Date()
        };

        return {
          updateOne: {
            filter: { _id: cls.id },
            update: { $set: doc },
            upsert: true
          }
        };
      });

      console.log(`[ClassScheduler] Writing ${bulkOps.length} classes to MongoDB...`);
      const result = await Class.bulkWrite(bulkOps);
      console.log(
        `[ClassScheduler] Class sync completed. Upserted/updated ${result.upsertedCount + result.modifiedCount} classes.`
      );
    } catch (err) {
      console.error("[ClassScheduler] syncAllClasses failed:", err.message);
    }
  }
}

module.exports = ClassScheduler;
