/**
 * Class Notification Controller
 * Handles class notifications, sync, and email sending.
 */

const { LMSClient, NotificationScheduler, caches, log } = require("./_shared");
const { isLmsAuthError } = require("../utils/authError");

const { notificationCache, classNotificationDetailsCache } = caches;

exports.getClassesNotifications = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { teacherId, centreIds, roles, statusIn, email } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");
    const parsedCentreIds = Array.isArray(centreIds)
      ? centreIds.map((c) => (typeof c === "object" ? c.id : c))
      : centreIds;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE && !teacherId) return res.status(400).json({ error: "Teacher ID is required" });

    const client = new LMSClient(token);
    const allEnrichedClasses = await NotificationScheduler.getEnrichedClasses(
      token, teacherId, parsedCentreIds, roles, statusIn,
    );

    const enriched = allEnrichedClasses.map((cls) => ({
      ...cls,
      computed: {
        lecName: (cls.teachers || [])
          .filter((t) => t.role?.shortName === "LEC")
          .map((t) => t.teacher?.fullName)
          .filter(Boolean)
          .join(", "),
        taName: (cls.teachers || [])
          .filter((t) => t.role?.shortName === "TA")
          .map((t) => t.teacher?.fullName)
          .filter(Boolean)
          .join(", "),
        teName: (cls.teachers || [])
          .filter((t) => t.role?.shortName === "TE")
          .map((t) => t.teacher?.fullName)
          .filter(Boolean)
          .join(", "),
        hasMissingFeedback: false,
      },
    }));

    const enrichedWithFeedback = await NotificationScheduler.enrichWithFeedback(
      token, enriched,
    );

    const finalData = enrichedWithFeedback.map((cls) => ({
      ...cls,
      computed: {
        ...cls.computed,
        totalMissingFeedback: (cls.computed.missingFeedbackStudents || []).length,
      },
    }));

    res.json({ success: true, data: finalData });
  } catch (err) {
    log.error("[Controller] getClassesNotifications failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

exports.syncNotifications = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE) return res.status(403).json({ error: "Access denied. TE role required." });

    log.info("[Controller] Manual notification sync triggered by TE");
    await NotificationScheduler.syncAllNotifications();
    notificationCache.flushAll();

    res.json({ success: true, message: "Đồng bộ thông báo thành công" });
  } catch (err) {
    log.error("[Controller] syncNotifications failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

exports.sendNotificationEmails = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE) return res.status(403).json({ error: "Access denied. TE role required." });

    log.info("[Controller] Manual email notification triggered by TE");
    await NotificationScheduler.sendReminderEmails();

    res.json({ success: true, message: "Đã gửi email nhắc nhở thành công" });
  } catch (err) {
    log.error("[Controller] sendNotificationEmails failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};
