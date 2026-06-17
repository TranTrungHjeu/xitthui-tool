const path = require("path");
const fs = require("fs");

// Load env variables: first check local folder, then fall back to root folder
const localEnvPath = path.join(__dirname, "../.env");
const rootEnvPath = path.join(__dirname, "../../.env");
if (fs.existsSync(localEnvPath)) {
  require("dotenv").config({ path: localEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  require("dotenv").config({ path: rootEnvPath });
} else {
  require("dotenv").config(); // default fallback
}

const express = require("express");
const cors = require("cors");
const config = require("./config");
const authRoutes = require("./routes/authRoutes");
const classRoutes = require("./routes/classRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const zaloRoutes = require("./routes/zaloRoutes");
const { startScheduler } = require("./services/zaloScheduler");
const { startPolling } = require("./services/zaloPolling");

// ---- 1. Express API Server Setup ----
const app = express();
// Sử dụng SERVER_PORT cho Backend API
const PORT = process.env.SERVER_PORT;

// Cấu hình các domain được phép truy cập API (CORS)
const allowedOrigins = process.env.ALLOWED_ORIGINS;

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
app.use("/api", teacherRoutes);
app.use("/api/zalo", zaloRoutes); // Dashboard APIs & Webhook
app.use("/zalo", zaloRoutes); // Legacy Zalo Webhook endpoint (keep to not break existing webhooks)

// Global Error Handler - Prevents server from crashing on unhandled errors
app.use((err, req, res, next) => {
  console.error("💥 Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// ---- 2. Unified Startup Logic ----
async function startApp() {
  try {
    // 2.1 Start API Server
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`API Server is running on PORT ${PORT}`);
      // Start Zalo Bot polling (reads messages from users)
      startPolling();
      // Start Zalo reminder scheduler (sends proactive reminders)
      startScheduler();
    });
  } catch (error) {
    console.error("Failed to start API server:", error);
    process.exit(1);
  }
}

// Nếu chạy trên môi trường Vercel, xuất Express app ra thay vì listen()
if (process.env.VERCEL) {
  module.exports = app;
} else {
  startApp();
}
