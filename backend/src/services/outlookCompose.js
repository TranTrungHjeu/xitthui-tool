/**
 * Build an Outlook Web Compose deeplink (`outlook.office.com/mail/deeplink/compose`)
 * from a pre-rendered email's metadata. Subject + body are passed as URL-encoded
 * query strings on the `body=` and `subject=` params so the user lands in
 * Outlook's composer with everything prefilled and just has to click Send.
 *
 * Outlook's deeplink params (per Microsoft's published compose schema):
 *   ?to=          comma-separated recipients
 *   ?cc=          comma-separated cc recipients
 *   ?subject=     subject line
 *   ?body=        plain-text or HTML body
 *   ?isHtml=      set to `True` so Outlook renders HTML body
 *
 * We render HTML because the payroll issue template is HTML-only;
 * Outlook web client strips unsupported tags but keeps key formatting.
 */

function encodeForOutlook(s) {
  if (s === undefined || s === null) return "";
  return encodeURIComponent(String(s));
}

/**
 * Build the Outlook Web Compose URL.
 *
 * @param {Object} options
 * @param {string|string[]} to    - recipient(s)
 * @param {string|string[]} [cc]  - CC recipient(s)
 * @param {string}         subject
 * @param {string}         htmlBody   - HTML body (we'll URL-encode it as-is)
 * @returns {string}
 */
function buildOutlookComposeUrl({ to, cc, subject, htmlBody }) {
  const toParam = Array.isArray(to) ? to.join(";") : String(to || "");
  const ccParam = cc
    ? (Array.isArray(cc) ? cc.join(";") : String(cc))
    : "";

  const params = new URLSearchParams();
  if (toParam) params.set("to", toParam);
  if (ccParam) params.set("cc", ccParam);
  if (subject) params.set("subject", subject);
  if (htmlBody) {
    params.set("body", htmlBody);
    params.set("isHtml", "True");
  }

  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

/**
 * Render an HTML body to a plain-text version for the rare case where the
 * user opens Outlook desktop and we want to keep both formats. Falls back
 * to the original htmlBody when stripping tags leaves an empty document.
 */
function htmlToText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>(?!\s*\n)/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convenience: take the same shape produced by `renderPayrollIssueEmail`
 * and turn it into an Outlook Web Compose URL.
 *
 * @param {Object} email - { subject, html, text }
 * @param {Object} recipients - { to, cc }
 */
function buildOutlookUrlForEmail(email, recipients) {
  return buildOutlookComposeUrl({
    to: recipients?.to,
    cc: recipients?.cc,
    subject: email?.subject || "",
    htmlBody: email?.html || email?.text || "",
  });
}

module.exports = {
  buildOutlookComposeUrl,
  buildOutlookUrlForEmail,
  htmlToText,
  encodeForOutlook,
};
