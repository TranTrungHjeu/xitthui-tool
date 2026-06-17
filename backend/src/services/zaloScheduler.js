const cron = require("node-cron");
const ZaloData = require("../storage/zaloData");
const { sendGlobalReminder } = require("../controllers/zaloBotController");

let activeTasks = [];

function startScheduler() {
  if (activeTasks.length > 0) {
    console.log("[ZaloScheduler] Global scheduler already running.");
    return;
  }

  const config = ZaloData.getGlobalConfig();
  const times = config.reminderTimes || [];

  if (times.length === 0) {
    console.log("[ZaloScheduler] No reminder times configured.");
    return;
  }

  times.forEach((timeStr) => {
    // timeStr format: "HH:mm" (e.g. "08:30")
    const [hour, minute] = timeStr.split(":");
    if (!hour || !minute) return;

    const cronExpr = `${parseInt(minute)} ${parseInt(hour)} * * *`;
    const task = cron.schedule(
      cronExpr,
      async () => {
        console.log(`[ZaloScheduler] Running scheduled reminder at ${timeStr}`);
        await sendGlobalReminder();
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      },
    );

    activeTasks.push(task);
  });

  console.log(
    `[ZaloScheduler] Global scheduler started with times: ${times.join(", ")}`,
  );
}

function stopScheduler() {
  if (activeTasks.length > 0) {
    activeTasks.forEach((t) => t.stop());
    activeTasks = [];
    console.log("[ZaloScheduler] Global scheduler stopped.");
  }
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

module.exports = { startScheduler, stopScheduler, restartScheduler };
