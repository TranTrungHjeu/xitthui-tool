/**
 * Shared Redis client.
 *
 * Initialized lazily to avoid crashing the server if Redis is not configured.
 * The rate limiter (utils/rateLimiter.js) connects independently for its own
 * counter store; this client is used for health checks and any future shared
 * Redis-backed state (sessions, pub/sub, etc.).
 *
 * Configured via REDIS_URL (e.g. redis://localhost:6379).
 * If REDIS_URL is not set, client remains null and operations are no-ops.
 */

let client = null;
let connecting = null;

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  // Use the official redis v4+ client (installed as dependency).
  // Lazy import so the module is safe to import even without Redis configured.
  // eslint-disable-next-line global-require
  const { createClient } = require("redis");

  const c = createClient({ url });

  c.on("error", (err) => {
    // Lazy import to avoid circular dependency.
    // eslint-disable-next-line global-require
    const { childLogger } = require("./logger.js");
    const l = childLogger("Redis");
    l.error({ err }, "[Redis] client error: %s", err.message);
  });

  c.on("connect", () => {
    // eslint-disable-next-line global-require
    const { childLogger } = require("./logger.js");
    const l = childLogger("Redis");
    l.info("[Redis] connected to %s", url);
  });

  return c;
}

/**
 * Get (or lazily create) the shared Redis client.
 * @returns {Object|null}
 */
function getRedisClient() {
  if (client) return client;

  client = createClient();
  if (!client) return null;

  // Store the promise so multiple callers don't race to connect.
  connecting = client.connect().then(() => {
    connecting = null;
    return client;
  }).catch((err) => {
    // eslint-disable-next-line global-require
    const { childLogger } = require("./logger.js");
    const l = childLogger("Redis");
    l.error({ err }, "[Redis] initial connection failed: %s", err.message);
    client = null;
    connecting = null;
    return null;
  });

  return client;
}

/**
 * Gracefully close the Redis connection on shutdown.
 * Called from the graceful shutdown handler in index.js.
 */
async function closeRedis() {
  if (client) {
    try {
      await client.quit();
    } catch (_) {
      // ignore
    }
    client = null;
  }
}

module.exports = {
  get redis() {
    return getRedisClient();
  },
  getRedisClient,
  closeRedis,
};
