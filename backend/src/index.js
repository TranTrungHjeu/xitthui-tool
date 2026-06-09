require("dotenv").config();
const express = require("express");
const cors = require("cors");
const config = require("./config");
const { setupBot, ReminderScheduler } = require("./bot");
const authRoutes = require("./routes/authRoutes");
const classRoutes = require("./routes/classRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

// ---- 1. Express API Server Setup ----
const app = express();
const PORT = process.env.WEB_PORT || 4444;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation"), false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "200kb" }));

// API Routes
app.use("/api", authRoutes);
app.use("/api", classRoutes);
app.use("/api", sessionRoutes);

// Global Error Handler - Prevents server from crashing on unhandled errors
app.use((err, req, res, next) => {
  console.error("💥 Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// ---- 2. Telegram Bot Setup ----
const bot = setupBot();

// ---- 3. Unified Startup Logic ----
let scheduler = null;

async function startApp() {
  try {
    // 3.1 Start API Server
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`🌐 API Server is running on http://127.0.0.1:${PORT}`);
    });

    // 3.2 Start Telegram Bot & Scheduler
    if (bot) {
      try {
        await bot.launch();
        scheduler = new ReminderScheduler(bot);
        scheduler.start();
      } catch (botError) {
        // Run API server anyway
      }
    }
  } catch (error) {
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n⛔ Received ${signal}. Shutting down...`);
  if (scheduler) scheduler.stop();
  if (bot) await bot.stop(signal);
  console.log("✅ Application stopped.");
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Start everything
startApp();
