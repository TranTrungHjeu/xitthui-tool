const { db, isFirebaseInitialized } = require("../config/firebase-admin");

const STUDENTS_COLLECTION = "students";

class FirestoreStudent {
  /**
   * Save a batch of students to Firestore.
   * Handles chunking to stay within Firestore batch limits (max 500 writes per batch).
   */
  static async saveStudents(studentsList) {
    if (!isFirebaseInitialized || !db) return;
    try {
      const now = new Date().toISOString();
      const chunkSize = 400; // Keep it under the 500 limit safely

      for (let i = 0; i < studentsList.length; i += chunkSize) {
        const chunk = studentsList.slice(i, i + chunkSize);
        const batch = db.batch();

        chunk.forEach((student) => {
          if (!student.id) return; // Bảo vệ an toàn
          const docRef = db
            .collection(STUDENTS_COLLECTION)
            .doc(student.id.toString());
          batch.set(
            docRef,
            {
              ...student,
              updatedAt: now,
            },
            { merge: true }, // Merge in case they are already in another class not fetched in this job
          );
        });

        await batch.commit();
      }
      console.log(
        `[FirestoreStudent] Successfully synced ${studentsList.length} students to Firestore.`,
      );
    } catch (error) {
      console.error("[FirestoreStudent] Error saving students:", error);
    }
  }

  /**
   * Retrieve students based on centreIds (for TE) or teacherId (for Teachers)
   */
  static async getStudentsForUser(teacherId, centreIds, roles) {
    if (!isFirebaseInitialized || !db) return [];
    try {
      const isTE = Array.isArray(roles) && roles.includes("TE");
      let query = db.collection(STUDENTS_COLLECTION);

      if (isTE) {
        // TE filters by their managed centres
        if (Array.isArray(centreIds) && centreIds.length > 0) {
          // Firestore array-contains-any supports up to 10 items
          const sliceCentreIds = centreIds.slice(0, 10);
          query = query.where(
            "centreIds",
            "array-contains-any",
            sliceCentreIds,
          );
        } else {
          // If TE has no centres, they shouldn't see any students
          return [];
        }
      } else {
        // Teacher filters by classes where they are a teacher/TA
        if (!teacherId) return [];
        query = query.where("teacherIds", "array-contains", teacherId);
      }

      const snapshot = await query.get();
      const students = [];
      snapshot.forEach((doc) => {
        students.push(doc.data());
      });

      return students;
    } catch (error) {
      console.error(
        "[FirestoreStudent] Error getting students for user:",
        error,
      );
      return [];
    }
  }

  /**
   * Optional helper to clean up old students who haven't been updated in a while (e.g. 7 days ago)
   * which means they are no longer in active/running classes.
   */
  static async cleanStaleStudents() {
    if (!isFirebaseInitialized || !db) return;
    try {
      // Clean students not updated in the last 7 days
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const snapshot = await db
        .collection(STUDENTS_COLLECTION)
        .where("updatedAt", "<", sevenDaysAgo)
        .get();

      if (snapshot.empty) return;

      const batch = db.batch();
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(
        `[FirestoreStudent] Cleaned up ${snapshot.size} stale students.`,
      );
    } catch (error) {
      console.error("[FirestoreStudent] Error cleaning stale students:", error);
    }
  }
}

module.exports = FirestoreStudent;
