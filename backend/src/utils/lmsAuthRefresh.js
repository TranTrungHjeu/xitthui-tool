/**
 * LMS auto-refresh wrapper
 *
 * The MindX LMS Firebase id-token expires ~1 hour after issue. When that
 * happens the LMS starts returning 401 / "UNAUTHENTICATED" GraphQL errors
 * for every authenticated call. Without an explicit refresh step the
 * user's session is effectively dead long before the cookie expires
 * (30 days).
 *
 * This helper wraps any controller handler that calls LMSClient so we
 * transparently:
 *
 *   1. Run the handler with the current `req.lmsToken`.
 *   2. If the result throws an LMS auth error, ask `lmsAuth` to refresh
 *      the token using the resolved session's `lmsRefreshToken` (stored
 *      in Firestore). The cookie is rotated on the response so the FE
 *      never sees the expiry.
 *   3. Run the handler a second time with the new token and return the
 *      successful result.
 *
 * The refresh is single-flighted per-process — if two requests come in
 * concurrently and both detect an expired token, only one hits the
 * upstream refresh endpoint; the rest wait for that promise to resolve.
 *
 * NOTE: handlers MUST use `req.lmsToken` (set by the `cookieAuth`
 * middleware) instead of `req.body.token` for this wrapper to work.
 * If the token is missing entirely (no cookie), the helper throws a
 * 400-style error so the FE can boot the user to the login screen.
 */

const { isLmsAuthError } = require("./authError");
const lmsAuth = require("../services/lmsAuth");
const LMSClient = require("../services/lmsClient");
const FirestoreSession = require("../storage/sessionStorage");
const FirestoreNotification = require("../storage/notificationStorage");
const { buildAuthCookieHeaders } = require("../middleware/cookieAuth");
const { childLogger } = require("./logger.js");
const log = childLogger("LmsAuthRefresh");

// Single-flight refresh so we don't fan out N token refreshes when
// multiple parallel requests expire at the same moment.
let refreshInFlight = null; // Map<sessionId, Promise<{ lmsToken, lmsRefreshToken } | null>>

/**
 * Force a refresh of the LMS token for the given sessionId.
 * Returns the new idToken (and refresh token) or null if the session
 * is no longer valid.
 */
async function refreshLmsTokenForSession(sessionId) {
  if (!refreshInFlight) {
    refreshInFlight = new Map();
  }
  const existing = refreshInFlight.get(sessionId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const session = await FirestoreSession.getSession(sessionId);
      if (!session || !session.isValid) return null;
      if (!session.lmsRefreshToken) {
        log.warn(`[LmsAuthRefresh] Session ${sessionId} has no refresh token`);
        return null;
      }

      const refreshed = await lmsAuth.refreshLmsToken(session.lmsRefreshToken);
      await FirestoreSession.updateSession(sessionId, {
        lmsRefreshToken: refreshed.refreshToken,
      });
      await FirestoreNotification.saveActiveToken(
        session.teacherId || session.userId,
        refreshed.idToken,
        session.centreIds || [],
        session.roles || [],
      );

      log.info(`[LmsAuthRefresh] Refreshed LMS token for session ${sessionId}`);
      return {
        lmsToken: refreshed.idToken,
        lmsRefreshToken: refreshed.refreshToken,
      };
    } catch (err) {
      log.error(`[LmsAuthRefresh] Refresh failed for session ${sessionId}:`, err.message);
      return null;
    } finally {
      // Free the slot on the next tick so a future expiry can fire again.
      setTimeout(() => refreshInFlight?.delete(sessionId), 0);
    }
  })();

  refreshInFlight.set(sessionId, promise);
  return promise;
}

/**
 * Wrap a controller handler so the LMS token is auto-refreshed on expiry.
 *
 * Usage:
 *   exports.getThings = withLmsAuthRefresh(async (req, res, client) => {
 *     const data = await client.getThings();
 *     res.json({ success: true, data });
 *   });
 *
 * The inner function receives a `LMSClient` constructed from `req.lmsToken`.
 * If a call inside the handler throws an LMS auth error, the wrapper
 * refreshes the token, rotates the cookie, and re-invokes the inner
 * function with a fresh client. If the refresh fails the original error
 * is propagated so the FE sees the 401 / 500 it would have gotten anyway.
 */
function withLmsAuthRefresh(handler) {
  return async function lmsAuthRefreshWrapper(req, res, ...args) {
    if (!req.lmsToken) {
      // No cookie at all — surface as 400 so the FE can move the user to
      // the login screen. The 401 retry queue in `api.ts` does not
      // trigger on 400, by design.
      return res.status(400).json({ error: "Token is required" });
    }

    const initialClient = new LMSClient(req.lmsToken);
    try {
      return await handler(req, res, initialClient, ...args);
    } catch (err) {
      if (!isLmsAuthError(err) || !req.sessionId) {
        throw err;
      }

      log.warn(
        `[LmsAuthRefresh] LMS auth error on ${req.method} ${req.path}, attempting refresh`,
      );

      const newTokens = await refreshLmsTokenForSession(req.sessionId);
      if (!newTokens) {
        // Session gone — translate to a 401 so the FE's session-expired
        // guard can do its thing.
        return res.status(401).json({
          success: false,
          error: "Session expired. Please login again.",
        });
      }

      // Rotate the cookie so the browser stops sending the expired token.
      const cookies = buildAuthCookieHeaders(newTokens.lmsToken, req.sessionId);
      cookies.forEach((c) => res.append("Set-Cookie", c));

      // Re-invoke the handler with the fresh token.
      const refreshedClient = new LMSClient(newTokens.lmsToken);
      return await handler(req, res, refreshedClient, ...args);
    }
  };
}

module.exports = {
  withLmsAuthRefresh,
  refreshLmsTokenForSession,
};
