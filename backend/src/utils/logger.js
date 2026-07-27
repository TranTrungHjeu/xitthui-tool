/**
 * Structured logger (pino).
 *
 * Use this instead of `console.*` everywhere. Output is JSON in production
 * (greppable, parseable by log aggregators) and pretty-printed in development.
 *
 * Conventions:
 *   - logger.info()    — normal flow events (request handled, scheduler run)
 *   - logger.warn()    — recoverable issues (rate limit hit, retry succeeded)
 *   - logger.error()   — failed actions (catch blocks, exception paths)
 *   - logger.debug()   — verbose info, gated by LOG_LEVEL=debug
 *   - logger.fatal()   — process about to die
 *
 * Performance:
 *   - `logger.child({ module: 'LMSClient' })` creates a child logger that
 *     prefixes every record with `module` without re-parsing the format.
 *   - Avoid `console.log(logger.info(...))` — the logger already emits JSON.
 *
 * Log level controlled via `LOG_LEVEL` env var (default: info).
 */

const pino = require("pino");

const level = process.env.LOG_LEVEL || "info";
const isDev = process.env.NODE_ENV !== "production";

const baseOptions = {
  level,
  base: {
    service: "mindx-support-tools-backend",
    pid: process.pid,
    nodeVersion: process.version,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.private_key",
    ],
    censor: "[REDACTED]",
  },
};

let transport;
if (isDev) {
  try {
    // eslint-disable-next-line global-require
    const pretty = require("pino-pretty");
    transport = pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname,service,nodeVersion",
      },
    });
  } catch (err) {
    // pino-pretty not installed in production-like setups; fall back to JSON.
    transport = undefined;
  }
}

const logger = transport
  ? pino(baseOptions, transport)
  : pino(baseOptions);

/**
 * Create a child logger scoped to a module/component.
 * @param {string} moduleName
 * @returns {pino.Logger}
 */
function childLogger(moduleName) {
  return logger.child({ module: moduleName });
}

module.exports = {
  logger,
  childLogger,
};
