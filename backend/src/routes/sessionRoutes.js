const express = require("express");
const { childLogger } = require("../utils/logger.js");
const log = childLogger("SessionRoutes");
const {
  rotateKey,
  isValidKey,
} = require("../utils/apiKeyManager");

const router = express.Router();
const { Session } = require("../storage/mongoModels");
const {
  createInMemoryRateLimiter,
} = require("../utils/rateLimiter");

// In-memory rate limiter for /sessions (5 req/min)
const sessionsRateLimiter = createInMemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: "sessions:",
});

function auditLog(action, details) {
  log.info({ action, ...details }, "[AuditLog] %s", JSON.stringify({ action, ...details }));
}

router.get("/sessions", async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown";

  const rateLimit = await sessionsRateLimiter.check(clientIp);
  if (!rateLimit.allowed) {
    auditLog("RATE_LIMITED", { ip: clientIp, endpoint: "/sessions" });
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter: rateLimit.retryAfter,
    });
  }

  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!apiKey) {
    auditLog("ACCESS_DENIED", { ip: clientIp, reason: "MISSING_API_KEY" });
    return res.status(401).json({
      success: false,
      error: "Missing API key. Provide X-Api-Key header or apiKey query param.",
    });
  }

  const valid = await isValidKey(apiKey);
  if (!valid) {
    auditLog("ACCESS_DENIED", { ip: clientIp, reason: "INVALID_API_KEY" });
    return res.status(403).json({
      success: false,
      error: "Access denied. Invalid API key.",
    });
  }

  auditLog("ACCESS_GRANTED", { ip: clientIp, endpoint: "/sessions" });

  try {
    const sessions = await Session.find({ isValid: true })
      .select("userId teacherId roles createdAt")
      .lean();

    const sanitized = sessions.reduce((acc, s) => {
      acc[s._id] = {
        userId: s.userId,
        teacherId: s.teacherId || null,
        roles: s.roles || [],
        createdAt: s.createdAt,
      };
      return acc;
    }, {});

    auditLog("FETCH_SUCCESS", { ip: clientIp, sessionCount: sessions.length });

    res.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    res.json({ success: true, data: sanitized });
  } catch (err) {
    log.error("[SessionRoutes] Failed to fetch sessions:", err.message);
    auditLog("FETCH_ERROR", { ip: clientIp, error: err.message });
    res.status(500).json({ success: false, error: "Failed to fetch sessions" });
  }
});

/**
 * POST /sessions/rotate
 * Issues a new rotated API key. Old key remains valid for the grace period.
 * Requires valid auth with the current key.
 */
router.post("/sessions/rotate", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "Missing API key.",
    });
  }

  const valid = await isValidKey(apiKey);
  if (!valid) {
    auditLog("ROTATE_DENIED", { reason: "INVALID_API_KEY" });
    return res.status(403).json({
      success: false,
      error: "Invalid API key. Cannot rotate.",
    });
  }

  try {
    const { key, expiresInSec } = await rotateKey();
    auditLog("KEY_ROTATED", { expiresInSec });
    log.info(`[SessionRoutes] API key rotated, expires in ${expiresInSec}s.`);

    res.json({
      success: true,
      newApiKey: key,
      expiresInSec,
      message:
        "New API key generated. Use it for future requests. " +
        "The previous key remains valid during the grace period.",
    });
  } catch (err) {
    log.error("[SessionRoutes] Key rotation failed:", err.message);
    res.status(500).json({ success: false, error: "Failed to rotate key" });
  }
});

module.exports = router;
