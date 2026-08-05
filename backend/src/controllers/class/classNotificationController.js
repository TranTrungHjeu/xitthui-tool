/**
 * Class Notification Controller
 * Handles class notifications, sync, and email sending.
 */

const { FirestoreNotification, NotificationScheduler, caches, log } = require("./_shared");
const { isLmsAuthError } = require("../../utils/authError");

const { notificationCache } = caches;

exports.getClassesNotifications = async (req, res) => {
  try {
    const { teacherId, centreIds, roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    const parsedCentreIds = Array.isArray(centreIds)
      ? centreIds.map((c) => (typeof c === "object" ? c.id : c))
      : centreIds;

    if (!isTE && !teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    const cacheKey = isTE
      ? `tickets:TE:${(parsedCentreIds || []).slice().sort().join(",")}`
      : `tickets:T:${teacherId}`;
    const cached = notificationCache.get(cacheKey);
    if (cached) {
      log.info(
        `[Controller] getClassesNotifications cache hit (role=${isTE ? "TE" : "T"}, key=${cacheKey})`,
      );
      return res.json({ success: true, data: cached });
    }

    const query = isTE
      ? { centreIds: { $in: parsedCentreIds || [] } }
      : { teacherIds: teacherId };
    const tickets = await FirestoreNotification.getNotificationsByQuery(query);

    const data = tickets.map((t) => ({
      classId: t.classId,
      className: t.className,
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      sessionIndex: t.sessionIndex,
      studentCount: t.studentCount,
      isLate: t.isLate,
      lec: t.lec,
      ta: t.ta,
      te: t.te,
    }));

    notificationCache.set(cacheKey, data, 60);
    log.info(
      `[Controller] getClassesNotifications served ${data.length} tickets (role=${isTE ? "TE" : "T"}, key=${cacheKey})`,
    );
    return res.json({ success: true, data });
  } catch (err) {
    log.error("[Controller] getClassesNotifications failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

// Ticket sync only (TE role; never sends email).
exports.syncNotifications = async (req, res) => {
  try {
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");
    if (!isTE) {
      return res.status(403).json({ error: "Access denied. TE role required." });
    }

    log.info("[Controller] Ticket-only notification sync triggered by TE");
    await NotificationScheduler.syncTicketsOnly();
    notificationCache.flushAll();

    res.json({ success: true, message: "Đồng bộ thông báo thành công" });
  } catch (err) {
    log.error("[Controller] syncNotifications failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

// Manual email send (no dedupe — always sends).
exports.sendReminderEmailsNow = async (req, res) => {
  try {
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");
    if (!isTE) {
      return res.status(403).json({ error: "Access denied. TE role required." });
    }

    log.info("[Controller] Manual email send triggered by TE");
    await NotificationScheduler.sendReminderEmailsNow();

    res.json({ success: true, message: "Đã gửi email nhắc nhở thành công" });
  } catch (err) {
    log.error("[Controller] sendReminderEmailsNow failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};
