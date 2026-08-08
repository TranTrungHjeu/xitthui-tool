/**
 * /me controller
 *
 * Returns the cached user profile for the current session. The session
 * lookup is intentionally minimal — we only need to confirm the cookie
 * still references a valid session AND give the FE the user info it
 * needs to render the dashboard after a reload.
 *
 * The lmsToken is intentionally NOT echoed here. The FE already has it
 * via the httpOnly cookie; re-sending it in the body would defeat the
 * point of using httpOnly cookies.
 */

const FirestoreSession = require("../storage/sessionStorage");
const { isSpecialAccount } = require("../utils/roleUtils");
const { childLogger } = require("../utils/logger.js");
const log = childLogger("MeController");

/**
 * GET /me
 * Returns { success: true, data: { user, sessionId } } when the cookie is
 * valid, or { success: false } otherwise.
 */
exports.getMe = async (req, res) => {
  if (!req.lmsToken || !req.sessionId) {
    return res
      .status(401)
      .json({ success: false, error: "Not authenticated" });
  }

  try {
    const session = await FirestoreSession.getSession(req.sessionId);
    if (!session || !session.isValid) {
      return res
        .status(401)
        .json({ success: false, error: "Session invalid" });
    }

    // The session record stores everything the FE needs to render user
    // info: roles, centreIds, userId, teacherId. We do NOT re-fetch the
    // MindX profile on every probe because the profile rarely changes.
    // The FE can still call `/login` (or a future /profile) if it needs
    // to refresh the name/photo.
    const user = {
      id: session.userId,
      teacherId: session.teacherId || null,
      centreIds: session.centreIds || [],
      appRoles: session.roles || [],
      isSpecialAccount: isSpecialAccount({ id: session.userId, roles: session.roles }),
    };

    return res.json({
      success: true,
      data: {
        user,
        sessionId: req.sessionId,
      },
    });
  } catch (err) {
    log.error("[Me] getMe failed:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
