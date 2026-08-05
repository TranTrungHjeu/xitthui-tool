/**
 * Class Detail Controller
 * Handles evaluation submission, course version, and submissions.
 */

const { LMSClient, caches, log } = require("./_shared");
const { isLmsAuthError } = require("../../utils/authError");

const { classDetailsCache, classNotificationDetailsCache, notificationCache } = caches;

exports.updateEvaluation = async (req, res) => {
  let token = req.body.token;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }
  const { payload } = req.body;

  if (!token || !payload)
    return res.status(400).json({ error: "Token and payload are required" });
  try {
    const client = new LMSClient(token);
    const data = await client.updateEvaluation(payload);

    if (payload.classId) {
      classDetailsCache.del(payload.classId);
      classNotificationDetailsCache.del(payload.classId);
      notificationCache.flushAll();
    }

    res.json({ success: true, data });
  } catch (err) {
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.response?.data || err.message });
  }
};

exports.getCourseVersion = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId) return res.status(400).json({ error: "Class ID is required" });

    const client = new LMSClient(token);
    const data = await client.getCourseVersionByClass(classId);
    res.json({ success: true, data });
  } catch (err) {
    log.error("[Controller] getCourseVersion failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: null,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId) return res.status(400).json({ error: "Class ID is required" });

    const client = new LMSClient(token);
    const data = await client.getStudentSubmissionsByClass(classId);

    if (data && Array.isArray(data.submissions)) {
      data.submissions.forEach((sub) => {
        if (sub.content && sub.content.attachments) {
          let list = [];
          const atts = sub.content.attachments;
          if (Array.isArray(atts)) list = atts;
          else if (typeof atts === "string" && atts.trim() !== "") {
            try { list = JSON.parse(atts); } catch (_) { list = [atts]; }
          } else if (atts) list = [atts];

          const normalized = list.map((att) => {
            let url = "";
            if (typeof att === "string") url = att;
            else if (att && typeof att === "object") url = att.url || att.link || att.path || att.downloadUrl || "";
            if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
              const base = (process.env.MINDX_LMS_ASSETS_BASE_URL || "https://mindx-learning-materials.hn.ss.bfcplatform.vn").replace(/\/$/, "");
              const cleanPath = url.startsWith("/") ? url : `/${url}`;
              return `${base}${cleanPath}`;
            }
            return url;
          }).filter(Boolean);
          sub.content.attachments = normalized;
        }
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    log.error("[Controller] getSubmissions failed:", err.message);
    log.error("[Controller] LMS error response:", JSON.stringify(err.response?.data || {}, null, 2));
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getStudents = async (req, res) => {
  // Forward to the students controller
  const studentsController = require("./studentsController");
  return studentsController.getStudents(req, res);
};

exports.syncStudents = async (req, res) => {
  // Forward to the students controller
  const studentsController = require("./studentsController");
  return studentsController.syncStudents(req, res);
};
