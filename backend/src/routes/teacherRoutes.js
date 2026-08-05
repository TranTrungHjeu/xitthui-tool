const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");

router.post("/teachers", teacherController.getTeachers);
router.post("/teachers/sync", teacherController.syncPersonnel);
router.post("/teachers/schedules", teacherController.getTeacherSchedules);
router.post("/teachers/visibility", teacherController.saveTeacherVisibility);
router.get("/teachers/visibility/:userId", teacherController.getTeacherVisibility);

module.exports = router;
