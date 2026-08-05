/**
 * LMS Routes
 *
 * Public endpoints that power the `/lms` page on the frontend.
 * No session is required — callers can pass a token directly in the
 * request body, via the Authorization header, or via a sessionId that
 * the controller uses to look up the user's stored LMS token.
 *
 * The legacy `trialReportAuth.attachSession` is intentionally NOT used
 * here to keep the page truly public (per the agreed scope).
 */

const express = require("express");
const router = express.Router();

const {
  generateComment,
  syncClass,
  getClasses,
  getCommentHistory,
  getCriteria,
  saveCriteria,
  chatEndpoint,
} = require("../controllers/lmsController");

router.post("/generate-comment", generateComment);
router.post("/sync-class", syncClass);
router.get("/classes", getClasses);
router.get("/comment-history", getCommentHistory);
router.get("/criteria", getCriteria);
router.post("/save-criteria", saveCriteria);
router.post("/chat", chatEndpoint);

module.exports = router;
