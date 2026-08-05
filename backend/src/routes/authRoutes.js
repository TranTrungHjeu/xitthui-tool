const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { createExpressRateLimiter } = require("../utils/rateLimiter");

// Limit login attempts: max 10 requests per 15 minutes
const loginLimiter = createExpressRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: "Too many login attempts. Please try again after 15 minutes.",
  keyPrefix: "login:",
});

router.post("/login", loginLimiter, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/test-token", authController.testToken);

// Dev-only quick login: client sends username only, server fills the password.
// Mounted only outside production so the route does not even exist in prod builds.
if (process.env.NODE_ENV !== "production") {
  router.post("/dev-login", loginLimiter, authController.devLogin);
}

module.exports = router;
