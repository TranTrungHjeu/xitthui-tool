const { db, isFirebaseInitialized } = require("../config/firebase-admin");

const TOKENS_COLLECTION = "active_tokens";
const NOTIFICATIONS_COLLECTION = "slot_notifications";

class FirestoreNotification {
  // --- Token Management ---
  static async saveActiveToken(teacherId, token, centreIds, roles) {
    if (!isFirebaseInitialized || !db) return;
    try {
      const docRef = db
        .collection(TOKENS_COLLECTION)
        .doc(teacherId || "anonymous");
      await docRef.set(
        {
          teacherId,
          token,
          centreIds: centreIds || [],
          roles: roles || [],
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      console.log(
        `[FirestoreNotification] Saved active token for teacher: ${teacherId}`,
      );
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error saving active token:",
        error,
      );
    }
  }

  static async getActiveTokens() {
    if (!isFirebaseInitialized || !db) return [];
    try {
      // Lấy token được cập nhật trong vòng 2 giờ qua
      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();
      const snapshot = await db
        .collection(TOKENS_COLLECTION)
        .where("updatedAt", ">=", twoHoursAgo)
        .get();

      const tokens = [];
      snapshot.forEach((doc) => {
        tokens.push(doc.data());
      });
      return tokens;
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error getting active tokens:",
        error,
      );
      return [];
    }
  }

  // --- Notification Tickets Management ---
  static async saveNotificationTicket(ticket) {
    if (!isFirebaseInitialized || !db) return;
    try {
      const docId = `${ticket.classId}_${ticket.date.replace(/\//g, "-")}`;
      const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(docId);
      await docRef.set({
        ...ticket,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error saving notification ticket:",
        error,
      );
    }
  }

  static async deleteNotificationTicket(classId, date) {
    if (!isFirebaseInitialized || !db) return;
    try {
      const docId = `${classId}_${date.replace(/\//g, "-")}`;
      const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(docId);
      await docRef.delete();
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error deleting notification ticket:",
        error,
      );
    }
  }

  static async getTicketsForTE(centreIds) {
    if (!isFirebaseInitialized || !db) return [];
    try {
      if (!Array.isArray(centreIds) || centreIds.length === 0) return [];

      const chunks = [];
      const chunkSize = 10;
      for (let i = 0; i < centreIds.length; i += chunkSize) {
        chunks.push(centreIds.slice(i, i + chunkSize));
      }

      let tickets = [];
      for (const chunk of chunks) {
        const snapshot = await db
          .collection(NOTIFICATIONS_COLLECTION)
          .where("centreIds", "array-contains-any", chunk)
          .get();
        snapshot.forEach((doc) => {
          tickets.push(doc.data());
        });
      }

      // Loại bỏ trùng lặp
      const uniqueTickets = Array.from(
        new Map(tickets.map((t) => [`${t.classId}_${t.date}`, t])).values(),
      );
      return uniqueTickets;
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error getting tickets for TE:",
        error,
      );
      return [];
    }
  }

  static async getTicketsForTeacher(teacherId) {
    if (!isFirebaseInitialized || !db) return [];
    try {
      if (!teacherId) return [];
      const snapshot = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where("teacherIds", "array-contains", teacherId)
        .get();

      const tickets = [];
      snapshot.forEach((doc) => {
        tickets.push(doc.data());
      });
      return tickets;
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error getting tickets for teacher:",
        error,
      );
      return [];
    }
  }

  static async clearAllTicketsForClass(classId) {
    if (!isFirebaseInitialized || !db) return;
    try {
      const snapshot = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where("classId", "==", classId)
        .get();

      const batch = db.batch();
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(
        `[FirestoreNotification] Cleared all tickets for class: ${classId}`,
      );
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error clearing tickets for class:",
        error,
      );
    }
  }

  static async saveBatchTickets(tickets, classId) {
    if (!isFirebaseInitialized || !db) return;
    try {
      // Xóa các tickets cũ của lớp này để ghi đè sạch sẽ
      await this.clearAllTicketsForClass(classId);

      if (tickets.length === 0) return;

      const batch = db.batch();
      tickets.forEach((ticket) => {
        const docId = `${ticket.classId}_${ticket.date.replace(/\//g, "-")}`;
        const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(docId);
        batch.set(docRef, {
          ...ticket,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.log(
        `[FirestoreNotification] Batch saved ${tickets.length} tickets for class: ${classId}`,
      );
    } catch (error) {
      console.error(
        "[FirestoreNotification] Error batch saving tickets:",
        error,
      );
    }
  }
}

module.exports = FirestoreNotification;
