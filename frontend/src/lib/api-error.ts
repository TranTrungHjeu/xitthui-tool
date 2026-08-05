"use client";

/**
 * Lightweight wrapper around axios errors. Centralises the
 * `(status, code, message)` extraction so callers (especially
 * `mapAuthErrorToAlert` for login failures) don't have to repeat the
 * `err.response?.data?.error?.message || err.message` incantation.
 *
 * Both `error` (human-readable) and `code` (machine-readable) come
 * from the backend response body when the request reached the
 * server. When the request never reached the server (CORS, network
 * down, request cancelled, server timeout) both are inferred.
 */

import { AxiosError } from "axios";

export type ApiErrorCode =
  | "missing_credentials"
  | "invalid_credentials"
  | "user_disabled"
  | "no_access"
  | "user_not_found"
  | "rate_limited"
  | "service_unavailable"
  | "internal_error"
  // generic fallbacks
  | "network_error"
  | "request_cancelled"
  | "timeout"
  | "unknown"
  | string;

export interface ApiError {
  status: number | null;
  code: ApiErrorCode;
  message: string;
  /** `true` if the request never reached the server. */
  isNetworkError: boolean;
}

const NETWORK_CODES = new Set([
  "ERR_NETWORK",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENETUNREACH",
  "ENOTFOUND",
]);

export function isApiError(err: unknown): err is AxiosError {
  return !!err && typeof err === "object" && "isAxiosError" in err;
}

export function extractApiError(err: unknown): ApiError {
  if (isApiError(err)) {
    const status = err.response?.status ?? null;
    const data: any = err.response?.data;

    // 1. Network-level failure (request never reached the server).
    if (!err.response) {
      const code: ApiErrorCode = err.code === "ECONNABORTED"
        ? "timeout"
        : err.code === "ERR_CANCELED"
        ? "request_cancelled"
        : NETWORK_CODES.has(String(err.code))
        ? "network_error"
        : "unknown";

      return {
        status: null,
        code,
        message:
          err.code === "ECONNABORTED"
            ? "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại."
            : err.code === "ERR_CANCELED"
            ? "Yêu cầu đã bị huỷ."
            : "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
        isNetworkError: true,
      };
    }

    // 2. Server responded — pick the most specific message + code.
    const code: ApiErrorCode =
      (typeof data?.code === "string" && data.code) ||
      // Best-effort fallback to HTTP status families when the backend
      // didn't include a `code` field.
      (status === 401
        ? "invalid_credentials"
        : status === 403
        ? "no_access"
        : status === 404
        ? "user_not_found"
        : status === 429
        ? "rate_limited"
        : status === 503
        ? "service_unavailable"
        : "internal_error");

    const message =
      (typeof data?.error === "string" && data.error) ||
      (typeof data?.message === "string" && data.message) ||
      err.message ||
      "Đã xảy ra lỗi không xác định.";

    return { status, code, message, isNetworkError: false };
  }

  // 3. Plain `Error` (or anything else) — wrap it as unknown.
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return {
    status: null,
    code: "unknown",
    message,
    isNetworkError: false,
  };
}

export class ApiErrorWrapper extends Error implements ApiError {
  status: number | null;
  code: ApiErrorCode;
  isNetworkError: boolean;

  constructor(parsed: ApiError) {
    super(parsed.message);
    this.name = "ApiError";
    this.status = parsed.status;
    this.code = parsed.code;
    this.isNetworkError = parsed.isNetworkError;
  }
}