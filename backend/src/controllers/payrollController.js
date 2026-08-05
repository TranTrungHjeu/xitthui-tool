/**
 * Payroll Controller
 *
 * Public-facing endpoints (no auth required) for the monthly payroll
 * check tool. Admin endpoints are guarded by `requireRole(["TE"])` in
 * the router.
 *
 * All endpoints intentionally read from `PayrollPeriod`/`PayrollRecord`
 * — we never reach out to Google Sheets or LMS during a search.
 */

const { PayrollPeriod, PayrollRecord, PayrollIssueReport } = require("../storage/mongoModels");
const {
  parsePayrollWorkbook,
  inferPeriodFromFilename,
  deriveLabel,
  buildPeriodId,
} = require("../services/payrollParser");
const { childLogger } = require("../utils/logger");
const emailService = require("../services/emailService");
const { renderPayrollIssueEmail } = require("../services/emailTemplates/payrollIssueReport");
const {
  buildOutlookUrlForEmail,
} = require("../services/outlookCompose");
const { randomUUID } = require("crypto");

const log = childLogger("PayrollController");

const DEFAULT_TTL_MONTHS = 18;
const SEARCH_LIMIT = 500;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTtlMonths() {
  const raw = process.env.PAYROLL_TTL_MONTHS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_MONTHS;
  return Math.min(parsed, 60); // cap at 5 years
}

function buildExpiresAt(fromDate = new Date()) {
  const ttl = getTtlMonths();
  const expires = new Date(fromDate);
  expires.setMonth(expires.getMonth() + ttl);
  return expires;
}

/* ---------------------------------------------------------------- *
 * Public — list active periods (metadata only, no records)
 * ---------------------------------------------------------------- */
exports.getPeriods = async (_req, res) => {
  try {
    const periods = await PayrollPeriod.find({ status: "active" })
      .select("-__v")
      .sort({ year: -1, month: -1, uploadedAt: -1 })
      .lean();
    res.json({ success: true, data: periods });
  } catch (err) {
    log.error("getPeriods failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to load payroll periods" });
  }
};

/* ---------------------------------------------------------------- *
 * Public — list distinct centre shortnames present in payroll data.
 *
 * Used by the search form to render a <select> instead of a free-text
 * input. We do NOT de-duplicate TDM ↔ 230ĐLBD on the server side — the
 * UI may simply render "TDM" and "230ĐLBD" as separate options and the
 * user picks the one they want. Both are real `centreShortname` values
 * observed in the source spreadsheet.
 *
 * Optional `?periodId=...` restricts the result to that period, but
 * the default returns distinct centres across all periods so the user
 * still sees options before picking a period.
 * ---------------------------------------------------------------- */
exports.getCentres = async (req, res) => {
  try {
    const { periodId } = req.query;
    const match = periodId && periodId !== "ALL" ? { periodId: String(periodId) } : {};

    const grouped = await PayrollRecord.aggregate([
      { $match: match },
      { $group: { _id: "$centreShortname", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const data = grouped
      .filter((g) => g._id && String(g._id).trim() !== "")
      .map((g) => ({
        id: String(g._id),
        label: String(g._id),
        count: g.count,
      }));

    res.json({ success: true, data });
  } catch (err) {
    log.error("getCentres failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to load payroll centres" });
  }
};

/* ---------------------------------------------------------------- *
 * Public — search records (paginated, lean)
 * ---------------------------------------------------------------- */
exports.searchRecords = async (req, res) => {
  try {
    const {
      q,
      periodId,
      type,
      classRole,
      centre,
      status,
      month,
      year,
      page = "1",
      pageSize = "50",
    } = req.query;

    const filter = {};
    if (periodId) filter.periodId = String(periodId);
    if (type && ["CLASS", "OFFICE_HOURS"].includes(String(type).toUpperCase())) {
      filter.type = String(type).toUpperCase();
    }
    if (classRole) filter.classRole = String(classRole).toUpperCase();
    if (centre) filter.centreShortname = String(centre);
    if (status && ["CHECKED", "UNCHECKED"].includes(String(status).toUpperCase())) {
      filter.status = String(status).toUpperCase();
    }
    if (month && year) {
      // Filter by month/year of slotTime via $expr + date parts.
      const m = Number(month);
      const y = Number(year);
      if (Number.isFinite(m) && Number.isFinite(y)) {
        filter.$expr = {
          $and: [
            { $eq: [{ $month: "$slotTime" }, m] },
            { $eq: [{ $year: "$slotTime" }, y] },
          ],
        };
      }
    }

    const trimmedQ = typeof q === "string" ? q.trim() : "";
    if (trimmedQ) {
      // Strategy:
      //   - If `q` looks like an email → match workEmail/personalEmail exactly.
      //   - If `q` is short alphanumeric → match username exactly.
      //   - Otherwise → fuzzy regex on teacherName + className.
      const isEmail = /^[^\s@]+@[^\s@]+$/.test(trimmedQ);
      const isUsernameLike = /^[a-z0-9._-]{3,}$/i.test(trimmedQ);

      if (isEmail) {
        filter.$or = [
          { workEmail: trimmedQ.toLowerCase() },
          { personalEmail: trimmedQ.toLowerCase() },
        ];
      } else if (isUsernameLike) {
        filter.$or = [
          { username: trimmedQ.toLowerCase() },
          { workEmail: new RegExp(`^${escapeRegex(trimmedQ)}@`, "i") },
        ];
      } else {
        const regex = new RegExp(escapeRegex(trimmedQ), "i");
        filter.$or = [
          { teacherName: regex },
          { className: regex },
        ];
      }
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(SEARCH_LIMIT, Math.max(1, Number(pageSize) || 50));
    const skip = (safePage - 1) * safeSize;

    const [items, total] = await Promise.all([
      PayrollRecord.find(filter)
        .sort({ slotTime: -1, _id: 1 })
        .skip(skip)
        .limit(safeSize)
        .lean(),
      PayrollRecord.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.ceil(total / safeSize),
      },
    });
  } catch (err) {
    log.error("searchRecords failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to search records" });
  }
};

/* ---------------------------------------------------------------- *
 * Public — period summary (KPI cards on dashboard)
 * ---------------------------------------------------------------- */
exports.getSummary = async (req, res) => {
  try {
    const { periodId } = req.query;
    if (!periodId) {
      return res
        .status(400)
        .json({ success: false, error: "periodId is required" });
    }
    const match = { periodId: String(periodId) };
    const [kpis, byRole, byCentre, byStatus] = await Promise.all([
      PayrollRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalSlots: { $sum: "$slotDuration" },
            totalEffectiveHours: { $sum: "$effectiveDuration" },
            totalStudents: { $sum: "$studentCount" },
            checkedCount: {
              $sum: { $cond: [{ $eq: ["$status", "CHECKED"] }, 1, 0] },
            },
            uncheckedCount: {
              $sum: { $cond: [{ $eq: ["$status", "UNCHECKED"] }, 1, 0] },
            },
            distinctTeachers: {
              $addToSet: {
                $cond: [{ $gt: ["$username", ""] }, "$username", null],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalRecords: 1,
            totalSlots: 1,
            totalEffectiveHours: 1,
            totalStudents: 1,
            checkedCount: 1,
            uncheckedCount: 1,
            teacherCount: {
              $size: {
                $filter: {
                  input: "$distinctTeachers",
                  as: "t",
                  cond: { $ne: ["$$t", null] },
                },
              },
            },
          },
        },
      ]),
      PayrollRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$classRole",
            count: { $sum: 1 },
            hours: { $sum: "$effectiveDuration" },
            checked: {
              $sum: { $cond: [{ $eq: ["$status", "CHECKED"] }, 1, 0] },
            },
          },
        },
        { $project: { _id: 0, role: "$_id", count: 1, hours: 1, checked: 1 } },
        { $sort: { role: 1 } },
      ]),
      PayrollRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$centreShortname",
            count: { $sum: 1 },
            hours: { $sum: "$effectiveDuration" },
          },
        },
        { $project: { _id: 0, centre: "$_id", count: 1, hours: 1 } },
        { $sort: { count: -1 } },
      ]),
      PayrollRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]),
    ]);

    const summary = {
      periodId,
      kpis: kpis[0] || {
        totalRecords: 0,
        totalSlots: 0,
        totalEffectiveHours: 0,
        totalStudents: 0,
        checkedCount: 0,
        uncheckedCount: 0,
        teacherCount: 0,
      },
      byRole,
      byCentre,
      byStatus,
    };
    res.json({ success: true, data: summary });
  } catch (err) {
    log.error("getSummary failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to load summary" });
  }
};

/* ---------------------------------------------------------------- *
 * Public — monthly rollup (1 row / teacher)
 * ---------------------------------------------------------------- */
exports.getMonthlyRollup = async (req, res) => {
  try {
    const { periodId } = req.query;
    if (!periodId) {
      return res
        .status(400)
        .json({ success: false, error: "periodId is required" });
    }
    const rows = await PayrollRecord.aggregate([
      { $match: { periodId: String(periodId) } },
      {
        $group: {
          _id: {
            username: "$username",
            teacherName: "$teacherName",
            workEmail: "$workEmail",
          },
          totalSessions: { $sum: 1 },
          checkedSessions: {
            $sum: { $cond: [{ $eq: ["$status", "CHECKED"] }, 1, 0] },
          },
          lecCount: {
            $sum: { $cond: [{ $eq: ["$classRole", "LEC"] }, 1, 0] },
          },
          taCount: {
            $sum: { $cond: [{ $eq: ["$classRole", "TA"] }, 1, 0] },
          },
          ohCount: {
            $sum: {
              $sum: { $cond: [{ $eq: ["$type", "OFFICE_HOURS"] }, 1, 0] },
            },
          },
          totalEffectiveHours: { $sum: "$effectiveDuration" },
          totalStudents: { $sum: "$studentCount" },
          centres: { $addToSet: "$centreShortname" },
        },
      },
      {
        $project: {
          _id: 0,
          username: "$_id.username",
          teacherName: "$_id.teacherName",
          workEmail: "$_id.workEmail",
          totalSessions: 1,
          checkedSessions: 1,
          lecCount: 1,
          taCount: 1,
          ohCount: 1,
          totalEffectiveHours: 1,
          totalStudents: 1,
          centres: {
            $filter: {
              input: "$centres",
              as: "c",
              cond: { $ne: ["$$c", ""] },
            },
          },
        },
      },
      { $sort: { teacherName: 1 } },
    ]);
    res.json({ success: true, data: rows });
  } catch (err) {
    log.error("getMonthlyRollup failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to load monthly rollup" });
  }
};

/* ---------------------------------------------------------------- *
 * Admin — list all periods (including archived)
 * ---------------------------------------------------------------- */
exports.adminListPeriods = async (_req, res) => {
  try {
    const periods = await PayrollPeriod.find({})
      .select("-__v")
      .sort({ uploadedAt: -1 })
      .lean();
    res.json({ success: true, data: periods });
  } catch (err) {
    log.error("adminListPeriods failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to list payroll periods" });
  }
};

/* ---------------------------------------------------------------- *
 * Admin — upload period (parses xlsx, batch-inserts records)
 * ---------------------------------------------------------------- */
exports.uploadPeriod = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded (expected multipart field 'file')",
      });
    }

    let parsed;
    try {
      parsed = parsePayrollWorkbook(
        req.file.buffer,
        req.file.originalname || ""
      );
    } catch (parseErr) {
      return res
        .status(400)
        .json({ success: false, error: parseErr.message });
    }

    // Allow TE to override month/year/label via form fields.
    const overrideMonth = Number(req.body?.month);
    const overrideYear = Number(req.body?.year);
    const overrideLabel = String(req.body?.label || "").trim();
    if (Number.isFinite(overrideMonth) && overrideMonth >= 1 && overrideMonth <= 12) {
      parsed.periodMeta.month = overrideMonth;
    }
    if (Number.isFinite(overrideYear) && overrideYear > 2000) {
      parsed.periodMeta.year = overrideYear;
    }
    if (overrideLabel) {
      parsed.periodMeta.label = overrideLabel;
    } else {
      // Re-derive label after override so it stays consistent.
      parsed.periodMeta.label = deriveLabel({
        month: parsed.periodMeta.month,
        year: parsed.periodMeta.year,
        fileName: parsed.periodMeta.originalFileName,
      });
    }

    const expiresAt = buildExpiresAt(new Date());

    // Insert in chunks to keep individual ops fast on large workbooks.
    const CHUNK = 500;
    const insertedIds = [];
    for (let i = 0; i < parsed.records.length; i += CHUNK) {
      const slice = parsed.records.slice(i, i + CHUNK);
      const result = await PayrollRecord.insertMany(slice, { ordered: false });
      result.forEach((doc) => insertedIds.push(doc._id));
    }

    const periodDoc = await PayrollPeriod.create({
      _id: parsed.periodMeta._id,
      label: parsed.periodMeta.label,
      month: parsed.periodMeta.month,
      year: parsed.periodMeta.year,
      originalFileName: parsed.periodMeta.originalFileName,
      uploadedById: req.trialReportUser?.userId || null,
      uploadedByName:
        req.trialReportUser?.fullName || "TE/Admin",
      uploadedAt: new Date(),
      recordCount: parsed.records.length,
      status: "active",
      expiresAt,
    });

    log.info(
      `[PayrollController] Uploaded period=${periodDoc._id} records=${parsed.records.length} warnings=${parsed.warnings.length}`
    );

    res.status(201).json({
      success: true,
      data: {
        periodId: periodDoc._id,
        label: periodDoc.label,
        month: periodDoc.month,
        year: periodDoc.year,
        recordCount: periodDoc.recordCount,
        warnings: parsed.warnings,
        expiresAt,
      },
    });
  } catch (err) {
    log.error("uploadPeriod failed:", err.message, err.stack);
    res
      .status(500)
      .json({ success: false, error: "Failed to upload payroll period" });
  }
};

/* ---------------------------------------------------------------- *
 * Admin — toggle archive status (soft delete / restore).
 *
 * Archives an active period, restores an archived one. Records stay
 * intact for audit. Requires TE.
 * ---------------------------------------------------------------- */
exports.archivePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await PayrollPeriod.findById(id).lean();
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Period not found" });
    }
    const nextStatus = existing.status === "archived" ? "active" : "archived";
    const period = await PayrollPeriod.findByIdAndUpdate(
      id,
      { status: nextStatus, updatedAt: new Date() },
      { new: true }
    ).lean();
    res.json({
      success: true,
      data: period,
      restored: nextStatus === "active",
    });
  } catch (err) {
    log.error("archivePeriod failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to toggle archive period" });
  }
};

/* ---------------------------------------------------------------- *
 * Admin — HARD-DELETE a period + every PayrollRecord it owns.
 *
 * Unlike archive (soft delete), this is irreversible. The period and
 * all rows are removed from MongoDB immediately. Use only when a
 * period was uploaded by mistake (wrong file, wrong month).
 *
 * Requires TE.
 * ---------------------------------------------------------------- */
exports.purgePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const period = await PayrollPeriod.findById(id).lean();
    if (!period) {
      return res
        .status(404)
        .json({ success: false, error: "Period not found" });
    }
    const recordsResult = await PayrollRecord.deleteMany({ periodId: id });
    await PayrollPeriod.deleteOne({ _id: id });
    log.warn(
      `Hard-deleted payroll period ${id} (${period.label}) ` +
        `along with ${recordsResult.deletedCount} record(s).`,
    );
    res.json({
      success: true,
      data: {
        id,
        label: period.label,
        recordsDeleted: recordsResult.deletedCount,
      },
    });
  } catch (err) {
    log.error("purgePeriod failed:", err.message, err.stack);
    res
      .status(500)
      .json({ success: false, error: "Failed to purge payroll period" });
  }
};

/* ---------------------------------------------------------------- *
 * Admin — preview first N rows of uploaded file before persisting.
 * Useful for the upload dialog's "preview before submit" UI.
 * ---------------------------------------------------------------- */
exports.previewPeriod = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded (expected multipart field 'file')",
      });
    }
    let parsed;
    try {
      parsed = parsePayrollWorkbook(
        req.file.buffer,
        req.file.originalname || ""
      );
    } catch (parseErr) {
      return res
        .status(400)
        .json({ success: false, error: parseErr.message });
    }
    const preview = parsed.records.slice(0, 20).map((r, idx) => ({
      idx,
      teacherName: r.teacherName,
      className: r.className,
      classRole: r.classRole,
      type: r.type,
      status: r.status,
      slotTime: r.slotTime,
      slotDuration: r.slotDuration,
      effectiveDuration: r.effectiveDuration,
      centreShortname: r.centreShortname,
    }));
    res.json({
      success: true,
      data: {
        periodMeta: parsed.periodMeta,
        preview,
        totalRecords: parsed.records.length,
        warnings: parsed.warnings,
      },
    });
  } catch (err) {
    log.error("previewPeriod failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to preview file" });
  }
};

/* ---------------------------------------------------------------- *
 * Payroll issue reports — submitted by GV TDM when a salary row
 * looks "Uncheck vô lý" (status=UNCHECKED but still counted in totals).
 * TE thekhiem later collates these and emails the Tech team.
 * ---------------------------------------------------------------- */

function parseEmailList(raw, { fallback } = {}) {
  if (!raw) return fallback ?? [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function summariseIssueEnv() {
  const to = (process.env.TECH_TEAM_EMAIL || "").trim();
  const cc = parseEmailList(process.env.TECH_TEAM_CC);
  const centreName = (process.env.TECH_TEAM_CENTRE_NAME || "Thủ Dầu Một").trim();
  return { to, cc, centreName };
}

/* POST /payroll/issues
 * Body: { payrollRecordId, reason }
 * Auth: sessionId + TDM centre membership (enforced by route middleware).
 */
exports.createPayrollIssue = async (req, res) => {
  try {
    // Endpoint is now public — `req.trialReportUser` may be undefined.
    // We still treat authenticated callers preferentially for dedup /
    // reporter metadata, but anonymous submissions are accepted (rate
    // limiter + IP-based dedup keep abuse in check).
    const user = req.trialReportUser || null;
    const { payrollRecordId, reason } = req.body || {};
    if (!payrollRecordId || typeof payrollRecordId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "payrollRecordId is required" });
    }
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      return res
        .status(400)
        .json({ success: false, error: "Lý do không được để trống" });
    }
    if (trimmedReason.length > 1000) {
      return res
        .status(400)
        .json({ success: false, error: "Lý do tối đa 1000 ký tự" });
    }

    const record = await PayrollRecord.findById(payrollRecordId).lean();
    if (!record) {
      return res
        .status(404)
        .json({ success: false, error: "PayrollRecord không tồn tại" });
    }
    if (record.centreShortname !== "230ĐLBD") {
      return res.status(403).json({
        success: false,
        error: "Chỉ được báo cáo công lương thuộc centre TDM (230ĐLBD).",
      });
    }

    // Resolve a stable "reporter id" so anonymous users still get
    // duplicate-pending-report protection. Prefer session identity,
    // else fall back to client IP (trust-proxy-aware via req.ip).
    const reporterId =
      (user && (user.userId || user.teacherId || user.fullName)) ||
      `anon:${req.ip || "unknown"}`;

    // Avoid spamming duplicate pending reports for the same record.
    const existing = await PayrollIssueReport.findOne({
      payrollRecordId,
      reporterUsername: reporterId,
      status: "pending",
    }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Bạn đã báo cáo dòng công lương này, đang chờ TE xem xét.",
        data: existing,
      });
    }

    const id = `pir_${randomUUID()}`;
    const doc = await PayrollIssueReport.create({
      _id: id,
      payrollRecordId,
      periodId: record.periodId,
      centreShortname: record.centreShortname,
      teacherName: record.teacherName || "",
      teacherUsername: record.username || "",
      teacherWorkEmail: record.workEmail || "",
      teacherClassName: record.className || "",
      teacherSlotTime: record.slotTime || null,
      teacherEffectiveDuration: record.effectiveDuration || 0,
      payrollRecordStatus: record.status || "UNCHECKED",
      reason: trimmedReason,
      reporterUserId: user?.userId || null,
      reporterUsername: reporterId,
      reporterFullName: user?.fullName || "",
      reporterEmail: "",
      status: "pending",
    });
    log.info(`PayrollIssueReport created: ${id} by ${doc.reporterUsername}`);
    res.json({ success: true, data: doc });
  } catch (err) {
    log.error("createPayrollIssue failed:", err.message, err.stack);
    res
      .status(500)
      .json({ success: false, error: "Failed to create payroll issue report" });
  }
};

/* GET /payroll/admin/payroll-issues
 * Query: periodId, status, centreShortname (default 230ĐLBD = TDM), page, pageSize
 */
exports.listPayrollIssues = async (req, res) => {
  try {
    const periodId = (req.query?.periodId || "").toString().trim();
    const status = (req.query?.status || "").toString().trim();
    const centreShortname =
      (req.query?.centreShortname || "230ĐLBD").toString().trim();
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(req.query?.pageSize, 10) || 50, 1),
      200,
    );

    const filter = { centreShortname };
    if (periodId) filter.periodId = periodId;
    if (status) filter.status = status;

    const total = await PayrollIssueReport.countDocuments(filter);
    const data = await PayrollIssueReport.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    res.json({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    log.error("listPayrollIssues failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to list payroll issues" });
  }
};

/* POST /payroll/admin/payroll-issues/notify
 * Body: {
 *   issueIds: [string],
 *   customIntro?: string,
 *   customConclusion?: string,
 *   mode?: 'smtp' | 'outlook'  — default 'smtp'
 * }
 *
 * Two sending modes:
 *   - 'smtp' (default): go through EmailService.sendPayrollIssueEmail (Gmail),
 *     update status='notified', and persist a real emailHistory entry.
 *   - 'outlook': do NOT actually send the email. Instead render the same
 *     template, build an Outlook Web Compose deeplink, return the URL to
 *     the FE which opens it via window.open — the user completes the send
 *     in their own Outlook (no Gmail App Password required). We still log
 *     a 'opened-outlook-compose' history entry to the issue for traceability,
 *     with success=null (the actual send happens outside our service).
 */
exports.notifyPayrollIssue = async (req, res) => {
  try {
    const { issueIds, customIntro, customConclusion, mode } = req.body || {};
    const user = req.trialReportUser;
    const sendMode =
      typeof mode === "string" && mode.toLowerCase() === "outlook"
        ? "outlook"
        : "smtp";

    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "issueIds is required" });
    }
    if (issueIds.length > 200) {
      return res
        .status(400)
        .json({ success: false, error: "Tối đa 200 issues mỗi lần gửi" });
    }

    const { to, cc, centreName } = summariseIssueEnv();
    if (!to) {
      return res.status(500).json({
        success: false,
        error: "TECH_TEAM_EMAIL chưa được cấu hình trên server.",
      });
    }

    const issues = await PayrollIssueReport.find({
      _id: { $in: issueIds },
    }).lean();
    if (issues.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Không tìm thấy issue nào" });
    }

    // Build line items, grouped by period for the subject.
    const periodIds = new Set(issues.map((i) => i.periodId));
    const periods = await PayrollPeriod.find({
      _id: { $in: Array.from(periodIds) },
    }).lean();
    const periodById = new Map(periods.map((p) => [p._id, p]));

    // Pick the most common period for the email subject.
    const periodTally = new Map();
    for (const i of issues) {
      periodTally.set(i.periodId, (periodTally.get(i.periodId) || 0) + 1);
    }
    const mainPeriodId = [...periodTally.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    const mainPeriod = periodById.get(mainPeriodId);
    const periodLabel = mainPeriod?.label || mainPeriodId;

    const lines = issues.map((i) => ({
      teacherName: i.teacherName,
      className: i.teacherClassName,
      slotTime: i.teacherSlotTime,
      reason: i.reason,
    }));

    // We render the template once and reuse it for both modes so the
    // Outlook composer shows the exact same content.
    const rendered = renderPayrollIssueEmail({
      periodLabel,
      centreName,
      lines,
      customIntro,
      customConclusion,
    });

    let outlookComposeUrl = null;
    let sendResult = { ok: false, messageId: "", error: "" };

    if (sendMode === "outlook") {
      outlookComposeUrl = buildOutlookUrlForEmail(rendered, { to, cc });
    } else {
      sendResult = await emailService.sendPayrollIssueEmail({
        to,
        cc,
        periodLabel,
        centreName,
        lines,
        customIntro,
        customConclusion,
      });
    }

    const sentAt = new Date();
    const logEntry =
      sendMode === "outlook"
        ? {
            sentAt,
            sentByUserId: user?.userId || null,
            sentByName: user?.fullName || "",
            to: [to],
            cc,
            subject: rendered.subject,
            messageId: "",
            success: null, // tri-state — user soạn gửi thủ công trong Outlook
            error: "outlook-compose-deeplink",
          }
        : {
            sentAt,
            sentByUserId: user?.userId || null,
            sentByName: user?.fullName || "",
            to: [to],
            cc,
            subject: sendResult.ok ? rendered.subject : "",
            messageId: sendResult.messageId || "",
            success: !!sendResult.ok,
            error: sendResult.error || "",
          };

    let updated = 0;
    for (const issue of issues) {
      const nextStatus =
        sendMode === "outlook"
          ? "notified" // we treat "user opened the composer" as notified — gives TE signal
          : sendResult.ok
            ? "notified"
            : issue.status;
      await PayrollIssueReport.updateOne(
        { _id: issue._id },
        {
          $push: { emailHistory: logEntry },
          $set: { status: nextStatus },
        },
      );
      updated++;
    }
    log.info(
      `notifyPayrollIssue: TE ${user?.fullName || ""} gửi ${updated} ` +
        `issues tới ${to} (cc=${cc.join(",")}) - mode=${sendMode} ` +
        `smtpSuccess=${sendMode === "smtp" ? !!sendResult.ok : "n/a"}`,
    );

    res.json({
      success: true,
      data: {
        sent: updated,
        mode: sendMode,
        to,
        cc,
        outlookComposeUrl,
        messageId: sendResult.messageId || "",
        error: sendResult.error || "",
      },
    });
  } catch (err) {
    // Surface the underlying message so the caller can tell SMTP failure
    // from a render failure without having to grep the server log.
    log.error("notifyPayrollIssue failed:", err.message, err.stack);
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      success: false,
      error: "Failed to send email",
      detail: isDev ? err.message : undefined,
    });
  }
};

/* PATCH /payroll/admin/payroll-issues/:id/resolve
 * Body: { action: "resolved" | "dismissed", note?: string }
 */
exports.resolvePayrollIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body || {};
    const user = req.trialReportUser;
    if (!["resolved", "dismissed"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "action phải là 'resolved' hoặc 'dismissed'",
      });
    }
    const updated = await PayrollIssueReport.findByIdAndUpdate(
      id,
      {
        $set: {
          status: action,
          reviewedByUserId: user?.userId || null,
          reviewedByName: user?.fullName || "",
          reviewedAt: new Date(),
          resolutionNote: (note || "").toString().slice(0, 1000),
        },
      },
      { new: true },
    ).lean();
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, error: "Issue không tồn tại" });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    log.error("resolvePayrollIssue failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to resolve payroll issue" });
  }
};

/* GET /payroll/admin/payroll-issues/:id/history */
exports.getPayrollIssueHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await PayrollIssueReport.findById(id)
      .select("emailHistory status")
      .lean();
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, error: "Issue không tồn tại" });
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    log.error("getPayrollIssueHistory failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to load history" });
  }
};