const { ActiveToken, NotificationTicket } = require("./mongoModels");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("NotificationStorage");

class NotificationStorage {
  // --- Token Management ---
  static async saveActiveToken(teacherId, token, centreIds, roles) {
    try {
      const id = teacherId || "anonymous";
      await ActiveToken.findOneAndUpdate(
        { _id: id },
        {
          token,
          centreIds: centreIds || [],
          roles: roles || [],
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
      log.info(
        `[NotificationStorage] Saved active token for teacher: ${teacherId}`
      );
    } catch (error) {
      log.error(
        "[NotificationStorage] Error saving active token:",
        error
      );
    }
  }

  static async getActiveTokens() {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const docs = await ActiveToken.find({ updatedAt: { $gte: twoHoursAgo } }).lean();
      
      return docs.map(doc => ({
        ...doc,
        teacherId: doc._id
      }));
    } catch (error) {
      log.error(
        "[NotificationStorage] Error getting active tokens:",
        error
      );
      return [];
    }
  }

  // --- Notification Tickets Management ---
  static async saveNotificationTicket(ticket) {
    try {
      const docId = `${ticket.classId}_${ticket.date.replace(/\//g, "-")}`;
      await NotificationTicket.findOneAndUpdate(
        { _id: docId },
        {
          ...ticket,
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (error) {
      log.error(
        "[NotificationStorage] Error saving notification ticket:",
        error
      );
    }
  }

  static async deleteNotificationTicket(classId, date) {
    try {
      const docId = `${classId}_${date.replace(/\//g, "-")}`;
      await NotificationTicket.deleteOne({ _id: docId });
    } catch (error) {
      log.error(
        "[NotificationStorage] Error deleting notification ticket:",
        error
      );
    }
  }

  static async getTicketsForTE(centreIds) {
    try {
      if (!Array.isArray(centreIds) || centreIds.length === 0) return [];

      const docs = await NotificationTicket.find({
        centreIds: { $in: centreIds }
      }).lean();

      return docs;
    } catch (error) {
      log.error(
        "[NotificationStorage] Error getting tickets for TE:",
        error
      );
      return [];
    }
  }

  static async getTicketsForTeacher(teacherId) {
    try {
      if (!teacherId) return [];
      const docs = await NotificationTicket.find({
        teacherIds: teacherId
      }).lean();

      return docs;
    } catch (error) {
      log.error(
        "[NotificationStorage] Error getting tickets for teacher:",
        error
      );
      return [];
    }
  }

  static async clearAllTicketsForClass(classId) {
    try {
      await NotificationTicket.deleteMany({ classId });
      log.info(
        `[NotificationStorage] Cleared all tickets for class: ${classId}`
      );
    } catch (error) {
      log.error(
        "[NotificationStorage] Error clearing tickets for class:",
        error
      );
    }
  }

  static async saveBatchTickets(tickets, classId) {
    try {
      await this.clearAllTicketsForClass(classId);

      if (!tickets || tickets.length === 0) return;

      const now = new Date();
      const docs = tickets.map((ticket) => ({
        _id: `${ticket.classId}_${ticket.date.replace(/\//g, "-")}`,
        ...ticket,
        updatedAt: now
      }));

      await NotificationTicket.insertMany(docs);
      log.info(
        `[NotificationStorage] Batch saved ${tickets.length} tickets for class: ${classId}`
      );
    } catch (error) {
      log.error(
        "[NotificationStorage] Error batch saving tickets:",
        error
      );
    }
  }
}

module.exports = NotificationStorage;
