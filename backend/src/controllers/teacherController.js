const LMSClient = require("../services/lmsClient");
const { isLmsAuthError } = require("../utils/authError");
const { getSessionExamType } = require("../utils/courseConfig");

// In-memory visibility map for demonstration. Replace with persistent DB in prod.
const teacherVisibilityPrefs = {};

/**
 * POST /teachers/visibility
 * Body: { userId: string, hiddenTeacherIds: string[] }
 */
exports.saveTeacherVisibility = async (req, res) => {
  const { userId, hiddenTeacherIds } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  teacherVisibilityPrefs[userId] = {
    hiddenTeacherIds: hiddenTeacherIds || [],
    updated: Date.now(),
  };
  res.json({ success: true, preferences: teacherVisibilityPrefs[userId] });
};

/**
 * GET /teachers/visibility/:userId
 * Params: userId
 */
exports.getTeacherVisibility = async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const prefs = teacherVisibilityPrefs[userId] || { hiddenTeacherIds: [] };
  res.json({ success: true, preferences: prefs });
};

exports.getTeacherSchedules = async (req, res) => {
  console.log("[Controller] getTeacherSchedules request body:", req.body);
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { teacherIds, dateGte, dateLte } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
      return res.status(400).json({ error: "teacherIds array is required" });
    }
    if (!dateGte || !dateLte) {
      return res
        .status(400)
        .json({ error: "dateGte and dateLte are required" });
    }

    const { Schedule } = require("../storage/mongoModels");

    // 1. Calculate synced 7-week window boundaries
    const today = new Date();
    const currentMonday = new Date(today);
    const day = currentMonday.getDay();
    const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
    currentMonday.setDate(diff);
    currentMonday.setHours(0, 0, 0, 0);

    const windowStart = new Date(currentMonday);
    windowStart.setDate(windowStart.getDate() - 21);

    const windowEnd = new Date(currentMonday);
    windowEnd.setDate(windowEnd.getDate() + 28);
    windowEnd.setMilliseconds(-1);

    const isWithinSyncWindow = (new Date(dateGte) >= windowStart) && (new Date(dateLte) <= windowEnd);
    let allSchedules = [];
    let fetchedFromDb = false;

    // 2. Fetch from MongoDB if within the synced window and DB has records
    if (isWithinSyncWindow) {
      try {
        const dbCount = await Schedule.countDocuments();
        if (dbCount > 0) {
          console.log(`[Controller] Querying schedules from MongoDB for range ${dateGte} -> ${dateLte}...`);
          const dbSchedules = await Schedule.find({
            teacherId: { $in: teacherIds },
            startTime: { $gte: dateGte },
            endTime: { $lte: dateLte }
          }).lean();

          allSchedules = dbSchedules.map(s => ({
            ...s,
            id: s._id
          }));
          fetchedFromDb = true;
          console.log(`[Controller] Served ${allSchedules.length} schedules from MongoDB.`);
        }
      } catch (dbErr) {
        console.warn(`[Controller] MongoDB Schedule fetch failed: ${dbErr.message}`);
      }
    }

    // 3. Fallback: Query LMS directly
    if (!fetchedFromDb) {
      console.log(`[Controller] Fetching schedules from LMS directly...`);
      const client = new LMSClient(token);
      allSchedules = await client.getTeacherSchedulesBatch(
        teacherIds,
        dateGte,
        dateLte,
      );

      // If within sync window, save fetched schedules to MongoDB in background
      if (isWithinSyncWindow) {
        const bulkOps = allSchedules.map((sch) => {
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
          Schedule.bulkWrite(bulkOps).catch(err => {
            console.error("[Controller] Failed to write fetched schedules to MongoDB:", err.message);
          });
        }
      }
    }

    // 4. Update titles for CLASS_SESSION schedules using cached classes in MongoDB
    const uniqueClassIds = new Set();
    allSchedules.forEach((s) => {
      if (s.type === "CLASS_SESSION" && s.classSite?.class?.id) {
        uniqueClassIds.add(s.classSite.class.id);
      }
    });

    if (uniqueClassIds.size > 0) {
      const classDetailsMap = new Map();
      const { Class } = require("../storage/mongoModels");
      
      try {
        const dbClasses = await Class.find({ _id: { $in: Array.from(uniqueClassIds) } }).lean();
        dbClasses.forEach(c => classDetailsMap.set(c._id, c));
      } catch (dbClassErr) {
        console.warn(`[Controller] MongoDB Class fetch failed: ${dbClassErr.message}`);
      }

      // Identify missing classes not cached in MongoDB
      const missingClassIds = Array.from(uniqueClassIds).filter(id => !classDetailsMap.has(id));
      if (missingClassIds.length > 0) {
        console.log(`[Controller] Fetching ${missingClassIds.length} missing classes from LMS...`);
        const client = new LMSClient(token);
        await Promise.all(
          missingClassIds.map(async (classId) => {
            try {
              const details = await client.getClassById(classId);
              if (details) {
                classDetailsMap.set(classId, details);
                
                // Save it to MongoDB Class collection
                const { getCourseCategory } = require("../utils/courseConfig");
                const {
                  getClassWeekdayIndexes,
                  getRealTeacherByRole,
                  getClassTimeRange,
                  getClassWeekdays,
                  getCurrentSessionIndex,
                } = require("../utils/classHelpers");
                
                const weekdayIndexes = getClassWeekdayIndexes(details);
                const lecName = getRealTeacherByRole(details, "LEC") || "-";
                const taName = getRealTeacherByRole(details, "TA") || "-";
                const timeRange = getClassTimeRange(details);
                const weekdays = getClassWeekdays(details);
                const category = getCourseCategory(details.name || details.course?.name || "");
                const currentSessionIndex = getCurrentSessionIndex(details);
                const searchString = [
                  details.name,
                  details.course?.shortName,
                  details.centre?.name,
                  details.centre?.shortName,
                  lecName,
                  taName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();

                const doc = {
                  name: details.name,
                  status: details.status,
                  startDate: details.startDate,
                  endDate: details.endDate,
                  course: details.course,
                  centre: details.centre,
                  teachers: details.teachers,
                  slots: details.slots,
                  students: details.students || [],
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
                
                await Class.updateOne({ _id: details.id }, { $set: doc }, { upsert: true });
              }
            } catch (err) {
              console.error(`[Controller] Failed to fetch class ${classId} detail:`, err.message);
            }
          })
        );
      }

      // Map session index and format titles
      allSchedules.forEach((s) => {
        if (s.type === "CLASS_SESSION" && s.classSite?.class?.name) {
          const className = s.classSite.class.name;
          const classId = s.classSite.class.id;

          let sessionInfo = "";
          let computedSession = null;

          if (classId) {
            const classDetails = classDetailsMap.get(classId);
            if (classDetails && classDetails.slots) {
              const slot = classDetails.slots.find(
                (slot) =>
                  slot.startTime === s.startTime && slot.endTime === s.endTime,
              );
              if (slot && typeof slot.index === "number") {
                computedSession = slot.index + 1;
              } else if (slot) {
                // Chronological index fallback if index is not present in slots list
                const sortedSlots = [...classDetails.slots].sort(
                  (a, b) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime()
                );
                const sIdx = sortedSlots.findIndex(
                  (slot) =>
                    slot.startTime === s.startTime && slot.endTime === s.endTime,
                );
                if (sIdx !== -1) {
                  computedSession = sIdx + 1;
                }
              }
            }
          }

          if (computedSession !== null) {
            const examType = getSessionExamType(className, computedSession);
            if (examType === "checkpoint1") sessionInfo = "Checkpoint 1";
            else if (examType === "checkpoint2") sessionInfo = "Checkpoint 2";
            else if (examType === "demo") sessionInfo = "Demo";
            else {
              sessionInfo = `Buổi ${computedSession}`;
            }
          }

          if (sessionInfo) {
            s.title = `${className} - ${sessionInfo}`;
          }
        }
      });
    }

    res.json({ success: true, data: allSchedules });
  } catch (err) {
    console.error("[Controller] getTeacherSchedules failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getTeachers = async (req, res) => {
  console.log("[Controller] getTeachers request body:", req.body);
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const {
      centers = ["6443460f94300678908f7974"],
      pageIndex = 0,
      itemsPerPage = 100,
    } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });

    const client = new LMSClient(token);
    const result = await client.getTeachers(centers, pageIndex, itemsPerPage);

    res.json({
      success: true,
      data: result.data || [],
      pagination: result.pagination || { total: 0 },
    });
  } catch (err) {
    console.error("[Controller] getTeachers failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      pagination: { total: 0 },
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};
