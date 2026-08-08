// Quick sanity check for the fuzzy-header payroll parser.
// Generates a fake Excel with Vietnamese column headers and asserts
// that parsePayrollWorkbook() still returns valid records.
//
// Run from backend/: node ../scripts/test-payroll-parser.js

const path = require("path");
const XLSX = require("xlsx");
const {
  parsePayrollWorkbook,
  normalizeHeaderKey,
  resolveHeaders,
  detectHeaderRowIndex,
} = require(path.join(__dirname, "..", "backend", "src", "services", "payrollParser"));

let failed = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failed += 1;
  }
}

// 1) normalizeHeaderKey
console.log("normalizeHeaderKey");
assert(normalizeHeaderKey("Effective Duration") === "effectiveduration", "strip spaces + lower");
assert(normalizeHeaderKey("  Giờ hiệu lực  ") === "giohieuluc", "strip diacritics");
assert(normalizeHeaderKey("Class Role/Office Hour Type") === "classroleofficehourtype", "strip slash");
assert(normalizeHeaderKey("") === "", "empty → empty");
assert(normalizeHeaderKey(null) === "", "null → empty");

// 2) resolveHeaders with VN aliases
console.log("resolveHeaders");
const vnHeaders = [
  "Mã trung tâm",          // → centreShortname
  "Lớp",                   // → className
  "Tên giáo viên",         // → teacherName
  "Email",                 // → workEmail
  "Giờ",                   // → slotTime
  "Giờ hiệu lực",          // → effectiveDuration
  "Số học sinh",           // → studentCount
  "Trạng thái",            // → status
  "Ghi chú",               // → note
  "Some Unknown Column",   // → unmapped
];
const { unmapped } = resolveHeaders(vnHeaders);
assert(unmapped.length === 1, "1 unmapped column");
assert(unmapped[0] === "Some Unknown Column", "unmapped keeps original text");

// 3) End-to-end parse with VN headers + missing canonical columns
console.log("parsePayrollWorkbook (VN headers, partial)");

const data = [
  ["Công GV T8/2026"],                       // title row (should be skipped)
  ["Mã TT", "Lớp", "GV", "Email", "Giờ", "Hiệu lực (giờ)", "Sĩ số", "TT"],
  [
    "HAN01",
    "L1.S2.SCR.AI-1",
    "Nguyen Van A",
    "[email protected]",
    "2026-08-05T18:00:00Z",
    3,
    8,
    "CHECKED",
  ],
  [
    "HAN01",
    "L1.S2.SCR.AI-2",
    "Tran Thi B",
    "[email protected]",
    "2026-08-06T18:00:00Z",
    2.5,
    6,
    "UNCHECKED",
  ],
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Payroll");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

const result = parsePayrollWorkbook(buf, "cong_T8_2026.xlsx");
assert(result.records.length === 2, `parsed 2 records (got ${result.records.length})`);
assert(result.periodMeta.month === 8, "month=8 from filename");
assert(result.periodMeta.year === 2026, "year=2026 from filename");
assert(result.records[0].className === "L1.S2.SCR.AI-1", "className mapped");
assert(result.records[0].teacherName === "Nguyen Van A", "teacherName mapped");
assert(result.records[0].workEmail === "[email protected]", "workEmail mapped");
assert(result.records[0].effectiveDuration === 3, "effectiveDuration mapped");
assert(result.records[0].studentCount === 8, "studentCount mapped");
assert(result.records[0].status === "CHECKED", "status mapped");
assert(result.records[0].centreShortname === "HAN01", "centreShortname mapped");
assert(result.records[0].slotTime instanceof Date, "slotTime parsed as Date");
assert(result.records[1].effectiveDuration === 2.5, "decimal hours parsed");

// 4) detectHeaderRowIndex
console.log("detectHeaderRowIndex");
const idx = detectHeaderRowIndex([
  ["Công GV T8/2026"],
  ["Class name", "Teacher name"],
  ["foo", "bar"],
]);
assert(idx === 1, `header detected at row 1 (got ${idx})`);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nAll assertions passed.");