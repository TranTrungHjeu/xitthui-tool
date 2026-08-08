const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { createExpressRateLimiter } = require("../utils/rateLimiter");
const { getMe } = require("../controllers/meController");

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
router.get("/me", getMe);

module.exports = router;
