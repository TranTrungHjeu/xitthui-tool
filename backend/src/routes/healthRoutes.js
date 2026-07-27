/**
 * Health & Readiness endpoints.
 *
 * - `/health`  : liveness probe. Always returns 200 once the process is up.
 *                Used by load balancers / container orchestrators to decide
 *                whether to route traffic.
 *
 * - `/ready`   : readiness probe. Pings MongoDB and (when configured) Redis.
 *                Returns 503 with a body explaining which dependency is down.
 *                Used to take the instance OUT of rotation while it boots,
 *                or while a critical dependency is unavailable.
 *
 * Both endpoints are exempt from authentication, CSRF and rate limiting.
 */

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

let redisClientRef = null;
function getRedisClient() {
  if (redisClientRef) return redisClientRef;
  try {
    // Lazy require so the health module is safe to load even if ioredis is
    // not yet installed (Item 5 lands separately).
    // eslint-disable-next-line global-require
    const { redis } = require("./redisClient");
    redisClientRef = redis;
    return redisClientRef;
  } catch (err) {
    return null;
  }
}

/**
 * Liveness: 200 once the Node process can answer HTTP.
 */
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness: 200 only when critical dependencies are reachable.
 */
router.get("/ready", async (_req, res) => {
  const checks = {};
  let allOk = true;

  // MongoDB
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        `mongoose readyState=${mongoose.connection.readyState} (expected 1)`,
      );
    }
    await mongoose.connection.db.admin().ping();
    checks.mongo = { ok: true };
  } catch (err) {
    allOk = false;
    checks.mongo = { ok: false, error: err.message };
  }

  // Redis (optional). Only fails readiness if a client is configured AND down.
  const redis = getRedisClient();
  if (redis) {
    try {
      const pong = await redis.ping();
      checks.redis = { ok: pong === "PONG" };
      if (!checks.redis.ok) allOk = false;
    } catch (err) {
      checks.redis = { ok: false, error: err.message };
      allOk = false;
    }
  } else {
    checks.redis = { ok: null, note: "not configured" };
  }

  if (allOk) {
    return res.status(200).json({
      status: "ready",
      uptime: process.uptime(),
      checks,
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(503).json({
    status: "not_ready",
    uptime: process.uptime(),
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
