const cron = require("node-cron");
const { OfficeHour } = require("../storage/mongoModels");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const axios = require("axios");

const GQL_QUERY = `query GetOfficeHours($payload: OfficeHourQuery) {
  officeHours(payload: $payload) {
    data {
      id
      courses {
        id
        name
        shortName
      }
      courseLines {
        id
        name
      }
      courseTopics {
        id
        name
      }
      startTime
      endTime
      status
      centre {
        id
        name
        shortName
      }
      teacher {
        id
        username
        code
        fullName
        imageUrl
        email
        phoneNumber
      }
      class {
        id
        name
      }
      classSiteId
      note
      managerNote
      type
      links {
        _id
        title
        link
      }
      studentCount
      custom
      createdBy {
        username
      }
      createdAt
    }
    pagination {
      type
      total
    }
  }
}`;

class OfficeHourScheduler {
  static start() {
    // Run once a day at 2:20 AM (Asia/Ho_Chi_Minh)
    cron.schedule(
      "20 2 * * *",
      async () => {
        console.log("[OfficeHourScheduler] Starting periodic office hours sync...");
        await this.syncAllOfficeHours();
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );
    console.log("[OfficeHourScheduler] Initialized (scheduled daily at 2:20 AM).");

    // Run once on startup after 25 seconds
    setTimeout(() => {
      this.syncAllOfficeHours();
    }, 25000);
  }

  static async syncAllOfficeHours() {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        console.warn(
          "[OfficeHourScheduler] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping sync."
        );
        return;
      }

      console.log("[OfficeHourScheduler] Authenticating with LMS...");
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword
        );
      } catch (authErr) {
        console.warn(
          "[OfficeHourScheduler] Username login failed, trying Firebase flow..."
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword
          );
        } catch (fallbackErr) {
          console.error(
            "[OfficeHourScheduler] Authentication failed. Skipping sync.",
            fallbackErr.message
          );
          return;
        }
      }

      const token = authData.lmsToken;
      const targetCentreId = "6443460f94300678908f7974"; // Thủ Dầu Một

      console.log(`[OfficeHourScheduler] Fetching office hours for Thủ Dầu Một...`);

      // Fetch all pages dynamically until we get an empty page
      const itemsPerPage = 100;
      let pageIndex = 0;
      let allFetched = [];
      let hasMore = true;

      while (hasMore) {
        console.log(`[OfficeHourScheduler] Fetching page ${pageIndex + 1}...`);
        
        const payload = {
          pageIndex,
          itemsPerPage,
          orderBy: "createdAt_desc",
          centreIn: [targetCentreId],
          courseIn: [],
          courseTopicIn: [],
          courseLineIn: [],
          paginationType: "OFFSET",
          searchString_wordSearch: ""
        };

        const response = await axios.post(
          config.lms.gatewayGraphql || "https://lms-api.mindx.edu.vn/",
          {
            operationName: "GetOfficeHours",
            variables: { payload },
            query: GQL_QUERY
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              origin: "https://lms.mindx.edu.vn"
            }
          }
        );

        if (response.data.errors) {
          console.error(`[OfficeHourScheduler] GraphQL Errors on page ${pageIndex}:`, response.data.errors);
          break;
        }

        const data = response.data?.data?.officeHours?.data || [];
        if (data.length === 0) {
          hasMore = false;
          break;
        }

        allFetched = allFetched.concat(data);
        if (data.length < itemsPerPage) {
          hasMore = false;
        } else {
          pageIndex++;
        }
      }

      console.log(`[OfficeHourScheduler] Fetched ${allFetched.length} office hours from LMS.`);

      if (allFetched.length === 0) {
        console.log("[OfficeHourScheduler] No office hours to sync.");
        return;
      }

      // Write to MongoDB
      const bulkOps = allFetched.map(item => {
        const doc = {
          courses: item.courses,
          courseLines: item.courseLines,
          courseTopics: item.courseTopics,
          startTime: item.startTime ? new Date(item.startTime) : null,
          endTime: item.endTime ? new Date(item.endTime) : null,
          status: item.status,
          centre: item.centre,
          teacher: item.teacher,
          class: item.class,
          classSiteId: item.classSiteId,
          note: item.note,
          managerNote: item.managerNote,
          type: item.type,
          links: item.links,
          studentCount: item.studentCount,
          custom: item.custom,
          createdBy: item.createdBy,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          updatedAt: new Date()
        };

        return {
          updateOne: {
            filter: { _id: item.id },
            update: { $set: doc },
            upsert: true
          }
        };
      });

      console.log(`[OfficeHourScheduler] Writing ${bulkOps.length} office hours to MongoDB...`);
      const result = await OfficeHour.bulkWrite(bulkOps);
      console.log(
        `[OfficeHourScheduler] Sync completed. Upserted/updated ${result.upsertedCount + result.modifiedCount} office hours.`
      );

      // Delete old data to optimize space (e.g. startTime older than 1095 days / 3 years)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 1095);

      console.log(`[OfficeHourScheduler] Purging office hours older than ${cutoffDate.toISOString()}...`);
      const deleteResult = await OfficeHour.deleteMany({
        startTime: { $lt: cutoffDate }
      });
      console.log(`[OfficeHourScheduler] Purged ${deleteResult.deletedCount} old office hours from MongoDB.`);

    } catch (err) {
      console.error("[OfficeHourScheduler] Sync failed:", err.message);
    }
  }
}

module.exports = OfficeHourScheduler;
