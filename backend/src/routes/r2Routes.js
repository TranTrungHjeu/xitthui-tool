/**
 * Cloudflare R2 storage + upload routes.
 *
 * Endpoints:
 *   GET    /r2/storage/list?path=Year/Month/Day
 *   GET    /r2/storage/download?key=...&ttl=...
 *   POST   /r2/upload  (multipart, field "file")
 *   DELETE /r2/storage/object
 *   GET    /r2/storage/health
 *
 * All endpoints are PUBLIC — same rationale as the previous storage
 * layer: this is the team's shared storage, not per-user LMS data.
 * Rate-limiting is in front of these endpoints at the global
 * `rateLimiter` middleware.
 *
 * Response shape is `{ success, data, error }`.
 */

const express = require("express");
const multer = require("multer");

const r2Client = require("../services/r2Client");
const { childLogger } = require("../utils/logger.js");

const log = childLogger("R2Routes");

const router = express.Router();

// 5MB cap so we reject anything above the simple-PUT limit with a
// clean 413 before it touches the network. Larger files need
// chunked upload (see r2Client.getUploadUrl).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * GET /r2/storage/list?path=Year/Month/Day
 *
 * Lists folder + file children under a given R2 path (relative to
 * `R2_ROOT_PREFIX`). Empty/missing `path` → list root.
 */
router.get("/storage/list", async (req, res) => {
  try {
    const rawPath = (req.query.path || "").toString();
    const segments = rawPath
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);

    const { folders, files } = await r2Client.listChildren(segments);
    return res.json({ success: true, data: { folders, files } });
  } catch (err) {
    if (err?.name === "NoSuchBucket") {
      return res.status(503).json({
        success: false,
        code: "R2_BUCKET_MISSING",
        error:
          `R2 bucket "${r2Client.config().bucket}" không tồn tại. ` +
          "Kiểm tra R2_BUCKET trong .env.",
      });
    }
    if (err?.name === "AccessDenied" || err?.$metadata?.httpStatusCode === 403) {
      return res.status(503).json({
        success: false,
        code: "R2_ACCESS_DENIED",
        error:
          "R2 access denied. Kiểm tra R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY trong .env.",
      });
    }
    log.error("[r2Routes] list failed: %s", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal error",
    });
  }
});

/**
 * GET /r2/storage/download?key=...&ttl=...
 *
 * Returns a presigned GET URL the browser can use to download the
 * object directly from R2 (no proxy through the backend). `ttl` is
 * optional and defaults to R2_PRESIGNED_URL_TTL_SECONDS.
 *
 * We return the URL in the JSON body rather than 302-ing so the FE
 * has a chance to surface "this link expires in N minutes" in the
 * UI. The FE can also `window.location.href = url` for a direct
 * download flow.
 */
router.get("/storage/download", async (req, res) => {
  try {
    const key = (req.query.key || "").toString();
    if (!key) {
      return res.status(400).json({
        success: false,
        error: "key is required (query string)",
      });
    }
    const ttl = Number(req.query.ttl) || r2Client.config().presignedTtl;
    // Optional `filename` — when set, the generated URL carries a
    // Content-Disposition: attachment header so the browser triggers
    // a Save-As dialog (download flow) instead of in-browser preview.
    const filename = req.query.filename ? req.query.filename.toString() : null;
    const url = await r2Client.getDownloadUrl(key, ttl, filename);
    return res.json({
      success: true,
      data: { url, expiresIn: ttl },
    });
  } catch (err) {
    log.error("[r2Routes] download failed: %s", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal error",
    });
  }
});

/**
 * POST /r2/upload  (multipart "file")
 *
 * Accepts the same form fields as the previous upload route. Returns the
 * R2 object key + a presigned download URL the FE can hand to
 * `window.open()`.
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        error: "file is required (multipart field 'file')",
      });
    }

    const body = req.body || {};
    const { year, month, day, teacher, studentName } = body;

    if (!year || !month || !day || !teacher) {
      return res.status(400).json({
        success: false,
        error: "year, month, day, teacher are required (form fields)",
      });
    }
    if (!studentName || !String(studentName).trim()) {
      return res.status(400).json({
        success: false,
        error: "studentName is required",
      });
    }

    if (file.size > 4 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error:
          `File too large for simple upload (${file.size} bytes). ` +
          "Use the chunked upload endpoint or shrink the PDF.",
      });
    }

    const segments = r2Client.buildPathSegments({
      year,
      month,
      day,
      teacher,
    });

    const safeStudentName = String(studentName)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_");
    const fileName = `${safeStudentName}.pdf`;

    const uploaded = await r2Client.uploadFile({
      segments,
      fileName,
      fileBuffer: file.buffer,
      contentType: file.mimetype || "application/pdf",
    });

    const downloadUrl = await r2Client.getDownloadUrl(uploaded.key);

    return res.json({
      success: true,
      data: {
        id: uploaded.id,
        key: uploaded.key,
        name: uploaded.name,
        size: uploaded.size,
        contentType: uploaded.contentType,
        webViewLink: downloadUrl,
        parentPath: segments.join("/"),
        parentId: null,
      },
    });
  } catch (err) {
    if (err?.name === "AccessDenied" || err?.$metadata?.httpStatusCode === 403) {
      return res.status(503).json({
        success: false,
        code: "R2_ACCESS_DENIED",
        error:
          "R2 access denied. Kiểm tra R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY trong .env.",
      });
    }
    log.error("[r2Routes] upload failed: %s", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal error",
    });
  }
});

/**
 * DELETE /r2/storage/object
 * Body: { key: string }
 *
 * Hard-delete an object by key. Missing objects (404) are treated
 * as success so retries don't blow up.
 */
router.delete("/storage/object", async (req, res) => {
  try {
    const key = (req.body && req.body.key) || "";
    if (!key) {
      return res.status(400).json({
        success: false,
        error: "key is required (JSON body)",
      });
    }
    const result = await r2Client.deleteObject(key);
    return res.json({ success: true, data: result });
  } catch (err) {
    log.error("[r2Routes] delete failed: %s", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal error",
    });
  }
});

/**
 * GET /r2/storage/health
 *
 * Cheap "is R2 reachable + is the bucket accessible" probe. Used by
 * the FE to decide whether to show "R2 ready" / "R2 not configured"
 * indicators.
 */
router.get("/storage/health", async (req, res) => {
  const result = await r2Client.healthCheck();
  if (result.ok) {
    return res.json({
      success: true,
      data: { provider: "r2", bucket: result.bucket },
    });
  }
  return res.status(503).json({
    success: false,
    code: result.code || "R2_HEALTHCHECK_FAILED",
    error: result.error || "R2 unreachable",
    data: { provider: "r2", bucket: result.bucket },
  });
});

module.exports = router;