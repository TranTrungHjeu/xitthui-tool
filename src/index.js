const { Telegraf, session } = require("telegraf");
const config = require("./config");
const TelegramHandlers = require("./telegram/handlers");
const ReminderScheduler = require("./scheduler/reminderScheduler");
const app = require("./web/server");

const bot = config.telegram.token ? new Telegraf(config.telegram.token) : null;

if (bot) {
  // Middleware
  bot.use(session());

  // Commands
  bot.command("start", (ctx) => TelegramHandlers.handleStart(ctx));

  bot.command("login", (ctx) => {
    const match = ctx.message.text.match(/^\/login\s+(.+)$/);
    ctx.match = match;
    return TelegramHandlers.handleLogin(ctx);
  });

  bot.command("info", (ctx) => TelegramHandlers.handleInfo(ctx));

  bot.command("classes", (ctx) => TelegramHandlers.handleClasses(ctx));

  bot.command("reminders", (ctx) => TelegramHandlers.handleReminders(ctx));

  bot.command("logout", (ctx) => TelegramHandlers.handleLogout(ctx));

  // Error handling
  bot.catch((err, ctx) => {
    console.error("Bot error:", err);
    ctx
      .reply("❌ Đã xảy ra lỗi. Vui lòng thử lại hoặc liên hệ admin.")
      .catch(console.error);
  });
}

// Initialize reminder scheduler
let scheduler = null;

async function startBot() {
  try {
    // Start Web Server for testing FIRST
    const PORT = process.env.WEB_PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🌐 Web Test UI is running on http://localhost:${PORT}`);
    });

    if (bot) {
      console.log("🚀 Starting MindX LMS Telegram Bot...");

      // Start bot
      await bot.launch();
      console.log("✅ Bot started successfully!");

      // Start reminder scheduler
      scheduler = new ReminderScheduler(bot);
      scheduler.start();

      console.log("📖 Available commands:");
      console.log("  /start - Start the bot");
      console.log("  /login <TOKEN> - Login with LMS token");
      console.log("  /info - View account info");
      console.log("  /classes - View your classes");
      console.log("  /reminders - Check reminders");
      console.log("  /logout - Logout");
    } else {
      console.log(
        "⚠️  TELEGRAM_BOT_TOKEN is missing. Telegram bot is disabled.",
      );
      console.log(
        "👉 Please configure TELEGRAM_BOT_TOKEN in .env to use the bot.",
      );
    }
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once("SIGINT", async () => {
  console.log("\n⛔ Shutting down...");
  if (scheduler) {
    scheduler.stop();
  }
  if (bot) {
    await bot.stop("SIGINT");
  }
  console.log("✅ Application stopped.");
  process.exit(0);
});

process.once("SIGTERM", async () => {
  console.log("\n⛔ Shutting down...");
  if (scheduler) {
    scheduler.stop();
  }
  if (bot) {
    await bot.stop("SIGTERM");
  }
  console.log("✅ Application stopped.");
  process.exit(0);
});

// Start the bot
startBot();
