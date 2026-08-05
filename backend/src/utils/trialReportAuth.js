/**
 * Authentication middlewares for trial-report routes.
 *
 * The MindX-style API uses an LMS token (passed in the request body) plus
 * an optional `sessionId` (set when the user logged in via MindX support
 * tools). Role-based authorization is layered on top:
 *   - `attachSession`     — optional, populates req.trialReportUser when
 *                          sessionId is present, but never rejects.
 *   - `requireRole`       — hard 401/403 if user is missing the role.
 *
 * The middleware is intentionally lenient for public-facing flows
 * (upload/create-report) and strict for TE/Admin-only endpoints.
 */

const SessionStorage = require("../storage/sessionStorage");

const { childLogger } = require("./logger.js");
const log = childLogger("TrialReportAuth");

function normalizeRoles(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean).map(String);
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Attach the session (if any) to req.trialReportUser without rejecting.
 * Useful for endpoints that work whether or not the caller is logged in.
 */
async function attachSession(req, _res, next) {
  try {
    const sessionId =
      req.body?.sessionId ||
      req.query?.sessionId ||
      req.headers?.["x-session-id"] ||
      null;

    if (!sessionId) {
      req.trialReportUser = null;
      return next();
    }

    const session = await SessionStorage.getSession(sessionId);
    if (!session || session.isValid === false) {
      req.trialReportUser = null;
      return next();
    }

    req.trialReportUser = {
      userId: session.userId || null,
      teacherId: session.teacherId || null,
      fullName: session.teacherId || session.userId || "Người dùng",
      roles: normalizeRoles(session.roles),
      sessionId: session.sessionId,
    };
    return next();
  } catch (err) {
    log.warn("[trialReportAuth] attachSession error: %s", err.message);
    req.trialReportUser = null;
    return next();
  }
}

/**
 * Factory: require the caller to have at least one of the listed roles.
 * Falls back to raw `roles` query/body if no session is found, so callers
 * can pass explicit roles for service-to-service flows.
 */
function requireRole(allowedRoles) {
  const allowed = new Set(normalizeRoles(allowedRoles).map((r) => r.toUpperCase()));
  if (allowed.size === 0) {
    throw new Error("requireRole: allowedRoles is empty");
  }

  return async (req, res, next) => {
    try {
      let user = req.trialReportUser || null;

      if (!user) {
        const sessionId =
          req.body?.sessionId ||
          req.query?.sessionId ||
          req.headers?.["x-session-id"] ||
          null;
        if (sessionId) {
          const session = await SessionStorage.getSession(sessionId);
          if (session && session.isValid !== false) {
            user = {
              userId: session.userId || null,
              teacherId: session.teacherId || null,
              fullName: session.teacherId || session.userId || "Người dùng",
              roles: normalizeRoles(session.roles),
              sessionId: session.sessionId,
            };
            req.trialReportUser = user;
          }
        }
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
          code: "EAUTHREQUIRED",
        });
      }

      const userRoles = (user.roles || []).map((r) => String(r).toUpperCase());
      const hasRole = userRoles.some((r) => allowed.has(r));
      if (!hasRole) {
        return res.status(403).json({
          success: false,
          error: `Insufficient role. Required: ${Array.from(allowed).join(", ")}`,
          code: "EFORBIDDEN",
          userRoles,
        });
      }

      return next();
    } catch (err) {
      log.error("[trialReportAuth] requireRole error: %s", err.message);
      return res.status(500).json({
        success: false,
        error: "Authorization check failed",
        code: "EAUTHERROR",
      });
    }
  };
}

module.exports = {
  attachSession,
  requireRole,
  normalizeRoles,
};
