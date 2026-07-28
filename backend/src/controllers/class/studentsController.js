/**
 * Students Controller
 * Handles student listing and sync.
 */

const { LMSClient, FirestoreStudent, StudentScheduler, log } = require("./_shared");
const { isLmsAuthError } = require("../utils/authError");

exports.getStudents = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    const {
      teacherId, centreIds, roles, statusIn = ["RUNNING", "OPEN", "PRE_OPEN"],
      page = 1, limit = 20, search = "", centre = "all", classId = "all",
    } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE && !teacherId) return res.status(400).json({ error: "Teacher ID is required" });

    const client = new LMSClient(token);
    const allClasses = await FirestoreStudent.getClassesWithStudentList(token, teacherId, centreIds, roles, statusIn);

    let filtered = allClasses;
    if (centre !== "all") filtered = filtered.filter((c) => c.centre?.id === centre);
    if (classId !== "all") filtered = filtered.filter((c) => c.id === classId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.course?.name || "").toLowerCase().includes(q),
      );
    }

    const total = filtered.length;
    const p = Math.min(Math.max(1, Number(page)), Math.max(1, Math.ceil(total / limit)));
    const l = Number(limit);
    const start = (p - 1) * l;
    const paginated = filtered.slice(start, start + l);

    const enriched = await FirestoreStudent.enrichWithStudentDetails(
      token, paginated,
    );

    res.json({
      success: true,
      data: enriched,
      meta: { total, page: p, limit: l, totalPages: Math.max(1, Math.ceil(total / l)) },
    });
  } catch (err) {
    log.error("[Controller] getStudents failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

exports.syncStudents = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
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
};
