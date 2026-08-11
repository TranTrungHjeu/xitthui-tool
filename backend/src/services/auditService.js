/**
 * Audit Service for trial-report actions.
 *
 * Two endpoints:
 *   - `logReportEvent(reportId, actor, action, meta)` — fire-and-forget
 *     write to Mongo after every relevant action. Failures are logged
 *     but never throw — audit logging must NOT break the user's request.
 *   - `getReportAuditTrail(reportId, limit)` — read the last N events
 *     for a report (ascending or descending).
 *
 * The actor argument follows the shape exposed by `getActor(req)` in
 * `controllers/trialReportController.js`:
 *   { userId, teacherId, name, email }
 */

const ReportAuditLog = require("../models/reportAuditLog");
const { childLogger } = require("../utils/logger.js");

const log = childLogger("AuditService");

/**
 * Persist a single audit event. Returns the saved document (or null if
 * the write failed). Never throws — auditing should be invisible to the
 * caller's main flow.
 *
 * @param {string} reportId  - TrialReport _id
 * @param {object} actor     - { userId, teacherId, name, email }
 * @param {string} action    - "upload" | "delete-request" | "delete" | ...
 * @param {object} [meta]    - free-form payload
 */
async function logReportEvent(reportId, actor, action, meta) {
  if (!reportId) {
    log.warn("[auditService] logReportEvent called without reportId");
    return null;
  }
  if (!action) {
    log.warn("[auditService] logReportEvent called without action");
    return null;
  }

  const actorId =
    (actor && (actor.userId || actor.teacherId)) || null;
  const actorName =
    (actor && (actor.name || actor.fullName)) || "";

  const safeMeta = meta && typeof meta === "object" ? meta : {};

  try {
    const doc = await ReportAuditLog.create({
      reportId,
      actorId,
      actorName,
      action,
      meta: safeMeta,
    });

    // Mirror to console so it's grep-able in dev. The structured
    // logger is fine, but a single line keeps it obvious in
    // tail-of-log debugging.
    log.info(
      "[audit] reportId=%s actor=%s action=%s",
      reportId,
      actorName || actorId || "anonymous",
      action,
    );
    return doc;
  } catch (err) {
    log.error(
      "[auditService] Failed to log event for reportId=%s action=%s: %s",
      reportId,
      action,
      err.message,
    );
    return null;
  }
}

/**
 * Fetch the most recent audit events for a report, newest first.
 * Defaults to 50 entries (matches the FE drawer default).
 *
 * @param {string} reportId
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
async function getReportAuditTrail(reportId, limit = 50) {
  if (!reportId) return [];
  const cap = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  try {
    return await ReportAuditLog.find({ reportId })
      .sort({ at: -1 })
      .limit(cap)
      .lean();
  } catch (err) {
    log.error(
      "[auditService] Failed to read audit trail for reportId=%s: %s",
      reportId,
      err.message,
    );
    return [];
  }
}

module.exports = {
  logReportEvent,
  getReportAuditTrail,
};
