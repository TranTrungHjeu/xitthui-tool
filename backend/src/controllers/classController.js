/**
 * Class Controller — Re-export barrel
 *
 * This file is the backward-compatible entry point for `require("../controllers/classController")`.
 * All route handlers are now implemented in the `class/` subdirectory.
 * Import from this file to keep existing route bindings working.
 */

const classListController = require("./class/classListController");
const classDetailController = require("./class/classDetailController");
const classNotificationController = require("./class/classNotificationController");
const classAiReportController = require("./class/classAiReportController");
const classAttachmentController = require("./class/classAttachmentController");

module.exports = {
  // List & detail
  getClasses: classListController.getClasses,
  getClassById: classListController.getClassById,
  getClassesDetails: classListController.getClassesDetails,

  // Evaluation & course
  updateEvaluation: classDetailController.updateEvaluation,
  getCourseVersion: classDetailController.getCourseVersion,
  getSubmissions: classDetailController.getSubmissions,

  // Students
  getStudents: classDetailController.getStudents,
  syncStudents: classDetailController.syncStudents,

  // Notifications
  getClassesNotifications: classNotificationController.getClassesNotifications,
  syncNotifications: classNotificationController.syncNotifications,
  sendReminderEmailsNow: classNotificationController.sendReminderEmailsNow,

  // AI Report
  getStudentAIReport: classAiReportController.getStudentAIReport,

  // Attachments
  downloadAttachment: classAttachmentController.downloadAttachment,
};
