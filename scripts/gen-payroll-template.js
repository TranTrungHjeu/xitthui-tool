// Generate payroll template (.xlsx) matching REQUIRED_HEADERS in
// backend/src/services/payrollParser.js
//
// Usage:
//   cd backend && node ../scripts/gen-payroll-template.js [outputPath]
//   default outputPath: ../payroll-template.xlsx (relative to backend/)

const path = require("path");
const XLSX = require("xlsx");

const HEADERS = [
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

// One example row showing the expected format.
const SAMPLE_ROW = [
  "HAN01",
  "HAN Centre",
  "CLASS_SLOT",
  "L1.S2.SCR.AI-1",
  "HAN",
  "AI Essentials",
  "Foundation",
  "Nguyen Van A",
  "[email protected]",
  "[email protected]",
  "nguyen.a",
  "Lead Teacher",
  "CHECKED",
  "2026-08-05T18:00:00Z",
  2,
  3,
  8,
  "Curriculum Team",
  "Normal class",
  "",
  "",
  "",
];

function main() {
  const outArg = process.argv[2];
  const outPath = path.resolve(
    outArg || path.join(__dirname, "..", "payroll-template.xlsx")
  );

  // Build AOA (array of arrays), header + 1 sample row
  const aoa = [HEADERS, SAMPLE_ROW];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set reasonable column widths
  ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));

  // Freeze first row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll");

  XLSX.writeFile(wb, outPath);

  console.log(`Template written to: ${outPath}`);
  console.log(`Columns: ${HEADERS.length}`);
  console.log(`Headers (in order):`);
  HEADERS.forEach((h, i) => console.log(`  ${String(i + 1).padStart(2)}. ${h}`));
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}