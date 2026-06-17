const zaloClient = require("./zaloClient");
const { handleWebhook } = require("../controllers/zaloBotController");

let isRunning = false;
let currentOffset = 0;

async function pollLoop() {
  while (isRunning) {
    try {
      const result = await zaloClient.getUpdates(currentOffset);

      // Log raw result from Zalo to understand its structure
      if (result) {
        const resultStr = JSON.stringify(result);
        // Only log if it's not an empty array and NOT a 408 timeout (expected behavior when idle)
        if (
          !resultStr.includes('"result":[]') &&
          !resultStr.includes('"data":[]') &&
          !resultStr.includes('"error_code":408') &&
          resultStr.length > 20
        ) {
          console.log("[ZaloPolling] Raw getUpdates result:", resultStr);
        }
      }

      // Zalo might return result.result as an Object (single update) instead of an Array.
      // Or it might return result.data as an Array.
      let updates = [];
      if (Array.isArray(result?.result)) {
        updates = result.result;
      } else if (result?.result && typeof result.result === "object") {
        updates = [result.result];
      } else if (Array.isArray(result?.data)) {
        updates = result.data;
      } else if (result?.data && typeof result.data === "object") {
        updates = [result.data];
      }

      if (updates.length > 0) {
        for (const update of updates) {
          console.log("[ZaloPolling] Received update:", JSON.stringify(update));

          // Extract message info from Zalo Bot API format
          // Handle both Telegram-like structure and Zalo Webhook-like structure
          const senderId =
            update.sender?.id ||
            update.message?.chat?.id ||
            update.chat?.id ||
            update.from?.id;

          const msgText = update.message?.text || update.text || "";

          const eventName =
            update.event_name ||
            (update.message ? "user_send_text" : "unknown");

          const event = {
            name: eventName,
            data: {
              from: senderId,
              message: {
                text: msgText,
              },
            },
            from: senderId,
            message: {
              text: msgText,
            },
          };

          try {
            await handleWebhook(event);
          } catch (err) {
            console.error("[ZaloPolling] Error handling update:", err.message);
          }

          // Update offset to acknowledge this update
          if (update.update_id) {
            currentOffset = update.update_id + 1;
          }
        }
      }
    } catch (err) {
      console.error("[ZaloPolling] Poll error:", err.message);
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function startPolling() {
  if (isRunning) {
    console.log("[ZaloPolling] Already running.");
    return;
  }

  if (!process.env.ZALO_BOT_TOKEN) {
    console.warn("[ZaloPolling] ZALO_BOT_TOKEN not set. Skipping Zalo bot.");
    return;
  }

  // Delete webhook first to allow getUpdates to work
  console.log(
    "[ZaloPolling] Attempting to delete webhook to enable getUpdates...",
  );
  await zaloClient.deleteWebhook();

  isRunning = true;
  console.log("[ZaloPolling] Started polling for Zalo Bot updates...");
  pollLoop();
}

function stopPolling() {
  isRunning = false;
  console.log("[ZaloPolling] Stopped polling.");
}

module.exports = { startPolling, stopPolling };
