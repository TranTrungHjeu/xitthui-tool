/**
 * Trial Report deletion password verification.
 *
 * The "direct delete" flow protects destructive operations behind a
 * shared password (set in `.env` as `TRIAL_REPORT_DELETE_PASSWORD`)
 * instead of the old 2-step request/review workflow. The password is
 * shared by everyone who is allowed to delete reports — it's an
 * authorization gate, not a per-user credential.
 *
 * Security:
 *   - Plain-text stored in env (acceptable for an internal shared
 *     gate; not for per-user passwords).
 *   - `crypto.timingSafeEqual` avoids leaking length / char-by-char
 *     info via timing.
 *   - Constant-time comparison falls back to `false` if the buffers
 *     differ in length.
 *
 * Configuration:
 *   - TRIAL_REPORT_DELETE_PASSWORD (required) — cleartext password
 *   - TRIAL_REPORT_DELETE_PASSWORD_DISABLED (optional, "true") — set
 *     to bypass the gate entirely (only useful in tests / staging).
 */

const crypto = require("crypto");

function getConfiguredPassword() {
  const disabled = String(process.env.TRIAL_REPORT_DELETE_PASSWORD_DISABLED || "")
    .trim()
    .toLowerCase();
  if (disabled === "true" || disabled === "1") return null;

  const pwd = process.env.TRIAL_REPORT_DELETE_PASSWORD;
  if (typeof pwd !== "string" || pwd.length === 0) {
    throw new Error(
      "[deletePassword] TRIAL_REPORT_DELETE_PASSWORD is not set in .env. " +
        "Direct delete is disabled until this env var is configured.",
    );
  }
  return pwd;
}

/**
 * Verify a candidate password against the configured one. Returns
 * `true` only on exact match (constant-time).
 *
 * @param {string} candidate
 * @returns {boolean}
 */
function verifyDeletePassword(candidate) {
  const expected = getConfiguredPassword();
  // When the gate is explicitly disabled via env, accept anything.
  if (expected === null) return true;
  if (typeof candidate !== "string" || candidate.length === 0) return false;

  const expectedBuf = Buffer.from(expected, "utf8");
  const candidateBuf = Buffer.from(candidate, "utf8");
  if (expectedBuf.length !== candidateBuf.length) {
    // timingSafeEqual requires equal-length buffers; do a dummy compare
    // so the rejection still takes roughly the same time.
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
}

module.exports = {
  getConfiguredPassword,
  verifyDeletePassword,
};