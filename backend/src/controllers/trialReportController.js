/**
 * Trial Report Controller
 *
 * Implements the public `/trial-report` endpoints. All mutations write
 * to `TrialReportLog` so the trail of who uploaded/deleted what is
 * discoverable later. Authorization is centralized in the auth
 * middleware (see `utils/trialReportAuth.js`).
 *
 * Storage strategy:
 *   - Primary: Cloudflare R2 (server-side, no per-user auth needed).
 *     Backend proxies PDF uploads via multipart and issues presigned
 *     download URLs on demand.
 *
 * The frontend uploads to R2, then POSTs the resulting object key to
 * `POST /trial-report/reports/register` so the metadata is stored
 * in Mongo.
 *
 * Legacy `POST /trial-report/reports` and `POST /trial-report/upload`
 * are preserved as aliases that delegate to `registerReport` for
 * backward compatibility with any external caller.
 */

const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const {
  TrialReport,
  TrialReportLog,
} = require("../storage/mongoModels");
const { notifyAlert } = require("../utils/slackNotifier");
const { logReportEvent, getReportAuditTrail } = require("../services/auditService");
const { verifyDeletePassword } = require("../utils/deletePassword");
const r2Client = require("../services/r2Client");

const { childLogger } = require("./../utils/logger.js");
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

/**
 * Resolve the version metadata for a new trial-report upload.
 *
 * Looks for the most-recent non-deleted report with the same
 * (studentName, teacherName, classDate) tuple. If found, the new row
 * becomes version+1 and points to the prior row via `previousReportId`.
 * The `reportGroupId` is reused from the prior row so a future
 * "timeline" view can fetch the whole lineage in one query.
 *
 * If the prior row predates the versioning feature and is therefore
 * missing a `reportGroupId`, we backfill it on the prior row before
 * returning so the chain stays consistent.
 *
 * If no prior row exists, this is version 1 with a fresh groupId.
 *
 * This helper is exported (and not bound to the controller instance)
 * so it can be unit-tested with a mocked `TrialReport` model — see
 * `backend/scripts/test-versioning.js`.
 *
 * @param {object} deps
 * @param {object} deps.TrialReport - Mongoose model (injectable for tests)
 * @param {string} deps.studentName
 * @param {string} deps.teacherName
 * @param {Date|null} deps.classDate
 * @returns {Promise<{version:number, previousReportId:objectId|null, reportGroupId:string}>}
 */
async function resolveVersion({ TrialReport: Model, studentName, teacherName, classDate }) {
  const prior = await Model.findOne({
    studentName,
    teacherName,
    classDate,
    deletedAt: null,
  })
    .sort({ version: -1, createdAt: -1 })
    .lean();

  if (!prior) {
    const groupId = new mongoose.Types.ObjectId().toString();
    return {
      version: 1,
      previousReportId: null,
      reportGroupId: groupId,
    };
  }

  // Backfill groupId on the prior row if it predates the versioning
  // feature. We do this BEFORE returning so the new row's groupId is
  // the one stored in Mongo (rather than a transient in-memory value).
  let reportGroupId = prior.reportGroupId;
  if (!reportGroupId) {
    reportGroupId = new mongoose.Types.ObjectId().toString();
    await Model.updateOne(
      { _id: prior._id },
      { $set: { reportGroupId } },
    );
  }

  return {
    version: (typeof prior.version === "number" && prior.version > 0 ? prior.version : 1) + 1,
    previousReportId: String(prior._id),
    reportGroupId,
  };
}

function getActor(req) {
  // Prefer the trial-report-specific session (set by `attachSession`)
  // but fall back to `req.user` so the controller also works when it's
  // mounted under a generic auth middleware that populates `req.user`.
  const user = req.trialReportUser || req.user || null;
  return {
    userId: user?.userId || null,
    teacherId: user?.teacherId || null,
    name: user?.fullName || user?.name || null,
    email: user?.email || null,
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
 * GET /trial-report/reports/:id/audit
 *
 * Returns the last 50 audit entries for a report. Access rules:
 *   - the report's uploader (uploadedBy == userId) may read
 *   - TE/Admin may always read
 *   - everyone else gets 403
 */
const TE_OR_ADMIN = ["TE", "ADMIN"];
const getReportAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const report = await TrialReport.findOne({ _id: id }).lean();
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    const user = req.trialReportUser || null;
    const userRoles = (user && user.roles) || [];
    const isPrivileged = userRoles.some((r) =>
      TE_OR_ADMIN.includes(String(r).toUpperCase()),
    );

    const isOwner =
      user &&
      report.uploadedBy &&
      String(user.userId || user.teacherId) ===
        String(report.uploadedBy);

    if (!isPrivileged && !isOwner) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permission to view audit log",
        code: "EFORBIDDEN",
      });
    }

    const items = await getReportAuditTrail(id, limit);
    return res.json({ success: true, data: items });
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * POST /trial-report/reports/register
 *
 * Registers a file uploaded to R2 (canonical path). The storage key
 * (`r2Key`) is used as the unique upsert key so retries never create
 * duplicates.
 *
 * Body (all fields optional except `r2Key` / `fileName` / `studentName`):
 *   {
 *     r2Key:            string  (R2 object key — canonical for new uploads)
 *     fileName:         string  (required)
 *     mimeType?:        "application/pdf"
 *     size?:            number
 *     webViewLink?:     string  (presigned R2 URL)
 *     reportType?:      "Kiro4+" | "Robotics" | "Coding" | "Art" | "pdf-upload"
 *     classDate?:       ISO date string
 *     teacherCode?:     string
 *     teacherName?:     string
 *     studentName:      string  (required)
 *     uploadedByEmail?: string
 *   }
 *
 * Response: { success, data: { report, webViewLink } }
 */
const registerReport = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      r2Key,
      fileName,
      mimeType,
      size,
      webViewLink,
      reportType,
      classDate,
      teacherCode,
      teacherName,
      studentName,
      uploadedByEmail,
    } = body;

    const storageKey = r2Key;
    if (!storageKey || typeof storageKey !== "string") {
      return res.status(400).json({
        success: false,
        error: "r2Key is required",
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
    const trimmedStudentName = String(studentName).trim();
    const trimmedTeacherName = (teacherName || "").trim();

    // === Version resolution ===
    // Try to find an existing non-deleted row for the same
    // (studentName, teacherName, classDate) tuple. If found, bump
    // version; if not, start at v1.
    // We look up by storageKey for the retry path, or by the
    // (student/teacher/date) trio for the version-bump path.
    const existingRow = await TrialReport.findById(storageKey);
    if (existingRow) {
      // Retry of the exact same upload — preserve version lineage.
      existingRow.fileId = storageKey;
      existingRow.fileName = fileName;
      existingRow.mimeType = mimeType || "application/pdf";
      existingRow.size = typeof size === "number" ? size : size ? Number(size) : null;
      existingRow.webViewLink = webViewLink || existingRow.webViewLink || "";
      existingRow.reportType = reportType || existingRow.reportType || "pdf-upload";
      existingRow.classDate = classDateParsed;
      existingRow.teacherCode = teacherCode || existingRow.teacherCode || "";
      existingRow.teacherName = trimmedTeacherName || existingRow.teacherName || "";
      existingRow.studentName = trimmedStudentName;
      existingRow.uploadedBy = actor.userId;
      existingRow.uploadedByName = actor.name || "";
      existingRow.uploadedByEmail = uploadedByEmail || "";
      existingRow.deletedAt = existingRow.deletedAt || null;
      existingRow.r2Key = r2Key || existingRow.r2Key || "";
      const reportDoc = await existingRow.save();

      await writeLog({
        action: "upload",
        reportId: r2Key,
        reportType: reportType || "pdf-upload",
        fileName,
        targetUserId: null,
        performedBy: actor.userId,
        performedByName: actor.name,
        metadata: {
          r2Key: r2Key || "",
          size: reportDoc.size,
          classDate: classDateParsed,
          teacherCode,
          teacherName: trimmedTeacherName,
          studentName: trimmedStudentName,
          uploadedByEmail,
          source: "r2",
          version: reportDoc.version,
          event: "retry",
        },
      });

      return res.json({
        success: true,
        data: {
          report: reportDoc.toObject(),
          webViewLink: reportDoc.webViewLink,
        },
      });
    }

    // New row — compute version + previousReportId + reportGroupId.
    const { version, previousReportId, reportGroupId } = await resolveVersion({
      TrialReport,
      studentName: trimmedStudentName,
      teacherName: trimmedTeacherName,
      classDate: classDateParsed,
    });

    const reportDoc = await TrialReport.create({
      _id: storageKey,
      fileId: storageKey,
      fileName,
      mimeType: mimeType || "application/pdf",
      size: typeof size === "number" ? size : size ? Number(size) : null,
      webViewLink: webViewLink || "",
      webContentLink: "",
      parentFolderId: "",
      r2Key: r2Key || "",
      reportType: reportType || "pdf-upload",
      classDate: classDateParsed,
      teacherCode: teacherCode || "",
      teacherName: trimmedTeacherName,
      studentName: trimmedStudentName,
      uploadedBy: actor.userId,
      uploadedByName: actor.name || "",
      uploadedByEmail: uploadedByEmail || "",
      deletedAt: null,
      version,
      previousReportId,
      reportGroupId,
    });

    await writeLog({
      action: "upload",
      reportId: storageKey,
      reportType: reportType || "pdf-upload",
      fileName,
      targetUserId: null,
      performedBy: actor.userId,
      performedByName: actor.name,
      metadata: {
        r2Key: r2Key || "",
        size: reportDoc.size,
        classDate: classDateParsed,
        teacherCode,
        teacherName: trimmedTeacherName,
        studentName: trimmedStudentName,
        uploadedByEmail,
        source: "r2",
        version,
        previousReportId: previousReportId ? previousReportId.toString() : null,
        reportGroupId,
      },
    });

    // Audit trail (structured, future-proof log of who/when).
    // Fire-and-forget: failures are swallowed inside the service so
    // a logging hiccup never breaks the user's upload.
    await logReportEvent(
      r2Key,
      actor,
      "upload",
      {
        size: reportDoc.size,
        classDate: classDateParsed,
        teacherCode,
        teacherName: trimmedTeacherName,
        studentName: trimmedStudentName,
        version,
        reportGroupId,
      },
    );

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
      metadata: { source: "r2" },
    });
    return sendError(res, err);
  }
};

/**
 * POST /trial-report/reports
 *
 * Legacy alias — old backend-driven upload path. The browser now drives
 * uploads to R2, so this route exists only for backward compatibility
 * with any external caller still POSTing here. For legacy callers that
 * still send a `pdfBase64`, we attempt to find a matching Mongo doc by
 * fileName; if none, we still register a row with a synthetic `_id` so
 * logs make sense.
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
 * Resolve a `TrialReport` from either its Mongo `_id` (uuidv4) or its
 * R2 object key (`r2Key`). The browser's `FileList` is driven by R2,
 * so the id it sends may be the r2Key rather than the Mongo _id.
 *
 * Lookup order:
 *   1. `_id` — exact match (fast path, also used by legacy callers).
 *   2. `r2Key` — exact match, pick the most recent non-deleted row.
 *
 * `r2Key` is not currently unique at the DB level (rows can be re-uploaded
 * with the same key after a soft-delete), so we defensively pick the
 * newest match. Returns `null` if nothing matches.
 */
async function resolveReport(idOrKey) {
  if (!idOrKey) return null;
  const value = String(idOrKey).trim();
  if (!value) return null;

  const byId = await TrialReport.findOne({ _id: value, deletedAt: null }).lean();
  if (byId) return byId;

  // Try exact r2Key match first (fast path).
  const exact = await TrialReport.find({ r2Key: value, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();
  if (exact[0]) return exact[0];

  // Debug: report whether the collection even has r2Key on any doc.
  // This is one-shot — won't spam logs on every call.
  if (!resolveReport._r2keyLogged) {
    resolveReport._r2keyLogged = true;
    const total = await TrialReport.countDocuments({ deletedAt: null });
    const withField = await TrialReport.countDocuments({
      deletedAt: null,
      r2Key: { $exists: true },
    });
    const withFieldNonEmpty = await TrialReport.countDocuments({
      deletedAt: null,
      r2Key: { $exists: true, $ne: "" },
    });
    // eslint-disable-next-line no-console
    console.log(
      "[resolveReport] r2Key probe: totalLive=" + total +
        " withField=" + withField +
        " withFieldNonEmpty=" + withFieldNonEmpty,
    );
  }

  // Fallback: normalize both sides to NFKC + lowercase to absorb
  // Unicode form (NFC vs NFD) and case differences between what
  // the FE encodes into a file path and what we store at upload time.
  const norm = (s) =>
    typeof s === "string"
      ? s.normalize("NFKC").trim().toLowerCase()
      : "";
  const target = norm(value);

  // Pull a bounded candidate set (recent, not deleted) and filter
  // in-process. Cheap enough for the dataset size — and avoids
  // building a fancy index just for this debug pass.
  const candidates = await TrialReport.find({ deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  // Debug distribution: how many of the recent rows actually have r2Key?
  const dbCounts = await TrialReport.aggregate([
    {
      $group: {
        _id: {
          hasR2Key: {
            $cond: [{ $and: [{ $ne: ["$r2Key", null] }, { $ne: ["$r2Key", ""] }] }, true, false],
          },
          isDeleted: { $cond: [{ $ne: ["$deletedAt", null] }, true, false] },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
  // eslint-disable-next-line no-console
  console.log(
    "[resolveReport] db distribution (r2Key x deletedAt):",
    JSON.stringify(dbCounts),
  );

  // eslint-disable-next-line no-console
  console.log(
    "[resolveReport] fallback scan candidates=",
    candidates.length,
    "input_norm=",
    JSON.stringify(target),
    "input_len=",
    value.length,
    "input_nfc_len=",
    value.normalize("NFC").length,
    "input_nfkc_len=",
    value.normalize("NFKC").length,
    "input_nfd_len=",
    value.normalize("NFD").length,
  );

  let firstThree = [];
  for (const c of candidates) {
    const rawKey = c.r2Key;
    if (firstThree.length < 3) {
      firstThree.push({
        _id: c._id,
        fileId: c.fileId,
        fileName: c.fileName,
        classDate: c.classDate,
        studentName: c.studentName,
        teacherName: c.teacherName,
        hasR2KeyField: "r2Key" in c,
      });
    }
    if (!rawKey) continue;
    const keyNFC = rawKey.normalize("NFC").trim().toLowerCase();
    const keyNFKC = rawKey.normalize("NFKC").trim().toLowerCase();
    if (keyNFC === target || keyNFKC === target) return c;
  }
  // eslint-disable-next-line no-console
  console.log(
    "[resolveReport] fallback scan sample keys (first 3):",
    JSON.stringify(firstThree, null, 2),
  );
  return null;
}

/**
 * POST /trial-report/reports/direct-delete
 * Body: { password: string, id: string }
 *
 * Password-gated direct delete — replaces the old 2-step
 * request/review workflow. Anyone who knows
 * `TRIAL_REPORT_DELETE_PASSWORD` can delete a report immediately:
 *   1. verify password (constant-time compare)
 *   2. resolve report (`_id` or r2Key)
 *   3. soft-delete Mongo row + hard-delete R2 object
 *   4. write audit log
 *
 * The `id` field is in the body (not URL params) so R2 object keys
 * that contain slashes don't break URL parsing.
 *
 * The shared password (configured in `.env`) acts as an authorization
 * gate rather than a per-user credential.
 */

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
 *
 * @deprecated — replaced by direct delete (password-gated). Kept only
 * for any caller that hasn't migrated; returns empty result.
 */
const getDeleteRequests = async (_req, res) => {
  return res.json({ success: true, data: [], total: 0, deprecated: true });
};

/**
 * GET /trial-report/delete-requests/count
 *
 * @deprecated — bell badge is gone with the request/review workflow.
 */
const getDeleteRequestsCount = async (_req, res) => {
  return res.json({ success: true, data: { pending: 0 }, deprecated: true });
};

/**
 * POST /trial-report/reports/direct-delete
 *
 * Replaces the old 2-step request/review flow. Anyone with the
 * configured `TRIAL_REPORT_DELETE_PASSWORD` can delete a single
 * report immediately:
 *   - soft-delete the Mongo row (`deletedAt`)
 *   - hard-delete the R2 object (if `r2Key` is set)
 *   - write audit log (`action: "delete-direct"`)
 *
 * Body: { password: string, id: string }
 * Response: { success, data: { id, deletedAt } }
 * Errors:
 *   404 EREPORTNOTFOUND  — resolveReport miss
 *   401 EWRONGPASSWORD   — password mismatch
 *   409 EALREADYDELETED   — already soft-deleted
 *   500 — anything else (logged)
 */
const executeDirectDelete = async (req, res) => {
  try {
    // Accept `id` from body (not URL params) to support R2 keys
    // that contain slashes. Also accept from params for backwards
    // compatibility.
    const id = req.body?.id || req.params?.id;
    const password = req.body?.password;

    // 1. Password gate (constant-time compare inside verifyDeletePassword).
    if (!verifyDeletePassword(password)) {
      return res.status(403).json({
        success: false,
        code: "EWRONGPASSWORD",
        error: "Mật khẩu xóa không đúng.",
      });
    }

    // 2. Resolve the report (handles legacy _id / r2Key / fuzzy matches).
    const report = await resolveReport(id);

    if (!report) {
      // No MongoDB record — try to hard-delete from R2 directly.
      // This handles files uploaded manually to R2 without a
      // corresponding TrialReport document.
      try {
        await r2Client.deleteObject(id);
        log.info("[executeDirectDelete] R2-only delete: %s", id);
        return res.json({ success: true, data: { id, deletedAt: null, r2Only: true } });
      } catch (r2Err) {
        if (r2Err.$metadata?.httpStatusCode === 404) {
          return res.status(404).json({
            success: false,
            code: "EREPORTNOTFOUND",
            error: "Không tìm thấy phiếu.",
          });
        }
        log.error("[executeDirectDelete] R2-only delete failed: %s", r2Err.stack || r2Err.message);
        return sendError(res, r2Err);
      }
    }

    if (report.deletedAt) {
      return res.status(409).json({
        success: false,
        code: "EALREADYDELETED",
        error: "Phiếu đã bị xóa trước đó.",
      });
    }

    const actor = getActor(req);
    await _softAndHardDelete(report, actor, "delete-direct");
    return res.json({
      success: true,
      data: { id: report._id, deletedAt: report.deletedAt },
    });
  } catch (err) {
    log.error("[executeDirectDelete] %s", err.stack || err.message);
    return sendError(res, err);
  }
};

/**
 * Soft-delete the Mongo row + hard-delete the R2 object + write audit
 * log. Shared between the legacy `executeDelete` (still callable for
 * emergency TE/Admin use without the password gate) and the new
 * password-gated `executeDirectDelete`.
 *
 * @param {object} report       - the live TrialReport mongoose doc
 * @param {object} actor        - { userId, name, email } from session
 * @param {string} actionLabel  - "delete-direct" | "delete"
 */
const _softAndHardDelete = async (report, actor, actionLabel) => {
  // 1. R2 hard-delete (best-effort — missing objects are success).
  if (report.r2Key) {
    try {
      await r2Client.deleteObject(report.r2Key);
    } catch (r2Err) {
      log.warn(
        "[%s] R2 delete failed for %s: %s",
        actionLabel,
        report.r2Key,
        r2Err.message,
      );
    }
  }

  // 2. Mongo soft-delete. Use findByIdAndUpdate so it works whether
  // `report` is a Mongoose doc (from findById) or a lean plain object
  // (from resolveReport's fuzzy fallback that uses .lean()).
  await TrialReport.findByIdAndUpdate(report._id, { deletedAt: new Date() });

  // 3. Audit (legacy log).
  await TrialReportLog.create({
    action: "delete",
    reportId: report._id,
    reportType: report.reportType,
    fileName: report.fileName,
    targetUserId: report.uploadedBy,
    performedBy: actor?.userId || null,
    performedByName: actor?.name || "",
    metadata: {
      source: actionLabel,
      r2Key: report.r2Key || "",
      teacherCode: report.teacherCode,
      teacherName: report.teacherName,
      studentName: report.studentName,
    },
  });

  // 4. Audit (structured).
  await logReportEvent(
    report._id,
    actor || { userId: null, name: "", email: "" },
    "delete",
    { source: actionLabel, r2Key: report.r2Key || "" },
  );
};

/**
 * POST /trial-report/reports/:id/delete
 *
 * @deprecated — legacy hard-delete that bypasses the password gate.
 * Kept only as an internal escape hatch (currently unused by the FE).
 * Prefer `POST /trial-report/reports/direct-delete`.
 */
const executeDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await TrialReport.findById(id);
    if (!report) {
      return res
        .status(404)
        .json({ success: false, error: "Report not found" });
    }
    if (report.deletedAt) {
      return res.status(409).json({
        success: false,
        error: "Report already deleted",
        code: "EALREADYDELETED",
      });
    }
    const actor = getActor(req);
    await _softAndHardDelete(report, actor, "delete");
    return res.json({ success: true, data: report.toObject() });
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
  // Versioning helper (exported for unit tests — see
  // scripts/test-versioning.js)
  resolveVersion,
  // Legacy aliases (kept for backward compatibility)
  getFolders: (_req, _res) =>
    _res.status(410).json({
      success: false,
      error:
        "GET /trial-report/folders is no longer supported. The browser now lists R2 folders directly.",
    }),
  getFiles: (_req, _res) =>
    _res.status(410).json({
      success: false,
      error:
        "GET /trial-report/files is no longer supported. The browser now lists R2 objects directly.",
    }),
  getReport,
  getReportAudit,
  createReport,
  uploadPdf,
  executeDirectDelete,
  executeDelete,
  getAllReports,
  getDeleteRequests,
  getDeleteRequestsCount,
};
