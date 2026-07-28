/**
 * CSRF protection middleware using csurf + cookie-parser.
 *
 * Applies to all state-changing routes (POST, PUT, PATCH, DELETE) that are NOT
 * already exempt. The following paths are exempt from CSRF:
 *   - /health          — liveness probe (no auth, safe)
 *   - /ready           — readiness probe (no auth, safe)
 *   - /sessions        — uses its own INTERNAL_API_KEY auth
 *   - /spreadsheet/*   — webhooks with their own auth
 *
 * CSRF token lifecycle:
 *   1. Client GETs a safe endpoint (e.g. /api/csrf-token) to obtain a token.
 *   2. The server reads the token from the signed cookie.
 *   3. Client includes `x-xsrf-token: <token>` header on every mutation.
 *
 * A `csurf` instance is created here so that it is shared between:
 *   - the route that sets the cookie (GET /csrf-token)
 *   - the middleware that validates the token
 *
 * This file must be imported AFTER dotenv config runs (so INTERNAL_API_KEY
 * is available) but BEFORE routes are mounted.
 */

const csurf = require("csurf");
const cookieParser = require("cookie-parser");

/**
 * Paths that are exempt from CSRF protection.
 * All other paths will require a valid CSRF token on mutations.
 */
const CSRF_EXEMPT_PATHS = [
  "/health",
  "/ready",
  "/sessions",
  "/data",
  "/trial-availabilities",
  "/trial-bookings/assign",
  "/trial-bookings/unassign",
];

function isExempt(reqPath) {
  return CSRF_EXEMPT_PATHS.some(
    (p) => reqPath === p || reqPath.startsWith(p + "/"),
  );
}

/**
 * Build the CSRF middleware.
 * @returns {Function} Express middleware.
 */
function buildCsrfMiddleware() {
  const csrfProtection = csurf({
    cookie: {
      key: "_csrf",
      httpOnly: false, // Must be readable by JS (XSRF-TOKEN header)
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    },
    value: (req) => {
      // Read token from header first (preferred), fall back to cookie.
      return req.headers["x-xsrf-token"] || req.cookies?._csrf;
    },
  });

  return function csrfMiddleware(req, res, next) {
    if (isExempt(req.path)) {
      return next();
    }
    return csrfProtection(req, res, next);
  };
}

module.exports = {
  buildCsrfMiddleware,
  CSRF_EXEMPT_PATHS,
};
