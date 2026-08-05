const express = require("express");
const router = express.Router();
const spreadsheetController = require("../controllers/spreadsheetController");

router.get("/data", spreadsheetController.getSpreadsheetData);
router.get("/trial-availabilities", spreadsheetController.getTrialAvailabilities);
router.post("/trial-bookings/assign", spreadsheetController.assignTrialTeacher);
router.post("/trial-bookings/unassign", spreadsheetController.unassignTrialTeacher);

router.get("/substitute-slots", spreadsheetController.getSubstituteSlots);
router.get("/examiner-slots", spreadsheetController.getExaminerSlots);
router.get("/bookable-teachers", spreadsheetController.getBookableTeachers);
router.post("/bookings/assign", spreadsheetController.assignBookTeacher);
router.post("/bookings/unassign", spreadsheetController.unassignBookTeacher);
router.get("/gk-assignments", spreadsheetController.getGkAssignmentsForWeek);

module.exports = router;
