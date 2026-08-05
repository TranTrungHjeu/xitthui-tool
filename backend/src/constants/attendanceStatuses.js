/**
 * Centralized Attendance Status Constants.
 *
 * Normalizes all attendance status strings used across LMS, MongoDB, and UI.
 * Using these constants prevents typos and makes it easy to track status
 * changes across the codebase.
 */

const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ATTENDED: "ATTENDED",
  LATE: "LATE",
  LATE_ARRIVED: "LATE_ARRIVED",
  ABSENT: "ABSENT",
  EXCUSED: "EXCUSED",
  PENDING: "PENDING",
};

/** All statuses that indicate the student showed up (used for notification logic). */
const PRESENT_STATUSES = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.ATTENDED,
  ATTENDANCE_STATUS.LATE,
  ATTENDANCE_STATUS.LATE_ARRIVED,
];

/** All statuses that indicate the student was absent without excuse. */
const ABSENT_STATUSES = [ATTENDANCE_STATUS.ABSENT];

/**
 * Statuses that count as "attended" for notification and stats logic.
 * Source of truth for both notificationScheduler.js and studentScheduler.js
 * (and any future call site that needs to know "did the student show up?").
 *
 * Contains the union of all strings used historically in those schedulers,
 * so behavior is preserved exactly when this constant is imported.
 */
const ATTENDED_STATUSES = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.ATTENDED,
  ATTENDANCE_STATUS.LATE,
  ATTENDANCE_STATUS.LATE_ARRIVED,
];

/** Statuses that count as "did NOT attend". */
const NOT_ATTENDED_STATUSES = [
  ATTENDANCE_STATUS.ABSENT,
  "NOT_ATTEND",
  "NOT_ATTENDED",
];

/** All known attendance status strings (attended + not attended). */
const ALL_STATUSES = [...ATTENDED_STATUSES, ...NOT_ATTENDED_STATUSES];

/**
 * Check if a status indicates the student was present.
 * @param {string} status
 * @returns {boolean}
 */
function isPresentStatus(status) {
  return PRESENT_STATUSES.includes(status);
}

/**
 * Check if a status indicates the student was absent without excuse.
 * @param {string} status
 * @returns {boolean}
 */
function isAbsentStatus(status) {
  return ABSENT_STATUSES.includes(status);
}

module.exports = {
  ATTENDANCE_STATUS,
  PRESENT_STATUSES,
  ABSENT_STATUSES,
  ATTENDED_STATUSES,
  NOT_ATTENDED_STATUSES,
  ALL_STATUSES,
  isPresentStatus,
  isAbsentStatus,
};
