/**
 * Rotating API Keys for internal service-to-service calls.
 *
 * Problem: A static INTERNAL_API_KEY shared across all instances is a single
 * point of compromise. If the key leaks in logs or a config file, an attacker
 * has indefinite access.
 *
 * Solution: Each backend instance holds a short-lived key (default: 1 hour).
 * Keys are stored in Redis with a TTL; the /sessions/rotate endpoint issues
 * a fresh key. The old key remains valid until its TTL expires (grace period),
 * so there is no downtime during rotation.
 *
 * Resolution order (findKey):
 *   1. Redis (active rotated keys) — primary for multi-instance deployments
 *   2. Fallback: INTERNAL_API_KEY env var (legacy static key, still supported)
 *
 * Env vars:
 *   INTERNAL_API_KEY         — legacy static key (optional fallback)
 *   API_KEY_ROTATION_TTL_SEC — TTL for each key (default 3600 = 1 hour)
 *   API_KEY_GRACE_SEC        — old key stays valid for this long after rotation (default 300 = 5 min)
 */

const crypto = require("crypto");
const { childLogger } = require("./logger.js");
const log = childLogger("ApiKeyManager");

const KEY_PREFIX = "apikey:";
const ACTIVE_KEY_PREFIX = `${KEY_PREFIX}active`;
const PREVIOUS_KEY_PREFIX = `${KEY_PREFIX}prev`;

// Config
const KEY_TTL_SEC = parseInt(process.env.API_KEY_ROTATION_TTL_SEC, 10) || 3600;
const GRACE_SEC = parseInt(process.env.API_KEY_GRACE_SEC, 10) || 300;

let redis = null;
let useRedis = false;

function getRedisClient() {
  if (redis) return redis;
  try {
    // eslint-disable-next-line global-require
    const { createClient } = require("redis");
    const url = process.env.REDIS_URL;
    if (!url) return null;
    const c = createClient({ url });
    c.on("error", (err) => log.error("[ApiKeyManager] Redis error:", err.message));
    redis = c;
    useRedis = true;
    return c;
  } catch (_) {
    return null;
  }
}

/**
 * Generate a cryptographically random API key (32 bytes hex = 64 chars).
 * @returns {string}
 */
function generateKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a key for storage (we store the hash, not the plain key).
 * @param {string} key
 * @returns {string}
 */
function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Get the Redis client (connected if possible).
 * @returns {Promise<Object|null>}
 */
async function getConnectedRedis() {
  const client = getRedisClient();
  if (!client) return null;
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (err) {
      log.warn("[ApiKeyManager] Redis connect failed:", err.message);
      return null;
    }
  }
  return client;
}

/**
 * Rotate the active API key: demote current to "previous", generate a new one.
 * @returns {Promise<{key: string, expiresInSec: number}>}
 */
async function rotateKey() {
  const client = await getConnectedRedis();
  const newKey = generateKey();
  const newKeyHash = hashKey(newKey);
  const previousHash = useRedis ? await client.get(`${ACTIVE_KEY_PREFIX}:hash`) : null;

  if (client) {
    try {
      // Move current to previous (with grace period TTL)
      if (previousHash) {
        await client
          .multi()
          .set(`${PREVIOUS_KEY_PREFIX}:hash`, previousHash, { EX: GRACE_SEC })
          .set(`${ACTIVE_KEY_PREFIX}:hash`, newKeyHash, { EX: KEY_TTL_SEC })
          .exec();
      } else {
        await client.set(`${ACTIVE_KEY_PREFIX}:hash`, newKeyHash, {
          EX: KEY_TTL_SEC,
        });
      }
    } catch (err) {
      log.error("[ApiKeyManager] Redis key rotation failed:", err.message);
    }
  }

  return { key: newKey, expiresInSec: KEY_TTL_SEC };
}

/**
 * Validate an API key against active + previous (grace) keys.
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
async function isValidKey(candidate) {
  if (!candidate) return false;
  const hash = hashKey(candidate);

  const client = await getConnectedRedis();
  if (client) {
    try {
      const activeHash = await client.get(`${ACTIVE_KEY_PREFIX}:hash`);
      if (activeHash && activeHash === hash) return true;
      const prevHash = await client.get(`${PREVIOUS_KEY_PREFIX}:hash`);
      if (prevHash && prevHash === hash) return true;
      return false;
    } catch (err) {
      log.warn("[ApiKeyManager] Redis key validation failed, falling back:", err.message);
    }
  }

  // Legacy: fall back to static INTERNAL_API_KEY
  const staticKey = process.env.INTERNAL_API_KEY;
  if (staticKey && staticKey.length > 0) {
    return candidate === staticKey;
  }

  return false;
}

/**
 * Initialize keys on startup: ensure an active key exists in Redis.
 * Called from index.js after MongoDB connects.
 */
async function initializeKeys() {
  const client = await getConnectedRedis();
  if (!client) {
    log.info(
      "[ApiKeyManager] Redis not available. Using legacy INTERNAL_API_KEY. " +
        "Configure REDIS_URL to enable key rotation.",
    );
    return;
  }

  try {
    const existing = await client.get(`${ACTIVE_KEY_PREFIX}:hash`);
    if (existing) {
      log.info("[ApiKeyManager] Active key found in Redis (TTL managed).");
    } else {
      // First startup: generate an initial key.
      const { key } = await rotateKey();
      log.info(
        `[ApiKeyManager] Generated initial rotated key (TTL=${KEY_TTL_SEC}s). ` +
          "Call POST /sessions/rotate to refresh. Fallback legacy key still works.",
      );
      // Print a hint for operators
      process.stdout.write(
        `[ApiKeyManager] Initial API key (save this, it won't be shown again):\n${key}\n`,
      );
    }
  } catch (err) {
    log.error("[ApiKeyManager] Key initialization failed:", err.message);
  }
}

module.exports = {
  rotateKey,
  isValidKey,
  initializeKeys,
  KEY_TTL_SEC,
  GRACE_SEC,
};
