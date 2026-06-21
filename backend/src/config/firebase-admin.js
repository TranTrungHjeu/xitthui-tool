process.env.FIRESTORE_PREFER_REST = "true";
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");

// Đường dẫn đến file Service Account Key
const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");

let isFirebaseInitialized = false;

try {
  let serviceAccount = null;

  // 1. Check for Base64 encoded Service Account in Environment Variables (for Vercel/Cloud deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decodedJson = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64",
    ).toString("utf8");
    serviceAccount = JSON.parse(decodedJson);
    console.log(
      "[Firebase] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable",
    );
  }
  // 2. Check for raw JSON string in Environment Variables
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log(
      "[Firebase] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_JSON environment variable",
    );
  }
  // 3. Fallback to local file (for local development)
  else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
    console.log(
      "[Firebase] Loaded credentials from local serviceAccountKey.json file",
    );
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    console.log("[Firebase] Admin SDK initialized successfully.");
  } else {
    console.warn("[Firebase] WARNING: No Firebase credentials found.");
    console.warn(
      "[Firebase] Please set FIREBASE_SERVICE_ACCOUNT_BASE64 in Vercel or place serviceAccountKey.json locally.",
    );
  }
} catch (error) {
  console.error("[Firebase] Error initializing Admin SDK:", error);
}

const db = isFirebaseInitialized ? getFirestore() : null;

module.exports = { admin, db, isFirebaseInitialized };
