const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const rateLimiter = require("../utils/rateLimiter");

// Limit login attempts: max 10 requests per 15 minutes
const loginLimiter = rateLimiter(
  10,
  15 * 60 * 1000,
  "Too many login attempts. Please try again after 15 minutes.",
);

router.post("/login", loginLimiter, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/test-token", authController.testToken);

module.exports = router;
