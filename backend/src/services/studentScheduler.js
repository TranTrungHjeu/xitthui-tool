const cron = require("node-cron");
const FirestoreStudent = require("../storage/firestoreStudent");
const LMSClient = require("./lmsClient");
const ClassCacheService = require("./classCache");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");

class StudentScheduler {
  static start() {
    // Run every 30 minutes (at 5 minutes past the hour/half-hour to offset other tasks)
    cron.schedule("5,35 * * * *", async () => {
      console.log("[StudentScheduler] Starting periodic student data sync...");
      await this.syncAllStudents();
    });
    console.log("[StudentScheduler] Initialized.");

    // Run once on startup after 15 seconds
    setTimeout(() => {
      this.syncAllStudents();
    }, 15000);
  }

  static async syncAllStudents() {
    try {
      if (!config.lms.masterUsername || !config.lms.masterPassword) {
        console.warn(
          "[StudentScheduler] LMS_MASTER_USERNAME or LMS_MASTER_PASSWORD not configured. Skipping background sync.",
        );
        return;
      }

      console.log("[StudentScheduler] Authenticating with Master Account...");
      let authData;
      try {
        authData = await lmsAuth.loginWithUsernameFlow(
          config.lms.masterUsername,
          config.lms.masterPassword,
        );
      } catch (authErr) {
        console.warn(
          "[StudentScheduler] Username login failed, trying Firebase flow...",
        );
        try {
          authData = await lmsAuth.loginWithCredentials(
            config.lms.masterUsername,
            config.lms.masterPassword,
          );
        } catch (fallbackErr) {
          console.error(
            "[StudentScheduler] Master authentication failed on both flows. Skipping sync.",
            fallbackErr.message,
          );
          return;
        }
      }

      const { lmsToken: token, mindxUser } = authData;
      const { teacherId, centreIds, appRoles: roles } = mindxUser;

      // Default centre if empty
      const finalCentreIds =
        centreIds && centreIds.length > 0
          ? centreIds
          : ["6443460f94300678908f7974"];

      console.log(
        `[StudentScheduler] Master authenticated. Syncing student data for centres:`,
        finalCentreIds,
      );

      // 1. Get all active classes
      const allEnrichedClasses = await ClassCacheService.getEnrichedClasses(
        token,
        teacherId,
        finalCentreIds,
        roles,
        ["OPEN", "RUNNING", "PRE_OPEN"], // Include PRE_OPEN as configured in frontend
      );

      const activeClasses = allEnrichedClasses.filter((cls) =>
        ["OPEN", "RUNNING", "PRE_OPEN"].includes(cls.status),
      );

      const classIdsToFetch = activeClasses.map((cls) => cls.id);

      if (classIdsToFetch.length === 0) {
        console.log("[StudentScheduler] No classes to process.");
        return;
      }

      // 2. Fetch class details in chunks (parallel inside each chunk)
      const client = new LMSClient(token);
      const chunkSize = 15; // Parallel fetch 15 classes at a time
      const fetchedDetails = [];

      for (let i = 0; i < classIdsToFetch.length; i += chunkSize) {
        const chunk = classIdsToFetch.slice(i, i + chunkSize);
        try {
          const fetchPromises = chunk.map(
            (id) => client.getClassesDetails([id]), // This returns an array of details
          );
          const results = await Promise.all(fetchPromises);
          fetchedDetails.push(...results.flat());
        } catch (err) {
          console.error(
            `[StudentScheduler] Error fetching class details chunk:`,
            err.message,
          );
        }
      }

      // 3. Extract and merge students
      const studentMap = new Map();

      fetchedDetails.forEach((cls) => {
        if (!cls || !Array.isArray(cls.students)) return;

        const centreId = cls.centre?.id || cls.course?.centre?.id || "";

        // Extract active teachers and TAs in this class
        const teacherIds = [];
        if (Array.isArray(cls.teachers)) {
          cls.teachers.forEach((t) => {
            if (t.teacher?.id && t.isActive !== false) {
              teacherIds.push(t.teacher.id);
            }
          });
        }

        const classInfo = {
          id: cls.id,
          name: cls.name,
          status: cls.status,
          centreId,
          teacherIds,
        };

        cls.students.forEach((studentEntry) => {
          const student = studentEntry.student;
          if (!student || !student.id) return;

          if (!studentMap.has(student.id)) {
            studentMap.set(student.id, {
              id: student.id,
              fullName: student.fullName || "",
              email: student.email || "",
              phone: student.phone || "",
              classes: [classInfo],
              centreIds: centreId ? [centreId] : [],
              teacherIds: teacherIds,
            });
          } else {
            const existingStudent = studentMap.get(student.id);
            // Add class if not exist
            const hasClass = existingStudent.classes.some(
              (c) => c.id === cls.id,
            );
            if (!hasClass) {
              existingStudent.classes.push(classInfo);
            }
            // Add centreId if not exist
            if (centreId && !existingStudent.centreIds.includes(centreId)) {
              existingStudent.centreIds.push(centreId);
            }
            // Merge teacherIds
            teacherIds.forEach((tid) => {
              if (!existingStudent.teacherIds.includes(tid)) {
                existingStudent.teacherIds.push(tid);
              }
            });
          }
        });
      });

      const allStudents = Array.from(studentMap.values());

      if (allStudents.length > 0) {
        // 4. Save students to Firestore
        await FirestoreStudent.saveStudents(allStudents);
        // 5. Clean up old students
        await FirestoreStudent.cleanStaleStudents();
      }

      console.log(
        `[StudentScheduler] Background student sync complete. Synced ${allStudents.length} students.`,
      );
    } catch (err) {
      console.error("[StudentScheduler] syncAllStudents failed:", err.message);
    }
  }
}

module.exports = StudentScheduler;
