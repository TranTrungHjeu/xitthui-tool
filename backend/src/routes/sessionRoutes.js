const express = require("express");
const router = express.Router();
const UserSessionManager = require("../storage/userSession");

router.get("/sessions", (req, res) => {
  const expectedKey = process.env.INTERNAL_API_KEY;
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!expectedKey) {
    return res.status(403).json({
      success: false,
      error:
        "Access denied. Sessions endpoint is disabled (INTERNAL_API_KEY not configured).",
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      error: "Access denied. Invalid or missing API key.",
    });
  }

  const sessions = UserSessionManager.getAllSessions();
  const sanitized = {};
  for (const [id, s] of Object.entries(sessions)) {
    sanitized[id] = {
      lmsUserId: s.lmsUserId,
      createdAt: s.createdAt,
      tokenPreview: s.token ? s.token.substring(0, 20) + "..." : "N/A",
    };
  }
  res.json({ success: true, data: sanitized });
});

module.exports = router;
