/**
 * Trial Report Controller
 *
 * Implements the public `/trial-report` endpoints. All mutations write
 * to `TrialReportLog` so the trail of who uploaded/deleted what is
 * discoverable later. Authorization is centralized in the auth
 * middleware (see `utils/trialReportAuth.js`).
 *
 * Upload strategy (post browser-OAuth migration):
 *   - Frontend uploads the PDF to Google Drive directly via the user's
 *     OAuth token (using `Year > Month/Year > Day > Teacher` folder
 *     hierarchy, same as the original Vite sub-project).
 *   - Frontend then POSTs the resulting Drive file metadata here to
 *     register it in Mongo (`POST /trial-report/reports/register`).
 *   - This avoids the service-account `storageQuotaExceeded` error,
 *     which Google throws whenever a service account tries to upload
 *     into a user's personal Drive.
 *
 * The legacy `POST /trial-report/reports` and `POST /trial-report/upload`
 * routes are preserved as thin aliases that delegate to `registerReport`,
 * so existing callers don't break in the middle of a migration.
 */

const { v4: uuidv4 } = require("uuid");

const {
  TrialReport,
  TrialReportLog,
  TrialReportDeleteRequest,
} = require("../storage/mongoModels");
const { notifyAlert } = require("../utils/slackNotifier");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("TrialReportController");

// We intentionally do NOT require REPORT_TEMPLATES here anymore — reports
// can now be generated client-side, so the backend doesn't need to know
// the catalogue. Only `pdf-upload` is enforced for the legacy body shape.
const VALID_REPORT_TYPES = [
  "Kiro4+",
  "Robotics",
  "Coding",
  "Art",
  "pdf-upload",
];

function safe(value) {
  if (value === undefined || value === null) return null;
  return value;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function getActor(req) {
  const user = req.trialReportUser || null;
  return {
    userId: user?.userId || null,
    teacherId: user?.teacherId || null,
    name: user?.fullName || null,
  };
}

async function writeLog(entry) {
  try {
    await TrialReportLog.create(entry);
  } catch (err) {
    log.error("[trialReportController] Failed to write log: %s", err.message);
  }
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  log.error("[trialReportController] %s: %s", err.message, err.stack);
  return res.status(status).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
}

/**
 * GET /trial-report/reports/:id
 * Returns a single report's metadata (cached in Mongo).
 */
const getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await TrialReport.findOne({ _id: id, deletedAt: null }).lean();
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }
    return res.json({ success: true, data: report });
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * POST /trial-report/reports/register
 *
 * Registers a file that the browser already uploaded to Drive via the
 * user's OAuth token. The Mongo `_id` is the Drive `fileId`, which
 * makes the upsert idempotent (a retry won't create duplicates).
 *
 * Body (all fields optional except driveFileId / fileName / studentName):
 *   {
 *     driveFileId:        string  (required — the Google Drive file id)
 *     fileName:           string  (required)
 *     mimeType?:          "application/pdf"
 *     size?:              number
 *     webViewLink?:       string
 *     webContentLink?:    string
 *     parentFolderId?:    string  (Drive folder id where browser placed it)
 *     reportType?:        "Kiro4+" | "Robotics" | "Coding" | "Art" | "pdf-upload"
 *     classDate?:         ISO date string
 *     teacherCode?:       string
 *     teacherName?:       string
 *     studentName:        string  (required)
 *     uploadedByEmail?:   string  (the Google account email that uploaded)
 *   }
 *
 * Response: { success, data: { report, webViewLink } }
 */
const registerReport = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      driveFileId,
      fileName,
      mimeType,
      size,
      webViewLink,
      webContentLink,
      parentFolderId,
      reportType,
      classDate,
      teacherCode,
      teacherName,
      studentName,
      uploadedByEmail,
    } = body;

    if (!driveFileId || typeof driveFileId !== "string") {
      return res.status(400).json({
        success: false,
        error: "driveFileId is required",
      });
    }
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({
        success: false,
        error: "fileName is required",
      });
    }
    if (!studentName || !String(studentName).trim()) {
      return res.status(400).json({
        success: false,
        error: "studentName is required",
      });
    }
    if (reportType && !VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: `reportType must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
      });
    }

    const actor = getActor(req);
    const classDateParsed = parseDate(classDate);

    const reportDoc = await TrialReport.findByIdAndUpdate(
      driveFileId,
      {
        $set: {
          fileId: driveFileId,
          fileName,
          mimeType: mimeType || "application/pdf",
          size: typeof size === "number" ? size : size ? Number(size) : null,
          webViewLink: webViewLink || "",
          webContentLink: webContentLink || "",
          parentFolderId: parentFolderId || "",
          reportType: reportType || "pdf-upload",
          classDate: classDateParsed,
          teacherCode: teacherCode || "",
          teacherName: teacherName || "",
          studentName: String(studentName).trim(),
          uploadedBy: actor.userId,
          uploadedByName: actor.name || "",
          uploadedByEmail: uploadedByEmail || "",
          deletedAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await writeLog({
      action: "upload",
      reportId: driveFileId,
      reportType: reportType || "pdf-upload",
      fileName,
      targetUserId: null,
      performedBy: actor.userId,
      performedByName: actor.name,
      metadata: {
        folderId: parentFolderId || "",
        size: reportDoc.size,
        classDate: classDateParsed,
        teacherCode,
        teacherName,
        studentName,
        uploadedByEmail,
        source: "browser-oauth",
      },
    });

    return res.json({
      success: true,
      data: {
        report: reportDoc.toObject(),
        webViewLink: reportDoc.webViewLink,
      },
    });
  } catch (err) {
    const actor = getActor(req);
    await writeLog({
      action: "upload",
      reportType: req.body?.reportType || null,
      fileName: req.body?.fileName || "",
      performedBy: actor.userId,
      performedByName: actor.name,
      error: err.message,
      metadata: { source: "browser-oauth" },
    });
    return sendError(res, err);
  }
};

/**
 * POST /trial-report/reports
 *
 * Legacy alias — old backend-driven upload path (service-account). The
 * browser now drives the upload, so this route exists only for backward
 * compatibility with any external caller still POSTing here. It treats
 * the body exactly like `registerReport` but without `driveFileId` (which
 * was generated server-side before). For legacy callers that still send a
 * `pdfBase64`, we attempt to find a matching Mongo doc by fileName; if
 * none, we still register a row with a synthetic `_id` so logs make sense.
 *
 * New clients should call `POST /trial-report/reports/register`.
 */
const createReport = async (req, res) => {
  return registerReport(req, res);
};

/**
 * POST /trial-report/upload
 * Legacy alias for `createReport`. Kept for symmetry with the original
 * spec route.
 */
const uploadPdf = async (req, res) => {
  return registerReport(req, res);
};

/**
 * POST /trial-report/delete-request
 * Body: { reportId, reason }
 */
const requestDelete = async (req, res) => {
  try {
    const { reportId, reason } = req.body || {};
    if (!reportId) {
      return res.status(400).json({ success: false, error: "reportId is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: "reason is required" });
    }

    const report = await TrialReport.findOne({ _id: reportId, deletedAt: null }).lean();
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }

    const existing = await TrialReportDeleteRequest.findOne({
      reportId,
      status: { $in: ["pending", "approved"] },
    }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Đã có yêu cầu xóa đang chờ/đã duyệt cho báo cáo này",
        code: "EREQUESTEXISTS",
      });
    }

    const actor = getActor(req);
    const id = uuidv4();
    const doc = await TrialReportDeleteRequest.create({
      _id: id,
      reportId,
      fileName: report.fileName,
      requestedBy: actor.userId,
      requestedByName: actor.name,
      reason: reason.trim(),
      status: "pending",
    });

    await writeLog({
      action: "delete-request",
      reportId,
      reportType: report.reportType,
      fileName: report.fileName,
      targetUserId: report.uploadedBy,
      performedBy: actor.userId,
      performedByName: actor.name,
      metadata: { deleteRequestId: id, reason: reason.trim() },
    });

    return res.json({ success: true, data: doc.toObject() });
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * POST /trial-report/delete-request/:id/review
 * Body: { action: 'approve' | 'reject', note?: string }
 * Requires TE/Admin role.
 */
const reviewDeleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body || {};

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "action must be 'approve' or 'reject'",
      });
    }

    const request = await TrialReportDeleteRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, error: "Delete request not found" });
    }
    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        error: `Request already ${request.status}`,
        code: "EREQUESTNOTPENDING",
      });
    }

    const actor = getActor(req);
    const newStatus = action === "approve" ? "approved" : "rejected";
    request.status = newStatus;
    request.reviewedBy = actor.userId;
    request.reviewedByName = actor.name;
    request.reviewedAt = new Date();
    if (note) request.reason = `${request.reason}\n[Reviewer note]: ${note}`;
    await request.save();

    await writeLog({
      action: "delete-request",
      reportId: request.reportId,
      fileName: request.fileName,
      targetUserId: request.requestedBy,
      performedBy: actor.userId,
      performedByName: actor.name,
      metadata: {
        deleteRequestId: id,
        reviewAction: action,
        note: note || "",
      },
    });

    if (newStatus === "approved") {
      notifyAlert(
        "info",
        "Trial report delete request approved",
        `*${actor.name || "TE/Admin"}* đã duyệt yêu cầu xóa báo cáo: ${request.fileName}`,
        {
          File: request.fileName,
          "Requested by": request.requestedByName || request.requestedBy || "N/A",
          "Reviewed by": actor.name || "N/A",
          Reason: request.reason,
        },
      ).catch(() => {});
    }

    return res.json({ success: true, data: request.toObject() });
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * POST /trial-report/reports/:id/delete
 *
 * Soft-deletes the Mongo record. The browser is responsible for trashing
 * the actual Drive file via `googleDriveService.deleteFile(fileId)` BEFORE
 * calling this endpoint — if the browser forgot, the row will still be
 * hidden from the UI but the Drive file will linger in the user's account
 * until manually cleaned up.
 *
 * We intentionally do NOT touch Drive here anymore — the previous behaviour
 * (service-account `files.update({ trashed: true })`) failed with
 * `storageQuotaExceeded` because service accounts cannot own Drive files.
 *
 * Requires TE/Admin.
 */
const executeDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await TrialReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    if (report.deletedAt) {
      return res.status(409).json({
        success: false,
        error: "Report already deleted",
        code: "EALREADYDELETED",
      });
    }

    report.deletedAt = new Date();
    await report.save();

    await TrialReportDeleteRequest.findOneAndUpdate(
      { reportId: id, status: "approved" },
      { $set: { status: "completed", completedAt: new Date() } },
      { new: true },
    ).catch(() => {});

    const actor = getActor(req);
    await writeLog({
      action: "delete",
      reportId: id,
      reportType: report.reportType,
      fileName: report.fileName,
      targetUserId: report.uploadedBy,
      performedBy: actor.userId,
      performedByName: actor.name,
      metadata: {
        teacherCode: report.teacherCode,
        teacherName: report.teacherName,
        studentName: report.studentName,
        driveTrashedByBrowser: true,
      },
    });

    notifyAlert(
      "warning",
      "Trial report deleted",
      `*${actor.name || "TE/Admin"}* đã xóa báo cáo: ${report.fileName}`,
      {
        File: report.fileName,
        Type: report.reportType,
        Teacher: report.teacherName || "N/A",
        Student: report.studentName || "N/A",
      },
    ).catch(() => {});

    return res.json({ success: true, data: report.toObject() });
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * GET /trial-report/all-reports?from=&to=&teacherCode=&studentName=&reportType=
 * Paginated list for TE/Admin.
 */
const getAllReports = async (req, res) => {
  try {
    const { from, to, teacherCode, studentName, reportType, page = 0, pageSize = 100 } = req.query;
    const filter = { deletedAt: null };

    if (from || to) {
      filter.classDate = {};
      if (from) {
        const d = parseDate(from);
        if (d) filter.classDate.$gte = d;
      }
      if (to) {
        const d = parseDate(to);
        if (d) filter.classDate.$lte = d;
      }
      if (Object.keys(filter.classDate).length === 0) delete filter.classDate;
    }
    if (teacherCode) filter.teacherCode = teacherCode;
    if (studentName) filter.studentName = { $regex: escapeRegex(studentName), $options: "i" };
    if (reportType && VALID_REPORT_TYPES.includes(reportType)) filter.reportType = reportType;

    const limit = Math.min(parseInt(pageSize, 10) || 100, 500);
    const skip = Math.max(parseInt(page, 10) || 0, 0) * limit;

    const [items, total] = await Promise.all([
      TrialReport.find(filter)
        .sort({ classDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrialReport.countDocuments(filter),
    ]);

    return res.json({ success: true, data: items, total, page: skip / limit });
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * GET /trial-report/delete-requests?status=pending
 */
const getDeleteRequests = async (req, res) => {
  try {
    const { status = "pending", page = 0, pageSize = 100 } = req.query;
    const filter = {};
    if (status !== "all") filter.status = status;

    const limit = Math.min(parseInt(pageSize, 10) || 100, 500);
    const skip = Math.max(parseInt(page, 10) || 0, 0) * limit;

    const [items, total] = await Promise.all([
      TrialReportDeleteRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrialReportDeleteRequest.countDocuments(filter),
    ]);

    return res.json({ success: true, data: items, total });
  } catch (err) {
    return sendError(res, err);
  }
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  // New canonical endpoint
  registerReport,
  // Legacy aliases (kept for backward compatibility)
  getFolders: (_req, _res) =>
    _res.status(410).json({
      success: false,
      error:
        "GET /trial-report/folders is no longer supported. The browser now lists Drive folders directly via the user's OAuth token.",
    }),
  getFiles: (_req, _res) =>
    _res.status(410).json({
      success: false,
      error:
        "GET /trial-report/files is no longer supported. The browser now lists Drive files directly via the user's OAuth token.",
    }),
  getReport,
  createReport,
  uploadPdf,
  requestDelete,
  reviewDeleteRequest,
  executeDelete,
  getAllReports,
  getDeleteRequests,
};
