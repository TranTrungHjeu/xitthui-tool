const { Teacher } = require("./mongoModels");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("TeacherStorage");

class TeacherStorage {
  /**
   * Save a batch of teachers to MongoDB.
   * Uses bulkWrite to upsert/merge teacher records efficiently,
   * keyed by the LMS teacher id.
   */
  static async saveTeachers(teachersList) {
    if (!teachersList || teachersList.length === 0) return 0;
    try {
      const now = new Date();
      const operations = teachersList
        .filter((teacher) => teacher.id)
        .map((teacher) => ({
          updateOne: {
            filter: { _id: teacher.id.toString() },
            update: {
              $set: {
                fullName: teacher.fullName || "",
                username: teacher.username || "",
                user: teacher.user || "",
                firebaseId: teacher.firebaseId || "",
                code: teacher.code || "",
                email: teacher.email || "",
                personalEmail: teacher.personalEmail || "",
                phoneNumber: teacher.phoneNumber || "",
                gender: teacher.gender || "",
                dob: teacher.dob || "",
                imageUrl: teacher.imageUrl || "",
                address: teacher.address || "",
                socialMediaLink: teacher.socialMediaLink || "",
                notes: teacher.notes || "",
                handleScore:
                  typeof teacher.handleScore === "number" ? teacher.handleScore : null,
                hourlyRate:
                  typeof teacher.hourlyRate === "number" ? teacher.hourlyRate : null,
                teacherPoint: typeof teacher.teacherPoint === "number" ? teacher.teacherPoint : 0,
                isActive: teacher.isActive !== false,
                joinedDate: teacher.joinedDate || "",
                createdAt: teacher.createdAt || "",
                createdBy: teacher.createdBy || "",
                lastModifiedAt: teacher.lastModifiedAt || "",
                lastModifiedBy: teacher.lastModifiedBy || "",
                centres: Array.isArray(teacher.centres) ? teacher.centres : [],
                courseLines: Array.isArray(teacher.courseLines) ? teacher.courseLines : [],
                courses: Array.isArray(teacher.courses) ? teacher.courses : [],
                syncedAt: now,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        }));

      if (operations.length === 0) return 0;
      await Teacher.bulkWrite(operations);
      log.info(
        `[TeacherStorage] Successfully synced ${operations.length} teachers to MongoDB.`,
      );
      return operations.length;
    } catch (error) {
      log.error("[TeacherStorage] Error saving teachers:", error);
      return 0;
    }
  }

  /**
   * Retrieve all teachers stored in MongoDB. Used as the source of truth
   * for the personnel page after the first successful sync.
   */
  static async getAllTeachers() {
    try {
      const docs = await Teacher.find({}).lean();
      // Map _id back to id to preserve compatibility with downstream components.
      return docs.map((doc) => ({
        ...doc,
        id: doc._id,
      }));
    } catch (error) {
      log.error("[TeacherStorage] Error getting all teachers:", error);
      return [];
    }
  }

  /**
   * Returns the number of teachers currently stored in MongoDB.
   * Used to decide whether to serve from cache (cold start = 0) or skip the
   * LMS live fallback path.
   */
  static async getTeachersCount() {
    try {
      return await Teacher.countDocuments();
    } catch (error) {
      log.error("[TeacherStorage] Error counting teachers:", error);
      return 0;
    }
  }

  /**
   * Remove teachers that no longer appear in the latest sync payload.
   * Only deletes when the previous sync had records — guards against a
   * transient empty LMS response wiping the collection on cold start.
   */
  static async cleanStaleTeachers(activeIds) {
    try {
      if (!Array.isArray(activeIds) || activeIds.length === 0) return 0;
      const previousCount = await Teacher.countDocuments();
      if (previousCount === 0) return 0;

      const result = await Teacher.deleteMany({
        _id: { $nin: activeIds.map((id) => id.toString()) },
      });
      if (result.deletedCount > 0) {
        log.info(
          `[TeacherStorage] Cleaned up ${result.deletedCount} stale teachers.`,
        );
      }
      return result.deletedCount || 0;
    } catch (error) {
      log.error("[TeacherStorage] Error cleaning stale teachers:", error);
      return 0;
    }
  }
}

module.exports = TeacherStorage;