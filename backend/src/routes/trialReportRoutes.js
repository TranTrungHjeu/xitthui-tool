const express = require("express");
const router = express.Router();

const trialReportController = require("../controllers/trialReportController");
const { attachSession, requireRole } = require("../utils/trialReportAuth");

const { ROLES } = require("../constants/roles");

const TE_OR_ADMIN = [ROLES.TE, "admin", "ADMIN"];

router.use(attachSession);

// === Browser-OAuth upload (NEW canonical endpoint) ===
// Frontend uploads to Drive via user's OAuth token, then calls this
// route with the resulting file metadata so it shows up in Mongo.
router.post(
  "/reports/register",
  trialReportController.registerReport,
);

// === Read endpoints (legacy service-account paths now return 410) ===
// The browser now lists folders/files directly via the user's OAuth
// token, so the backend proxy is no longer needed.
router.get("/folders", trialReportController.getFolders);
router.get("/files", trialReportController.getFiles);

router.get("/reports/:id", trialReportController.getReport);

// === Legacy aliases for backward compatibility ===
// Old spec routes used to accept a base64 PDF body and upload via the
// backend service account. They now forward to `registerReport` for any
// external caller that hasn't migrated to the new flow.
router.post("/reports", trialReportController.createReport);
router.post("/upload", trialReportController.uploadPdf);

// === Delete-request flow (unchanged) ===
router.post("/delete-request", trialReportController.requestDelete);
router.post(
  "/delete-request/:id/review",
  requireRole(TE_OR_ADMIN),
  trialReportController.reviewDeleteRequest,
);
router.post(
  "/reports/:id/delete",
  requireRole(TE_OR_ADMIN),
  trialReportController.executeDelete,
);

router.get(
  "/all-reports",
  requireRole(TE_OR_ADMIN),
  trialReportController.getAllReports,
);
router.get(
  "/delete-requests",
  requireRole(TE_OR_ADMIN),
  trialReportController.getDeleteRequests,
);

module.exports = router;
