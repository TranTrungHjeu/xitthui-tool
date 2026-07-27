const { childLogger } = require("./logger.js");
const log = childLogger("TokenEncryption");

/**
 * Token Encryption Utility using AES-256-GCM
 *
 * Provides secure encryption for sensitive tokens (like LMS refresh tokens)
 * stored in MongoDB. Uses AES-256-GCM for authenticated encryption.
 *
 * Required environment variable:
 * - TOKEN_ENCRYPTION_KEY: 32-byte hex-encoded key (64 hex characters)
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Validates the encryption key format
 * @param {string} key - Hex-encoded 32-byte key
 * @returns {boolean} - True if valid
 */
function isValidKey(key) {
  if (!key || typeof key !== "string") return false;
  // Must be 64 hex characters (32 bytes)
  return /^[a-fA-F0-9]{64}$/.test(key);
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param {string} plaintext - The text to encrypt
 * @param {string} key - 64-char hex-encoded 32-byte key
 * @returns {string} - Base64-encoded ciphertext (iv:authTag:ciphertext)
 * @throws {Error} - If encryption fails
 */
function encrypt(plaintext, key) {
  if (!plaintext) {
    throw new Error("Plaintext is required for encryption");
  }

  if (!isValidKey(key)) {
    throw new Error("Invalid encryption key: must be 64 hex characters (32 bytes)");
  }

  try {
    const keyBuffer = Buffer.from(key, "hex");
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
  } catch (err) {
    throw new Error(`Encryption failed: ${err.message}`);
  }
}

/**
 * Decrypts a ciphertext string using AES-256-GCM
 * @param {string} ciphertext - Base64-encoded ciphertext (format: iv:authTag:ciphertext)
 * @param {string} key - 64-char hex-encoded 32-byte key
 * @returns {string} - Decrypted plaintext
 * @throws {Error} - If decryption fails or auth tag is invalid
 */
function decrypt(ciphertext, key) {
  if (!ciphertext) {
    throw new Error("Ciphertext is required for decryption");
  }

  if (!isValidKey(key)) {
    throw new Error("Invalid encryption key: must be 64 hex characters (32 bytes)");
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid ciphertext format");
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;

    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");

    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length");
    }

    const keyBuffer = Buffer.from(key, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, null, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    if (err.message.includes("Unsupported state") ||
        err.message.includes("auth tag")) {
      throw new Error("Decryption failed: authentication tag mismatch (data corrupted or tampered)");
    }
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

/**
 * Encrypts a token if encryption is enabled and key is available
 * Returns the original value if encryption is not configured
 * @param {string} token - The token to encrypt
 * @returns {string} - Encrypted token or original if encryption disabled
 */
function encryptToken(token) {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    log.warn("[TokenEncryption] TOKEN_ENCRYPTION_KEY not configured. Token will NOT be encrypted.");
    return token;
  }
  if (!token) return token;
  return encrypt(token, key);
}

/**
 * Decrypts a token if it appears to be encrypted
 * Returns the original value if decryption fails or token is not encrypted
 * @param {string} token - The encrypted token or plaintext
 * @returns {string} - Decrypted token or original value
 */
function decryptToken(token) {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    // If no key configured, assume token is plaintext
    return token;
  }
  if (!token) return token;

  // Check if token appears to be encrypted (has our format)
  if (token.includes(":") && token.split(":").length === 3) {
    try {
      return decrypt(token, key);
    } catch (err) {
      log.error("[TokenEncryption] Failed to decrypt token:", err.message);
      // Return original - might be legacy unencrypted token
      return token;
    }
  }

  // Not in encrypted format, return as-is
  return token;
}

module.exports = {
  encrypt,
  decrypt,
  encryptToken,
  decryptToken,
  isValidKey,
  ALGORITHM,
};
