const { db, isFirebaseInitialized } = require("../config/firebase-admin");

const COLLECTION_NAME = "zalo_sessions";

class FirestoreZalo {
  /**
   * Save user session after LMS login
   * @param {string} zaloUserId - Zalo user ID
   * @param {object} sessionData - { lmsToken, lmsRefreshToken, mindxUser, firebaseUid }
   */
  static async saveUserSession(zaloUserId, sessionData) {
    if (!isFirebaseInitialized || !db) {
      throw new Error(
        "Firestore is not initialized. Please add serviceAccountKey.json",
      );
    }

    try {
      const docRef = db.collection(COLLECTION_NAME).doc(zaloUserId);
      await docRef.set(
        {
          ...sessionData,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      console.log(`[FirestoreZalo] Saved session for Zalo User: ${zaloUserId}`);
    } catch (error) {
      console.error("[FirestoreZalo] Error saving user session:", error);
      throw error;
    }
  }

  /**
   * Retrieve user session
   * @param {string} zaloUserId
   * @returns {Promise<object|null>}
   */
  static async getUserSession(zaloUserId) {
    if (!isFirebaseInitialized || !db) return null;

    try {
      const docRef = db.collection(COLLECTION_NAME).doc(zaloUserId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error("[FirestoreZalo] Error getting user session:", error);
      return null;
    }
  }

  /**
   * Delete user session
   * @param {string} zaloUserId
   */
  static async deleteUserSession(zaloUserId) {
    if (!isFirebaseInitialized || !db) return;

    try {
      const docRef = db.collection(COLLECTION_NAME).doc(zaloUserId);
      await docRef.delete();
      console.log(
        `[FirestoreZalo] Deleted session for Zalo User: ${zaloUserId}`,
      );
    } catch (error) {
      console.error("[FirestoreZalo] Error deleting user session:", error);
    }
  }
}

module.exports = FirestoreZalo;
