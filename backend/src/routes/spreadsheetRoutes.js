const express = require("express");
const router = express.Router();
const spreadsheetController = require("../controllers/spreadsheetController");

router.get("/data", spreadsheetController.getSpreadsheetData);
router.get("/trial-availabilities", spreadsheetController.getTrialAvailabilities);
router.post("/trial-bookings/assign", spreadsheetController.assignTrialTeacher);
router.post("/trial-bookings/unassign", spreadsheetController.unassignTrialTeacher);

module.exports = router;
