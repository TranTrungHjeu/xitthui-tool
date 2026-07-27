const express = require("express");
const { childLogger } = require("../utils/logger.js");
const log = childLogger("SessionRoutes");

const router = express.Router();
const { Session } = require("../storage/mongoModels");
const {
  createInMemoryRateLimiter,
} = require("../utils/rateLimiter");

// In-memory rate limiter for /sessions (5 req/min)
// Note: For production with multiple instances, use createRateLimiter()
// which supports Redis-based distributed rate limiting via REDIS_URL.
const sessionsRateLimiter = createInMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyPrefix: "sessions:",
});

function auditLog(action, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  log.info(`[AuditLog] ${JSON.stringify(entry)}`);
}

router.get("/sessions", async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown";

  // Rate limiting check (5 req/min per IP)
  const rateLimit = await sessionsRateLimiter.check(clientIp);
  if (!rateLimit.allowed) {
    auditLog("RATE_LIMITED", { ip: clientIp, endpoint: "/sessions" });
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter: rateLimit.retryAfter,
    });
  }

  const expectedKey = process.env.INTERNAL_API_KEY;
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!expectedKey) {
    auditLog("ACCESS_DENIED", { ip: clientIp, reason: "INTERNAL_API_KEY_NOT_CONFIGURED" });
    return res.status(403).json({
      success: false,
      error:
        "Access denied. Sessions endpoint is disabled (INTERNAL_API_KEY not configured).",
    });
  }

  if (apiKey !== expectedKey) {
    auditLog("ACCESS_DENIED", { ip: clientIp, reason: "INVALID_API_KEY" });
    return res.status(403).json({
      success: false,
      error: "Access denied. Invalid or missing API key.",
    });
  }

  auditLog("ACCESS_GRANTED", { ip: clientIp, endpoint: "/sessions" });

  try {
    // Get sessions from MongoDB
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

module.exports = router;
