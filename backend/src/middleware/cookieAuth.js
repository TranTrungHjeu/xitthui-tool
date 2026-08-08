/**
 * Cookie-based auth helpers
 *
 * The LMS Bearer token that used to travel in the request body now lives in
 * an httpOnly cookie. This helper centralises:
 *
 *   - the cookie option set (production vs. dev)
 *   - middleware that copies `req.cookies.lms_token` into `req.lmsToken` for
 *     downstream controllers
 *   - tiny accessor functions used by `authController` when setting /
 *     clearing the cookie on login / refresh / logout
 *
 * Controllers that previously read `req.body.token` now read `req.lmsToken`
 * (set by this middleware). They still fall back to `req.body.token` so any
 * internal server-side callers (e.g. jobs) keep working without cookies.
 *
 * IMPORTANT: the cookie is httpOnly — JavaScript on the page cannot read it,
 * which means XSS cannot steal the LMS token. The middleware also enforces
 * `SameSite=Lax` so the cookie is still sent on top-level navigations from
 * the FE, but never on cross-site fetch requests.
 */

const { serializeCookie, clearCookie } = require("../utils/cookies");
const { childLogger } = require("../utils/logger.js");
const log = childLogger("CookieAuth");

const LMS_TOKEN_COOKIE = "lms_token";
const SESSION_COOKIE = "session_id";

/** Cookie options shared by both auth cookies. */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  // Strict = no cross-site at all (only same-site requests).
  // Lax    = top-level same-site + cross-site GET navigations.
  // None   = always sent, but MUST be paired with Secure (browser
  //          rejects cookies that violate this rule).
  //
  // When the FE and BE are on different eTLD+1 (e.g. Vercel → nip.io),
  // the browser treats the request as cross-site and refuses to attach
  // cookies with sameSite=Lax/Strict on XHR/fetch. Override via the
  // COOKIE_SAME_SITE env so we can keep `lax` for dev (same-origin) and
  // force `none` for cross-site production without forking the code.
  const sameSite = (process.env.COOKIE_SAME_SITE || "lax").toLowerCase();
  const isCrossSite = sameSite === "none";
  return {
    httpOnly: true,
    // sameSite=None mandates Secure; otherwise `secure` follows NODE_ENV.
    secure: isCrossSite || isProduction,
    sameSite,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  };
}

/**
 * Build Set-Cookie headers for both auth cookies.
 * Returns an array suitable for `res.setHeader("Set-Cookie", [...])` or for
 * `res.append("Set-Cookie", singleString)`.
 */
function buildAuthCookieHeaders(lmsToken, sessionId) {
  const opts = getCookieOptions();
  return [
    serializeCookie(LMS_TOKEN_COOKIE, lmsToken, opts),
    serializeCookie(SESSION_COOKIE, sessionId, opts),
  ];
}

/**
 * Build Set-Cookie headers that clear both auth cookies.
 */
function buildClearCookieHeaders() {
  const opts = getCookieOptions();
  return [
    clearCookie(LMS_TOKEN_COOKIE, opts),
    clearCookie(SESSION_COOKIE, opts),
  ];
}

/**
 * Middleware: prefer `req.cookies.lms_token`, allow `req.body.token` as
 * fallback for server-side / job callers, then `Authorization: Bearer`.
 *
 * Writes `req.lmsToken` (string or null) and `req.sessionId` (string or null)
 * for downstream controllers. Controllers SHOULD read these instead of
 * touching `req.body.token` directly.
 */
function cookieAuth(req, _res, next) {
  const fromCookie = req.cookies?.[LMS_TOKEN_COOKIE];
  const fromBody = req.body?.token;
  const fromHeader = (() => {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const parts = auth.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
    return null;
  })();

  req.lmsToken = fromCookie || fromBody || fromHeader || null;
  req.sessionId = req.cookies?.[SESSION_COOKIE] || req.body?.sessionId || null;

  if (req.lmsToken) {
    // Strip from body so downstream code doesn't accidentally re-send it.
    if (req.body && typeof req.body === "object") {
      delete req.body.token;
    }
  }
  next();
}

module.exports = {
  LMS_TOKEN_COOKIE,
  SESSION_COOKIE,
  buildAuthCookieHeaders,
  buildClearCookieHeaders,
  cookieAuth,
};
