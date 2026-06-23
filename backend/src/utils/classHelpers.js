const { getCourseCategory } = require("./courseConfig");

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

function getCurrentSessionIndex(cls) {
  if (!cls.slots || cls.slots.length === 0) return 0;
  const now = new Date();

  // Sort slots chronologically
  const sortedSlots = [...cls.slots].sort((a, b) => {
    const parseTime = (dateStr, timeStr) => {
      try {
        if (!dateStr) return 0;
        let d;
        if (dateStr.includes("/")) {
          const [day, month, year] = dateStr.split("/").map(Number);
          d = new Date(year, month - 1, day);
        } else {
          d = new Date(dateStr);
        }
        if (timeStr) {
          let hr = 0, min = 0;
          if (timeStr.includes("T")) {
            const temp = new Date(timeStr);
            hr = temp.getHours();
            min = temp.getMinutes();
          } else {
            const parts = timeStr.split(":");
            hr = parseInt(parts[0], 10) || 0;
            min = parseInt(parts[1], 10) || 0;
          }
          d.setHours(hr, min, 0, 0);
        }
        return d.getTime();
      } catch (e) {
        return 0;
      }
    };
    return parseTime(a.date, a.startTime) - parseTime(b.date, b.startTime);
  });

  let pastCount = 0;
  for (const slot of sortedSlots) {
    if (!slot.date || !slot.endTime) continue;
    let slotEndDateTime;
    try {
      if (typeof slot.date === "string" && slot.date.includes("/")) {
        const [d, m, y] = slot.date.split("/").map(Number);
        slotEndDateTime = new Date(y, m - 1, d);
      } else {
        slotEndDateTime = new Date(slot.date);
      }

      if (isNaN(slotEndDateTime.getTime())) continue;

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
      continue;
    }

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
};
