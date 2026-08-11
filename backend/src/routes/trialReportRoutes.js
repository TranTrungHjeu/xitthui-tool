const express = require("express");
const router = express.Router();

const trialReportController = require("../controllers/trialReportController");
const { attachSession } = require("../utils/trialReportAuth");

router.use(attachSession);

// === Browser-OAuth upload (NEW canonical endpoint) ===
// Frontend uploads to R2, then calls this route with the resulting
// object key so the metadata is stored in Mongo.
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

// Audit trail for a single report. Auth is enforced inside the controller
// (uploader OR TE/Admin). URL pattern is `/trial-report/reports/:id/audit`.
router.get("/reports/:id/audit", trialReportController.getReportAudit);

// === Legacy aliases for backward compatibility ===
// Old spec routes used to accept a base64 PDF body and upload via the
// backend service account. They now forward to `registerReport` for any
// external caller that hasn't migrated to the new flow.
router.post("/reports", trialReportController.createReport);
router.post("/upload", trialReportController.uploadPdf);

// === Direct delete (password-gated) ===
// Replaces the old 2-step request/review workflow. Anyone (uploader,
// Password-gated direct delete. The report id (Mongo `_id` or R2
// object key) is passed in the body as `{ id }` to support R2 keys
// that contain slashes. All other callers (internal scripts,
// TE/Admin, etc.) who knows the shared `TRIAL_REPORT_DELETE_PASSWORD`
// can delete a report immediately. The controller validates the
// password with constant-time compare before doing any work.
router.post(
  "/reports/direct-delete",
  trialReportController.executeDirectDelete,
);

// === TE/Admin-only escape hatch ===
// Legacy hard-delete that bypasses the password gate. Used by internal
// scripts only. The FE does not call this — it uses `/direct-delete`
// instead.
router.post(
  "/reports/:id/delete",
  trialReportController.executeDelete,
);

router.get(
  "/all-reports",
  trialReportController.getAllReports,
);

// === Legacy delete-request routes (stubbed for backward compat) ===
// The 2-step request/review workflow was retired in favor of the
// password-gated direct delete. These routes return empty results so
// old callers that still hit them don't crash.
router.get("/delete-requests", trialReportController.getDeleteRequests);
router.get(
  "/delete-requests/count",
  trialReportController.getDeleteRequestsCount,
);

module.exports = router;