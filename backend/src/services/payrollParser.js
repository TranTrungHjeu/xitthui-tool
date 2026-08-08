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

// Friendly default per canonical field when the upload is missing a column.
// Keeping these empty strings (not null/undefined) keeps sanitizeRow() happy
// and lets downstream code render an empty cell instead of throwing.
const FIELD_DEFAULTS = {
  centreShortname: "",
  classSiteCentre: "",
  type: "",
  className: "",
  classSite: "",
  course: "",
  courseLine: "",
  teacherName: "",
  workEmail: "",
  personalEmail: "",
  username: "",
  classRole: "",
  status: "UNCHECKED",
  slotTime: null,
  slotDuration: 0,
  effectiveDuration: 0,
  studentCount: 0,
  requestedBy: "",
  note: "",
  managerNote: "",
  confirmStatus: "",
  confirmNote: "",
};

// Aliases users actually paste in their spreadsheets, mapped to the
// canonical HEADER_TO_FIELD keys below. Matching is case-insensitive
// and whitespace/diacritic-insensitive (see normalizeHeaderKey()).
const HEADER_ALIASES = {
  centreShortname: [
    "centre shortname",
    "centre",
    "center shortname",
    "center",
    "shortname",
    "ma trung tam",
    "ma trung tam ngan",
    "ma tt",
    "ma trung tam day",
    "ma centre",
  ],
  classSiteCentre: [
    "class site centre",
    "site centre",
    "site center",
    "class site center",
    "class site",
    "class site name",
  ],
  type: ["type", "loai", "loai cong", "kieu"],
  className: [
    "class name",
    "class",
    "lop",
    "ten lop",
    "ten class",
    "class id",
    "class code",
  ],
  classSite: ["class site", "site", "co so"],
  course: ["course", "khoa hoc", "ten khoa hoc"],
  courseLine: ["course line", "line", "chuong trinh", "line khoa hoc"],
  teacherName: [
    "teacher name",
    "teacher",
    "gv",
    "giao vien",
    "ten giao vien",
    "ho ten",
    "full name",
    "name",
  ],
  workEmail: [
    "work email",
    "email",
    "email cong ty",
    "email lam viec",
    "work mail",
  ],
  personalEmail: [
    "personal email",
    "email ca nhan",
    "private email",
    "email rieng",
  ],
  username: ["username", "user", "ten dang nhap", "account"],
  classRole: [
    "class role/office hour type",
    "class role",
    "class role / office hour type",
    "office hour type",
    "oh type",
    "role",
    "vai tro",
    "loai office hour",
  ],
  status: ["status", "trang thai", "tinh trang", "trangthai", "trang thai check"],
  slotTime: [
    "slot time",
    "slot datetime",
    "time",
    "thoi gian",
    "gio",
    "ngay gio",
    "ngay",
    "datetime",
    "date time",
    "date",
  ],
  slotDuration: [
    "slot duration",
    "duration",
    "so slot",
    "slot",
    "slots",
    "thoi luong slot",
  ],
  effectiveDuration: [
    "effective duration",
    "effective hours",
    "effective hour",
    "hours",
    "gio hieu luc",
    "hieu luc",
    "thoi luong hieu luc",
    "real duration",
    "actual duration",
    "hieu luc gio",
    "hieu luc tiet",
    "so gio",
    "so gio day",
    "so gio hieu luc",
  ],
  studentCount: [
    "student count",
    "students",
    "so hoc sinh",
    "hoc sinh",
    "sl hoc sinh",
    "count",
    "si so",
    "so luong hoc sinh",
    "slhs",
    "hs",
  ],
  requestedBy: [
    "requested by",
    "requester",
    "nguoi yeu cau",
    "yeu cau boi",
  ],
  note: ["note", "ghi chu", "ghi chú"],
  managerNote: ["manager note", "ghi chu quan ly", "manager comment"],
  confirmStatus: [
    "confirm status (oh only)",
    "confirm status",
    "oh confirm status",
    "trang thai xac nhan",
  ],
  confirmNote: [
    "confirm note (oh only)",
    "confirm note",
    "oh confirm note",
    "ghi chu xac nhan",
  ],
};

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
 * Sanitize a single parsed row (already projected to canonical field
 * names) into a PayrollRecord document. Returns the sanitized record
 * or null when the row is structurally invalid (no className, etc.).
 */
function sanitizeRow(rawRow, periodId, rowIndex) {
  const className = truncate(rawRow.className, MAX_STRING_LEN);
  const teacherName = truncate(rawRow.teacherName, MAX_STRING_LEN);
  // Skip rows that are essentially empty (typical Google Sheet trailing
  // rows are completely blank).
  if (!className && !teacherName) return null;

  const type = coerceType(rawRow.type);
  const status = coerceStatus(rawRow.status);

  return {
    _id: `${periodId}:${rowIndex}`,
    periodId,
    centreShortname: truncate(rawRow.centreShortname, 100),
    classSiteCentre: truncate(rawRow.classSiteCentre, 200),
    type,
    className,
    classSite: truncate(rawRow.classSite, 100),
    course: truncate(rawRow.course, 100),
    courseLine: truncate(rawRow.courseLine, 100),
    teacherName,
    workEmail: truncate(rawRow.workEmail, 200),
    personalEmail: truncate(rawRow.personalEmail, 200),
    username: truncate(rawRow.username, 100),
    classRole: truncate(rawRow.classRole, 30).toUpperCase(),
    status,
    slotTime: coerceDate(rawRow.slotTime),
    slotDuration: coerceNumber(rawRow.slotDuration),
    effectiveDuration: coerceNumber(rawRow.effectiveDuration),
    studentCount: coerceNumber(rawRow.studentCount),
    requestedBy: truncate(rawRow.requestedBy, 100),
    note: truncate(rawRow.note, MAX_NOTE_LEN),
    managerNote: truncate(rawRow.managerNote, MAX_NOTE_LEN),
    confirmStatus: truncate(rawRow.confirmStatus, 100),
    confirmNote: truncate(rawRow.confirmNote, MAX_NOTE_LEN),
  };
}

function validateHeaders(headers) {
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  return missing;
}

/**
 * Normalize a header string so we can match aliases regardless of
 * case, accents, whitespace, or punctuation differences.
 *
 *   "  Effective Duration " -> "effectiveduration"
 *   "Giờ hiệu lực"          -> "giohieuluc"
 *   "Slot time (VN)"         -> "slottimevn"
 */
function normalizeHeaderKey(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // strip spaces, punctuation, slashes
}

/**
 * Build a map of normalized-alias → canonical field name. Computed
 * once at module load (HEADER_ALIASES is static).
 */
const NORMALIZED_ALIAS_TO_FIELD = (() => {
  const map = new Map();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      map.set(normalizeHeaderKey(alias), field);
    }
  }
  // Also support the canonical header text itself.
  for (const header of REQUIRED_HEADERS) {
    const field = HEADER_TO_FIELD[header];
    if (field && !map.has(normalizeHeaderKey(header))) {
      map.set(normalizeHeaderKey(header), field);
    }
  }
  return map;
})();

/**
 * Given the raw header row from the upload, return:
 *   {
 *     fieldOrder: ["centreShortname", "classSiteCentre", ...],
 *     unmapped: ["Foo Bar"],          // headers we couldn't recognize
 *     warnings: ["Mapped 'Foo Bar' → ... (best guess)", ...]
 *   }
 *
 * The order is preserved (used to read cells back from each row) and
 * unmapped headers are kept in fieldOrder under "__unmapped__" so the
 * sanitizer can ignore them safely.
 */
function resolveHeaders(rawHeaders) {
  const fieldOrder = [];
  const unmapped = [];
  const warnings = [];

  // First, reserve slots in the same order as REQUIRED_HEADERS so
  // downstream code can rely on a stable shape.
  for (const header of REQUIRED_HEADERS) {
    fieldOrder.push(HEADER_TO_FIELD[header]);
  }

  for (const rawHeader of rawHeaders) {
    const key = normalizeHeaderKey(rawHeader);
    if (!key) continue; // blank cell
    const field = NORMALIZED_ALIAS_TO_FIELD.get(key);
    if (field) {
      // Already in fieldOrder; nothing to do.
      if (!fieldOrder.includes(field)) fieldOrder.push(field);
    } else {
      unmapped.push(rawHeader);
      warnings.push(`Unknown column "${rawHeader}" — ignored.`);
    }
  }

  return { fieldOrder, unmapped, warnings };
}

/**
 * Project a 2D row (array of cell strings) to an object keyed by
 * canonical field name, using fieldOrder from resolveHeaders().
 * Missing fields fall back to FIELD_DEFAULTS so downstream code can
 * trust the shape.
 */
function projectRow(rowCells, fieldOrder, unmappedOriginalHeaders, rawHeaders) {
  const out = {};
  // Map raw header → its index, so unmapped columns don't push fields
  // around. We assume rawHeaders.length === rowCells.length.
  const rawFieldByIndex = new Array(rawHeaders.length).fill(null);
  for (let i = 0; i < rawHeaders.length; i++) {
    const key = normalizeHeaderKey(rawHeaders[i]);
    const field = NORMALIZED_ALIAS_TO_FIELD.get(key);
    if (field) rawFieldByIndex[i] = field;
  }

  // Apply each raw cell to its resolved field.
  for (let i = 0; i < rawHeaders.length; i++) {
    const field = rawFieldByIndex[i];
    if (!field) continue;
    out[field] = rowCells[i];
  }

  // Fill defaults for anything the upload didn't provide.
  for (const [field, def] of Object.entries(FIELD_DEFAULTS)) {
    if (!(field in out)) out[field] = def;
  }

  return out;
}

/**
 * Detect which row in the upload is the real header row. Many users
 * paste a title row above the column headers (e.g. "Công GV T8/2026").
 * We look at the first ~5 rows and pick the one with the highest
 * count of headers that match a known alias.
 */
function detectHeaderRowIndex(rows) {
  const maxScan = Math.min(rows.length, 6);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i] || [];
    let score = 0;
    for (const cell of row) {
      const key = normalizeHeaderKey(cell);
      if (key && NORMALIZED_ALIAS_TO_FIELD.has(key)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // Fallback: if nothing matched anywhere, assume row 0.
  return bestScore > 0 ? bestIndex : 0;
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

  const headerRowIndex = detectHeaderRowIndex(rows);
  const headers = (rows[headerRowIndex] || []).map((h) => String(h || "").trim());

  // Auto-detect + alias-map headers instead of failing.
  const { warnings: headerWarnings } = resolveHeaders(headers);
  if (headerWarnings.length) {
    headerWarnings.forEach((w) => log?.warn?.(w));
  }

  const inferred = inferPeriodFromFilename(fileName) || {};
  const month = inferred.month || new Date().getMonth() + 1;
  const year = inferred.year || new Date().getFullYear();
  const periodId = buildPeriodId({ month, year, fileName });
  const label = deriveLabel({ month, year, fileName });

  const records = [];
  const warnings = [];
  let recordIndex = 0;
  // Skip rows at and before the detected header row.
  for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
    const rowArr = rows[r];
    if (!rowArr || rowArr.every((c) => c === "" || c == null)) continue;
    const projected = projectRow(rowArr, null, null, headers);
    try {
      const sanitized = sanitizeRow(projected, periodId, recordIndex);
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
    `[PayrollParser] Parsed file=${fileName} periodId=${periodId} records=${records.length} warnings=${warnings.length} unmappedHeaders=${headerWarnings.length}`
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
    warnings: [...warnings, ...headerWarnings.map((w) => ({ row: 0, reason: w }))],
  };
}

module.exports = {
  parsePayrollWorkbook,
  inferPeriodFromFilename,
  deriveLabel,
  buildPeriodId,
  validateHeaders,
  resolveHeaders,
  detectHeaderRowIndex,
  normalizeHeaderKey,
  REQUIRED_HEADERS,
  HEADER_TO_FIELD,
  HEADER_ALIASES,
};