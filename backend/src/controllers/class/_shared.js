/**
 * Class Controller — Shared Utilities & Dependencies
 *
 * This file is imported by all class sub-controllers. It holds the shared
 * cache instances and service dependencies so that each sub-controller can
 * require them without duplication.
 *
 * NOTE: In the previous monolith (classController.js), these were declared
 * at the top of the file. After the split, each sub-controller imports
 * from here instead of re-declaring them.
 */

const LMSClient = require("../services/lmsClient");
const ClassCacheService = require("../services/classCache");
const FirestoreNotification = require("../storage/notificationStorage");
const NotificationScheduler = require("../services/notificationScheduler");
const FirestoreStudent = require("../storage/studentStorage");
const StudentScheduler = require("../services/studentScheduler");
const BoundedCache = require("../utils/boundedCache");
const { VertexAI } = require("@google-cloud/vertexai");
const { loadServiceAccountCredentials } = require("../utils/googleCredentials");
const { childLogger } = require("../utils/logger.js");
const {
  getClassWeekdayIndexes,
  getRealTeacherByRole,
  getClassTimeRange,
  getClassWeekdays,
  getCurrentSessionIndex,
} = require("../utils/classHelpers");

const log = childLogger("ClassController");

// Vertex AI credentials
const vertexCredentials = (() => {
  try {
    return loadServiceAccountCredentials();
  } catch (err) {
    log.error("[classController] Failed to load Vertex AI credentials:", err.message);
    return null;
  }
})();

const vertexAIConfig = {
  project: process.env.VERTEX_AI_PROJECT_ID || "xitthui-tool",
  location: process.env.VERTEX_AI_LOCATION || "us-central1",
  googleAuthOptions: vertexCredentials
    ? { credentials: vertexCredentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }
    : {
        keyFilename:
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          require("path").join(__dirname, "../../serviceAccountKey.json"),
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      },
};

const vertexAI = new VertexAI(vertexAIConfig);

// =============================================================================
// CACHE STRATEGY (SCALE-2)
// =============================================================================
// Three layers collaborate; each one has a single, well-defined role:
//
//   1. BoundedCache (in-process)        -> hot path, TTL < 5 min
//      - Per-process in-memory caches kept here.
//      - Bounded to prevent unbounded memory growth (LRU eviction).
//      - Dropped on process restart; that's fine because entries are
//        cheap to recompute (one MongoDB lookup).
//
//   2. MongoDB (persistent storage)     -> durable source of truth
//      - The ONLY persistent layer; survives restarts.
//      - Writers invalidate the in-memory cache (L1) by .del()/.flushAll().
//      - NOT a cache: never put TTL on MongoDB reads.
//
//   3. LMS (external system)            -> fallback
//      - Slowest path; reached only when L1 + L2 both miss.
//
// L1: classDetailsCache — individual class detail payloads (classController & getClassById)
// L1: classNotificationDetailsCache — notification-specific data (getClassesNotifications)
// L1: notificationCache — lightweight notification summaries (getClassesNotifications)
//
// L1 settings: maxKeys=200, stdTTL=300s (5min), checkPeriod=120s.
// Bounded to 200 unique class IDs in memory — the most active ones.
// Beyond that the cache is LRU-evicted; fine because MongoDB is the source of truth.
//
// Cache invalidation is call-site: callers call .del(key) after writes (evaluation, enrollment).

const classDetailsCache = new BoundedCache({
  maxKeys: 200,
  stdTTL: 300,
  checkperiod: 120,
});

const classNotificationDetailsCache = new BoundedCache({
  maxKeys: 200,
  stdTTL: 300,
  checkperiod: 120,
});

const notificationCache = new BoundedCache({
  maxKeys: 500,
  stdTTL: 60,
  checkperiod: 30,
});

module.exports = {
  LMSClient,
  ClassCacheService,
  FirestoreNotification,
  NotificationScheduler,
  FirestoreStudent,
  StudentScheduler,
  BoundedCache,
  vertexAI,
  vertexAIConfig,
  log,
  classHelpers: {
    getClassWeekdayIndexes,
    getRealTeacherByRole,
    getClassTimeRange,
    getClassWeekdays,
    getCurrentSessionIndex,
  },
  caches: {
    classDetailsCache,
    classNotificationDetailsCache,
    notificationCache,
  },
};
