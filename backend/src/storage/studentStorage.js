const { Student } = require("./mongoModels");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("StudentStorage");

class StudentStorage {
  /**
   * Save a batch of students to MongoDB.
   * Uses bulkWrite to upsert/merge student records efficiently.
   */
  static async saveStudents(studentsList) {
    if (!studentsList || studentsList.length === 0) return;
    try {
      const now = new Date();
      const operations = studentsList
        .filter((student) => student.id)
        .map((student) => ({
          updateOne: {
            filter: { _id: student.id.toString() },
            update: {
              $set: {
                fullName: student.fullName || "",
                email: student.email || "",
                phone: student.phone || "",
                classes: student.classes || [],
                centreIds: student.centreIds || [],
                teacherIds: student.teacherIds || [],
                updatedAt: now,
              },
            },
            upsert: true,
          },
        }));

      await Student.bulkWrite(operations);
      log.info(
        `[StudentStorage] Successfully synced ${studentsList.length} students to MongoDB.`
      );
    } catch (error) {
      log.error("[StudentStorage] Error saving students:", error);
    }
  }

  /**
   * Retrieve students based on centreIds (for TE) or teacherId (for Teachers)
   */
  static async getStudentsForUser(teacherId, centreIds, roles) {
    try {
      const isTE = Array.isArray(roles) && roles.includes("TE");

      let query = {};
      if (isTE) {
        if (Array.isArray(centreIds) && centreIds.length > 0) {
          // No 10-element limit in MongoDB compared to Firestore
          query = { centreIds: { $in: centreIds } };
        } else {
          return [];
        }
      } else {
        if (!teacherId) return [];
        query = { teacherIds: teacherId };
      }

      const docs = await Student.find(query).lean();
      // Map _id back to id to preserve compatibility with downstream components
      return docs.map((doc) => ({
        ...doc,
        id: doc._id,
      }));
    } catch (error) {
      log.error("[StudentStorage] Error getting students for user:", error);
      return [];
    }
  }

  /**
   * Optional helper to clean up old students who haven't been updated in the last 7 days
   */
  static async cleanStaleStudents() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await Student.deleteMany({ updatedAt: { $lt: sevenDaysAgo } });
      if (result.deletedCount > 0) {
        log.info(
          `[StudentStorage] Cleaned up ${result.deletedCount} stale students.`
        );
      }
    } catch (error) {
      log.error("[StudentStorage] Error cleaning stale students:", error);
    }
  }
}

module.exports = StudentStorage;
