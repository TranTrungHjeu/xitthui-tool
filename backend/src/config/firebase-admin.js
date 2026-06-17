const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");

// Đường dẫn đến file Service Account Key
const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");

let isFirebaseInitialized = false;

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    console.log(
      "[Firebase] Admin SDK initialized successfully with serviceAccountKey.json",
    );
  } else {
    console.warn(
      "[Firebase] WARNING: serviceAccountKey.json not found in backend/ directory.",
    );
    console.warn(
      "[Firebase] Please generate one from Firebase Console and place it there.",
    );
  }
} catch (error) {
  console.error("[Firebase] Error initializing Admin SDK:", error);
}

const db = isFirebaseInitialized ? getFirestore() : null;

module.exports = { admin, db, isFirebaseInitialized };
