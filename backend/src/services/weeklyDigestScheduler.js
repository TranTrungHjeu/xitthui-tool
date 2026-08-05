const cron = require("node-cron");
const path = require("path");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("WeeklyDigestScheduler");

const VIETNAM_TZ = "Asia/Ho_Chi_Minh";
const { runWithStatusTracking } = require("../utils/schedulerUtils");

// Monday 8:00 AM Vietnam time. Override with WEEKLY_DIGEST_CRON for testing
// (e.g. "*/5 * * * *" to fire every 5 minutes).
const DEFAULT_CRON = "0 8 * * 1";
const SCHEDULER_NAME = "WeeklyDigestScheduler";

function getVietnamNow(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, dayKey };
}

// ISO week key "YYYY-Www" (Monday-based). Stable across years.
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

class WeeklyDigestScheduler {
  static start() {
    const expression = process.env.WEEKLY_DIGEST_CRON || DEFAULT_CRON;
    cron.schedule(
      expression,
      async () => {
        log.info(`[${SCHEDULER_NAME}] Tick at ${new Date().toISOString()}`);
        await this.runWithRetry();
      },
      { timezone: VIETNAM_TZ },
    );
    log.info(
      `[${SCHEDULER_NAME}] Initialized (cron='${expression}', tz=${VIETNAM_TZ}).`,
    );
  }

  /**
   * Run with retry logic and status tracking
   */
  static async runWithRetry(options = {}) {
    return runWithStatusTracking(
      SCHEDULER_NAME,
      () => this.run(options),
      { maxRetries: 3, baseDelayMs: 2000 },
    );
  }

  static async run({ bypassDedupe = false } = {}) {
    const NotificationTicket = require(path.join(
      __dirname,
      "../storage/mongoModels",
    )).NotificationTicket;
    const NotificationEmailLog = require("../storage/emailLogModel");
    const emailService = require("./emailService");
    const { renderWeeklyDigestEmail } = require("./emailTemplates/weeklyDigest");

    if (!emailService.isReady()) {
      log.warn(
        "[WeeklyDigestScheduler] Email service not ready. Skipping run.",
      );
      return { ok: false, reason: "email_not_ready" };
    }

    const now = new Date();
    const weekKey = isoWeekKey(now);
    const vietnam = getVietnamNow(now);

    // Tickets are saved with `date` in the LMS format (DD/MM/YYYY or
    // YYYY-MM-DD) and have a 14-day TTL, so 7 days back is a safe window.
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoKey = `${sevenDaysAgo.getUTCFullYear()}-${String(sevenDaysAgo.getUTCMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getUTCDate()).padStart(2, "0")}`;

    let tickets = [];
    try {
      tickets = await NotificationTicket.find({
        // We can't reliably compare the mixed string `date` field to a Date,
        // so we just take all tickets and filter in memory — the collection
        // is TTL-capped at 14 days, so the working set is small.
      }).lean();
    } catch (err) {
      log.error(
        "[WeeklyDigestScheduler] Failed to read NotificationTicket:",
        err.message,
      );
      return { ok: false, reason: "db_error", error: err.message };
    }

    // Filter to last 7 days (compare lexicographically on YYYY-MM-DD form).
    const normalized = tickets
      .map((t) => {
        const d = String(t.date || "");
        let ymd;
        if (d.includes("/")) {
          const [dd, mm, yy] = d.split("/").map(Number);
          ymd = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        } else {
          ymd = d.split("T")[0];
        }
        return { ...t, ymd };
      })
      .filter((t) => t.ymd >= sevenDaysAgoKey && t.ymd <= vietnam.dayKey);

    if (normalized.length === 0) {
      log.info(
        "[WeeklyDigestScheduler] No tickets in the last 7 days. Skipping.",
      );
      return { ok: true, sent: 0, skipped: "no_data" };
    }

    // Group by centreId -> array of tickets. centreIds is a string array.
    const byCentre = new Map();
    for (const t of normalized) {
      const centres = Array.isArray(t.centreIds) && t.centreIds.length > 0
        ? t.centreIds
        : ["unknown"];
      for (const cid of centres) {
        if (!byCentre.has(cid)) byCentre.set(cid, []);
        byCentre.get(cid).push(t);
      }
    }

    // For each centre, send 1 digest to a representative TE mailbox OR to a
    // global TE mailing list (configurable). For now we use the centre-id
    // derived placeholder, plus each ticket's TE field if available.
    const results = [];
    for (const [centreId, tixs] of byCentre.entries()) {
      // Build byTeacher grouping by ticket.te (teacher's TE name on that slot).
      const teacherMap = new Map();
      for (const t of tixs) {
        const key = t.te || "(không rõ TE)";
        if (!teacherMap.has(key)) {
          teacherMap.set(key, { teacherName: key, classes: [] });
        }
        teacherMap.get(key).classes.push({
          className: t.className,
          date: t.date,
          studentCount: t.studentCount,
          isLate: !!t.isLate,
        });
      }
      const byTeacher = Array.from(teacherMap.values());

      // Recipient resolution: per-centre TE mailing list env (optional), or
      // skip if none configured. Format: WEEKLY_DIGEST_TE_<CENTRE_ID_UPPER>.
      const envKey = `WEEKLY_DIGEST_TE_${centreId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
      const recipientsCsv = process.env[envKey] || process.env.WEEKLY_DIGEST_TE_DEFAULT;
      if (!recipientsCsv) {
        log.info(
          `[WeeklyDigestScheduler] No recipients configured for centre ${centreId} (env ${envKey}). Skipping.`,
        );
        results.push({ centreId, skipped: "no_recipients" });
        continue;
      }
      const recipients = recipientsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const dedupeId = `weekly_digest:${centreId}:${weekKey}`;
      if (!bypassDedupe) {
        try {
          const existing = await NotificationEmailLog.findById(dedupeId).lean();
          if (existing && existing.status === "sent") {
            log.info(
              `[WeeklyDigestScheduler] Already sent weekly digest for centre ${centreId} week ${weekKey}.`,
            );
            results.push({ centreId, skipped: "already_sent" });
            continue;
          }
        } catch (e) {
          log.warn(
            "[WeeklyDigestScheduler] dedupe check failed:",
            e.message,
          );
        }
      }

      const weekRange = {
        fromDate: formatDateKey(sevenDaysAgoKey),
        toDate: formatDateKey(vietnam.dayKey),
      };
      const rendered = renderWeeklyDigestEmail({
        centreName: centreId,
        weekRange,
        byTeacher,
        dashboardUrl: process.env.APP_DASHBOARD_URL,
      });

      // Send once to all recipients as a single comma-joined "to" header.
      const result = await emailService.sendMail({
        to: recipients.join(", "),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      try {
        await NotificationEmailLog.findOneAndUpdate(
          { _id: dedupeId },
          {
            _id: dedupeId,
            kind: "weekly_digest",
            email: recipients.join(","),
            dedupeKey: weekKey,
            subject: rendered.subject,
            messageId: result.messageId || null,
            status: result.ok ? "sent" : "failed",
            error: result.ok ? null : result.error,
            context: { centreId, teacherCount: byTeacher.length },
            sentAt: new Date(),
            updatedAt: new Date(),
          },
          { upsert: true },
        );
      } catch (e) {
        log.warn(
          `[WeeklyDigestScheduler] Failed to write log for ${centreId}:`,
          e.message,
        );
      }

      results.push({
        centreId,
        recipients: recipients.length,
        ok: result.ok,
        messageId: result.messageId,
        error: result.error,
      });
      log.info(
        `[WeeklyDigestScheduler] centre=${centreId} teachers=${byTeacher.length} ok=${result.ok}`,
      );
    }

    return { ok: true, weekKey, results };
  }
}

function formatDateKey(ymd) {
  // ymd is "YYYY-MM-DD" → "DD/MM/YYYY"
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

module.exports = WeeklyDigestScheduler;
