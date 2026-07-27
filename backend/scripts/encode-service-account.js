#!/usr/bin/env node
/**
 * Encode a Google service account JSON file into a base64 string suitable
 * for the `GOOGLE_SERVICE_ACCOUNT_BASE64` environment variable.
 *
 * Usage:
 *   node backend/scripts/encode-service-account.js [path-to-key-file]
 *
 * Default input path: ./backend/serviceAccountKey.json
 *
 * The output is printed to stdout, ready to be pasted into your .env file.
 * After rotating, delete the raw JSON file from the repo to avoid leaking
 * the private key.
 *
 * SECURITY:
 *   - Never commit the printed base64 to git.
 *   - Treat the JSON file as a secret: read it, encode it, then delete it.
 */

const fs = require("fs");
const path = require("path");

const inputPath =
  process.argv[2] || path.join(__dirname, "..", "serviceAccountKey.json");

if (!fs.existsSync(inputPath)) {
  console.error(`[encode-service-account] File not found: ${inputPath}`);
  console.error(
    "Pass the path as the first argument: node encode-service-account.js /path/to/key.json",
  );
  process.exit(1);
}

try {
  const raw = fs.readFileSync(inputPath, "utf-8");
  // Validate it parses as JSON before encoding
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "JSON does not look like a Google service account (missing client_email or private_key)",
    );
  }
  const encoded = Buffer.from(raw, "utf-8").toString("base64");
  process.stdout.write(encoded);
  // Append a trailing newline for friendlier copy-paste
  process.stdout.write("\n");
  console.error(
    `[encode-service-account] Encoded ${inputPath} (${raw.length} bytes -> ${encoded.length} base64 chars).`,
  );
  console.error(
    "Paste the value above into GOOGLE_SERVICE_ACCOUNT_BASE64 in your .env file.",
  );
} catch (err) {
  console.error(`[encode-service-account] Failed: ${err.message}`);
  process.exit(1);
}
