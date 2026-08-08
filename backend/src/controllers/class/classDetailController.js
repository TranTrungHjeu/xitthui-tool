/**
 * Class Detail Controller
 * Handles evaluation submission, course version, and submissions.
 *
 * Public handlers are wrapped with `withLmsAuthRefresh` so that when the
 * underlying Firebase id-token expires (1 hour window) the server
 * refreshes it transparently and retries the handler with the new
 * token. The cookie is rotated in the response so the FE never sees an
 * expired-token error.
 */

const { LMSClient, caches, log } = require("./_shared");
const { isLmsAuthError } = require("../../utils/authError");
const { withLmsAuthRefresh } = require("../../utils/lmsAuthRefresh");

const { classDetailsCache, classNotificationDetailsCache, notificationCache } = caches;

exports.updateEvaluation = withLmsAuthRefresh(async (req, res) => {
  const { payload } = req.body;

  if (!payload)
    return res.status(400).json({ error: "Token and payload are required" });
  try {
    const client = new LMSClient(req.lmsToken);
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
});

exports.getCourseVersion = withLmsAuthRefresh(async (req, res) => {
  const { classId } = req.body;

  if (!classId) return res.status(400).json({ error: "Class ID is required" });

  const client = new LMSClient(req.lmsToken);
  const data = await client.getCourseVersionByClass(classId);
  res.json({ success: true, data });
});

exports.getSubmissions = withLmsAuthRefresh(async (req, res) => {
  const { classId } = req.body;

  if (!classId) return res.status(400).json({ error: "Class ID is required" });

  const client = new LMSClient(req.lmsToken);
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
});

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
