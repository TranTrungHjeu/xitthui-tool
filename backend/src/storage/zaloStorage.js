const { ZaloSession, ZaloConfig } = require("./mongoModels");

class ZaloStorage {
  // ======== USER SESSIONS (firestoreZalo.js legacy) ========
  
  /**
   * Save user session after LMS login
   */
  static async saveUserSession(zaloUserId, sessionData) {
    try {
      await ZaloSession.findOneAndUpdate(
        { _id: zaloUserId },
        {
          ...sessionData,
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`[ZaloStorage] Saved session for Zalo User: ${zaloUserId}`);
    } catch (error) {
      console.error("[ZaloStorage] Error saving user session:", error);
      throw error;
    }
  }

  /**
   * Retrieve user session
   */
  static async getUserSession(zaloUserId) {
    try {
      const doc = await ZaloSession.findById(zaloUserId).lean();
      if (doc) {
        return {
          ...doc,
          zaloUserId: doc._id
        };
      }
      return null;
    } catch (error) {
      console.error("[ZaloStorage] Error getting user session:", error);
      return null;
    }
  }

  /**
   * Delete user session
   */
  static async deleteUserSession(zaloUserId) {
    try {
      await ZaloSession.deleteOne({ _id: zaloUserId });
      console.log(`[ZaloStorage] Deleted session for Zalo User: ${zaloUserId}`);
    } catch (error) {
      console.error("[ZaloStorage] Error deleting user session:", error);
    }
  }

  // ======== GLOBAL CONFIG (zaloData.js legacy) ========

  /**
   * Retrieve global configuration. If not exists, returns default settings.
   */
  static async getGlobalConfig() {
    try {
      const doc = await ZaloConfig.findById("global_config").lean();
      if (doc) {
        return {
          ...this._defaultGlobalConfig(),
          ...doc
        };
      }
    } catch (error) {
      console.error("[ZaloStorage] Error loading global config:", error.message);
    }
    return this._defaultGlobalConfig();
  }

  static _defaultGlobalConfig() {
    return {
      targetChatId: null,
      lmsToken: null,
      lmsRefreshToken: null,
      mindxUser: null,
      reminderTimes: [],
    };
  }

  /**
   * Save global configuration.
   */
  static async saveGlobalConfig(config) {
    try {
      await ZaloConfig.findOneAndUpdate(
        { _id: "global_config" },
        {
          ...config,
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
      console.log("[ZaloStorage] Global config updated successfully.");
    } catch (error) {
      console.error("[ZaloStorage] Error saving global config:", error.message);
    }
  }
}

module.exports = ZaloStorage;
