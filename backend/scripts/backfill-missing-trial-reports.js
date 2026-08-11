/**
 * Backfill missing TrialReport rows for orphan R2 objects.
 *
 * When to run this:
 *   - After R2 migration: any PDF that exists in the bucket but does
 *     NOT have a matching `trial_reports` row in MongoDB.
 *   - After manual upload to R2 (curl / dashboard / external tool)
 *     that bypassed `registerReport`.
 *
 * What it does:
 *   1. Walks every PDF object under `R2_ROOT_PREFIX` (recursive).
 *   2. Looks up each R2 object key in `trial_reports`.
 *   3. For every key missing a row, inserts a minimal stub with the
 *      metadata we can parse from the path layout:
 *        {prefix}/{year}/{month-year}/{day}/{teacher}/{ulid}__filename
 *      Where:
 *        year, month, day   -> classDate (best-effort)
 *        teacher            -> teacherName
 *        filename           -> fileName (the "ulid__" prefix is stripped)
 *      Fields we *can't* recover from the key are left empty:
 *        studentName, teacherCode, reportType, uploadedBy*
 *
 * Usage:
 *   # Dry-run (default) — print what would be inserted, change nothing.
 *   node scripts/backfill-missing-trial-reports.js
 *
 *   # Apply — actually insert the missing rows + write audit log.
 *   node scripts/backfill-missing-trial-reports.js --apply
 *
 *   # Custom prefix (default uses R2_ROOT_PREFIX from .env).
 *   node scripts/backfill-missing-trial-reports.js --prefix trial-reports/2025
 *
 * Idempotency:
 *   The script always does `findOne({_id: key})` before insert; it will
 *   never overwrite an existing row. Safe to re-run after a partial run.
 *
 * Side effects (with --apply):
 *   - Inserts rows into `trial_reports`
 *   - Inserts rows into `trial_report_logs` (action="upload",
 *     source="r2-backfill") so we can tell backfilled rows apart from
 *     real ones later.
 */

const path = require("path");
const mongoose = require("mongoose");

// Load .env from backend root so MONGO_URI / R2_* are populated.
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const { connectMongoDB } = require("../src/config/mongodb");
const models = require("../src/storage/mongoModels");
const { loadR2Config, config, listAllKeys } = require("../src/services/r2Client");

// --------------------------------------------------------------------------
// CLI flags
// --------------------------------------------------------------------------

const args = process.argv.slice(2);
const FLAGS = {
  apply: args.includes("--apply"),
  prefix: (() => {
    const i = args.indexOf("--prefix");
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  })(),
};

// --------------------------------------------------------------------------
// Path parsing
//
// Expected layout (from r2Client.buildKey + uploadFile):
//   {rootPrefix}/{year}/{month-year}/{day}/{teacher}/{ulid}__{safeName}.pdf
//
// Examples:
//   trial-reports/2025/08-2025/01-08-2025/Lê Thế Khiêm/abc...__Anh Thư.pdf
// --------------------------------------------------------------------------

function parseR2Key(key, rootPrefix) {
  const out = {
    year: null,
    month: null,
    day: null,
    teacher: null,
    rawFileName: null,
    cleanFileName: null,
  };

  const rel = key.startsWith(rootPrefix)
    ? key.slice(rootPrefix.length).replace(/^\/+/, "")
    : key;
  const segments = rel.split("/").filter(Boolean);
  if (segments.length < 5) return out;

  // [year, monthYear, day, teacher, ulid__name]
  const [year, monthYear, day, teacher, filePart] = segments;
  out.year = year || null;
  out.month = (monthYear && monthYear.split("-")[0]) || null;
  out.day = day || null;
  out.teacher = decodeURIComponentSafe(teacher);
  out.rawFileName = filePart || null;
  out.cleanFileName = stripUlidPrefix(filePart);
  return out;
}

function decodeURIComponentSafe(s) {
  if (!s) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function stripUlidPrefix(filePart) {
  if (!filePart) return filePart;
  // uploadFile uses `${objectId}__${safeName}` where objectId is uuidv4.
  // Strip the prefix so the FE / log shows the original name.
  const idx = filePart.indexOf("__");
  return idx >= 0 ? filePart.slice(idx + 2) : filePart;
}

function classDateFromParts(year, month, day) {
  // "01-08-2025" — day is DD-MM-YYYY Vietnamese format.
  if (!day || !month || !year) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(day);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  if (Number(yyyy) !== Number(year) || Number(mm) !== Number(month)) return null;
  const iso = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// --------------------------------------------------------------------------
// R2 listing
//
// `r2Client.listAllKeys` is the canonical helper — it walks every key
// under a prefix using ListObjectsV2 pagination. Reusing it keeps the
// script in sync with the rest of the codebase (region/endpoint/creds
// are configured exactly the same way).
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Backfill core
// --------------------------------------------------------------------------

function buildStub(parsed, key, size) {
  const classDate = classDateFromParts(
    parsed.year,
    parsed.month,
    parsed.day
  );
  return {
    _id: key,
    fileId: key,
    fileName: parsed.cleanFileName || parsed.rawFileName || "(unknown)",
    mimeType: "application/pdf",
    size: typeof size === "number" ? size : null,
    webViewLink: "",
    webContentLink: "",
    r2Key: key,
    parentFolderId: "",
    reportType: "pdf-upload",
    classDate: classDate,
    teacherCode: "",
    teacherName: parsed.teacher || "",
    studentName: "",
    uploadedBy: null,
    uploadedByName: "(backfilled from R2)",
    uploadedByEmail: "",
    deletedAt: null,
    version: 1,
    previousReportId: null,
    reportGroupId: key,
  };
}

async function run({ apply, prefixOverride }) {
  loadR2Config();
  const rootPrefix =
    prefixOverride !== null && prefixOverride !== undefined
      ? prefixOverride
      : config().rootPrefix;

  console.log(
    `[backfill] rootPrefix=${rootPrefix} mode=${apply ? "APPLY" : "DRY-RUN"}`
  );

  // 1. Connect Mongo
  await connectMongoDB();
  const { TrialReport, TrialReportLog } = models;
  console.log("[backfill] connected to MongoDB");

  // 2. List every R2 key
  const allKeys = await listAllKeys(rootPrefix);
  console.log(`[backfill] R2 objects under prefix: ${allKeys.length}`);

  // 3. Bulk-load existing rows for these keys (1 round-trip instead
  //    of N). MongoDB caps BSON $in at ~100k items; we slice if needed.
  const allKeyStrings = allKeys.map((o) => o.key);
  const existingRows = new Set();
  const IN_CHUNK = 5000;
  for (let i = 0; i < allKeyStrings.length; i += IN_CHUNK) {
    const slice = allKeyStrings.slice(i, i + IN_CHUNK);
    const rows = await TrialReport.find(
      { _id: { $in: slice } },
      { _id: 1 }
    ).lean();
    for (const r of rows) existingRows.add(r._id);
  }
  console.log(`[backfill] existing rows in Mongo: ${existingRows.size}`);

  // 4. Walk each key
  const summary = {
    scanned: allKeys.length,
    skippedNonPdf: 0,
    alreadyIndexed: 0,
    missing: 0,
    inserted: 0,
    errors: 0,
    samples: [], // first 10 missing rows (dry-run visibility)
  };

  for (const obj of allKeys) {
    // Only backfill PDFs — leave any other object types alone.
    if (!obj.key.toLowerCase().endsWith(".pdf")) {
      summary.skippedNonPdf += 1;
      continue;
    }

    if (existingRows.has(obj.key)) {
      summary.alreadyIndexed += 1;
      continue;
    }

    summary.missing += 1;
    const parsed = parseR2Key(obj.key, rootPrefix);
    const stub = buildStub(parsed, obj.key, obj.size);

    if (summary.samples.length < 10) {
      summary.samples.push({
        key: obj.key,
        parsed,
        stubPreview: {
          fileName: stub.fileName,
          teacherName: stub.teacherName,
          classDate: stub.classDate,
        },
      });
    }

    if (apply) {
      try {
        await TrialReport.create(stub);
        await TrialReportLog.create({
          action: "upload",
          reportId: obj.key,
          reportType: stub.reportType,
          fileName: stub.fileName,
          targetUserId: null,
          performedBy: null,
          performedByName: "backfill-script",
          metadata: {
            source: "r2-backfill",
            reason: "orphan object — no TrialReport row",
            originalSize: obj.size,
            originalLastModified: obj.lastModified,
            originalETag: obj.etag,
            parsedFromKey: parsed,
          },
          error: "",
        });
        summary.inserted += 1;
        console.log(`[backfill] + inserted ${obj.key}`);
      } catch (err) {
        summary.errors += 1;
        console.error(`[backfill] ! failed ${obj.key}: ${err.message}`);
      }
    }
  }

  // 5. Summary
  console.log("\n========== BACKFILL SUMMARY ==========");
  console.log(JSON.stringify(summary, null, 2));
  console.log("======================================");

  if (!apply) {
    console.log(
      "\n[backfill] DRY-RUN finished. Re-run with --apply to insert."
    );
  }
}

// --------------------------------------------------------------------------
// Bootstrap
// --------------------------------------------------------------------------

(async () => {
  try {
    await run({ apply: FLAGS.apply, prefixOverride: FLAGS.prefix });
  } catch (err) {
    console.error("[backfill] fatal:", err);
    process.exitCode = 1;
  } finally {
    // Make sure mongoose closes even if run() throws mid-loop.
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }
})();