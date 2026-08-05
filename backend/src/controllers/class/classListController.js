/**
 * Class List Controller
 * Handles class listing, filtering, and detail fetching.
 */

const {
  LMSClient,
  ClassCacheService,
  caches,
  log,
  classHelpers,
} = require("./_shared");
const { isLmsAuthError } = require("../../utils/authError");

const { classDetailsCache } = caches;
const {
  getClassWeekdayIndexes,
  getRealTeacherByRole,
  getClassTimeRange,
  getClassWeekdays,
  getCurrentSessionIndex,
} = classHelpers;

exports.getClasses = async (req, res) => {
  log.info("[Controller] getClasses request body:", req.body);
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const {
      teacherId,
      centreIds,
      roles,
      statusIn,
      page = 1,
      limit = 10,
      search = "",
      centre = "all",
      weekday = "all",
      role = "all",
      userName = "",
      status = "all",
      category = "all",
    } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE && !teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    const allEnrichedClasses = await ClassCacheService.getEnrichedClasses(
      token, teacherId, centreIds, roles, statusIn,
    );

    const paginatedResult = ClassCacheService.applyFiltersAndPagination(
      allEnrichedClasses,
      { page, limit, search, centre, weekday, role, userName, teacherId, status, category },
    );

    res.json({ success: true, data: paginatedResult.data, meta: paginatedResult.meta });
  } catch (err) {
    log.error("[Controller] getClasses failed:", err.message);
    log.error("[Controller] LMS error response:", JSON.stringify(err.response?.data || {}, null, 2));
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getClassById = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId, noCache } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId) return res.status(400).json({ error: "Class ID is required" });

    if (!noCache) {
      const cached = classDetailsCache.get(classId);
      if (cached) {
        log.info(`[Cache] Trả về class details từ cache cho lớp: ${classId}`);
        return res.json({ success: true, data: cached });
      }

      const { Class } = require("../../storage/mongoModels");
      try {
        const dbClass = await Class.findById(classId).lean();
        if (dbClass && dbClass.students !== undefined) {
          log.info(`[MongoDB] Trả về class details từ MongoDB cho lớp: ${classId}`);
          const formattedClass = { ...dbClass, id: dbClass._id };
          classDetailsCache.set(classId, formattedClass);
          return res.json({ success: true, data: formattedClass });
        }
      } catch (dbErr) {
        log.warn(`[MongoDB] Failed to find class details: ${dbErr.message}`);
      }
    }

    const client = new LMSClient(token);
    const data = await client.getClassById(classId);

    if (data && data.id) {
      const { Class } = require("../../storage/mongoModels");
      const { getCourseCategory } = require("../../utils/courseConfig");

      const weekdayIndexes = getClassWeekdayIndexes(data);
      const lecName = getRealTeacherByRole(data, "LEC") || "-";
      const taName = getRealTeacherByRole(data, "TA") || "-";
      const timeRange = getClassTimeRange(data);
      const weekdays = getClassWeekdays(data);
      const category = getCourseCategory(data.name || data.course?.name || "");
      const currentSessionIndex = getCurrentSessionIndex(data);
      const searchString = [
        data.name, data.course?.shortName, data.centre?.name, data.centre?.shortName, lecName, taName,
      ].filter(Boolean).join(" ").toLowerCase();

      const doc = {
        name: data.name, status: data.status, startDate: data.startDate, endDate: data.endDate,
        course: data.course, centre: data.centre, teachers: data.teachers,
        slots: data.slots, students: data.students || [],
        computed: { weekdayIndexes, lecName, taName, timeRange, weekdays, searchString, category, currentSessionIndex },
        updatedAt: new Date(),
      };

      try {
        await Class.updateOne({ _id: data.id }, { $set: doc }, { upsert: true });
        log.info(`[MongoDB] Saved detailed class ${data.id} to MongoDB`);
      } catch (saveErr) {
        log.error(`[MongoDB] Failed to save detailed class ${data.id}:`, saveErr.message);
      }

      const formattedClass = { ...doc, id: data.id };
      classDetailsCache.set(data.id, formattedClass);
      res.json({ success: true, data: formattedClass });
    } else {
      res.json({ success: true, data });
    }
  } catch (err) {
    log.error("[Controller] getClassById failed:", err.message);
    log.error("[Controller] LMS error response:", JSON.stringify(err.response?.data || {}, null, 2));
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false, data: null,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getClassesDetails = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classIds, noCache } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ error: "classIds is required" });
    }

    const results = [];
    const missingIds = [];

    if (!noCache) {
      classIds.forEach((id) => {
        const cached = classDetailsCache.get(id);
        if (cached) results.push(cached);
        else missingIds.push(id);
      });

      if (missingIds.length > 0) {
        const { Class } = require("../../storage/mongoModels");
        try {
          const dbClasses = await Class.find({ _id: { $in: missingIds } }).lean();
          const dbMap = new Map(dbClasses.map((c) => [c._id, c]));
          const stillMissing = [];
          missingIds.forEach((id) => {
            const dbClass = dbMap.get(id);
            if (dbClass && dbClass.students !== undefined) {
              const fc = { ...dbClass, id: dbClass._id };
              classDetailsCache.set(id, fc);
              results.push(fc);
            } else {
              stillMissing.push(id);
            }
          });
          missingIds.length = 0;
          missingIds.push(...stillMissing);
        } catch (dbErr) {
          log.warn(`[MongoDB] Failed to find multiple class details: ${dbErr.message}`);
        }
      }
    } else {
      missingIds.push(...classIds);
    }

    if (missingIds.length > 0) {
      const client = new LMSClient(token);
      const fetchedData = await client.getClassesDetails(missingIds);
      const { Class } = require("../../storage/mongoModels");
      const { getCourseCategory } = require("../../utils/courseConfig");

      for (const item of fetchedData) {
        if (item && item.id) {
          const weekdayIndexes = getClassWeekdayIndexes(item);
          const lecName = getRealTeacherByRole(item, "LEC") || "-";
          const taName = getRealTeacherByRole(item, "TA") || "-";
          const timeRange = getClassTimeRange(item);
          const weekdays = getClassWeekdays(item);
          const category = getCourseCategory(item.name || item.course?.name || "");
          const currentSessionIndex = getCurrentSessionIndex(item);
          const searchString = [
            item.name, item.course?.shortName, item.centre?.name, item.centre?.shortName, lecName, taName,
          ].filter(Boolean).join(" ").toLowerCase();

          const doc = {
            name: item.name, status: item.status, startDate: item.startDate, endDate: item.endDate,
            course: item.course, centre: item.centre, teachers: item.teachers,
            slots: item.slots, students: item.students || [],
            computed: { weekdayIndexes, lecName, taName, timeRange, weekdays, searchString, category, currentSessionIndex },
            updatedAt: new Date(),
          };

          try {
            await Class.updateOne({ _id: item.id }, { $set: doc }, { upsert: true });
            log.info(`[MongoDB] Saved detailed class ${item.id} to MongoDB`);
          } catch (saveErr) {
            log.error(`[MongoDB] Failed to save detailed class ${item.id}:`, saveErr.message);
          }

          const formattedClass = { ...doc, id: item.id };
          classDetailsCache.set(item.id, formattedClass);
          results.push(formattedClass);
        }
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    const statusCode = isLmsAuthError(err) ? 401 : (err.response?.status || 500);
    res.status(statusCode).json({
      success: false,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};
