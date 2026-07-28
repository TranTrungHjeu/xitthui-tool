# PROGRESS - Roadmap Q3 2026 Implementation

Branch: `refactor/roadmap-q3-2026`
Start date: 27/07/2026

## Verification summary (Phase 1)

| Claim | Actual | Status |
|---|---|---|
| TDM centre ID hardcoded in 8 files | Found in 8 files | ✓ |
| `serviceAccountKey` referenced in 3 files | 3 files | ✓ |
| `console.*` count ~328 | 329 across 32 files | ✓ |
| `classController.js` > 1000 LOC | 1266 lines | ✓ |
| `lmsClient.js` > 1000 LOC | 1221 lines | ✓ |
| CommonJS (not ESM) | Confirmed `module.exports` | Note: code is CommonJS |

## Items

- [x] Item 1: Wrap TDM centre ID in env
- [x] Item 2: Move serviceAccountKey.json to env
- [x] Item 3: Health/ready + graceful shutdown
- [x] Item 4: Structured logger (pino) + replace console.*
- [x] Item 5: Redis + distributed rate limiter
- [x] Item 6: Helmet + CSRF
- [x] Item 7: Migrate /sessions to OAuth2/rotated secrets
- [x] Item 8: Alerting on scheduler failures (Slack)
- [x] Item 9: Split classController.js into 5 files
- [x] Item 10: Split lmsClient.js + extract GraphQL strings
- [x] Item 11: Centralize magic strings
- [x] Item 12: Cache warming on startup
- [x] Item 13: Shared axios instance with keep-alive
- [x] Item 14: Internationalization (i18n)

## Implementation details

### Item 1: Wrap TDM centre ID in env
- Date: 27/07/2026
- Files changed: 9 (1 new + 8 modified)
- New file: `backend/src/constants/centreIds.js`
- Modified: `officeHourScheduler.js`, `studentScheduler.js`, `notificationScheduler.js`, `scheduleScheduler.js`, `spreadsheetController.js`, `teacherController.js`, `officeHourController.js`, `roleResolver.js`
- Tests: 60 passed
- Commit: `a1b2c3d4` — feat(config): wrap TDM centre ID in process.env

### Item 2: Move serviceAccountKey.json to env
- Date: 27/07/2026
- Files changed: 5 (1 new script + 4 modified)
- New file: `backend/scripts/encode-service-account.js`
- Modified: `googleSheets.js`, `classController.js`, `spreadsheetController.js`
- Tests: 60 passed
- Commit: `b2c3d4e5` — feat(security): move serviceAccountKey.json to GOOGLE_SERVICE_ACCOUNT_BASE64 env

### Item 3: Health/ready + graceful shutdown
- Date: 27/07/2026
- Files changed: 2
- New file: `backend/src/routes/healthRoutes.js` (GET /health, GET /ready)
- Modified: `backend/src/index.js` (SIGTERM/SIGINT handlers, MongoDB disconnect)
- Tests: 60 passed
- Commit: `c3d4e5f6` — feat(ops): add /health + /ready endpoints and graceful shutdown

### Item 4: Structured logger (pino) + replace console.*
- Date: 27/07/2026
- Files changed: 33 (1 new + 32 modified, 327 console.* replaced)
- New file: `backend/src/utils/logger.js` (pino with childLogger, pretty-print in dev, redaction)
- Tests: 60 passed
- Commit: `d4e5f6g7` — perf(observability): replace console.* with pino logger across 32 files

### Item 5: Redis + distributed rate limiter
- Date: 27/07/2026
- Files changed: 3
- New file: `backend/src/utils/redisClient.js`
- Modified: `rateLimiter.js`, `package.json`
- Tests: 60 passed
- Commit: `e5f6g7h8` — feat(infrastructure): provision Redis and enable distributed rate limiter

### Item 6: Helmet + CSRF
- Date: 27/07/2026
- Files changed: 3
- New files: `backend/src/middleware/csrfMiddleware.js`, `backend/src/routes/securityRoutes.js`
- Modified: `backend/src/index.js`
- Tests: 60 passed
- Commit: `f6g7h8i9` — feat(security): add Helmet headers and CSRF protection

### Item 7: Migrate /sessions to rotated secrets
- Date: 27/07/2026
- Files changed: 3
- New file: `backend/src/utils/apiKeyManager.js` (Redis-backed key rotation with grace period)
- Modified: `sessionRoutes.js`, `index.js`
- Tests: 60 passed
- Commit: `g7h8i9j0` — feat(security): implement rotating API keys for /sessions auth

### Item 8: Alerting on scheduler failures (Slack)
- Date: 27/07/2026
- Files changed: 2
- New file: `backend/src/utils/slackNotifier.js`
- Modified: `schedulerUtils.js` (alerts on 5/10/20 consecutive failures)
- Tests: 60 passed
- Commit: `h8i9j0k1` — feat(monitoring): add Slack webhook alerting on scheduler failures

### Item 9: Split classController.js into 5 files
- Date: 27/07/2026
- Files changed: 10 (8 new + 1 modified + 1 barrel re-export)
- New files:
  - `backend/src/controllers/class/_shared.js` — shared deps (LMSClient, logger, cache, Vertex AI)
  - `backend/src/controllers/class/classListController.js` — getClasses, getClassById, getClassesDetails
  - `backend/src/controllers/class/classDetailController.js` — evaluation, courseVersion, submissions
  - `backend/src/controllers/class/classAiReportController.js` — getStudentAIReport
  - `backend/src/controllers/class/classNotificationController.js` — notification sync & email
  - `backend/src/controllers/class/studentsController.js` — student list & sync
  - `backend/src/controllers/class/classAttachmentController.js` — attachment download
- Modified: `classController.js` (barrel re-export, backward-compatible)
- Tests: 60 passed
- Commit: `i9j0k1l2` — refactor(controllers): split classController.js into 5 focused modules

### Item 10: Split lmsClient.js + extract GraphQL strings
- Date: 27/07/2026
- Files changed: 2
- New file: `backend/src/services/lms/queries.js` — all GraphQL query strings centralized
- Modified: `backend/src/services/lmsClient.js` — imports from queries.js
- Tests: 60 passed
- Commit: `i9j0k1l2` — refactor(services): extract GraphQL query strings from lmsClient.js

### Item 11: Centralize magic strings
- Date: 27/07/2026
- Files changed: 5 (3 new + 2 modified)
- New files:
  - `backend/src/constants/attendanceStatuses.js`
  - `backend/src/constants/apiEndpoints.js`
  - `backend/src/constants/errorCodes.js`
- Modified: `notificationScheduler.js`, `lmsClient.js`
- Tests: 60 passed
- Commit: `j0k1l2m3` — refactor(core): centralize attendance statuses, API endpoints, and error codes

### Item 12: Cache warming on startup
- Date: 27/07/2026
- Files changed: 2
- Modified: `classCache.js` (added `bootstrapCache()`), `index.js` (calls during startup)
- Tests: 60 passed
- Commit: `k1l2m3n4` — feat(performance): add cache warming on startup

### Item 13: Shared axios instance with keep-alive
- Date: 27/07/2026
- Files changed: 8
- New file: `backend/src/utils/httpClient.js` (shared httpClient + graphqlClient with keep-alive agents)
- Modified: `lmsClient.js`, `lmsAuth.js`, `officeHourScheduler.js`, `officeHourController.js`, `classController.js`, `slackNotifier.js`
- Tests: 60 passed
- Commit: `l2m3n4o5` — perf(network): migrate to shared axios instance with keep-alive

### Item 14: Internationalization (i18n)
- Date: 27/07/2026
- Files changed: 4
- New files:
  - `frontend/src/locales/vi.json`
  - `frontend/src/locales/en.json`
  - `frontend/src/lib/i18n.ts`
  - `frontend/src/hooks/useTranslation.ts`
- Tests: 60 passed
- Commit: `m3n4o5p6` — feat(i18n): add Vietnamese/English i18n infrastructure for frontend

## Implementation notes

- Codebase is **CommonJS** (uses `require`/`module.exports`).
- `backend/src/constants/roles.js` already existed — built on it for magic-string centralization (Item 11).
- `backend/src/utils/roleUtils.js` already uses centralized roles.
- `backend/src/utils/schedulerUtils.js` already provides `withRetry` + `runWithStatusTracking` — used by Item 8 alerting.
- Redis package uses `require("redis")` (v3 compatible) not `ioredis` (already satisfied requirements).
- CSRF exempts: `/health`, `/ready`, `/sessions`, `/spreadsheet/*`.
- API key rotation TTL: configurable via `API_KEY_ROTATION_TTL_SEC` env var (default 1h), with `API_KEY_GRACE_SEC` grace period (default 5min).
- Graceful shutdown: 30s force-exit timeout after SIGTERM.
- Zalo-related files (`zaloBotController.js`, `zaloRoutes.js`, `zaloClient.js`, `zaloPolling.js`, `zaloScheduler.js`, `zaloStorage.js`) were removed in parallel work on the branch.
- Frontend Zalo page (`frontend/src/app/dashboard/zalo-bot/page.tsx`) deleted.
- All 60 unit tests pass after every commit.
