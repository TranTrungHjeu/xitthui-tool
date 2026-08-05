const { httpClient } = require("../utils/httpClient");

const ZALO_BOT_API_BASE = "https://bot-api.zaloplatforms.com";

/**
 * Minimal Zalo Bot API client.
 *
 * Original implementation used for the Zalo Bot scheduler (webhook + polling)
 * was removed during the logging refactor (commit 97553d8). This client only
 * covers the *outgoing* path needed by the /zalo-bot page (send text + cache
 * preview).
 */
class ZaloBotClient {
  constructor() {
    this.token = process.env.ZALO_BOT_TOKEN || "";
    if (this.token) {
      this.baseUrl = `${ZALO_BOT_API_BASE}/bot${this.token}`;
    } else {
      this.baseUrl = null;
    }
  }

  isConfigured() {
    return Boolean(this.token && this.baseUrl);
  }

  /**
   * Send a text message to a chat ID via Zalo Bot API.
   * Returns { ok, raw } where raw is the upstream response payload
   * (or { ok:false, error } when the call fails).
   */
  async sendText(chatId, text) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error:
          "ZALO_BOT_TOKEN chưa được cấu hình trên server. Vui lòng liên hệ admin.",
        code: "EZALONOTCONFIGURED",
      };
    }
    if (!chatId || typeof chatId !== "string") {
      return { ok: false, error: "chatId is required", code: "EZALOARG" };
    }
    if (!text || typeof text !== "string") {
      return { ok: false, error: "text is required", code: "EZALOARG" };
    }

    try {
      const res = await httpClient.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
      });

      if (res.status >= 200 && res.status < 300) {
        return { ok: true, raw: res.data };
      }
      return {
        ok: false,
        error:
          (res.data && (res.data.description || res.data.error || res.data)) ||
          `Zalo API error (${res.status})`,
        code: "EZALOREMOTE",
        status: res.status,
        raw: res.data,
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || "Zalo send failed",
        code: "EZALONETWORK",
      };
    }
  }
}

module.exports = new ZaloBotClient();
