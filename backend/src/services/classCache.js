const { childLogger } = require("../utils/logger.js");
const log = childLogger("ClassCache");

/**
 * Class Cache Service (L1 / In-process)
 *
 * Cache strategy (see classController.js CACHE STRATEGY block for the full picture):
 *
 *   L1 BoundedCache  - this module owns it. Cheap, fast, LRU-evicted, TTL 5 min.
 *   L2 MongoDB       - persistent store. Source of truth across restarts.
 *   L3 LMS API       - external fallback. Slowest path.
 *
 * The helper below (`getEnrichedClasses`) ONLY reads from L2 (MongoDB). On
 * cold start the ClassScheduler writes LMS data to L2; this module then reads
 * L2 and warms L1 implicitly via the controller. We never put TTL on L2 reads.
 *
 * IMPORTANT: There must be exactly one `myCache` instance per process. It
 * is therefore declared at module scope. Do not introduce a sibling in-process
 * cache at the controller level - always use this `myCache` (or another named
 * `BoundedCache`) for predictability.
 */
const LMSClient = require("./lmsClient");
const { isTeacherInRole } = require("../utils/classHelpers");
const BoundedCache = require("../utils/boundedCache");

// Bounded cache with maxKeys limit to prevent unbounded memory growth.
// TTL 5 minutes, check period 2 minutes, max 10000 keys.
const myCache = new BoundedCache({
  maxKeys: 10000,
  stdTTL: 300,
  checkperiod: 120,
});

// Periodically log cache stats for monitoring
setInterval(() => {
  const stats = myCache.getStats();
  if (stats.keys > stats.maxKeys * 0.8) {
    log.warn(
      `[ClassCache] Cache is at ${stats.keys}/${stats.maxKeys} keys (${Math.round((stats.keys / stats.maxKeys) * 100)}%). LRU eviction active.`,
    );
  }
}, 10 * 60 * 1000); // Check every 10 minutes

class ClassCacheService {
  /**
   * Bootstrap cache on startup: if MongoDB Class collection is empty,
   * proactively sync from LMS before the first request arrives.
   *
   * Called from index.js after MongoDB connects.
   * @returns {Promise<{warmed: boolean, classCount: number}>}
   */
  static async bootstrapCache() {
    try {
      const { Class } = require("../storage/mongoModels");
      const count = await Class.countDocuments();
      if (count > 0) {
        log.info(`[ClassCache] Bootstrap: ${count} classes found in MongoDB. Cache is warm.`);
        return { warmed: false, classCount: count };
      }

      log.info("[ClassCache] Bootstrap: MongoDB Class collection is empty. Warming cache from LMS...");
      const ClassScheduler = require("./classScheduler");
      await ClassScheduler.syncAllClasses();
      const newCount = await Class.countDocuments();
      log.info(`[ClassCache] Bootstrap complete: ${newCount} classes loaded into cache.`);
      return { warmed: true, classCount: newCount };
    } catch (err) {
      log.error("[ClassCache] Bootstrap failed:", err.message);
      return { warmed: false, classCount: 0 };
    }
  }

  /**
   * Fetch all classes (enriched) from MongoDB (and sync immediately if empty)
   */
  static async getEnrichedClasses(
    token,
    teacherId,
    centreIds,
    roles,
    statusIn,
  ) {
    const { Class } = require("../storage/mongoModels");
    const isTE = Array.isArray(roles) && roles.includes("TE");
    const targetTeacherId = isTE ? null : teacherId;
    const targetCentreIds = isTE ? centreIds : null;

    const query = {};
    if (statusIn && statusIn.length > 0) {
      query.status = { $in: statusIn };
    }
    
    if (isTE) {
      if (Array.isArray(targetCentreIds) && targetCentreIds.length > 0) {
        query["centre.id"] = { $in: targetCentreIds };
      }
    } else if (targetTeacherId) {
      query.$or = [
        { "teachers.teacher.id": targetTeacherId },
        { "slots.teachers.teacher.id": targetTeacherId }
      ];
    }

    log.info(`[ClassCache] Querying classes from MongoDB:`, JSON.stringify(query));
    let dbClasses = await Class.find(query).sort({ startDate: -1 }).lean();

    if (dbClasses.length === 0) {
      log.info("[ClassCache] MongoDB Class collection is empty, syncing from LMS immediately...");
      const ClassScheduler = require("./classScheduler");
      await ClassScheduler.syncAllClasses();
      dbClasses = await Class.find(query).sort({ startDate: -1 }).lean();
    }

    return dbClasses.map(cls => ({
      ...cls,
      id: cls._id,
    }));
  }

  /**
   * Filter & Paginate classes
   */
  static applyFiltersAndPagination(classes, queryParams) {
    const {
      page = 1,
      limit = 10,
      search = "",
      centre = "all",
      weekday = "all",
      role = "LEC",
      userName = "", // For fallback text match
      teacherId = "", // Teacher ID for absolute filter
      status = "all", // Lọc status
      category = "all", // Lọc bộ môn
    } = queryParams;

    let filtered = classes;

    // Category filter (art, coding, robotics)
    if (category && category !== "all") {
      const { getCourseCategory } = require("../utils/courseConfig");
      filtered = filtered.filter((cls) => {
        const cat = getCourseCategory(cls.name || cls.course?.name || "");
        return cat === category;
      });
    }

    // 1. Search text
    if (search && search.trim() !== "") {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((cls) =>
        cls.computed.searchString.includes(q),
      );
    }

    // 2. Centre filter
    if (centre && centre !== "all") {
      filtered = filtered.filter((cls) => cls.centre?.id === centre);
    }

    // 3. Status filter
    if (status && status !== "all") {
      filtered = filtered.filter((cls) => cls.status === status);
    }

    // 4. Weekday filter
    if (weekday && weekday !== "all") {
      filtered = filtered.filter((cls) =>
        cls.computed.weekdayIndexes.includes(Number(weekday)),
      );
    }

    // 5. "My classes" by Role filter
    if (role && role !== "all") {
      if (teacherId) {
        filtered = filtered.filter((cls) =>
          isTeacherInRole(cls, role, teacherId),
        );
      } else if (userName) {
        const uName = userName.toLowerCase();
        if (role === "LEC") {
          filtered = filtered.filter((cls) =>
            cls.computed.lecName.toLowerCase().includes(uName),
          );
        } else if (role === "TA") {
          filtered = filtered.filter((cls) =>
            cls.computed.taName.toLowerCase().includes(uName),
          );
        }
      }
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const p = Math.min(Math.max(1, Number(page)), totalPages);
    const l = Number(limit);

    const startIndex = (p - 1) * l;
    const paginatedItems = filtered.slice(startIndex, startIndex + l);

    // Optimize payload: remove slots, teachers, and students from list payload (Frontend will lazy load via details)
    const leanItems = paginatedItems.map((cls) => {
      const { slots, teachers, students, ...leanCls } = cls;
      return leanCls;
    });

    return {
      data: leanItems,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages,
      },
    };
  }
}

module.exports = ClassCacheService;
