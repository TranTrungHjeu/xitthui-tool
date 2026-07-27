const { childLogger } = require("./logger.js");
const log = childLogger("RateLimiter");

/**
 * Rate Limiter Utility
 *
 * Provides a rate limiter that uses Redis if available (REDIS_URL),
 * otherwise falls back to in-memory rate limiting with appropriate
 * warning logs.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60000, max: 5 });
 *   const result = limiter.check('client-ip');
 *   if (!result.allowed) return res.status(429).json({...});
 */

let redisClient = null;
let redisAvailable = false;

/**
 * Try to load and connect to Redis
 * @returns {Promise<boolean>} - True if Redis is available
 */
async function tryConnectRedis() {
  if (redisClient !== null) {
    return redisAvailable;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.info("[RateLimiter] No REDIS_URL configured. Using in-memory rate limiting.");
    redisClient = false; // Mark as checked
    redisAvailable = false;
    return false;
  }

  try {
    // Lazy-load redis to avoid hard dependency
    const { createClient } = require("redis");
    redisClient = createClient({ url: redisUrl });

    redisClient.on("error", (err) => {
      log.error("[RateLimiter] Redis client error:", err.message);
    });

    await redisClient.connect();
    redisAvailable = true;
    log.info("[RateLimiter] ✅ Redis connected for distributed rate limiting");
    return true;
  } catch (err) {
    log.warn(
      `[RateLimiter] Failed to connect to Redis (${err.message}). Falling back to in-memory rate limiting.`,
    );
    redisClient = false;
    redisAvailable = false;
    return false;
  }
}

/**
 * In-memory rate limiter (fallback)
 */
class InMemoryRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.max = options.max || 5;
    this.keyPrefix = options.keyPrefix || "rl:";
    this.map = new Map();

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => this._cleanup(), this.windowMs * 2);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async check(key) {
    const fullKey = `${this.keyPrefix}${key}`;
    const now = Date.now();
    const record = this.map.get(fullKey);

    if (!record || now - record.windowStart > this.windowMs) {
      this.map.set(fullKey, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.max - 1,
        retryAfter: 0,
      };
    }

    if (record.count >= this.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((this.windowMs - (now - record.windowStart)) / 1000),
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: this.max - record.count,
      retryAfter: 0,
    };
  }

  async reset(key) {
    this.map.delete(`${this.keyPrefix}${key}`);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, record] of this.map.entries()) {
      if (now - record.windowStart > this.windowMs * 2) {
        this.map.delete(key);
      }
    }
  }

  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Redis-based rate limiter using fixed window counter
 */
class RedisRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.max = options.max || 5;
    this.keyPrefix = options.keyPrefix || "rl:";
  }

  async check(key) {
    const fullKey = `${this.keyPrefix}${key}`;
    const windowSec = Math.ceil(this.windowMs / 1000);

    try {
      const multi = redisClient.multi();
      multi.incr(fullKey);
      multi.ttl(fullKey);
      const [count, ttl] = await multi.exec();

      // If key is new (no TTL), set expiry
      if (ttl === -1) {
        await redisClient.expire(fullKey, windowSec);
      }

      const countNum = parseInt(count, 10);
      if (countNum > this.max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: ttl > 0 ? ttl : windowSec,
        };
      }

      return {
        allowed: true,
        remaining: this.max - countNum,
        retryAfter: 0,
      };
    } catch (err) {
      log.error(`[RateLimiter] Redis error during check: ${err.message}. Allowing request.`);
      // Fail open - allow request on Redis error
      return { allowed: true, remaining: this.max, retryAfter: 0, error: true };
    }
  }

  async reset(key) {
    try {
      await redisClient.del(`${this.keyPrefix}${key}`);
    } catch (err) {
      log.warn(`[RateLimiter] Failed to reset key ${key}:`, err.message);
    }
  }

  close() {
    // Don't close the shared Redis connection
  }
}

/**
 * Factory function to create a rate limiter
 * Tries Redis first, falls back to in-memory
 * @param {Object} options
 * @returns {Promise<Object>} - Rate limiter instance
 */
async function createRateLimiter(options = {}) {
  const redisReady = await tryConnectRedis();

  if (redisReady) {
    log.info(
      `[RateLimiter] Using distributed (Redis) rate limiter: windowMs=${options.windowMs || 60000}, max=${options.max || 5}`,
    );
    return new RedisRateLimiter(options);
  }

  log.info(
    `[RateLimiter] Using in-memory rate limiter (NOT distributed across multiple instances): windowMs=${options.windowMs || 60000}, max=${options.max || 5}`,
  );
  return new InMemoryRateLimiter(options);
}

/**
 * Synchronous factory - uses in-memory only (for backward compatibility)
 * @param {Object} options
 * @returns {Object}
 */
function createInMemoryRateLimiter(options = {}) {
  return new InMemoryRateLimiter(options);
}

module.exports = {
  createRateLimiter,
  createInMemoryRateLimiter,
  InMemoryRateLimiter,
  RedisRateLimiter,
  tryConnectRedis,
  isRedisAvailable: () => redisAvailable,
};