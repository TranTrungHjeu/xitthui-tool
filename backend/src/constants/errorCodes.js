/**
 * Centralized Error Codes.
 *
 * Standard error codes used throughout the app for consistent error handling,
 * logging, and API responses.
 */

const ERROR_CODES = {
  // Auth errors (1xxx)
  AUTH_MISSING_TOKEN: "AUTH_1001",
  AUTH_INVALID_TOKEN: "AUTH_1002",
  AUTH_TOKEN_EXPIRED: "AUTH_1003",
  AUTH_ACCESS_DENIED: "AUTH_1004",
  AUTH_FORBIDDEN: "AUTH_1005",

  // Rate limit errors (2xxx)
  RATE_LIMIT_EXCEEDED: "RATE_2001",
  API_KEY_INVALID: "API_2002",
  API_KEY_MISSING: "API_2003",

  // Validation errors (3xxx)
  VALIDATION_MISSING_FIELD: "VAL_3001",
  VALIDATION_INVALID_FORMAT: "VAL_3002",
  VALIDATION_INPUT_TOO_LONG: "VAL_3003",

  // Resource errors (4xxx)
  RESOURCE_NOT_FOUND: "RES_4001",
  RESOURCE_CONFLICT: "RES_4002",

  // External service errors (5xxx)
  LMS_AUTH_FAILED: "EXT_5001",
  LMS_API_ERROR: "EXT_5002",
  LMS_TIMEOUT: "EXT_5003",
  SHEETS_API_ERROR: "EXT_5101",

  // Scheduler errors (6xxx)
  SCHEDULER_FAILED: "SCHED_6001",

  // Generic (9xxx)
  INTERNAL_ERROR: "INT_9001",
  DB_ERROR: "INT_9002",
};

/**
 * HTTP status codes mapping for each error category.
 */
const HTTP_STATUS_FOR_ERROR_CODE = {
  AUTH_1001: 401,
  AUTH_1002: 401,
  AUTH_1003: 401,
  AUTH_1004: 403,
  AUTH_1005: 403,
  RATE_2001: 429,
  API_2002: 403,
  API_2003: 401,
  VAL_3001: 400,
  VAL_3002: 400,
  VAL_3003: 400,
  RES_4001: 404,
  RES_4002: 409,
  EXT_5001: 502,
  EXT_5002: 502,
  EXT_5003: 504,
  EXT_5101: 502,
  SCHED_6001: 500,
  INT_9001: 500,
  INT_9002: 500,
};

function getHttpStatus(errorCode) {
  return HTTP_STATUS_FOR_ERROR_CODE[errorCode] || 500;
}

module.exports = {
  ERROR_CODES,
  getHttpStatus,
};
