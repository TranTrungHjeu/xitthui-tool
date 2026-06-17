const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");
const ZALO_SESSIONS_FILE = path.join(DATA_DIR, "zalo_sessions.json");
const ZALO_REMINDERS_FILE = path.join(DATA_DIR, "zalo_reminders.json");
const ZALO_GLOBAL_CONFIG_FILE = path.join(DATA_DIR, "zalo_global_config.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class ZaloData {
  // ======== SESSIONS ========
  static loadSessions() {
    try {
      if (fs.existsSync(ZALO_SESSIONS_FILE)) {
        const data = fs.readFileSync(ZALO_SESSIONS_FILE, "utf8");
        if (!data || data.trim() === "") return {};
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("[ZaloData] Error loading sessions:", err.message);
    }
    return {};
  }

  static saveSessions(sessions) {
    fs.writeFileSync(ZALO_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  }

  /**
   * Save user session after LMS login
   * @param {string} zaloUserId - Zalo user ID
   * @param {object} sessionData - { lmsToken, mindxUser, firebaseUid }
   */
  static saveUserSession(zaloUserId, sessionData) {
    const sessions = this.loadSessions();
    sessions[zaloUserId] = {
      ...sessionData,
      updatedAt: new Date().toISOString(),
    };
    this.saveSessions(sessions);
  }

  static getUserSession(zaloUserId) {
    const sessions = this.loadSessions();
    return sessions[zaloUserId] || null;
  }

  static deleteUserSession(zaloUserId) {
    const sessions = this.loadSessions();
    delete sessions[zaloUserId];
    this.saveSessions(sessions);
  }

  // ======== REMINDERS ========
  static loadReminders() {
    try {
      if (fs.existsSync(ZALO_REMINDERS_FILE)) {
        const data = fs.readFileSync(ZALO_REMINDERS_FILE, "utf8");
        if (!data || data.trim() === "") return {};
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("[ZaloData] Error loading reminders:", err.message);
    }
    return {};
  }

  static saveReminders(reminders) {
    fs.writeFileSync(ZALO_REMINDERS_FILE, JSON.stringify(reminders, null, 2));
  }

  /**
   * Set reminder config for a user
   * @param {string} zaloUserId
   * @param {number} intervalMinutes - 30, 180, or 300
   */
  static setReminder(zaloUserId, intervalMinutes) {
    const reminders = this.loadReminders();
    reminders[zaloUserId] = {
      intervalMinutes,
      enabled: true,
      lastSentAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveReminders(reminders);
  }

  static getReminder(zaloUserId) {
    const reminders = this.loadReminders();
    return reminders[zaloUserId] || null;
  }

  // ======== GLOBAL CONFIG ========
  static getGlobalConfig() {
    try {
      if (fs.existsSync(ZALO_GLOBAL_CONFIG_FILE)) {
        const data = fs.readFileSync(ZALO_GLOBAL_CONFIG_FILE, "utf8");
        if (!data || data.trim() === "") return this._defaultGlobalConfig();
        return { ...this._defaultGlobalConfig(), ...JSON.parse(data) };
      }
    } catch (err) {
      console.error("[ZaloData] Error loading global config:", err.message);
    }
    return this._defaultGlobalConfig();
  }

  static _defaultGlobalConfig() {
    return {
      targetChatId: null,
      lmsToken: null,
      lmsRefreshToken: null,
      mindxUser: null,
      reminderTimes: [], // e.g. ["08:00", "15:00"]
    };
  }

  static saveGlobalConfig(config) {
    fs.writeFileSync(ZALO_GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  static disableReminder(zaloUserId) {
    const reminders = this.loadReminders();
    if (reminders[zaloUserId]) {
      reminders[zaloUserId].enabled = false;
      reminders[zaloUserId].updatedAt = new Date().toISOString();
      this.saveReminders(reminders);
    }
  }

  static getAllEnabledReminders() {
    const reminders = this.loadReminders();
    return Object.entries(reminders)
      .filter(([_, config]) => config.enabled)
      .map(([userId, config]) => ({ userId, ...config }));
  }

  static updateReminderSentTime(zaloUserId) {
    const reminders = this.loadReminders();
    if (reminders[zaloUserId]) {
      reminders[zaloUserId].lastSentAt = new Date().toISOString();
      this.saveReminders(reminders);
    }
  }
}

module.exports = ZaloData;
