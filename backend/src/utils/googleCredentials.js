const { childLogger } = require("./logger.js");
const log = childLogger("GoogleCredentials");

/**
 * Google Service Account Loader
 *
 * Loads Google service account credentials from the `GOOGLE_SERVICE_ACCOUNT_BASE64`
 * environment variable, with a backward-compatible fallback to a file on disk
 * (so existing deployments keep working).
 *
 * Usage:
 *   const { loadServiceAccountCredentials } = require("../utils/googleCredentials");
 *   const credentials = loadServiceAccountCredentials();   // { client_email, private_key, ... }
 *
 *   // Vertex AI
 *   new VertexAI({
 *     project: '...',
 *     googleAuthOptions: { credentials, scopes: [...] },
 *   });
 *
 *   // googleapis
 *   const auth = new google.auth.GoogleAuth({ credentials, scopes: [...] });
 *
 * Migration steps for a fresh deployment:
 *   1. `base64 -i serviceAccountKey.json` (or use scripts/encode-service-account.js)
 *   2. Paste into GOOGLE_SERVICE_ACCOUNT_BASE64 in your .env.
 *   3. Delete the raw serviceAccountKey.json file from the repo.
 */

const fs = require("fs");
const path = require("path");

const FALLBACK_PATH = path.join(__dirname, "../../serviceAccountKey.json");

/**
 * Decode base64 string into a UTF-8 string.
 * Defensive: strips surrounding whitespace, validates length.
 * @param {string} b64
 * @returns {string}
 */
function decodeBase64(b64) {
  if (typeof b64 !== "string" || b64.trim() === "") {
    return null;
  }
  try {
    return Buffer.from(b64.trim(), "base64").toString("utf-8");
  } catch (err) {
    throw new Error(
      `[googleCredentials] Failed to decode GOOGLE_SERVICE_ACCOUNT_BASE64: ${err.message}`,
    );
  }
}

/**
 * Load Google service account credentials.
 *
 * Resolution order:
 *   1. `GOOGLE_SERVICE_ACCOUNT_BASE64` env var (preferred — keeps secrets out of disk).
 *   2. `GOOGLE_APPLICATION_CREDENTIALS` env var (file path, ADC).
 *   3. `serviceAccountKey.json` next to backend/ (legacy fallback, deprecated).
 *
 * @returns {Object|null} parsed service account JSON, or null if unavailable.
 * @throws {Error} when env var is set but cannot be parsed.
 */
function loadServiceAccountCredentials() {
  const fromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (fromEnv && fromEnv.trim() !== "") {
    const decoded = decodeBase64(fromEnv);
    if (!decoded) return null;
    try {
      const parsed = JSON.parse(decoded);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error(
          "Decoded JSON missing required fields: client_email, private_key",
        );
      }
      return parsed;
    } catch (err) {
      throw new Error(
        `[googleCredentials] GOOGLE_SERVICE_ACCOUNT_BASE64 is set but invalid: ${err.message}`,
      );
    }
  }

  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (adcPath && fs.existsSync(adcPath)) {
    try {
      const raw = fs.readFileSync(adcPath, "utf-8");
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `[googleCredentials] Failed to read GOOGLE_APPLICATION_CREDENTIALS at ${adcPath}: ${err.message}`,
      );
    }
  }

  if (fs.existsSync(FALLBACK_PATH)) {
    // Legacy fallback. Logs once via console.warn (still present pre-logger refactor).
    if (typeof console !== "undefined" && console.warn) {
      log.warn(
        `[googleCredentials] Falling back to legacy file at ${FALLBACK_PATH}. ` +
          "Migrate to GOOGLE_SERVICE_ACCOUNT_BASE64 and remove the file.",
      );
    }
    try {
      const raw = fs.readFileSync(FALLBACK_PATH, "utf-8");
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `[googleCredentials] Failed to read legacy ${FALLBACK_PATH}: ${err.message}`,
      );
    }
  }

  return null;
}

module.exports = {
  loadServiceAccountCredentials,
  FALLBACK_SERVICE_ACCOUNT_PATH: FALLBACK_PATH,
};
