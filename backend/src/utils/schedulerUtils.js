const { childLogger } = require("./logger.js");
const log = childLogger("SchedulerUtils");

/**
 * Scheduler Utilities - Retry Logic and Status Tracking
 *
 * Provides reusable retry logic with exponential backoff for schedulers
 * and status tracking in MongoDB.
 */

const mongoose = require("mongoose");

/**
 * Schema for tracking scheduler run status
 */
const SchedulerStatusSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // schedulerName
    lastRun: { type: Date, default: null },
    lastSuccess: { type: Date, default: null },
    lastError: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    totalFailures: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const SchedulerStatus = mongoose.model("SchedulerStatus", SchedulerStatusSchema);

/**
 * Executes an async function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Initial delay in ms (default: 1000)
 * @param {string} options.context - Context label for logging
 * @param {Function} options.onRetry - Callback for each retry attempt
 * @returns {Promise<Object>} - Result with success/failure info
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    context = "Task",
    onRetry = null,
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      return {
        success: true,
        result,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        log.error(
          `[${context}] All ${maxRetries} attempts failed. Final error: ${err.message}`,
        );
        break;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      log.warn(
        `[${context}] Attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in ${delay}ms...`,
      );

      if (onRetry) {
        try {
          await onRetry(attempt, err);
        } catch (onRetryErr) {
          log.warn(`[${context}] onRetry callback failed:`, onRetryErr.message);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message : "Unknown error",
    attempts: maxRetries,
  };
}

/**
 * Records scheduler run status to MongoDB
 * @param {string} schedulerName - Name of the scheduler
 * @param {Object} status - Status info
 */
async function recordSchedulerStatus(schedulerName, status) {
  try {
    const now = new Date();
    const update = {
      _id: schedulerName,
      lastRun: now,
      updatedAt: now,
      $inc: { totalRuns: 1 },
    };

    if (status.success) {
      update.lastSuccess = now;
      update.lastError = null;
      update.retryCount = 0;
    } else {
      update.lastError = status.error || "Unknown error";
      update.retryCount = status.attempts || 1;
      update.$inc.totalFailures = 1;
    }

    await SchedulerStatus.findOneAndUpdate(
      { _id: schedulerName },
      update,
      { upsert: true },
    );
  } catch (err) {
    log.warn(
      `[SchedulerStatus] Failed to record status for ${schedulerName}:`,
      err.message,
    );
  }
}

/**
 * Wraps a scheduler function with retry and status tracking
 * @param {string} schedulerName - Name for tracking
 * @param {Function} fn - Scheduler function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<Object>}
 */
async function runWithStatusTracking(schedulerName, fn, options = {}) {
  const { maxRetries = 3, baseDelayMs = 1000 } = options;

  const result = await withRetry(fn, {
    maxRetries,
    baseDelayMs,
    context: schedulerName,
  });

  await recordSchedulerStatus(schedulerName, result);

  return result;
}

module.exports = {
  withRetry,
  recordSchedulerStatus,
  runWithStatusTracking,
  SchedulerStatus,
};