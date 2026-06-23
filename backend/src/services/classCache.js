const NodeCache = require("node-cache");
const LMSClient = require("./lmsClient");
const { isTeacherInRole } = require("../utils/classHelpers");

// Cache TTL 5 minutes
const myCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

class ClassCacheService {
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

    console.log(`[ClassCache] Querying classes from MongoDB:`, JSON.stringify(query));
    let dbClasses = await Class.find(query).sort({ startDate: -1 }).lean();

    if (dbClasses.length === 0) {
      console.log("[ClassCache] MongoDB Class collection is empty, syncing from LMS immediately...");
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
