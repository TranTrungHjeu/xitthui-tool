// Centralized formatting and clipboard helpers for Zalo comment page
export type LineFormat = {
  html: string;
  text: string;
};

const escapeHtml = (str: string) =>
  str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatTripleStar = (inner: string): LineFormat => {
  return {
    html: `<div style="color:#db342e;font-weight:700;font-style:italic;background:#fff;font-size:16px">${escapeHtml(
      inner,
    )}</div>`,
    text: inner,
  };
};

const formatDoubleStar = (inner: string): LineFormat => {
  if (inner.startsWith("@All")) {
    const summaryIndex = inner.indexOf("TỔNG KẾT NỘI DUNG BUỔI");
    if (summaryIndex !== -1) {
      const beforeSummary = inner.slice(0, summaryIndex).trim();
      const summaryPart = inner.slice(summaryIndex).trim();
      const beforeHtml = beforeSummary
        ? `<span style="color:#000;background:#fff;font-size:14px">${escapeHtml(
            beforeSummary,
          )} </span>`
        : "";
      const summaryHtml = `<span style="color:#db342e;font-weight:700;background:#fff;font-size:16px">${escapeHtml(
        summaryPart,
      )}</span>`;
      return { html: `<div>${beforeHtml + summaryHtml}</div>`, text: inner };
    }
  }
  // numbered section: **1. Title** or **2. ...**
  if (/^\d+\..*/.test(inner)) {
    return {
      html: `<div style="color:#db342e;font-weight:700;background:#fff;font-size:16px">${escapeHtml(
        inner,
      )}</div>`,
      text: inner,
    };
  }
  return {
    html: `<div style="color:#db342e;font-weight:700;background:#fff;font-size:16px">${escapeHtml(
      inner,
    )}</div>`,
    text: inner,
  };
};

const formatSingleStar = (inner: string): LineFormat => {
  const compassPhrase = "'Học bạ trực tuyến - Compass'";
  if (inner.includes(compassPhrase)) {
    const parts = inner.split(compassPhrase);
    const before = parts[0] || "";
    const after = parts.slice(1).join(compassPhrase) || "";
    const html = `<div style="background:#fff;font-size:14px"><span style="color:#000;">${escapeHtml(
      before,
    )}</span><span style="color:#f7b503;font-weight:700;">${escapeHtml(
      compassPhrase,
    )}</span><span style="color:#000;">${escapeHtml(after)}</span></div>`;
    return { html, text: inner };
  }
  const isReminder = /nhắc nhở|quan tâm/i.test(inner);
  if (isReminder) {
    return {
      html: `<div style="color:#15a85f;font-style:italic;font-weight:700;background:#fff;font-size:14px">${escapeHtml(
        inner,
      )}</div>`,
      text: inner,
    };
  }
  return {
    html: `<div style="color:#15a85f;font-style:italic;font-weight:700;background:#fff;font-size:14px">${escapeHtml(
      inner,
    )}</div>`,
    text: inner,
  };
};

const formatNormal = (line: string): LineFormat => {
  if (!line.trim()) return { html: "<br>", text: "" };
  return {
    html: `<div style="color:#000;background:#fff;font-size:14px">${escapeHtml(
      line,
    )}</div>`,
    text: line,
  };
};

export const formatLine = (rawLine: string): LineFormat => {
  const line = rawLine.trim();
  if (line.startsWith("***") && line.endsWith("***")) {
    const inner = line.slice(3, -3).trim();
    return formatTripleStar(inner);
  }

  if (line.startsWith("**") && line.endsWith("**")) {
    const inner = line.slice(2, -2).trim();
    return formatDoubleStar(inner);
  }

  if (line.startsWith("*") && line.endsWith("*")) {
    const inner = line.slice(1, -1).trim();
    return formatSingleStar(inner);
  }

  return formatNormal(line);
};

export const buildPayloads = (fullText: string) => {
  const lines = fullText.split(/\r?\n/);
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  for (const ln of lines) {
    const formatted = formatLine(ln);
    htmlParts.push(formatted.html);
    if (formatted.text !== "") textParts.push(formatted.text);
  }
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#fff;font-family:system-ui, -apple-system, sans-serif;line-height:1.6;">${htmlParts.join(
    "",
  )}</body></html>`;
  const plain = textParts.join("\n");
  return { html: fullHtml, text: plain };
};

export const buildInnerHtml = (fullText: string) => {
  const lines = fullText.split(/\r?\n/);
  const htmlParts: string[] = [];
  for (const ln of lines) htmlParts.push(formatLine(ln).html);
  return htmlParts.join("");
};

export const copyWithFormatting = async (sourceText: string) => {
  const { html, text } = buildPayloads(sourceText);
  try {
    const blobHtml = new Blob([html], { type: "text/html" });
    const blobPlain = new Blob([text], { type: "text/plain" });
    await navigator.clipboard.write([
      // @ts-expect-error ClipboardItem is available in modern browsers
      new ClipboardItem({ "text/html": blobHtml, "text/plain": blobPlain }),
    ]);
    return { ok: true, mode: "html" };
  } catch {
    try {
      await navigator.clipboard.writeText(text || sourceText);
      return { ok: true, mode: "text" };
    } catch {
      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-9999px";
        document.body.appendChild(tempDiv);
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const sel = globalThis.getSelection ? globalThis.getSelection() : null;
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        document.execCommand("copy");
        if (sel) sel.removeAllRanges();
        tempDiv.remove();
        return { ok: true, mode: "exec" };
      } catch {
        return { ok: false };
      }
    }
  }
};
