const { childLogger } = require("../utils/logger.js");
const log = childLogger("Firebase-admin");

process.env.FIRESTORE_PREFER_REST = "true";
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

let isFirebaseInitialized = false;

function initializeFirebase() {
  let serviceAccount = null;

  // 1. Check for Base64 encoded Service Account in Environment Variables (for Vercel/Cloud deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decodedJson = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64",
      ).toString("utf8");
      serviceAccount = JSON.parse(decodedJson);
      log.info(
        "[Firebase] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable",
      );
    } catch (parseError) {
      log.error(
        "[Firebase] ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:",
        parseError.message,
      );
      return false;
    }
  }
  // 2. Check for raw JSON string in Environment Variables
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      log.info(
        "[Firebase] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_JSON environment variable",
      );
    } catch (parseError) {
      log.error(
        "[Firebase] ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
        parseError.message,
      );
      return false;
    }
  }

  if (serviceAccount) {
    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.client_email) {
      log.error(
        "[Firebase] ERROR: Invalid Firebase service account - missing project_id or client_email",
      );
      return false;
    }

    admin.initializeApp({
      credential: admin.cert(serviceAccount),
    });
    log.info("[Firebase] Admin SDK initialized successfully.");
    return true;
  }

  log.warn("[Firebase] WARNING: No Firebase credentials found in environment variables.");
  log.warn(
    "[Firebase] Please set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON in environment variables.",
  );
  return false;
}

isFirebaseInitialized = initializeFirebase();

const db = isFirebaseInitialized ? getFirestore() : null;

module.exports = { admin, db, isFirebaseInitialized };
