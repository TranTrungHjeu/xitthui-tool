const fs = require("fs");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "../../data");
const SESSIONS_FILE = path.join(SESSIONS_DIR, "sessions.json");

// Ensure data directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

class UserSessionManager {
  static loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const data = fs.readFileSync(SESSIONS_FILE, "utf8");
        if (!data || data.trim() === "") return {};
        return JSON.parse(data);
      }
    } catch (err) {
      console.error(
        "[UserSessionManager] Error loading sessions:",
        err.message,
      );
      // If file is corrupt, return empty and let it be overwritten
    }
    return {};
  }

  static saveSessions(sessions) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  }

  static saveUserSession(telegramUserId, lmsUserId, token) {
    const sessions = this.loadSessions();
    sessions[telegramUserId] = {
      lmsUserId,
      token,
      createdAt: new Date().toISOString(),
    };
    this.saveSessions(sessions);
  }

  static getUserSession(telegramUserId) {
    const sessions = this.loadSessions();
    return sessions[telegramUserId] || null;
  }

  static deleteUserSession(telegramUserId) {
    const sessions = this.loadSessions();
    delete sessions[telegramUserId];
    this.saveSessions(sessions);
  }

  static getAllSessions() {
    return this.loadSessions();
  }
}

module.exports = UserSessionManager;
