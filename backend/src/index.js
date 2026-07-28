const path = require("path");
const fs = require("fs");

const { childLogger } = require("./utils/logger.js");
const log = childLogger("Index");

// Fix: System DNS (fe80::1 IPv6 link-local) does not support SRV record queries
// required for MongoDB Atlas connection strings (mongodb+srv://). Override to use Google DNS.
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

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
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const config = require("./config");
const healthRoutes = require("./routes/healthRoutes");
const securityRoutes = require("./routes/securityRoutes");
const authRoutes = require("./routes/authRoutes");
const classRoutes = require("./routes/classRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const spreadsheetRoutes = require("./routes/spreadsheetRoutes");
const NotificationScheduler = require("./services/notificationScheduler");
const StudentScheduler = require("./services/studentScheduler");
const { ScheduleScheduler } = require("./services/scheduleScheduler");
const { connectMongoDB } = require("./config/mongodb");
const { initializeKeys } = require("./utils/apiKeyManager");

// ---- 0. Required Environment Variables Validation ----
const requiredEnvVars = [
  { name: "MONGODB_URI", description: "MongoDB connection string", format: "mongodb://" },
  { name: "FIREBASE_API_KEY", description: "Firebase API key" },
  { name: "INTERNAL_API_KEY", description: "Internal API key for session management" },
  { name: "NODE_ENV", description: "Environment (development/production)", values: ["development", "production"] },
  { name: "LMS_MASTER_USERNAME", description: "LMS master account username", required: false },
  { name: "LMS_MASTER_PASSWORD", description: "LMS master account password", required: false },
  { name: "TOKEN_ENCRYPTION_KEY", description: "32-byte hex key for token encryption (64 hex chars)", required: false, format: "64hex" },
];

const missingEnvVars = [];
const invalidEnvVars = [];

for (const envVar of requiredEnvVars) {
  if (envVar.required !== false && !process.env[envVar.name]) {
    missingEnvVars.push(`${envVar.name} (${envVar.description})`);
  } else if (envVar.format && !process.env[envVar.name]?.startsWith(envVar.format)) {
    invalidEnvVars.push(`${envVar.name} must start with ${envVar.format}`);
  } else if (envVar.values && !envVar.values.includes(process.env[envVar.name])) {
    invalidEnvVars.push(`${envVar.name} must be one of: ${envVar.values.join(", ")}`);
  } else if (envVar.format === "64hex" && process.env[envVar.name]) {
    // Validate hex format (64 hex characters = 32 bytes)
    if (!/^[a-fA-F0-9]{64}$/.test(process.env[envVar.name])) {
      invalidEnvVars.push(`${envVar.name} must be exactly 64 hexadecimal characters (32 bytes)`);
    }
  }
}

if (missingEnvVars.length > 0 || invalidEnvVars.length > 0) {
  log.error("=".repeat(60));
  if (missingEnvVars.length > 0) {
    log.error("FATAL: Missing required environment variables:");
    missingEnvVars.forEach((v) => log.error(`  - ${v}`));
  }
  if (invalidEnvVars.length > 0) {
    log.error("FATAL: Invalid environment variables:");
    invalidEnvVars.forEach((v) => log.error(`  - ${v}`));
  }
  log.error("=".repeat(60));
  log.error("Server cannot start without valid configuration. Please fix your .env file or environment.");
  process.exit(1);
}

log.info("[EnvValidation] All required environment variables present and valid.");

// ---- 1. Express API Server Setup ----
const app = express();
const PORT = process.env.SERVER_PORT;

// Security headers (Helmet). Disable some defaults that conflict with SPA patterns.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);

// Parse cookies (needed for CSRF cookie).
app.use(cookieParser());

// ---- 1b. CSRF Protection ----
// csurf is imported here (after cookie-parser) so it can read/write cookies.
const { buildCsrfMiddleware } = require("./middleware/csrfMiddleware");
const csrfMiddleware = buildCsrfMiddleware();

// Cấu hình các domain được phép truy cập API (CORS)
const allowedOrigins = process.env.ALLOWED_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development/test environments, allow all origins
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      
      // In production, ONLY allow explicitly whitelisted origins
      if (allowedOrigins && allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      // Reject all other origins in production
      log.warn(`[CORS] Rejected origin in production: ${origin}`);
      return callback(new Error("CORS policy violation"), false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "200kb" }));

// API Routes
app.use("/", healthRoutes);
app.use("/", securityRoutes);
app.use(csrfMiddleware); // CSRF validation on all mutations (except exempt paths)
app.use("/", authRoutes);
app.use("/", classRoutes);
app.use("/", sessionRoutes);
app.use("/", teacherRoutes);
app.use("/spreadsheet", spreadsheetRoutes);

// Global Error Handler - Prevents server from crashing on unhandled errors
app.use((err, req, res, next) => {
  // Handle CSRF token errors with a user-friendly response.
  if (err.code === "EBADCSRFTOKEN") {
    log.warn("[CSRF] Invalid or missing CSRF token from %s %s", req.method, req.path);
    return res.status(403).json({
      success: false,
      error: "Invalid or missing CSRF token. Please refresh the page and try again.",
      code: "EBADCSRFTOKEN",
    });
  }
  log.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// ---- 2. Unified Startup Logic ----
async function startApp() {
  try {
    // 2.0 Connect to MongoDB first
    await connectMongoDB();

    // 2.1 Initialize rotating API keys (Redis-backed; falls back to legacy static key)
    await initializeKeys();

    // 2.2 Warm cache: sync from LMS if MongoDB Class collection is empty
    const ClassCacheService = require("./services/classCache");
    await ClassCacheService.bootstrapCache();

    // 2.1 Start API Server
    // Lắng nghe trên "0.0.0.0" thay vì "127.0.0.1" để cho phép các kết nối từ bên ngoài Internet gọi vào API trên VPS
    const server = app.listen(PORT, "0.0.0.0", async () => {
      log.info(`API Server is running on PORT ${PORT}`);

      // Start Notification Background Sync
      NotificationScheduler.start();

      // Start Student Background Sync
      StudentScheduler.start();

      // Start Class Background Sync
      require("./services/classScheduler").start();

      // Start Schedule Background Sync
      ScheduleScheduler.start();

      // Start Office Hour Background Sync
      require("./services/officeHourScheduler").start();
    });

    // Track active connections so we can drain them gracefully.
    server.on("connection", (conn) => {
      const key = `${conn.remoteAddress}:${conn.remotePort}`;
      activeSockets.set(key, conn);
      conn.on("close", () => activeSockets.delete(key));
    });

    // Register shutdown handlers (SIGTERM from orchestrators, SIGINT from dev).
    registerGracefulShutdown(server);
  } catch (error) {
    log.error("Failed to start API server:", error);
    process.exit(1);
  }
}

// ---- 3. Graceful Shutdown ----
const SHUTDOWN_TIMEOUT_MS = 30_000;
const activeSockets = new Map();
let shuttingDown = false;

function registerGracefulShutdown(server) {
  const shutdown = (signal) => {
    if (shuttingDown) {
      log.warn(`[Shutdown] Received ${signal} while already shutting down. Forcing exit.`);
      process.exit(1);
    }
    shuttingDown = true;
    log.info(`[Shutdown] Received ${signal}. Draining ${activeSockets.size} active connections...`);

    // Stop accepting new connections, then wait for in-flight requests to finish.
    server.close((err) => {
      if (err) {
        log.error(`[Shutdown] server.close() error: ${err.message}`);
        process.exit(1);
      }
      log.info("[Shutdown] HTTP server closed. Disconnecting MongoDB...");

      mongoose
        .disconnect()
        .then(() => {
          log.info("[Shutdown] MongoDB disconnected. Exiting cleanly.");
          process.exit(0);
        })
        .catch((disconnectErr) => {
          log.error(`[Shutdown] MongoDB disconnect failed: ${disconnectErr.message}`);
          process.exit(1);
        });
    });

    // Force exit if the drain takes too long (e.g. a stuck request).
    setTimeout(() => {
      log.error(
        `[Shutdown] Forced exit after ${SHUTDOWN_TIMEOUT_MS}ms. Active sockets: ${activeSockets.size}`,
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    log.error("[uncaughtException]", err);
  });
  process.on("unhandledRejection", (reason) => {
    log.error("[unhandledRejection]", reason);
  });
}

// Start everything
startApp();
