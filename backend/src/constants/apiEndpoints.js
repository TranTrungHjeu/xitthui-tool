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
  CLASSES_NOTIFICATIONS_SYNC: "/classes/notifications/sync",
  CLASSES_NOTIFICATIONS_SEND_EMAILS_NOW: "/classes/notifications/send-emails-now",
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
  SUBSTITUTE_SLOTS: "/spreadsheet/substitute-slots",
  EXAMINER_SLOTS: "/spreadsheet/examiner-slots",
  BOOKABLE_TEACHERS: "/spreadsheet/bookable-teachers",
  BOOKINGS_ASSIGN: "/spreadsheet/bookings/assign",
  BOOKINGS_UNASSIGN: "/spreadsheet/bookings/unassign",
  GK_ASSIGNMENTS: "/spreadsheet/gk-assignments",

  // Trial report (Google Drive)
  TRIAL_REPORT_FOLDERS: "/trial-report/folders",
  TRIAL_REPORT_FILES: "/trial-report/files",
  TRIAL_REPORT_REPORT: (id) => `/trial-report/reports/${id}`,
  TRIAL_REPORT_REPORTS: "/trial-report/reports",
  TRIAL_REPORT_UPLOAD: "/trial-report/upload",
  TRIAL_REPORT_DELETE_REQUEST: "/trial-report/delete-request",
  TRIAL_REPORT_DELETE_REQUEST_REVIEW: (id) => `/trial-report/delete-request/${id}/review`,
  TRIAL_REPORT_DELETE: (id) => `/trial-report/reports/${id}/delete`,
  TRIAL_REPORT_ALL_REPORTS: "/trial-report/all-reports",
  TRIAL_REPORT_DELETE_REQUESTS: "/trial-report/delete-requests",

  // Lessons (public route — no auth required)
  LESSONS: "/lesson",
  LESSON_DETAIL: (id) => `/lesson/${id}`,
  LESSON_QR: (id) => `/lesson/${id}/qr`,
  LESSON_CONTENT: (id) => `/lesson/${id}/content`,
  LESSON_CONTENT_DETAIL: (contentId) => `/lesson/content/${contentId}`,

  // Zalo Bot (public route — no auth required)
  ZALO_SEND_MESSAGE: "/zalo/send-message",
  ZALO_PREVIEW_MESSAGE: "/zalo/preview-message",
  ZALO_TEMPLATES: "/zalo/templates",

  // LMS (public route — no auth required)
  LMS_GENERATE_COMMENT: "/lms/generate-comment",
  LMS_SYNC_CLASS: "/lms/sync-class",
  LMS_CRITERIA: "/lms/criteria",
  LMS_SAVE_CRITERIA: "/lms/save-criteria",
};

module.exports = {
  ENDPOINTS,
};
