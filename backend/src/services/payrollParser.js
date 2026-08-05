/**
 * Payroll Workbook Parser
 *
 * Parses an uploaded Excel file (the "CÔNG GV" monthly timesheet) into
 * a normalized shape suitable for inserting into the PayrollRecord
 * collection. The parser is intentionally lenient — it surfaces
 * warnings for malformed rows but never throws unless the workbook is
 * structurally invalid (missing headers, no rows, etc.).
 *
 * Expected layout (1 sheet per file):
 *   Row 1       : header row with 22 columns (see REQUIRED_HEADERS).
 *   Rows 2..N   : data rows (one row per class session / office-hour slot).
 *
 * The parser also extracts a `periodMeta` derived from the original
 * filename (e.g. `CÔNG GV T7_2026.xlsx` → month=7, year=2026,
 * label="Công GV T7/2026"). TE can override month/year via the upload
 * dialog later; the parser only infers defaults.
 */

const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");

const { childLogger } = require("../utils/logger");
const log = childLogger("PayrollParser");

// The 22 columns the dashboard expects. Order matches the source
// spreadsheet so we can map by index even if the header row is shifted.
const REQUIRED_HEADERS = [
  "Centre shortname",
  "Class Site Centre",
  "Type",
  "Class name",
  "Class Site",
  "Course",
  "Course Line",
  "Teacher name",
  "Work email",
  "Personal email",
  "Username",
  "Class role/Office hour type",
  "Status",
  "Slot time",
  "Slot duration",
  "Effective duration",
  "Student count",
  "Requested by",
  "Note",
  "Manager Note",
  "Confirm Status (OH only)",
  "Confirm Note (OH only)",
];

// Build a lookup so we can resolve "Centre shortname" → "centreShortname".
const HEADER_TO_FIELD = {
  "Centre shortname": "centreShortname",
  "Class Site Centre": "classSiteCentre",
  "Type": "type",
  "Class name": "className",
  "Class Site": "classSite",
  "Course": "course",
  "Course Line": "courseLine",
  "Teacher name": "teacherName",
  "Work email": "workEmail",
  "Personal email": "personalEmail",
  "Username": "username",
  "Class role/Office hour type": "classRole",
  "Status": "status",
  "Slot time": "slotTime",
  "Slot duration": "slotDuration",
  "Effective duration": "effectiveDuration",
  "Student count": "studentCount",
  "Requested by": "requestedBy",
  "Note": "note",
  "Manager Note": "managerNote",
  "Confirm Status (OH only)": "confirmStatus",
  "Confirm Note (OH only)": "confirmNote",
};

const MAX_STRING_LEN = 500;
const MAX_NOTE_LEN = 5000;

function truncate(value, max) {
  if (value == null) return "";
  const str = String(value).trim();
  return str.length > max ? str.slice(0, max) : str;
}

function coerceNumber(value) {
  if (value == null || value === "") return 0;
  // Some cells contain a date string in the "Slot duration" column due
  // to data-entry bugs (we saw "2026-05-01" leak in). Detect ISO dates
  // and treat them as 0 rather than NaN.
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return 0;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function coerceDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    // Excel serial date number — xlsx reads these as numbers when
    // cellDates:false. Convert to JS Date.
    // 25569 = days between 1900-01-01 and 1970-01-01.
    const ms = (value - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // Try ISO first
  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) return iso;
  // Try d/m/yyyy (Vietnam format)
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      0, 0, 0, 0
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function coerceStatus(value) {
  const upper = String(value || "").trim().toUpperCase();
  if (upper === "CHECKED") return "CHECKED";
  if (upper === "UNCHECKED") return "UNCHECKED";
  return "UNCHECKED";
}

function coerceType(value) {
  const upper = String(value || "").trim().toUpperCase();
  if (upper === "OFFICE_HOURS" || upper === "OH") return "OFFICE_HOURS";
  return "CLASS";
}

/**
 * Extract month/year hints from a filename like:
 *   "CÔNG GV T7_2026.xlsx"            → month=7, year=2026
 *   "Công GV Tháng 8-2026.xlsx"       → month=8, year=2026
 *   "payroll_aug_2025.xlsx"           → month=8, year=2025
 *
 * Returns null when nothing matches so the controller can fall back
 * to explicit metadata from the request body.
 */
function inferPeriodFromFilename(fileName) {
  if (!fileName) return null;
  const base = String(fileName).replace(/\.[^.]+$/, "");

  // T<number>_<year>  (most common from the actual file)
  let m = base.match(/T(\d{1,2})[_\-\s]+(\d{4})/i);
  if (m) return { month: Number(m[1]), year: Number(m[2]) };

  // Tháng <number>-<year> or Tháng <number>/<year>
  m = base.match(/th[aá]ng\s*(\d{1,2})\s*[-\/]\s*(\d{4})/i);
  if (m) return { month: Number(m[1]), year: Number(m[2]) };

  // _<month>_<year>  (payroll_aug_2025)
  m = base.match(/[_\-\s](\d{1,2})[_\-\s]+(\d{4})(?!\d)/);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (month >= 1 && month <= 12) return { month, year };
  }

  // Last resort: any 4-digit year in the filename + month from T<digits>
  const yearMatch = base.match(/(\d{4})/);
  const monthMatch = base.match(/T(\d{1,2})/i) || base.match(/th[aá]ng\s*(\d{1,2})/i);
  if (yearMatch && monthMatch) {
    return { month: Number(monthMatch[1]), year: Number(yearMatch[1]) };
  }

  return null;
}

function deriveLabel({ month, year, fileName }) {
  const safeMonth = Math.min(12, Math.max(1, Number(month) || 0));
  if (!safeMonth) {
    return `Công GV (${truncate(fileName || "Unknown", 40)})`;
  }
  return `Công GV T${safeMonth}/${year}`;
}

function buildPeriodId({ month, year, fileName }) {
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14); // YYYYMMDDHHMMSS
  const slugSource = `${month}-${year}-${fileName || "upload"}`;
  const slug = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "upload";
  return `pay_${slug}_${stamp}_${uuidv4().slice(0, 8)}`;
}

/**
 * Sanitize a single row of the parsed workbook (object keyed by header
 * text) into a PayrollRecord document. Returns the sanitized record
 * or null when the row is structurally invalid (no className, etc.).
 */
function sanitizeRow(rawRow, periodId, rowIndex) {
  const get = (header) => {
    const field = HEADER_TO_FIELD[header];
    if (!field) return undefined;
    return rawRow[header];
  };

  const className = truncate(get("Class name"), MAX_STRING_LEN);
  const teacherName = truncate(get("Teacher name"), MAX_STRING_LEN);
  // Skip rows that are essentially empty (typical Google Sheet trailing
  // rows are completely blank).
  if (!className && !teacherName) return null;

  const type = coerceType(get("Type"));
  const status = coerceStatus(get("Status"));

  return {
    _id: `${periodId}:${rowIndex}`,
    periodId,
    centreShortname: truncate(get("Centre shortname"), 100),
    classSiteCentre: truncate(get("Class Site Centre"), 200),
    type,
    className,
    classSite: truncate(get("Class Site"), 100),
    course: truncate(get("Course"), 100),
    courseLine: truncate(get("Course Line"), 100),
    teacherName,
    workEmail: truncate(get("Work email"), 200),
    personalEmail: truncate(get("Personal email"), 200),
    username: truncate(get("Username"), 100),
    classRole: truncate(get("Class role/Office hour type"), 30).toUpperCase(),
    status,
    slotTime: coerceDate(get("Slot time")),
    slotDuration: coerceNumber(get("Slot duration")),
    effectiveDuration: coerceNumber(get("Effective duration")),
    studentCount: coerceNumber(get("Student count")),
    requestedBy: truncate(get("Requested by"), 100),
    note: truncate(get("Note"), MAX_NOTE_LEN),
    managerNote: truncate(get("Manager Note"), MAX_NOTE_LEN),
    confirmStatus: truncate(get("Confirm Status (OH only)"), 100),
    confirmNote: truncate(get("Confirm Note (OH only)"), MAX_NOTE_LEN),
  };
}

function validateHeaders(headers) {
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  return missing;
}

/**
 * Main entry point. Accepts a workbook Buffer (from multer) and the
 * original filename, returns:
 *   {
 *     periodMeta: { _id, label, month, year, originalFileName },
 *     records: [PayrollRecord, ...],
 *     warnings: [{row, reason}, ...]
 *   }
 *
 * Throws Error when the workbook is structurally invalid (no headers,
 * no data rows, etc.) — those are user-facing errors worth surfacing.
 */
function parsePayrollWorkbook(buffer, fileName) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Empty or invalid file buffer");
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true, cellNF: false, cellText: false });
  } catch (err) {
    throw new Error(`Cannot read workbook: ${err.message}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  // Read as 2D array so we can inspect the header row before
  // projecting to objects.
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (!rows.length) {
    throw new Error("Workbook is empty");
  }

  const headers = rows[0].map((h) => String(h || "").trim());
  const missing = validateHeaders(headers);
  if (missing.length > 0) {
    throw new Error(
      `Workbook is missing required columns: ${missing.join(", ")}`
    );
  }

  const inferred = inferPeriodFromFilename(fileName) || {};
  const month = inferred.month || new Date().getMonth() + 1;
  const year = inferred.year || new Date().getFullYear();
  const periodId = buildPeriodId({ month, year, fileName });
  const label = deriveLabel({ month, year, fileName });

  const records = [];
  const warnings = [];
  let recordIndex = 0;
  for (let r = 1; r < rows.length; r += 1) {
    const rowArr = rows[r];
    if (!rowArr || rowArr.every((c) => c === "" || c == null)) continue;
    const rawRow = {};
    headers.forEach((h, i) => {
      rawRow[h] = rowArr[i];
    });
    try {
      const sanitized = sanitizeRow(rawRow, periodId, recordIndex);
      if (sanitized) {
        records.push(sanitized);
        recordIndex += 1;
      }
    } catch (err) {
      warnings.push({ row: r + 1, reason: err.message });
    }
  }

  if (records.length === 0) {
    throw new Error("Workbook contains no valid data rows");
  }

  log.info(
    `[PayrollParser] Parsed file=${fileName} periodId=${periodId} records=${records.length} warnings=${warnings.length}`
  );

  return {
    periodMeta: {
      _id: periodId,
      label,
      month,
      year,
      originalFileName: fileName || "",
    },
    records,
    warnings,
  };
}

module.exports = {
  parsePayrollWorkbook,
  inferPeriodFromFilename,
  deriveLabel,
  buildPeriodId,
  validateHeaders,
  REQUIRED_HEADERS,
  HEADER_TO_FIELD,
};