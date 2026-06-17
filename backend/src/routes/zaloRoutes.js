const express = require("express");
const router = express.Router();
const {
  handleWebhook,
  getGlobalBotSettings,
  updateGlobalBotSettings,
  triggerRemindNow,
} = require("../controllers/zaloBotController");

/**
 * Zalo Webhook endpoint
 * Zalo will POST to this endpoint when user interacts with the bot
 */
router.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("[ZaloRoutes] Webhook received:", JSON.stringify(event));

    // Respond immediately to Zalo (required within 3 seconds)
    res.status(200).json({ success: true });

    // Process the event asynchronously
    if (event) {
      await handleWebhook(event);
    }
  } catch (err) {
    console.error("[ZaloRoutes] Webhook error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Health check endpoint for Zalo verification
 */
router.get("/webhook", (req, res) => {
  res.status(200).json({ message: "Zalo webhook endpoint is active" });
});

// Admin / Web settings APIs
router.get("/config", getGlobalBotSettings);
router.post("/config", updateGlobalBotSettings);
router.post("/trigger", triggerRemindNow);

module.exports = router;
