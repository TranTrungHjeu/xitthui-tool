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
const mongoose = require("mongoose");
const config = require("./config");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const classRoutes = require("./routes/classRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const spreadsheetRoutes = require("./routes/spreadsheetRoutes");
const trialReportRoutes = require("./routes/trialReportRoutes");
const lmsRoutes = require("./routes/lmsRoutes");
const zaloRoutes = require("./routes/zaloRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const NotificationScheduler = require("./services/notificationScheduler");
const StudentScheduler = require("./services/studentScheduler");
const StudentCommentsScheduler = require("./services/studentCommentsScheduler");
const TeacherScheduler = require("./services/teacherScheduler");
const { ScheduleScheduler } = require("./services/scheduleScheduler");
const { connectMongoDB } = require("./config/mongodb");
const { initializeKeys } = require("./utils/apiKeyManager");
const { cookieParser } = require("./utils/cookies");
const { cookieAuth } = require("./middleware/cookieAuth");

// ---- 0. Required Environment Variables Validation ----
// Small-team project: only 2 keys are required. Optional keys are not validated here
// to keep startup fast. See utils/tokenEncryption.js for at-rest encryption behavior.
const requiredEnvVars = [
  { name: "MONGODB_URI", description: "MongoDB connection string", format: ["mongodb://", "mongodb+srv://"] },
  { name: "FIREBASE_API_KEY", description: "Firebase API key" },
  { name: "NODE_ENV", description: "Environment (development/production)", values: ["development", "production"] },
];

// Fallback: FIREBASE_API_KEY <- MINDX_FIREBASE_API_KEY
if (!process.env.FIREBASE_API_KEY && process.env.MINDX_FIREBASE_API_KEY) {
  process.env.FIREBASE_API_KEY = process.env.MINDX_FIREBASE_API_KEY;
}

// Default NODE_ENV to development when not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const missingEnvVars = [];
const invalidEnvVars = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar.name]) {
    missingEnvVars.push(`${envVar.name} (${envVar.description})`);
  } else if (envVar.format) {
    const formats = Array.isArray(envVar.format) ? envVar.format : [envVar.format];
    if (!formats.some((f) => process.env[envVar.name]?.startsWith(f))) {
      invalidEnvVars.push(`${envVar.name} must start with one of: ${formats.join(", ")}`);
    }
  } else if (envVar.values && !envVar.values.includes(process.env[envVar.name])) {
    invalidEnvVars.push(`${envVar.name} must be one of: ${envVar.values.join(", ")}`);
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

// ---- 1b. CSRF Protection ----
// CSRF protection was removed because:
//   1. Authentication is JWT Bearer (Authorization header), not session cookie.
//   2. Browsers do not auto-attach Bearer tokens on cross-site requests, so
//      there is no credential to hijack via CSRF.
//   3. CORS already enforces an origin whitelist in production (see cors()
//      below), which is the appropriate defense for this architecture.
// If a session-cookie flow is added later, reintroduce csurf with the
// `sameSite: "lax"` cookie option and wrap the /csrf-token route.

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
// Defense-in-depth: in production, also reject state-changing requests from
// disallowed origins even when CORS preflight is bypassed (e.g. simple
// form submissions). For Bearer-token APIs this is mostly redundant with
// the origin check above, but it's cheap and explicit.
const requireSameOrigin =
  process.env.NODE_ENV === "production"
    ? (req, res, next) => {
        if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
        const origin = req.headers.origin;
        // Allow requests with no Origin header (mobile apps, server-to-server)
        // — these can't be CSRF victims because they don't carry credentials
        // automatically.
        if (!origin) return next();
        if (
          allowedOrigins &&
          allowedOrigins.split(",").indexOf(origin) !== -1
        ) {
          return next();
        }
        log.warn(
          `[OriginCheck] Rejected ${req.method} ${req.path} from origin ${origin}`,
        );
        return res.status(403).json({
          success: false,
          error: "Origin not allowed.",
          code: "EORIGINNOTALLOWED",
        });
      }
    : (req, res, next) => next();

// API Routes
app.use(requireSameOrigin); // production-only origin check on mutations
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(cookieParser); // populates req.cookies from the Cookie header
app.use(cookieAuth); // copies req.cookies.lms_token/session_id into req.lmsToken/req.sessionId
app.use("/", healthRoutes);
app.use("/", authRoutes);
app.use("/", classRoutes);
app.use("/", sessionRoutes);
app.use("/", teacherRoutes);
app.use("/spreadsheet", spreadsheetRoutes);
app.use("/trial-report", trialReportRoutes);
app.use("/lms", lmsRoutes);
app.use("/zalo", zaloRoutes);
app.use("/lesson", lessonRoutes);
app.use("/payroll", payrollRoutes);

// Global Error Handler - Prevents server from crashing on unhandled errors
app.use((err, req, res, next) => {
  // Surface body-parser size errors with the actual limit so they're debuggable.
  if (err && err.type === "entity.too.large") {
    log.warn(
      `[PayloadTooLarge] ${req.method} ${req.path} length=${err.length} limit=${err.limit}`,
    );
    return res.status(413).json({
      success: false,
      error: `Payload too large (limit ${err.limit})`,
      code: "EPAYLOADTOOLARGE",
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

      // Start Student Comments Background Sync (master-account, daily 2:30 AM)
      StudentCommentsScheduler.start();

      // Start Teacher Background Sync
      TeacherScheduler.start();

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
    log.error("[uncaughtException] message=%s stack=%s", err.message, err.stack);
  });
  process.on("unhandledRejection", (reason) => {
    const r = reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason;
    log.error("[unhandledRejection] reason=%j", r);
  });
}

// Start everything
startApp();
