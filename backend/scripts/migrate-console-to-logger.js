#!/usr/bin/env node
/**
 * Bulk-replace console.* with logger.* in the backend src tree.
 *
 * Strategy:
 *   - For each file under backend/src that has `const ... = require("./logger")`
 *     or `require("../utils/logger")`, skip (already migrated).
 *   - Otherwise, prepend a require for the logger (relative path inferred from
 *     file location) and a `const log = childLogger("<ModuleName>")` line, then
 *     rewrite console.{log,info,warn,error,debug} to log.{info,warn,error,debug}.
 *   - Preserves existing require blocks: just injects the logger import once.
 *
 * Idempotent: if `const log = childLogger(...)` is already present, skip.
 *
 * Usage:
 *   node scripts/migrate-console-to-logger.js           # dry run
 *   node scripts/migrate-console-to-logger.js --apply   # write changes
 *
 * Dry run prints a per-file report. The default is dry run for safety.
 */

const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const ROOT = path.join(__dirname, "..", "src");
const SKIP_FILES = new Set([
  "utils/logger.js",
  "utils/__tests__/roleResolver.test.js",
  "utils/__tests__/roleUtils.test.js",
  "utils/__tests__/boundedCache.test.js",
]);

const LEVELS = {
  log: "info",
  info: "info",
  warn: "warn",
  error: "error",
  debug: "debug",
};

function moduleNameFromPath(filePath) {
  // e.g. services/notificationScheduler.js -> NotificationScheduler
  // e.g. controllers/classController.js    -> ClassController
  // e.g. utils/roleResolver.js             -> RoleResolver
  const base = path.basename(filePath, ".js");
  // Camel-case the first letter for module tag
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function loggerRequireFor(filePath) {
  // Compute relative require path to src/utils/logger.js
  const fromDir = path.dirname(filePath);
  let rel = path
    .relative(fromDir, path.join(ROOT, "utils", "logger.js"))
    .replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function alreadyMigrated(src) {
  return /childLogger\(/.test(src) || /require\(['"][^'"]*logger['"]\)/.test(src) && /const\s+log\s*=/.test(src);
}

function countConsoleCalls(src) {
  return (src.match(/console\.(log|info|warn|error|debug)\(/g) || []).length;
}

function replaceConsoleCalls(src) {
  // Replace console.X(arg) -> log.Y(arg) for X in {log,info,warn,error,debug}.
  return src.replace(/console\.(log|info|warn|error|debug)\(/g, (_, lvl) => {
    return `log.${LEVELS[lvl] || "info"}(`;
  });
}

function injectLoggerImport(src, filePath) {
  if (alreadyMigrated(src)) return src;
  const rel = loggerRequireFor(filePath);
  const moduleName = moduleNameFromPath(filePath);

  // Find a good spot: after the last `require(...)` line at the top of the file.
  const lines = src.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^const\s+.*=\s*require\(/.test(line) || /^require\(/.test(line)) {
      insertAt = i + 1;
    } else if (line.trim() === "" && insertAt > 0 && i === insertAt) {
      // skip blank line after the last require
      insertAt = i + 1;
      break;
    } else {
      break;
    }
  }

  const importLines = [
    `const { childLogger } = require("${rel}");`,
    `const log = childLogger("${moduleName}");`,
    "",
  ];

  return [...lines.slice(0, insertAt), ...importLines, ...lines.slice(insertAt)].join("\n");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = walk(ROOT).filter((f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    return !SKIP_FILES.has(rel);
  });

  let totalCalls = 0;
  let totalFiles = 0;
  const report = [];

  for (const file of files) {
    const src = fs.readFileSync(file, "utf-8");
    const calls = countConsoleCalls(src);
    if (calls === 0) continue;

    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const migrated = injectLoggerImport(src, file);
    const rewritten = replaceConsoleCalls(migrated);
    totalCalls += calls;
    totalFiles += 1;
    report.push({ file: rel, calls });

    if (APPLY) {
      fs.writeFileSync(file, rewritten, "utf-8");
    }
  }

  if (!APPLY) {
    console.log("DRY RUN — pass --apply to write changes.\n");
  }
  for (const { file, calls } of report) {
    console.log(`  ${calls.toString().padStart(3)}  ${file}`);
  }
  console.log(`\n${APPLY ? "WROTE" : "Would migrate"} ${totalCalls} console calls across ${totalFiles} files.`);
}

main();
