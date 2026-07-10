const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");
const officeHourController = require("../controllers/officeHourController");
const rateLimiter = require("../utils/rateLimiter");

// Limit AI evaluation requests (e.g. max 60 requests per 10 minutes)
const aiLimiter = rateLimiter(
  60,
  10 * 60 * 1000,
  "Too many AI evaluation requests. Please try again later.",
);

router.post("/classes", classController.getClasses);
router.post("/office-hours", officeHourController.getOfficeHours);
router.post("/office-hours/detail", officeHourController.getOfficeHourById);
router.post("/classes/notifications", classController.getClassesNotifications);
router.post("/classes/sync-notifications", classController.syncNotifications);
router.post(
  "/classes/send-notification-emails",
  classController.sendNotificationEmails,
);
router.post("/classes/detail", classController.getClassById);
router.post("/classes/details", classController.getClassesDetails);
router.post("/update-evaluation", classController.updateEvaluation);
router.post("/submissions", classController.getSubmissions);
router.post("/course-version", classController.getCourseVersion);
router.post(
  "/student-evaluation",
  aiLimiter,
  classController.getStudentAIReport,
);
router.post("/classes/students", classController.getStudents);
router.post("/classes/sync-students", classController.syncStudents);
router.get("/classes/download-attachment", classController.downloadAttachment);

module.exports = router;

