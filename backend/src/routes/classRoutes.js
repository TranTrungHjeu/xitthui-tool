const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");
const rateLimiter = require("../utils/rateLimiter");

// Limit AI evaluation requests (e.g. max 20 requests per 10 minutes)
const aiLimiter = rateLimiter(
  20,
  10 * 60 * 1000,
  "Too many AI evaluation requests. Please try again later.",
);

router.post("/classes", classController.getClasses);
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

module.exports = router;
