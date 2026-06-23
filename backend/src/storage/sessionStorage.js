const { Session } = require("./mongoModels");

class SessionStorage {
  /**
   * Tạo session mới khi user login
   */
  static async createSession(sessionData) {
    try {
      await Session.findOneAndUpdate(
        { _id: sessionData.sessionId },
        {
          ...sessionData,
          isValid: true,
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`[SessionStorage] Created/Updated session: ${sessionData.sessionId}`);
      return sessionData.sessionId;
    } catch (error) {
      console.error("[SessionStorage] Error creating session:", error);
      return null;
    }
  }

  /**
   * Cập nhật thông tin session (vd: khi refresh token)
   */
  static async updateSession(sessionId, updateData) {
    try {
      await Session.updateOne(
        { _id: sessionId },
        {
          ...updateData,
          updatedAt: new Date()
        }
      );
      return true;
    } catch (error) {
      console.error("[SessionStorage] Error updating session:", error);
      return false;
    }
  }

  /**
   * Lấy thông tin session
   */
  static async getSession(sessionId) {
    try {
      const doc = await Session.findById(sessionId).lean();
      if (!doc) return null;
      return {
        ...doc,
        sessionId: doc._id
      };
    } catch (error) {
      console.error("[SessionStorage] Error getting session:", error);
      return null;
    }
  }

  /**
   * Vô hiệu hóa một session (khi user logout hoặc bị kick)
   */
  static async revokeSession(sessionId) {
    try {
      await Session.updateOne(
        { _id: sessionId },
        {
          isValid: false,
          updatedAt: new Date()
        }
      );
      console.log(`[SessionStorage] Revoked session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error("[SessionStorage] Error revoking session:", error);
      return false;
    }
  }
}

module.exports = SessionStorage;
