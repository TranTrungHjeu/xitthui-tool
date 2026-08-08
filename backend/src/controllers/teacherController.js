const LMSClient = require("../services/lmsClient");
const { isLmsAuthError } = require("../utils/authError");
const { withLmsAuthRefresh } = require("../utils/lmsAuthRefresh");
const { getSessionExamType } = require("../utils/courseConfig");
const { TeacherVisibilityPrefs } = require("../storage/mongoModels");
const TeacherStorage = require("../storage/teacherStorage");
const TeacherScheduler = require("../services/teacherScheduler");
const BoundedCache = require("../utils/boundedCache");
const { getTdmCentreId } = require("../constants/centreIds");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("TeacherController");

// SCALE-2: Single source of truth for the teachers list cache.
// Replaces the previous object-literal cache that duplicated both
// definitions (top of file + line 316) and relied on manual TTL sweeps.
const TEACHERS_CACHE_TTL_SECONDS = 15 * 60; // 15 minutes
const TEACHERS_CACHE_MAX_KEYS = 50;
const teachersCache = new BoundedCache({
  maxKeys: TEACHERS_CACHE_MAX_KEYS,
  stdTTL: TEACHERS_CACHE_TTL_SECONDS,
  checkperiod: 5 * 60, // Sweep every 5 minutes
});

/**
 * POST /teachers/visibility
 * Body: { userId: string, hiddenTeacherIds: string[] }
 */
exports.saveTeacherVisibility = async (req, res) => {
  const { userId, hiddenTeacherIds } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  
  try {
    await TeacherVisibilityPrefs.findByIdAndUpdate(
      userId,
      {
        _id: userId,
        hiddenTeacherIds: hiddenTeacherIds || [],
        updatedAt: new Date()
      },
      { upsert: true }
    );
    const prefs = { hiddenTeacherIds: hiddenTeacherIds || [], updated: Date.now() };
    res.json({ success: true, preferences: prefs });
  } catch (err) {
    log.error("[TeacherController] saveTeacherVisibility failed:", err.message);
    res.status(500).json({ error: "Failed to save visibility preferences" });
  }
};

/**
 * GET /teachers/visibility/:userId
 * Params: userId
 */
exports.getTeacherVisibility = async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  
  try {
    const prefs = await TeacherVisibilityPrefs.findById(userId).lean();
    const result = prefs ? { hiddenTeacherIds: prefs.hiddenTeacherIds || [], updated: prefs.updatedAt?.getTime() || null } : { hiddenTeacherIds: [] };
    res.json({ success: true, preferences: result });
  } catch (err) {
    log.error("[TeacherController] getTeacherVisibility failed:", err.message);
    res.status(500).json({ error: "Failed to get visibility preferences" });
  }
};

exports.getTeacherSchedules = withLmsAuthRefresh(async (req, res) => {
  log.info("[Controller] getTeacherSchedules request body:", req.body);
  try {
    const { teacherIds, dateGte, dateLte, forceRefresh = false } = req.body;

    // Auth check is handled by `withLmsAuthRefresh` — if `req.lmsToken`
    // is missing the wrapper returns 400 "Token is required" before we
    // ever get here. Don't add a redundant `if (!token)` check here.
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

    // 2. Fetch from MongoDB if within the synced window and DB has records (skip if forceRefresh)
    if (isWithinSyncWindow && !forceRefresh) {
      try {
        const dbCount = await Schedule.countDocuments();
        if (dbCount > 0) {
          log.info(`[Controller] Querying schedules from MongoDB for range ${dateGte} -> ${dateLte}...`);
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
          log.info(`[Controller] Served ${allSchedules.length} schedules from MongoDB.`);
        }
      } catch (dbErr) {
        log.warn(`[Controller] MongoDB Schedule fetch failed: ${dbErr.message}`);
      }
    }

    // 3. Fallback: Query LMS directly
    if (!fetchedFromDb) {
      log.info(`[Controller] Fetching schedules from LMS directly...`);
      const client = new LMSClient(req.lmsToken);
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
            log.error("[Controller] Failed to write fetched schedules to MongoDB:", err.message);
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
        const dbClasses = await Class.find({ _id: { $in: Array.from(uniqueClassIds) } }).select("name slots.index slots.startTime slots.endTime slots.date slots.teachers teachers").lean();
        dbClasses.forEach(c => classDetailsMap.set(c._id, c));
      } catch (dbClassErr) {
        log.warn(`[Controller] MongoDB Class fetch failed: ${dbClassErr.message}`);
      }

      // Identify missing classes not cached in MongoDB
      const missingClassIds = Array.from(uniqueClassIds).filter(id => !classDetailsMap.has(id));
      if (missingClassIds.length > 0) {
        log.info(`[Controller] Skipping fetching ${missingClassIds.length} missing classes from LMS to optimize response time.`);
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
            if (classDetails) {
              let slot = null;
              if (classDetails.slots && Array.isArray(classDetails.slots)) {
                slot = classDetails.slots.find(
                  (slotItem) =>
                    slotItem.startTime === s.startTime && slotItem.endTime === s.endTime,
                );
              }

              // Determine teacher role (slot-level first, then class-level fallback)
              let foundRole = null;
              if (slot && slot.teachers && Array.isArray(slot.teachers)) {
                const tAssignment = slot.teachers.find(
                  (t) => (t.teacher?.id || t.teacher?._id) === s.teacherId
                );
                if (tAssignment && tAssignment.role) {
                  foundRole = tAssignment.role.shortName || tAssignment.role.name;
                }
              }
              if (!foundRole && classDetails.teachers && Array.isArray(classDetails.teachers)) {
                const tAssignment = classDetails.teachers.find(
                  (t) => (t.teacher?.id || t.teacher?._id) === s.teacherId
                );
                if (tAssignment && tAssignment.role) {
                  foundRole = tAssignment.role.shortName || tAssignment.role.name;
                }
              }
              if (foundRole) {
                s.teacherRole = foundRole;
              }

              // Determine session index
              if (slot && typeof slot.index === "number") {
                computedSession = slot.index + 1;
              } else if (slot && classDetails.slots) {
                // Chronological index fallback if index is not present in slots list
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
                const sortedSlots = [...classDetails.slots].sort((a, b) => {
                  return parseSlotDateForSorting(a.date, a.startTime) - parseSlotDateForSorting(b.date, b.startTime);
                });
                const sIdx = sortedSlots.findIndex(
                  (slotItem) =>
                    slotItem.startTime === s.startTime && slotItem.endTime === s.endTime,
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
    log.error("[Controller] getTeacherSchedules failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
});

exports.getTeachers = withLmsAuthRefresh(async (req, res) => {
  log.info("[Controller] getTeachers request body:", req.body);
  try {
    const {
      centers = [getTdmCentreId()],
      pageIndex = 0,
      itemsPerPage = 100,
    } = req.body;

    // 1. Try MongoDB first (the source of truth after the first successful sync).
    try {
      const dbCount = await TeacherStorage.getTeachersCount();
      if (dbCount > 0) {
        log.info(
          `[Controller] Serving teachers list from MongoDB (${dbCount} records).`,
        );
        const docs = await TeacherStorage.getAllTeachers();

        // Optional centre filter, mirroring the LMS API surface.
        const wantedCentres = new Set(
          (Array.isArray(centers) ? centers : [centers])
            .filter(Boolean)
            .map((c) => c.toString()),
        );
        const filtered = wantedCentres.size
          ? docs.filter((t) => {
              const teacherCentres = Array.isArray(t.centres) ? t.centres : [];
              return teacherCentres.some((c) => wantedCentres.has(String(c?.id)));
            })
          : docs;

        const start = pageIndex * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        return res.json({
          success: true,
          data: paginated,
          pagination: { total: filtered.length },
          source: "mongodb",
        });
      }
    } catch (dbErr) {
      log.warn(
        `[Controller] MongoDB Teacher fetch failed, falling back to LMS: ${dbErr.message}`,
      );
    }

    // 2. Cold-start fallback: serve from LMS live and reuse the existing BoundedCache.
    const cacheKey = `${JSON.stringify(centers)}_${pageIndex}_${itemsPerPage}`;
    const cached = teachersCache.get(cacheKey);
    if (cached) {
      log.info(
        `[Controller] Serving teachers list from BoundedCache for key: ${cacheKey}`,
      );
      return res.json({ ...cached, source: "cache" });
    }

    const client = new LMSClient(req.lmsToken);
    const result = await client.getTeachers(centers, pageIndex, itemsPerPage);

    const response = {
      success: true,
      data: result.data || [],
      pagination: result.pagination || { total: 0 },
      source: "lms",
    };

    teachersCache.set(cacheKey, response);

    res.json(response);
  } catch (err) {
    log.error("[Controller] getTeachers failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      pagination: { total: 0 },
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
});

/**
 * POST /teachers/sync
 * Fire-and-forget teacher sync from LMS → MongoDB.
 * Requires TE role. The actual LMS fetch happens in the background; we
 * respond immediately and invalidate the BoundedCache so the next
 * `getTeachers` call will read from MongoDB.
 */
exports.syncPersonnel = async (req, res) => {
  try {
    const { roles } = req.body || {};
    const isTE =
      (Array.isArray(roles) && roles.includes("TE")) ||
      (req.user && Array.isArray(req.user.appRoles) && req.user.appRoles.includes("TE"));

    if (!isTE) {
      return res.status(403).json({
        success: false,
        error: "Access denied. TE role required.",
      });
    }

    log.info("[Controller] Manual teacher sync triggered by TE");

    // Fire-and-forget: respond immediately, then kick off the sync.
    res.json({
      success: true,
      message: "Đang đồng bộ nhân sự từ LMS...",
    });

    TeacherScheduler.syncAllPersonnel()
      .then(() => {
        // Invalidate cache so the next read goes through MongoDB.
        teachersCache.flushAll();
      })
      .catch((err) => {
        log.error("[Controller] syncPersonnel background job failed:", err.message);
      });
  } catch (err) {
    log.error("[Controller] syncPersonnel failed:", err.message);
    if (!res.headersSent) {
      const statusCode = isLmsAuthError(err) ? 401 : 500;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  }
};
