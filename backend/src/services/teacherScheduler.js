const cron = require("node-cron");
const TeacherStorage = require("../storage/teacherStorage");
const LMSClient = require("./lmsClient");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { getTdmCentreId } = require("../constants/centreIds");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("TeacherScheduler");

class TeacherScheduler {
  static isSyncing = false;

  static start() {
    // Run once a day at 2:15 AM (Asia/Ho_Chi_Minh)
    cron.schedule(
      "15 2 * * *",
      async () => {
        log.info("[TeacherScheduler] Starting periodic teacher data sync...");
        await this.syncAllPersonnel();
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      },
    );
    log.info("[TeacherScheduler] Initialized (scheduled daily at 2:15 AM).");

    // Run once on startup after 25 seconds
    setTimeout(() => {
      this.syncAllPersonnel();
    }, 25000);
  }

  static async syncAllPersonnel() {
    if (this.isSyncing) {
      log.warn("[TeacherScheduler] Sync already in progress. Skipping overlap.");
      return;
    }
    this.isSyncing = true;
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        log.warn(
          "[TeacherScheduler] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping background sync.",
        );
        return;
      }

      log.info("[TeacherScheduler] Authenticating with Master Account...");
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword,
        );
      } catch (authErr) {
        log.warn(
          "[TeacherScheduler] Username login failed, trying Firebase flow...",
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword,
          );
        } catch (fallbackErr) {
          log.error(
            "[TeacherScheduler] Master authentication failed on both flows. Skipping sync.",
            fallbackErr.message,
          );
          return;
        }
      }

      const { lmsToken: token, mindxUser } = authData;
      const { centreIds } = mindxUser;

      const finalCentreIds =
        centreIds && centreIds.length > 0 ? centreIds : [getTdmCentreId()];

      log.info(
        "[TeacherScheduler] Master authenticated. Syncing teacher data for centres:",
        finalCentreIds,
      );

      const client = new LMSClient(token);
      const allTeachers = [];
      const PAGE_SIZE = 100;

      for (const centreId of finalCentreIds) {
        try {
          let pageIndex = 0;
          let hasMore = true;
          while (hasMore) {
            const result = await client.getTeachers(
              [centreId],
              pageIndex,
              PAGE_SIZE,
            );
            const pageData = Array.isArray(result?.data) ? result.data : [];
            allTeachers.push(...pageData);

            const total = result?.pagination?.total || 0;
            if (pageData.length === 0 || allTeachers.length >= total) {
              hasMore = false;
            } else {
              pageIndex += 1;
            }
          }
        } catch (centreErr) {
          log.error(
            `[TeacherScheduler] Error fetching teachers for centre ${centreId}:`,
            centreErr.message,
          );
        }
      }

      if (allTeachers.length === 0) {
        log.warn("[TeacherScheduler] No teachers returned from LMS. Skipping save.");
        return;
      }

      const savedCount = await TeacherStorage.saveTeachers(allTeachers);
      const activeIds = allTeachers
        .map((t) => (t?.id ? t.id.toString() : null))
        .filter(Boolean);
      const deletedCount = await TeacherStorage.cleanStaleTeachers(activeIds);

      log.info(
        `[TeacherScheduler] Background teacher sync complete. Saved=${savedCount}, removed=${deletedCount}.`,
      );
    } catch (err) {
      log.error("[TeacherScheduler] syncAllPersonnel failed:", err.message);
    } finally {
      this.isSyncing = false;
    }
  }
}

module.exports = TeacherScheduler;