const { getCourseCategory } = require("./courseConfig");

const VIETNAM_TZ = "Asia/Ho_Chi_Minh";

// Returns current time components in Vietnam timezone, independent of server TZ.
function getVietnamNow(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const dayOfWeek = weekdayMap[get("weekday")] ?? 0;
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  const second = parseInt(get("second"), 10);
  // Canonical "YYYY-MM-DD" key for the day in Vietnam.
  const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, hour, minute, second, dayOfWeek, dayKey, raw: date };
}

/**
 * Normalize a time value to Vietnam timezone (UTC+7) and return { hour, minute }.
 *
 * - ISO strings (with "T"): parsed as UTC/timezone-aware, then explicitly converted to UTC+7.
 *   Uses getTime() + 7h instead of relying on the server's system timezone.
 * - Plain time strings ("HH:MM:SS"): extracted directly as Vietnam wall-clock time.
 */
function extractHHMM(timeVal) {
  if (!timeVal) return null;
  const str = String(timeVal).trim();

  // ISO string (has "T"): parse then convert to UTC+7 explicitly
  if (str.includes("T")) {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
    const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
    return { hour: vnDate.getUTCHours(), minute: vnDate.getUTCMinutes() };
  }

  // Plain time ("14:00:00" or "14:00"): treat as Vietnam wall-clock time directly
  const parts = str.split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isNaN(h) && !Number.isNaN(m)) return { hour: h, minute: m };
  }
  return null;
}

function parseDateTime(dateVal, timeVal) {
  if (!timeVal) return null;
  const hhmm = extractHHMM(timeVal);
  if (!hhmm) return null;

  let dateStr;
  if (dateVal) {
    dateStr = String(dateVal).split("T")[0]; // "2024-01-15"
  } else {
    return null;
  }

  // Build with explicit +07:00 suffix → correct UTC timestamp, timezone-safe
  const d = new Date(
    `${dateStr}T${String(hhmm.hour).padStart(2, "0")}:${String(hhmm.minute).padStart(2, "0")}:00+07:00`
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTeacherByRole(cls, roleShortName) {
  if (Array.isArray(cls.teachers)) {
    const activeTeachers = cls.teachers.filter(
      (t) => t.role?.shortName === roleShortName && t.isActive !== false
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

  return (cls.teachers || []).some(
    (assignment) =>
      assignment.role?.shortName === roleShortName &&
      (assignment.teacher?.id === teacherId ||
        assignment.teacher?._id === teacherId),
  );
}

function formatTime(isoString) {
  if (!isoString) return "";
  // Extract HH:mm directly from the string to avoid timezone offset conversion issues.
  // MindX LMS may store times with wrong offset (+08:00 instead of +07:00),
  // but the HH:mm component always represents the correct Vietnam wall-clock time.
  const hhmm = extractHHMM(isoString);
  if (hhmm) {
    return `${String(hhmm.hour).padStart(2, "0")}:${String(hhmm.minute).padStart(2, "0")}`;
  }
  return "";
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

function getCurrentSessionIndex(cls) {
  if (!cls.slots || cls.slots.length === 0) return 0;
  const now = new Date();

  // Build a UTC+7-normalized Date from slot date + time value
  const buildSlotDate = (dateVal, timeVal) => {
    if (!dateVal) return null;
    let dateStr;
    if (typeof dateVal === "string" && dateVal.includes("/")) {
      const [d, m, y] = dateVal.split("/").map(Number);
      dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    } else {
      dateStr = String(dateVal).split("T")[0];
    }
    const hhmm = extractHHMM(timeVal);
    if (!hhmm) return new Date(`${dateStr}T00:00:00+07:00`);
    // Build with explicit +07:00 → correct UTC timestamp, timezone-safe
    return new Date(
      `${dateStr}T${String(hhmm.hour).padStart(2, "0")}:${String(hhmm.minute).padStart(2, "0")}:00+07:00`
    );
  };

  // Sort slots chronologically using UTC+7 start time
  const sortedSlots = [...cls.slots].sort((a, b) => {
    const ta = buildSlotDate(a.date, a.startTime);
    const tb = buildSlotDate(b.date, b.startTime);
    return (ta?.getTime() ?? 0) - (tb?.getTime() ?? 0);
  });

  let pastCount = 0;
  for (const slot of sortedSlots) {
    if (!slot.date || !slot.endTime) continue;
    const slotEndDateTime = buildSlotDate(slot.date, slot.endTime);
    if (!slotEndDateTime || Number.isNaN(slotEndDateTime.getTime())) continue;

    if (now > slotEndDateTime) {
      pastCount++;
    } else {
      break;
    }
  }

  return pastCount;
}

function enrichClassData(cls) {
  const weekdayIndexes = getClassWeekdayIndexes(cls);
  const lecName = getRealTeacherByRole(cls, "LEC") || "-";
  const taName = getRealTeacherByRole(cls, "TA") || "-";
  const timeRange = getClassTimeRange(cls);
  const weekdays = getClassWeekdays(cls);
  const category = getCourseCategory(cls.name || cls.course?.name || "");
  const currentSessionIndex = getCurrentSessionIndex(cls);

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

  return {
    ...cls,
    computed: {
      weekdayIndexes,
      lecName,
      taName,
      timeRange,
      weekdays,
      searchString,
      category,
      currentSessionIndex,
    },
  };
}

module.exports = {
  extractHHMM,
  parseDateTime,
  getTeacherByRole,
  getRealTeacherByRole,
  isTeacherInRole,
  formatTime,
  getClassTimeRange,
  getClassWeekdayIndexes,
  getClassWeekdays,
  getCurrentSessionIndex,
  enrichClassData,
  getVietnamNow,
};
