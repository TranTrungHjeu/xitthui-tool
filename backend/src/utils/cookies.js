/**
 * Cookie parsing & serialization utilities
 *
 * Self-contained so we don't pull in the `cookie-parser` package.
 * Express `@4.18.2` matches/parses cookies via `req.headers.cookie` but
 * doesn't expose parsed values. This helper gives the rest of the code
 * a minimal `req.cookies` shape for the few places we read auth cookies.
 */

const { childLogger } = require("./logger.js");
const log = childLogger("Cookies");

/**
 * Parse a `Cookie:` header into a plain object.
 * Returns {} for missing or malformed headers.
 */
function parseCookieHeader(header) {
  if (!header || typeof header !== "string") return {};
  const cookies = {};
  const pairs = header.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

/**
 * Build a `Set-Cookie` header value from the given options.
 * Defaults are tuned for LMS tokens: httpOnly + sameSite=Lax so the cookie
 * is sent on top-level navigations but never exposed to JS.
 */
function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  const maxAge = options.maxAge ?? 30 * 24 * 60 * 60; // 30 days
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  parts.push(`Path=${options.path ?? "/"}`);
  if (options.httpOnly) parts.push("HttpOnly");
  const sameSite = options.sameSite ?? "Lax";
  parts.push(`SameSite=${sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Build a `Set-Cookie` header that clears the cookie on the client.
 */
function clearCookie(name, options = {}) {
  const parts = [`${name}=`, `Max-Age=0`, `Path=${options.path ?? "/"}`];
  const sameSite = options.sameSite ?? "Lax";
  parts.push(`SameSite=${sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Express middleware: populates `req.cookies` from the Cookie header.
 * Mounted once near the top of the request pipeline.
 */
function cookieParser(req, _res, next) {
  try {
    req.cookies = parseCookieHeader(req.headers.cookie);
  } catch (err) {
    log.warn(`[Cookies] Failed to parse cookie header: ${err.message}`);
    req.cookies = {};
  }
  next();
}

module.exports = {
  parseCookieHeader,
  serializeCookie,
  clearCookie,
  cookieParser,
};
