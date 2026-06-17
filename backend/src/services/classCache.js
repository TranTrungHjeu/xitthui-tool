const NodeCache = require("node-cache");
const LMSClient = require("./lmsClient");

// Cache TTL 5 phút
const myCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// --- CÁC HÀM HELPER SAO CHÉP TỪ FRONTEND ĐỂ TÍNH TOÁN DỮ LIỆU ---
function parseDateTime(dateVal, timeVal) {
  if (!timeVal) return null;
  const timeStr = String(timeVal).trim();
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (dateVal) {
    const dateStr = String(dateVal).split("T")[0];
    const d = new Date(`${dateStr}T${timeStr}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(timeStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTeacherByRole(cls, roleShortName) {
  if (Array.isArray(cls.teachers)) {
    const activeTeachers = cls.teachers.filter(
      (tAssignment) =>
        tAssignment.role?.shortName === roleShortName &&
        tAssignment.isActive !== false,
    );
    if (activeTeachers.length > 0) {
      return activeTeachers
        .map((t) => t.teacher?.fullName)
        .filter(Boolean)
        .join(", ");
    }
  }
  return "-";
}

function getRealTeacherByRole(cls, roleShortName) {
  const countTeachersFromSlots = (slotsToCount) => {
    const map = new Map();
    slotsToCount.forEach((slot) => {
      if (Array.isArray(slot.teachers)) {
        slot.teachers.forEach((tAssignment) => {
          if (tAssignment.role?.shortName === roleShortName) {
            const teacher = tAssignment.teacher;
            if (teacher) {
              const id = teacher.id || teacher._id || teacher.fullName;
              const current = map.get(id) || {
                name: teacher.fullName,
                count: 0,
              };
              map.set(id, { ...current, count: current.count + 1 });
            }
          }
        });
      }
    });
    return map;
  };

  const getTopTeacher = (map) => {
    if (map.size === 0) return null;
    const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return sorted[0]?.name;
  };

  if (Array.isArray(cls.slots)) {
    const now = new Date().getTime();
    const pastSlots = cls.slots.filter((slot) => {
      if (!slot.date || !slot.endTime) return false;
      const endDateTime = parseDateTime(slot.date, slot.endTime);
      return endDateTime && endDateTime.getTime() <= now;
    });

    const pastMap = countTeachersFromSlots(pastSlots);
    const topPast = getTopTeacher(pastMap);
    if (topPast) return topPast;

    const allMap = countTeachersFromSlots(cls.slots);
    const topAll = getTopTeacher(allMap);
    if (topAll) return topAll;
  }
  return getTeacherByRole(cls, roleShortName);
}

function isTeacherInRole(cls, roleShortName, teacherId) {
  if (!teacherId) return false;

  // Kiểm tra trong slot nếu có gán giáo viên riêng từng buổi
  const slots = Array.isArray(cls.slots) ? cls.slots : [];
  for (const slot of slots) {
    const matched = (slot.teachers || []).some(
      (assignment) =>
        assignment.role?.shortName === roleShortName &&
        (assignment.teacher?.id === teacherId ||
          assignment.teacher?._id === teacherId),
    );
    if (matched) return true;
  }

  // Kiểm tra trong danh sách GV của lớp
  return (cls.teachers || []).some(
    (assignment) =>
      assignment.role?.shortName === roleShortName &&
      (assignment.teacher?.id === teacherId ||
        assignment.teacher?._id === teacherId),
  );
}

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "";
  }
}

function getClassTimeRange(cls) {
  const slots = cls.slots || [];
  const slotWithTime = slots.find((s) => s.startTime || s.endTime);
  if (slotWithTime?.startTime || slotWithTime?.endTime) {
    return `${formatTime(slotWithTime.startTime)} - ${formatTime(slotWithTime.endTime)}`;
  }
  return "N/A";
}

function getClassWeekdayIndexes(cls) {
  const uniqueDays = new Set();
  (cls.slots || []).forEach((slot) => {
    if (!slot.date) return;
    const date = new Date(slot.date);
    if (!Number.isNaN(date.getTime())) {
      uniqueDays.add(date.getDay());
    }
  });
  return Array.from(uniqueDays).sort((a, b) => a - b);
}

function getClassWeekdays(cls) {
  const weekdayMap = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const sortedDays = getClassWeekdayIndexes(cls);
  if (sortedDays.length === 0) return "N/A";
  return sortedDays.map((day) => weekdayMap[day]).join(", ");
}

// Làm giàu dữ liệu một lớp học
function enrichClassData(cls) {
  const weekdayIndexes = getClassWeekdayIndexes(cls);
  const lecName = getRealTeacherByRole(cls, "LEC") || "-";
  const taName = getRealTeacherByRole(cls, "TA") || "-";
  const timeRange = getClassTimeRange(cls);
  const weekdays = getClassWeekdays(cls);

  const searchString = [
    cls.name,
    cls.course?.shortName,
    cls.centre?.name,
    cls.centre?.shortName,
    lecName,
    taName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Ta lưu lại các trường tính toán nhưng KHÔNG XÓA slots vì frontend detail loading có thể cần sau này,
  // nhưng để tối ưu payload trả về, list chỉ nên gửi thông tin computed
  return {
    ...cls,
    computed: {
      weekdayIndexes,
      lecName,
      taName,
      timeRange,
      weekdays,
      searchString,
    },
  };
}

class ClassCacheService {
  /**
   * Lấy danh sách toàn bộ các lớp (đã enrich) từ Cache hoặc fetch MindX
   */
  static async getEnrichedClasses(
    token,
    teacherId,
    centreIds,
    roles,
    statusIn,
  ) {
    const isTE = Array.isArray(roles) && roles.includes("TE");
    const targetTeacherId = isTE ? null : teacherId;
    const targetCentreIds = isTE ? centreIds : null;

    // Cache key bao gồm token để phân tách theo tài khoản (Dùng 20 ký tự cuối để đảm bảo signature JWT khác nhau)
    const tokenSuffix = token ? token.slice(-20) : "empty";
    const statusKey = statusIn ? [...statusIn].sort().join(",") : "all";
    const cacheKey = `classes_token_${tokenSuffix}_${targetTeacherId || "all"}_${(targetCentreIds || []).join("-")}_${statusKey}`;

    const cachedData = myCache.get(cacheKey);
    if (cachedData) {
      console.log(`[ClassCache] HIT cache for key: ${cacheKey}`);
      return cachedData;
    }

    console.log(
      `[ClassCache] MISS cache for key: ${cacheKey}, fetching from MindX...`,
    );
    const client = new LMSClient(token);
    // Fetch tất cả các trang
    const rawData = await client.getClasses(
      targetTeacherId,
      targetCentreIds,
      statusIn,
      true,
    );

    const enrichedData = rawData.map(enrichClassData);

    // Lưu vào cache
    myCache.set(cacheKey, enrichedData);
    console.log(`[ClassCache] Saved ${enrichedData.length} classes to cache.`);
    return enrichedData;
  }

  /**
   * Xử lý Filter & Pagination
   */
  static applyFiltersAndPagination(classes, queryParams) {
    const {
      page = 1,
      limit = 10,
      search = "",
      centre = "all",
      weekday = "all",
      role = "LEC",
      userName = "", // Dành cho fallback text match
      teacherId = "", // Mã giáo viên để filter chuẩn
      status = "all", // Lọc status chính xác
    } = queryParams;

    let filtered = classes;

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

    // 2.5 Status filter (Nếu query parameter có status truyền lên)
    if (status && status !== "all") {
      filtered = filtered.filter((cls) => cls.status === status);
    }

    // 4. Weekday filter
    if (weekday && weekday !== "all") {
      filtered = filtered.filter((cls) =>
        cls.computed.weekdayIndexes.includes(Number(weekday)),
      );
    }

    // 5. "My classes" by Role filter (lọc lớp mà tài khoản hiện tại đang đứng role đó)
    if (role && role !== "all") {
      if (teacherId) {
        // Dùng ID để lọc chính xác tuyệt đối
        filtered = filtered.filter((cls) =>
          isTeacherInRole(cls, role, teacherId),
        );
      } else if (userName) {
        // Fallback dùng string matching
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

    // 6. Sắp xếp (ở đây default theo startDate hoặc name)
    // MindX đã trả về theo createdAt_desc nên giữ nguyên hoặc có thể sort thêm.

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const p = Math.min(Math.max(1, Number(page)), totalPages);
    const l = Number(limit);

    const startIndex = (p - 1) * l;
    const paginatedItems = filtered.slice(startIndex, startIndex + l);

    // Tối ưu payload: xoá slots và teachers khỏi list (Frontend dùng getClassesDetails lazy-load)
    const leanItems = paginatedItems.map((cls) => {
      const { slots, teachers, ...leanCls } = cls;
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
