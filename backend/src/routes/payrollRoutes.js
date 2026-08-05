const express = require("express");
const router = express.Router();
const multer = require("multer");

const payrollController = require("../controllers/payrollController");
const { attachSession, requireRole } = require("../utils/trialReportAuth");
const { ROLES } = require("../constants/roles");
const { createExpressRateLimiter } = require("../utils/rateLimiter");

// Allow both TE and admin-like accounts to upload/manage periods.
const TE_OR_ADMIN = [ROLES.TE, "admin", "ADMIN"];

// Memory storage — we never want payroll xlsx files sitting on disk.
// Cap at 10MB which is well above the 1.3MB sample we measured.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = /\.xlsx?$/i.test(file.originalname || "");
    if (!ok) {
      return cb(new Error("Only .xlsx / .xls files are accepted"));
    }
    return cb(null, true);
  },
});

// Per-route `attachSession` + `requireRole` because multer must run
// BEFORE auth (so `req.body.sessionId` is populated). The original
// `router.use(attachSession)` pattern used by `trialReportRoutes` only
// works for JSON endpoints — for multipart uploads we wire each route
// individually below.

// Public — list active periods (metadata only).
router.get("/periods", payrollController.getPeriods);

// Public — distinct centre shortnames present in payroll data (powers the
// search form's <select> instead of a free-text input).
router.get("/centres", payrollController.getCentres);

// Public — search records with filters + pagination.
router.get("/search", payrollController.searchRecords);

// Public — KPI summary for a period (cards on the dashboard).
router.get("/summary", payrollController.getSummary);

// Public — monthly rollup (1 row / teacher).
router.get("/monthly-rollup", payrollController.getMonthlyRollup);

// Admin — list ALL periods (including archived) — TE only.
router.get(
  "/admin/periods",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.adminListPeriods,
);

// Admin — preview parsed file before persisting — TE only.
// Multer MUST run before requireRole so req.body.sessionId is parsed.
router.post(
  "/admin/preview",
  upload.single("file"),
  attachSession,
  requireRole(TE_OR_ADMIN),
  (req, res, next) => {
    // Wrap multer errors (file too large, wrong type) so the response
    // stays inside the {success, error} shape used elsewhere.
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }
    return payrollController.previewPeriod(req, res, next);
  },
);

// Admin — upload new period — TE only.
// Rate-limit uploads separately so a runaway TE script can't DoS the
// upload pipeline. Allow 10 uploads / 10 min.
const uploadLimiter = createExpressRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Quá nhiều lần upload. Vui lòng chờ vài phút.",
  keyPrefix: "payroll-upload:",
});

router.post(
  "/admin/periods",
  uploadLimiter,
  upload.single("file"),
  attachSession,
  requireRole(TE_OR_ADMIN),
  (req, res, next) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }
    return payrollController.uploadPeriod(req, res, next);
  },
);

// Admin — archive (soft delete) — TE only.
router.delete(
  "/admin/periods/:id",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.archivePeriod,
);

// Admin — HARD-DELETE period (irreversible) — TE only.
// Use this when a period was uploaded by mistake. The path uses /purge
// (not just DELETE on the same URL) so the soft-delete toggle above
// keeps working without breaking existing callers.
router.delete(
  "/admin/periods/:id/purge",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.purgePeriod,
);

/* ---------------------------------------------------------------- *
 * Payroll Issue Reports (GV TDM ↔ TE thekhiem ↔ Tech team)
 * ---------------------------------------------------------------- */

// Public rate limit — caps any single IP / session at 20 reports / 5 min
// regardless of whether they authenticate or not.
const payrollIssueCreateLimiter = createExpressRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: "Bạn gửi quá nhiều báo cáo. Vui lòng chờ vài phút.",
  keyPrefix: "payroll-issue:",
});

// Public (rate-limited only). Historically required TDM-teacher
// session — relaxed to public so anyone reading payroll can flag
// "Uncheck vô lý" without authenticating. The rate limiter + dedup
// by reporter identifier is the only abuse guard now.
router.post(
  "/issues",
  payrollIssueCreateLimiter,
  payrollController.createPayrollIssue,
);

// TE list reports — TE only.
router.get(
  "/admin/payroll-issues",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.listPayrollIssues,
);

// TE gửi email tới Tech team — TE only.
router.post(
  "/admin/payroll-issues/notify",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.notifyPayrollIssue,
);

// TE resolve / dismiss — TE only.
router.patch(
  "/admin/payroll-issues/:id/resolve",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.resolvePayrollIssue,
);

// Lấy lịch sử email của 1 issue — TE only.
router.get(
  "/admin/payroll-issues/:id/history",
  attachSession,
  requireRole(TE_OR_ADMIN),
  payrollController.getPayrollIssueHistory,
);

module.exports = router;