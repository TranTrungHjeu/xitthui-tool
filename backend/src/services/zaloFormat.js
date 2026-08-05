/**
 * Centralized formatting helpers for Zalo Bot messages.
 *
 * Mirrors the sub-project `sub_project/abc-mindx-support-tools-web-app/src/page/Zalo/components/zalo-format.ts`
 * but adapted for Node.js (no DOM APIs, no Clipboard API). Provides:
 *   - formatLine(rawLine) — returns the formatted text + inline-style metadata
 *     used to render the Zalo-style preview (red/green/black, italic, bold).
 *   - buildPayloads(fullText) — returns the html/text pair the Zalo Bot API
 *     can consume via `sendMessage` (text + attachment HTML).
 *
 * Formatting rules (Zalo OA color scheme):
 *   ***text***  -> bold + italic, red (#db342e)
 *   **text**    -> bold, red
 *   *text*      -> italic + bold green
 *   plain text  -> default black
 */

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const baseSpan = (color, extra, content) =>
  `<span style="color:${color};background:#fff;font-size:14px;${extra}">${escapeHtml(
    content,
  )}</span>`;

const wrappedDiv = (inner, extra) =>
  `<div style="${extra}">${inner}</div>`;

const formatTripleStar = (inner) => ({
  html: wrappedDiv(
    baseSpan("#db342e", "font-weight:700;font-style:italic;font-size:16px;", inner),
    "",
  ),
  text: inner,
});

const formatDoubleStar = (inner) => {
  if (inner.startsWith("@All")) {
    const summaryIndex = inner.indexOf("TỔNG KẾT NỘI DUNG BUỔI");
    if (summaryIndex !== -1) {
      const beforeSummary = inner.slice(0, summaryIndex).trim();
      const summaryPart = inner.slice(summaryIndex).trim();
      const beforeHtml = beforeSummary
        ? baseSpan("#000", "", beforeSummary) + " "
        : "";
      const summaryHtml = baseSpan(
        "#db342e",
        "font-weight:700;font-size:16px;",
        summaryPart,
      );
      return { html: wrappedDiv(beforeHtml + summaryHtml, ""), text: inner };
    }
  }
  return {
    html: wrappedDiv(
      baseSpan("#db342e", "font-weight:700;font-size:16px;", inner),
      "",
    ),
    text: inner,
  };
};

const COMPASS_PHRASE = "'Học bạ trực tuyến - Compass'";

const formatSingleStar = (inner) => {
  if (inner.includes(COMPASS_PHRASE)) {
    const parts = inner.split(COMPASS_PHRASE);
    const before = parts[0] || "";
    const after = parts.slice(1).join(COMPASS_PHRASE) || "";
    const html =
      `<div style="background:#fff;font-size:14px">` +
      `<span style="color:#000;">${escapeHtml(before)}</span>` +
      `<span style="color:#f7b503;font-weight:700;">${escapeHtml(
        COMPASS_PHRASE,
      )}</span>` +
      `<span style="color:#000;">${escapeHtml(after)}</span>` +
      `</div>`;
    return { html, text: inner };
  }
  const isReminder = /nhắc nhở|quan tâm/i.test(inner);
  const color = "#15a85f";
  const extra = isReminder
    ? "font-style:italic;font-weight:700;"
    : "font-style:italic;font-weight:700;";
  return {
    html: wrappedDiv(baseSpan(color, extra, inner), ""),
    text: inner,
  };
};

const formatNormal = (line) => {
  if (!line || !line.trim()) return { html: "<br>", text: "" };
  return {
    html: wrappedDiv(baseSpan("#000", "", line), ""),
    text: line,
  };
};

const formatLine = (rawLine) => {
  const line = (rawLine || "").trim();
  if (!line) return { html: "<br>", text: "" };
  if (line.startsWith("***") && line.endsWith("***")) {
    return formatTripleStar(line.slice(3, -3).trim());
  }
  if (line.startsWith("**") && line.endsWith("**")) {
    return formatDoubleStar(line.slice(2, -2).trim());
  }
  if (line.startsWith("*") && line.endsWith("*")) {
    return formatSingleStar(line.slice(1, -1).trim());
  }
  return formatNormal(line);
};

const buildPayloads = (fullText) => {
  const lines = String(fullText || "").split(/\r?\n/);
  const htmlParts = [];
  const textParts = [];
  for (const ln of lines) {
    const formatted = formatLine(ln);
    htmlParts.push(formatted.html);
    if (formatted.text !== "") textParts.push(formatted.text);
  }
  const fullHtml =
    `<!doctype html><html><head><meta charset="utf-8"></head>` +
    `<body style="background:#fff;font-family:system-ui, -apple-system, sans-serif;line-height:1.6;">` +
    htmlParts.join("") +
    `</body></html>`;
  const plain = textParts.join("\n");
  return { html: fullHtml, text: plain };
};

/**
 * Render preview lines as an array of { html, text } so the frontend can
 * display them without re-parsing markdown. Kept here so backend and frontend
 * stay perfectly in sync.
 */
const buildPreviewLines = (fullText) => {
  const lines = String(fullText || "").split(/\r?\n/);
  return lines.map((ln) => formatLine(ln));
};

module.exports = {
  formatLine,
  buildPayloads,
  buildPreviewLines,
  escapeHtml,
};
