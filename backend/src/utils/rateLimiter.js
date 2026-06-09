// Simple in-memory IP rate limiter for basic DDoS/abuse prevention
const rateLimitMap = new Map();

// Clean up old IP entries every 10 minutes to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
      const validTimestamps = timestamps.filter(
        (t) => now - t < 15 * 60 * 1000,
      ); // 15 minutes window max
      if (validTimestamps.length === 0) {
        rateLimitMap.delete(ip);
      } else {
        rateLimitMap.set(ip, validTimestamps);
      }
    }
  },
  10 * 60 * 1000,
);

/**
 * Express middleware for rate limiting
 * @param {number} limit - Maximum number of requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @param {string} errorMessage - Error message returned when limit is exceeded
 */
const rateLimiter = (
  limit,
  windowMs,
  errorMessage = "Too many requests. Please try again later.",
) => {
  return (req, res, next) => {
    // In production behind proxies like Nginx/Cloudflare, we want the real IP
    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }

    const timestamps = rateLimitMap.get(ip);
    // Filter timestamps to only keep those within the current window
    const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (recentTimestamps.length >= limit) {
      return res.status(429).json({
        success: false,
        error: errorMessage,
      });
    }

    recentTimestamps.push(now);
    rateLimitMap.set(ip, recentTimestamps);
    next();
  };
};

module.exports = rateLimiter;
