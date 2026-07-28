/**
 * Centralized API Endpoint Constants.
 *
 * Single source of truth for all HTTP/REST endpoint paths used in the app.
 * Using these constants prevents path drift and makes it easy to find
 * all usages of a given route.
 */

const ENDPOINTS = {
  // Health & system
  HEALTH: "/health",
  READY: "/ready",
  CSRF_TOKEN: "/csrf-token",

  // Auth
  LOGIN: "/login",
  REFRESH_TOKEN: "/refresh-token",
  LOGOUT: "/logout",
  TEST_TOKEN: "/test-token",

  // Classes
  CLASSES: "/classes",
  CLASSES_DETAIL: "/classes/detail",
  CLASSES_DETAILS: "/classes/details",
  CLASSES_NOTIFICATIONS: "/classes/notifications",
  CLASSES_SYNC_NOTIFICATIONS: "/classes/sync-notifications",
  CLASSES_ENROLL: "/classes/enroll",
  UPDATE_EVALUATION: "/update-evaluation",
  SUBMISSIONS: "/submissions",

  // Teachers
  TEACHERS: "/teachers",
  TEACHERS_LIST: "/teachers/list",
  TEACHERS_VISIBILITY: "/teachers/visibility",

  // Office hours
  OFFICE_HOURS: "/office-hours",
  OFFICE_HOURS_DETAIL: "/office-hours/detail",

  // Sessions
  SESSIONS: "/sessions",
  SESSIONS_ROTATE: "/sessions/rotate",

  // Spreadsheet
  SPREADSHEET_DATA: "/spreadsheet/data",
  TRIAL_AVAILABILITIES: "/spreadsheet/trial-availabilities",
  TRIAL_BOOKINGS_ASSIGN: "/spreadsheet/trial-bookings/assign",
  TRIAL_BOOKINGS_UNASSIGN: "/spreadsheet/trial-bookings/unassign",
};

module.exports = {
  ENDPOINTS,
};
