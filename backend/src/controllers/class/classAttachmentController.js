/**
 * Class Attachment Controller
 * Handles file download with SSRF protection.
 */

const { httpClient, log } = require("./_shared");
const path = require("path");
const fs = require("fs");
const os = require("os");

exports.downloadAttachment = async (req, res) => {
  try {
    let key = req.query.key || "";
    if (!key) return res.status(400).send("Parameter 'key' is required.");

    const SAFE_KEY_PATTERN = /^[a-zA-Z0-9._\/-]+$/;
    if (!SAFE_KEY_PATTERN.test(key)) {
      log.warn(`[Controller] downloadAttachment: Invalid key pattern rejected: "${key}"`);
      return res.status(400).send("Invalid key format.");
    }

    key = key.replace(/\.\./g, "").replace(/[<>'"`;]/g, "");

    if (key.startsWith("http://") || key.startsWith("https://")) {
      try {
        const urlObj = new URL(key);
        key = urlObj.pathname;
      } catch (_) {
        // use key as is
      }
    }

    if (key.startsWith("/")) {
      key = key.substring(1);
    }

    if (key.startsWith("uploads/")) {
      // Local file
      const localPath = path.join(process.cwd(), key);
      if (!fs.existsSync(localPath)) return res.status(404).send("File not found.");
      return res.download(localPath);
    }

    // Proxy external URL through backend to prevent SSRF from client
    log.info(`[Controller] Proxying attachment download: ${key}`);
    const response = await httpClient.get(key, {
      responseType: "stream",
      timeout: 30_000,
      maxContentLength: 100 * 1024 * 1024, // 100MB
    });

    const contentDisposition = response.headers?.["content-disposition"];
    const contentType = response.headers?.["content-type"] || "application/octet-stream";
    res.set("Content-Type", contentType);
    if (contentDisposition) res.set("Content-Disposition", contentDisposition);

    response.data.pipe(res);
  } catch (err) {
    log.error("[Controller] downloadAttachment failed:", err.message);
    res.status(500).send("Download failed.");
  }
};
