/**
 * Students Controller
 * Handles student listing and sync.
 */

const { FirestoreStudent, StudentScheduler, log } = require("./_shared");
const { isLmsAuthError } = require("../../utils/authError");
const { withLmsAuthRefresh } = require("../../utils/lmsAuthRefresh");

exports.getStudents = withLmsAuthRefresh(async (req, res) => {
  try {
    const {
      teacherId, centreIds, roles,
      statusIn = ["RUNNING", "OPEN", "PRE_OPEN"],
      page = 1, limit = 20, search = "", centre = "all", classId = "all",
    } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!isTE && !teacherId) return res.status(400).json({ error: "Teacher ID is required" });

    // 1. Get all students from MongoDB by teacherId or centreIds
    let allStudents = await FirestoreStudent.getStudentsForUser(teacherId, centreIds, roles);

    // 2. Filter by specific centre if selected
    if (centre !== "all") {
      allStudents = allStudents.filter((student) =>
        student.classes.some((c) => c.centreId === centre),
      );
    }

    // 3. Filter by specific classId if selected
    if (classId !== "all") {
      allStudents = allStudents.filter((student) =>
        student.classes.some((c) => c.id === classId),
      );
    }

    // 4. Filter by class status
    if (statusIn && statusIn.length > 0) {
      allStudents = allStudents.filter((student) =>
        student.classes.some((c) => statusIn.includes(c.status)),
      );
    }

    // 5. Apply search filter (fullName, email, phone)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      allStudents = allStudents.filter((student) => {
        const searchString = `${student.fullName} ${student.email} ${student.phone}`.toLowerCase();
        return searchString.includes(searchLower);
      });
    }

    // 6. Sort students alphabetically
    allStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));

    // 7. Pagination
    const total = allStudents.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const validPage = Math.max(1, Math.min(page, Math.max(1, totalPages)));
    const startIndex = (validPage - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStudents = allStudents.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedStudents,
      meta: { total, page: validPage, limit, totalPages },
    });
  } catch (err) {
    log.error("[Controller] getStudents failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

exports.syncStudents = withLmsAuthRefresh(async (req, res) => {
  try {
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!isTE) return res.status(403).json({ error: "Access denied. TE role required." });

    log.info("[Controller] Manual student sync triggered by TE");
    res.json({ success: true, message: "Đồng bộ học viên đang chạy ngầm..." });
    StudentScheduler.syncAllStudents();
  } catch (err) {
    log.error("[Controller] syncStudents failed:", err.message);
    if (!res.headersSent) {
      const statusCode = isLmsAuthError(err) ? 401 : 500;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  }
});
