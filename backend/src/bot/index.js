const { Telegraf, session } = require("telegraf");
const config = require("../config");
const TelegramHandlers = require("./handlers/telegramHandlers");
const ReminderScheduler = require("./scheduler/reminderScheduler");

function setupBot() {
  if (!config.telegram.token) {
    console.log("⚠️  TELEGRAM_BOT_TOKEN is missing. Telegram bot is disabled.");
    return null;
  }

  const bot = new Telegraf(config.telegram.token);

  bot.use(session());
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

  bot.catch((err, ctx) => {
    console.error("Bot error:", err);
    ctx
      .reply("❌ Đã xảy ra lỗi. Vui lòng thử lại hoặc liên hệ admin.")
      .catch(console.error);
  });

  return bot;
}

module.exports = { setupBot, ReminderScheduler };
