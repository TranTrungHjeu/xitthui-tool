const express = require("express");
const router = express.Router();
const spreadsheetController = require("../controllers/spreadsheetController");

router.get("/data", spreadsheetController.getSpreadsheetData);

module.exports = router;
