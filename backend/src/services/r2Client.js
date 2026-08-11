/**
 * Cloudflare R2 storage client.
 *
 * Why R2:
 *   - Server-credential auth (no per-user OAuth, no consent flow).
 *   - 10 GB/month free tier with **zero egress bandwidth fees**
 *     (trial-report PDFs are downloaded more than uploaded).
 *   - S3-compatible API, so we use the official AWS SDK.
 *
 * Folder hierarchy mirrors the previous OneDrive layout so the FE can
 * swap providers without restructuring UI:
 *   {R2_ROOT_PREFIX} / {year} / {month-year} / {day} / {teacher} / {file.pdf}
 *
 * Files are stored with their original filename + a short id prefix
 * (`{ulid}__{originalName}`) so two teachers with the same filename
 * don't collide.
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

const { childLogger } = require("../utils/logger.js");

const log = childLogger("R2Client");

// --- Config ---------------------------------------------------------------

function readEnv(name, { required = false, fallback = null } = {}) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    if (required) {
      throw new Error(
        `[r2Client] Missing required env var: ${name}. ` +
          "Set it in .env to enable R2 storage.",
      );
    }
    return fallback;
  }
  return raw.trim();
}

function loadR2Config() {
  const accountId = readEnv("R2_ACCOUNT_ID", { required: true });
  const accessKeyId = readEnv("R2_ACCESS_KEY_ID", { required: true });
  const secretAccessKey = readEnv("R2_SECRET_ACCESS_KEY", { required: true });
  const endpoint = readEnv("R2_ENDPOINT", {
    fallback: `https://${accountId}.r2.cloudflarestorage.com`,
  });
  const bucket = readEnv("R2_BUCKET", { required: true });
  const rootPrefix = readEnv("R2_ROOT_PREFIX", { fallback: "trial-reports/" });
  const presignedTtl = Number(readEnv("R2_PRESIGNED_URL_TTL_SECONDS", {
    fallback: "3600",
  }));
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket,
    rootPrefix: rootPrefix.endsWith("/") ? rootPrefix : `${rootPrefix}/`,
    presignedTtl,
  };
}

let cachedConfig = null;
function config() {
  if (!cachedConfig) cachedConfig = loadR2Config();
  return cachedConfig;
}

// --- S3 client singleton --------------------------------------------------

let cachedClient = null;
function client() {
  if (cachedClient) return cachedClient;
  const cfg = config();
  cachedClient = new S3Client({
    region: "auto", // R2 requires "auto" but ignores region
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: false, // R2 supports virtual-hosted-style
  });
  return cachedClient;
}

// --- Path helpers ---------------------------------------------------------

/**
 * Build the S3 object key from hierarchical segments.
 *   buildKey("2026", "2026-08", "9", "Nguyễn Văn A", "report.pdf")
 *   → "trial-reports/2026/2026-08/9/Nguyễn Văn A/report.pdf"
 */
function buildKey(segments) {
  const cleaned = (segments || [])
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0)
    // S3 keys may contain any UTF-8; we just strip the path separator.
    .map((s) => s.replace(/\//g, "_"));
  return `${config().rootPrefix}${cleaned.join("/")}`;
}

/**
 * Build the year/month/day/teacher segments matching the previously
 * used OneDrive folder hierarchy so the FE doesn't need to know
 * which backend is in use.
 */
function buildPathSegments({ year, month, day, teacher }) {
  if (!year || !month || !day || !teacher) {
    throw new Error(
      `[r2Client] buildPathSegments: missing one of year/month/day/teacher ` +
        `(got ${year}/${month}/${day}/${teacher})`,
    );
  }
  return [
    String(year),
    `${month}-${year}`,
    String(day),
    String(teacher),
  ];
}

/**
 * Strip the root prefix from a key for friendlier display.
 */
function prettifyKey(key) {
  const cfg = config();
  if (key.startsWith(cfg.rootPrefix)) {
    return key.slice(cfg.rootPrefix.length);
  }
  return key;
}

// --- Object operations ----------------------------------------------------

/**
 * Upload a buffer to the given segments + filename. Generates a unique
 * storage key (ulid prefix) so identical filenames in the same folder
 * don't collide; returns both the storageKey and the original filename
 * for the caller to persist in metadata.
 *
 * @param {object} opts
 * @param {string[]} opts.segments - e.g. ["2026", "2026-08", "9", "Teacher A"]
 * @param {string} opts.fileName - original filename (e.g. "phieu.pdf")
 * @param {Buffer} opts.fileBuffer
 * @param {string} [opts.contentType]
 * @returns {Promise<{ id, key, name, size, contentType }>}
 */
async function uploadFile({ segments, fileName, fileBuffer, contentType }) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new Error("[r2Client] uploadFile requires a Buffer");
  }
  if (typeof fileName !== "string" || !fileName.trim()) {
    throw new Error("[r2Client] uploadFile requires fileName");
  }
  const cleanedName = fileName.trim().replace(/\//g, "_");
  const objectId = uuidv4();
  // uuid__filename — uuid is collision-resistant, the double
  // underscore is a safe separator (filenames may not contain "/"
  // but underscores are common; we strip them from the original
  // name to avoid ambiguity).
  const safeName = cleanedName.replace(/_/g, "-");
  const storageKey = `${buildKey([...segments, `${objectId}__${safeName}`])}`;

  const ct = contentType || "application/octet-stream";
  // R2/S3 only accepts ASCII in HTTP headers, so any non-ASCII user
  // input (e.g. Vietnamese names) must be URL-encoded before being
  // placed in `Metadata`. We percent-encode to preserve the original
  // string losslessly; the FE can decode it via `decodeURIComponent`
  // when it needs to show the original name.
  const safeMetadata = {
    "original-name": encodeURIComponent(cleanedName),
    "uploaded-at": new Date().toISOString(),
  };
  await client().send(
    new PutObjectCommand({
      Bucket: config().bucket,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: ct,
      Metadata: safeMetadata,
    }),
  );

  log.info(
    "[r2Client] uploaded %s (%d bytes, key=%s)",
    cleanedName,
    fileBuffer.length,
    storageKey,
  );

  return {
    id: objectId,
    key: storageKey,
    name: cleanedName,
    size: fileBuffer.length,
    contentType: ct,
  };
}

/**
 * Generate a presigned GET URL for a private object. Defaults to a 1h
 * expiry so admins/teachers can preview the file inline.
 *
 * @param {string} key
 * @param {number} [ttlSeconds]
 * @returns {Promise<string>}
 */
async function getDownloadUrl(key, ttlSeconds, downloadFilename) {
  if (!key) throw new Error("[r2Client] getDownloadUrl requires key");
  const ttl = ttlSeconds || config().presignedTtl;
  const params = { Bucket: config().bucket, Key: key };
  // If the caller wants the browser to download instead of preview,
  // add a Content-Disposition header so R2 tells the browser to
  // trigger a save-as dialog with the given filename.
  if (downloadFilename) {
    // RFC 5987 encoding so non-ASCII filenames (e.g. Vietnamese) work
    const encoded = encodeURIComponent(downloadFilename);
    params.ResponseContentDisposition = `attachment; filename*=UTF-8''${encoded}`;
  }
  return getSignedUrl(
    client(),
    new GetObjectCommand(params),
    { expiresIn: ttl },
  );
}

/**
 * Hard-delete an object (now only used by trial-report approval flow).
 * Missing objects (404) are treated as success so retries don't blow up.
 *
 * @param {string} key
 */
async function deleteObject(key) {
  if (!key) throw new Error("[r2Client] deleteObject requires key");
  try {
    await client().send(
      new DeleteObjectCommand({ Bucket: config().bucket, Key: key }),
    );
    log.info("[r2Client] deleted object key=%s", key);
    return { deleted: true };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") {
      log.warn(
        "[r2Client] deleteObject: key %s already gone, treating as success",
        key,
      );
      return { deleted: true, alreadyMissing: true };
    }
    throw err;
  }
}

/**
 * Check whether an object exists.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function objectExists(key) {
  try {
    await client().send(
      new HeadObjectCommand({ Bucket: config().bucket, Key: key }),
    );
    return true;
  } catch (err) {
    if (
      err?.$metadata?.httpStatusCode === 404 ||
      err?.name === "NotFound"
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * List immediate children of a "folder" (S3 has no real folders — we
 * emulate them via a key prefix ending in "/"). Returns a flat list
 * with `isFolder` derived from whether the key ends with "/".
 *
 * NOTE: S3 list semantics — when `Prefix` is `X` (no trailing slash)
 * and `Delimiter='/'`, S3 returns X as a *common prefix* (i.e. treats
 * X itself as a "folder") and skips files nested under X. That's the
 * opposite of what we want. We append a trailing slash so the API
 * returns the files directly under X/ and uses CommonPrefixes for
 * any nested folders.
 *
 * @param {string[]} segments - path segments relative to rootPrefix
 * @returns {Promise<{ folders: object[], files: object[] }>}
 */
async function listChildren(segments = []) {
  const cfg = config();
  const prefix = buildKey(segments);
  // S3 list is "the prefix IS the folder" — trailing slash tells the
  // service to list files nested under it instead of treating the
  // prefix itself as a folder.
  const listPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const out = await client().send(
    new ListObjectsV2Command({
      Bucket: cfg.bucket,
      Prefix: listPrefix,
      Delimiter: "/",
      MaxKeys: 1000,
    }),
  );

  const folders = (out.CommonPrefixes || [])
    .map((p) => p.Prefix)
    .filter(Boolean)
    // CommonPrefixes always ends with "/" — strip it for the caller.
    // Strip the root prefix so the caller gets a relative path (e.g.
    // "2025") instead of the full S3 key (e.g. "trial-reports/2025").
    // The caller will use this as `path` when navigating into the folder.
    .map((p) => p.slice(0, -1))
    .map((p) => {
      const name = prettifyKey(p);
      return {
        id: p,
        // Relative path for the caller to use as `path` in listChildren.
        // Strip root prefix so the FE doesn't double-prefix when re-calling.
        path: p.startsWith(cfg.rootPrefix)
          ? p.slice(cfg.rootPrefix.length)
          : p,
        name: name.split("/").pop(),
        // S3 doesn't tell us childCount from a delimiter listing, so
        // report null and let the FE render "Folder" without a count.
        childCount: null,
      };
    });

  const files = (out.Contents || [])
    .filter((o) => o.Key !== prefix) // skip the folder placeholder itself
    .map((o) => {
      const key = o.Key;
      const fullName = prettifyKey(key).split("/").pop();
      // Strip the ulid__ prefix that uploadFile adds.
      const dashIdx = fullName.indexOf("__");
      const displayName =
        dashIdx >= 0 ? fullName.slice(dashIdx + 2) : fullName;
      return {
        id: key,
        key,
        name: displayName,
        size: typeof o.Size === "number" ? o.Size : null,
        lastModified: o.LastModified
          ? new Date(o.LastModified).toISOString()
          : null,
        etag: o.ETag || null,
        // S3 doesn't expose mime type from a list call — we record
        // it in metadata at upload time. The FE can probe via a HEAD
        // when it actually needs the content type.
        mimeType: null,
      };
    });

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { folders, files };
}

/**
 * Flat-list every key under a given prefix (no delimiter). Useful for
 * one-off scripts like the orphan-reconciler / backfill that need to
 * scan the entire tree, not just one level.
 *
 * Skips folder placeholders (zero-byte objects whose key ends with "/").
 * Pagination handled internally — callers get a flat array.
 *
 * @param {string} [prefix] - defaults to the configured rootPrefix
 * @returns {Promise<Array<{key, size, lastModified, etag}>>}
 */
async function listAllKeys(prefix) {
  const cfg = config();
  const listPrefix =
    prefix !== undefined && prefix !== null ? prefix : cfg.rootPrefix;
  const all = [];
  let token = undefined;
  do {
    const out = await client().send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: listPrefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const obj of out.Contents || []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      all.push({
        key: obj.Key,
        size: typeof obj.Size === "number" ? obj.Size : null,
        lastModified: obj.LastModified ? new Date(obj.LastModified) : null,
        etag: obj.ETag || null,
      });
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return all;
}

/**
 * Generate a presigned PUT URL so the browser can upload directly to
 * R2 without proxying through the backend. Useful for large files
 * (>=5MB) that exceed the simple-PUT limit.
 *
 * NOTE: not wired into the current routes — exposed for a future
 * "chunked upload" feature. We keep it because the helper is small
 * and the alternative is to hand-roll a presigner.
 *
 * @param {string} key
 * @param {string} contentType
 * @param {number} [ttlSeconds]
 * @returns {Promise<string>}
 */
async function getUploadUrl(key, contentType, ttlSeconds) {
  if (!key) throw new Error("[r2Client] getUploadUrl requires key");
  const ttl = ttlSeconds || config().presignedTtl;
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: config().bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    }),
    { expiresIn: ttl },
  );
}

// --- Status / health ------------------------------------------------------

/**
 * Cheap "is R2 wired up" probe used by `/storage/status`. We list with
 * a max-keys=1 instead of a HEAD on the bucket so we get a clear
 * error (NoSuchBucket / AccessDenied / network) without having to
 * special-case the bucket-not-found response.
 */
async function healthCheck() {
  try {
    await client().send(
      new ListObjectsV2Command({
        Bucket: config().bucket,
        MaxKeys: 1,
      }),
    );
    return { ok: true, bucket: config().bucket };
  } catch (err) {
    log.error("[r2Client] health check failed: %s", err.message);
    return {
      ok: false,
      bucket: config().bucket,
      error: err.message,
      code: err?.name || "R2_HEALTHCHECK_FAILED",
    };
  }
}

module.exports = {
  // config
  loadR2Config,
  config,
  // path helpers
  buildKey,
  buildPathSegments,
  prettifyKey,
  // operations
  uploadFile,
  deleteObject,
  objectExists,
  listChildren,
  listAllKeys,
  getDownloadUrl,
  getUploadUrl,
  healthCheck,
};