const cron = require("node-cron");
const FirestoreStudent = require("../storage/studentStorage");
const LMSClient = require("./lmsClient");
const ClassCacheService = require("./classCache");
const config = require("../config/index");
const lmsAuth = require("./lmsAuth");
const { getTdmCentreId } = require("../constants/centreIds");

class StudentScheduler {
  static start() {
    // Run once a day at 2:05 AM (Asia/Ho_Chi_Minh)
    cron.schedule(
      "5 2 * * *",
      async () => {
        console.log("[StudentScheduler] Starting periodic student data sync...");
        await this.syncAllStudents();
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );
    console.log("[StudentScheduler] Initialized (scheduled daily at 2:05 AM).");

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
          : [getTdmCentreId()];

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
        ["OPEN", "RUNNING", "PRE_OPEN"],
      );

      const activeClasses = allEnrichedClasses.filter((cls) =>
        ["OPEN", "RUNNING", "PRE_OPEN"].includes(cls.status)
      );

      const classIdsToFetch = activeClasses.map((cls) => cls.id);

      if (classIdsToFetch.length === 0) {
        console.log("[StudentScheduler] No classes to process.");
        return;
      }

      // 2. Process class details & student performance statistics
      const client = new LMSClient(token);
      const studentMap = new Map();
      const now = new Date();

      for (const classId of classIdsToFetch) {
        try {
          const classDetailsList = await client.getClassesDetails([classId]);
          const cls = classDetailsList?.[0];
          if (!cls) continue;

          // Fetch submissions for homework rate calculation
          let submissionsData = { students: [], lessons: [], submissions: [] };
          try {
            submissionsData = await client.getStudentSubmissionsByClass(classId);
          } catch (subErr) {
            console.warn(
              `[StudentScheduler] Failed to get submissions for class ${classId}:`,
              subErr.message
            );
          }

          const submissions = submissionsData.submissions || [];
          const subStudents = submissionsData.students || [];
          const lessons = submissionsData.lessons || [];

          // Find active lessons that have been taught
          const taughtLessonIds = new Set();
          (cls.slots || []).forEach((slot) => {
            const start = new Date(slot.startTime);
            if (!isNaN(start.getTime()) && start < now && slot.learningLessonId) {
              taughtLessonIds.add(slot.learningLessonId);
            }
          });
          submissions.forEach((sub) => {
            if (sub.lessonId) {
              taughtLessonIds.add(sub.lessonId);
            }
          });

          let activeLessons = lessons.filter((lesson) => taughtLessonIds.has(lesson.id));
          if (activeLessons.length === 0) {
            activeLessons = lessons.filter((lesson) => lesson.isActive !== false);
          }

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

          // Build classInfo base
          const classInfoBase = {
            id: cls.id,
            name: cls.name,
            status: cls.status,
            centreId,
            teacherIds,
          };

          // Process each student in this class
          if (Array.isArray(cls.students)) {
            cls.students.forEach((studentEntry) => {
              const student = studentEntry.student;
              if (!student || !student.id) return;

              // --- 1. Attendance Rate Calculation ---
              let attendedCount = 0;
              let totalPastSlots = 0;

              (cls.slots || []).forEach((slot) => {
                if (!slot.date || !slot.endTime) return;
                let slotEndDateTime;
                try {
                  if (typeof slot.date === "string" && slot.date.includes("/")) {
                    const [d, m, y] = slot.date.split("/").map(Number);
                    slotEndDateTime = new Date(y, m - 1, d);
                  } else {
                    slotEndDateTime = new Date(slot.date);
                  }

                  if (isNaN(slotEndDateTime.getTime())) return;

                  let hour = 0, minute = 0;
                  if (slot.endTime.includes("T")) {
                    const dateObj = new Date(slot.endTime);
                    hour = dateObj.getHours();
                    minute = dateObj.getMinutes();
                  } else {
                    const timeParts = slot.endTime.split(":");
                    hour = parseInt(timeParts[0], 10) || 0;
                    minute = parseInt(timeParts[1], 10) || 0;
                  }
                  slotEndDateTime.setHours(hour, minute, 0, 0);
                } catch (e) {
                  return;
                }

                if (now > slotEndDateTime) {
                  const attendanceList = slot.studentAttendance || [];
                  const studentAttendanceEntry = attendanceList.find(
                    (sa) => sa.student?.id === student.id
                  );

                  if (studentAttendanceEntry) {
                    totalPastSlots++;
                    const status = studentAttendanceEntry.status;
                    if (
                      status === "PRESENT" ||
                      status === "ATTENDED" ||
                      status === "LATE" ||
                      status === "LATE_ARRIVED"
                    ) {
                      attendedCount++;
                    }
                  }
                }
              });

              const attendanceRate = totalPastSlots > 0 ? attendedCount / totalPastSlots : null;

              // --- 2. Homework Submission Rate Calculation ---
              const subStudentEntry = subStudents.find((s) => s.id === student.id);
              let homeworkRate = null;

              if (subStudentEntry && subStudentEntry.studentUid) {
                const studentUid = subStudentEntry.studentUid;
                const studentSubs = submissions.filter((s) => s.studentUid === studentUid);

                let homeworkLessonsCount = 0;
                let submittedHomeworkCount = 0;

                activeLessons.forEach((lesson) => {
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
                    const classLessonSubs = submissions.filter((s) => s.lessonId === lesson.id);
                    const hasQuizSub = classLessonSubs.some((s) => s.type === "QUIZ");
                    const hasFileSub = classLessonSubs.some((s) => s.type !== "QUIZ");

                    if (hasQuizSub || hasFileSub) {
                      requiresQuiz = hasQuizSub;
                      requiresFile = hasFileSub;
                    } else {
                      requiresQuiz = true;
                      requiresFile = true;
                    }
                  }

                  if (requiresQuiz || requiresFile) {
                    homeworkLessonsCount++;

                    // Evaluate quiz status
                    let qDone = false;
                    if (requiresQuiz) {
                      const qSub = studentSubs.find((s) => s.type === "QUIZ" && s.lessonId === lesson.id);
                      if (qSub) {
                        qDone = ["GRADED", "MARKED", "SUBMITTED", "RE_SUBMITTED"].includes(qSub.status) ||
                                (qSub.score !== null && qSub.score !== undefined && qSub.score > 0);
                      }
                    }

                    // Evaluate file status
                    let fDone = false;
                    if (requiresFile) {
                      const fSub = studentSubs.find((s) => s.type !== "QUIZ" && s.lessonId === lesson.id);
                      if (fSub) {
                        fDone = ["GRADED", "MARKED", "SUBMITTED", "RE_SUBMITTED"].includes(fSub.status) ||
                                (fSub.score !== null && fSub.score !== undefined && fSub.score > 0);
                      }
                    }

                    const isFullySubmitted = (!requiresQuiz || qDone) && (!requiresFile || fDone);
                    if (isFullySubmitted) {
                      submittedHomeworkCount++;
                    }
                  }
                });

                homeworkRate = homeworkLessonsCount > 0 ? submittedHomeworkCount / homeworkLessonsCount : null;
              }

              const classInfo = {
                ...classInfoBase,
                attendanceRate,
                homeworkRate,
              };

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
                const existingClassIndex = existingStudent.classes.findIndex(
                  (c) => c.id === cls.id
                );
                if (existingClassIndex !== -1) {
                  existingStudent.classes[existingClassIndex] = classInfo;
                } else {
                  existingStudent.classes.push(classInfo);
                }
                if (centreId && !existingStudent.centreIds.includes(centreId)) {
                  existingStudent.centreIds.push(centreId);
                }
                teacherIds.forEach((tid) => {
                  if (!existingStudent.teacherIds.includes(tid)) {
                    existingStudent.teacherIds.push(tid);
                  }
                });
              }
            });
          }
        } catch (clsErr) {
          console.error(
            `[StudentScheduler] Error processing class ${classId}:`,
            clsErr.message
          );
        }
      }

      const allStudents = Array.from(studentMap.values());

      if (allStudents.length > 0) {
        // 3. Save students to MongoDB
        await FirestoreStudent.saveStudents(allStudents);
        // 4. Clean up old students
        await FirestoreStudent.cleanStaleStudents();
      }

      console.log(
        `[StudentScheduler] Background student sync complete. Synced ${allStudents.length} students.`
      );
    } catch (err) {
      console.error("[StudentScheduler] syncAllStudents failed:", err.message);
    }
  }
}

module.exports = StudentScheduler;
