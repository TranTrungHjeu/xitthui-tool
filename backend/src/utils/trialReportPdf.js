/**
 * Trial Report PDF Generator (stub)
 *
 * The full implementation uses `pdfkit` to render a real PDF. Until
 * pdfkit/pdf-lib is added to package.json (see TODO), we emit a minimal
 * but valid PDF (1.4) with a single page that lists the report title
 * and the form fields. This is enough to keep the upload pipeline
 * working while a designer templates the four subjects.
 *
 * The file is intentionally hand-crafted to avoid new dependencies.
 * The output is a real PDF (not a TXT renamed to .pdf), so R2's
 * preview and webViewLink work.
 */

const REPORT_TEMPLATES = {
  "Kiro4+": {
    title: "Kiro 4+",
    fields: [
      "lessonTitle",
      "objectives",
      "activities",
      "studentFeedback",
    ],
  },
  Robotics: {
    title: "Robotics",
    fields: [
      "projectName",
      "partsUsed",
      "programmingConcepts",
      "observations",
    ],
  },
  Coding: {
    title: "Coding",
    fields: [
      "projectTitle",
      "language",
      "keyConcepts",
      "challenges",
    ],
  },
  Art: {
    title: "Art",
    fields: [
      "projectTitle",
      "medium",
      "techniques",
      "observations",
    ],
  },
};

function humanizeField(field) {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
}

function escapePdfText(text) {
  return String(text == null ? "" : text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "");
}

function wrapLines(text, maxLen = 90) {
  const out = [];
  const raw = String(text == null ? "" : text).split("\n");
  raw.forEach((line) => {
    if (line.length <= maxLen) {
      out.push(line);
      return;
    }
    let remaining = line;
    while (remaining.length > maxLen) {
      out.push(remaining.slice(0, maxLen));
      remaining = remaining.slice(maxLen);
    }
    out.push(remaining);
  });
  return out.length ? out : [""];
}

/**
 * Generate a placeholder PDF Buffer for the given report type + form data.
 *
 * The PDF is intentionally tiny: 1 page, fixed font, no images. It is
 * meant to be a stopgap until pdfkit is added.
 *
 * @param {string} reportType "Kiro4+" | "Robotics" | "Coding" | "Art"
 * @param {Object} payload     form fields for the report
 * @param {Object} meta        { classDate, teacherName, studentName }
 * @returns {Buffer}
 */
function generateReportPDF(reportType, payload, meta) {
  const template = REPORT_TEMPLATES[reportType] || {
    title: reportType || "Trial Report",
    fields: Object.keys(payload || {}),
  };

  const safeMeta = meta || {};
  const lines = [];
  lines.push(`MINDX TRIAL REPORT - ${template.title}`);
  lines.push("");

  if (safeMeta.classDate) {
    lines.push(`Ngay: ${formatDate(safeMeta.classDate)}`);
  }
  if (safeMeta.teacherName) {
    lines.push(`Giao vien: ${safeMeta.teacherName}`);
  }
  if (safeMeta.studentName) {
    lines.push(`Hoc vien: ${safeMeta.studentName}`);
  }
  lines.push("");

  template.fields.forEach((field) => {
    lines.push(`${humanizeField(field)}:`);
    const val = payload && payload[field] != null ? String(payload[field]) : "";
    wrapLines(val, 90).forEach((l) => lines.push(`  ${l}`));
    lines.push("");
  });

  return renderSimplePdf(lines);
}

function formatDate(value) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch {
    return String(value);
  }
}

/**
 * Render a minimal valid PDF (1.4) with a single page containing the
 * given lines. Each line is rendered with the built-in Helvetica font.
 */
function renderSimplePdf(lines) {
  const pageWidth = 612; // 8.5 in * 72 dpi
  const pageHeight = 792; // 11 in * 72 dpi
  const marginX = 54;
  const lineHeight = 14;
  const fontSize = 11;
  const topY = pageHeight - 72;

  const contentLines = lines.flatMap((line, idx) => {
    const y = topY - idx * lineHeight;
    if (y < 72) return [];
    return [
      `BT`,
      `/F1 ${fontSize} Tf`,
      `${marginX} ${y} Td`,
      `(${escapePdfText(line)}) Tj`,
      `ET`,
    ];
  });

  const stream = contentLines.join("\n");

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  ];

  let body = "%PDF-1.4\n%__PDF_MINX__\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "binary"));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "binary");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  });

  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "binary");
}

module.exports = {
  generateReportPDF,
  REPORT_TEMPLATES,
};
