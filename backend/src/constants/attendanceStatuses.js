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
  isPresentStatus,
  isAbsentStatus,
};
