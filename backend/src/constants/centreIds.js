/**
 * Central Constants - Centre IDs
 *
 * Source of truth for hard-coded centre IDs. All centre IDs must be imported
 * from this module instead of being hard-coded inline, so that:
 *   1. Multi-tenant deployments (other centres) can be configured via env.
 *   2. Magic strings don't drift between modules.
 *
 * Env overrides:
 *   - TDM_CENTRE_ID: ID of the "Thủ Dầu Một" centre. Fallback to the
 *     historical default if not set (backward-compatible).
 */

const DEFAULT_TDM_CENTRE_ID = "6443460f94300678908f7974";

/**
 * Returns the configured TDM centre ID, or the historical default.
 * @returns {string}
 */
function getTdmCentreId() {
  return process.env.TDM_CENTRE_ID || DEFAULT_TDM_CENTRE_ID;
}

module.exports = {
  DEFAULT_TDM_CENTRE_ID,
  TDM_CENTRE_ID: getTdmCentreId(),
  getTdmCentreId,
};
