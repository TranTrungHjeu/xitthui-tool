const { db, isFirebaseInitialized } = require("../config/firebase-admin");

const SESSIONS_COLLECTION = "user_sessions";

class FirestoreSession {
  /**
   * Tạo session mới khi user login
   */
  static async createSession(sessionData) {
    if (!isFirebaseInitialized || !db) return null;
    try {
      const docRef = db
        .collection(SESSIONS_COLLECTION)
        .doc(sessionData.sessionId);
      await docRef.set({
        ...sessionData,
        isValid: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(
        `[FirestoreSession] Created session: ${sessionData.sessionId}`,
      );
      return sessionData.sessionId;
    } catch (error) {
      console.error("[FirestoreSession] Error creating session:", error);
      return null;
    }
  }

  /**
   * Cập nhật thông tin session (vd: khi refresh token)
   */
  static async updateSession(sessionId, updateData) {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
      await docRef.update({
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error("[FirestoreSession] Error updating session:", error);
      return false;
    }
  }

  /**
   * Lấy thông tin session
   */
  static async getSession(sessionId) {
    if (!isFirebaseInitialized || !db) return null;
    try {
      const doc = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
      if (!doc.exists) return null;
      return doc.data();
    } catch (error) {
      console.error("[FirestoreSession] Error getting session:", error);
      return null;
    }
  }

  /**
   * Vô hiệu hóa một session (khi user logout hoặc bị kick)
   */
  static async revokeSession(sessionId) {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
      await docRef.update({
        isValid: false,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[FirestoreSession] Revoked session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error("[FirestoreSession] Error revoking session:", error);
      return false;
    }
  }
}

module.exports = FirestoreSession;
