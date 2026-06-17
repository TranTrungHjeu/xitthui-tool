const axios = require("axios");

// Zalo Bot API Base (bot-api.zaloplatforms.com)
const ZALO_BOT_API_BASE = "https://bot-api.zaloplatforms.com";
const ZALO_BOT_TOKEN = process.env.ZALO_BOT_TOKEN;

class ZaloClient {
  constructor() {
    this.token = ZALO_BOT_TOKEN;
    // URL format: /bot{token}/{method}
    this.baseUrl = `${ZALO_BOT_API_BASE}/bot${this.token}`;
  }

  /**
   * Xóa Webhook để getUpdates hoạt động
   */
  async deleteWebhook() {
    try {
      const res = await axios.post(`${this.baseUrl}/deleteWebhook`);
      return res.data;
    } catch (err) {
      console.log(
        "[ZaloClient] deleteWebhook failed or not supported:",
        err.message,
      );
      return null;
    }
  }

  /**
   * Get updates using polling
   */
  async getUpdates(offset = 0) {
    try {
      // Must use POST for getUpdates per documentation
      const res = await axios.post(`${this.baseUrl}/getUpdates`, {
        offset,
        timeout: 30,
      });
      return res.data;
    } catch (err) {
      console.error("[ZaloClient] getUpdates failed:", err.message);
      return null;
    }
  }

  /**
   * Send text message to user
   */
  async sendText(chatId, text) {
    try {
      const res = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
      });
      return res.data;
    } catch (err) {
      console.error("[ZaloClient] sendMessage failed:", err.message);
      return null;
    }
  }

  /**
   * Send message with keyboard (if supported by Zalo Bot API)
   */
  async sendWithKeyboard(chatId, text, buttons) {
    try {
      // Zalo Bot API usually supports reply_markup similar to Telegram
      const res = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
        reply_markup: {
          keyboard: buttons,
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      return res.data;
    } catch (err) {
      return this.sendText(chatId, text + "\n\n" + buttons.flat().join(", "));
    }
  }
}

module.exports = new ZaloClient();
