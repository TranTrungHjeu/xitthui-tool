"use client";

/**
 * Maps a thrown error from `authService.login` into the
 * `AlertModal`-ready payload (title, message, optional CTA).
 *
 * Backend (`backend/src/controllers/authController.js`) now returns
 * `{ success: false, code, error }` with a `code` we can switch on
 * plus the corresponding HTTP status:
 *
 *   - 400 missing_credentials  → "Thiếu thông tin đăng nhập"
 *   - 401 invalid_credentials  → "Email hoặc mật khẩu không chính xác"
 *   - 403 user_disabled        → "Tài khoản đã bị vô hiệu hóa"
 *   - 403 no_access            → "Không có quyền truy cập"
 *   - 404 user_not_found       → "Không tìm thấy tài khoản"
 *   - 503 service_unavailable  → "Hệ thống đăng nhập tạm thời không khả dụng"
 *   - 500 internal_error       → "Lỗi hệ thống"
 *
 * For axios errors that never reached the server (network down,
 * CORS, request cancelled) we surface "service_unavailable" without
 * a `code`.
 *
 * `retry` action is exposed only for transient failures — invalid
 * credentials / user-disabled / no-access errors should not show a
 * "Retry" button because they will keep failing.
 */

import { Mail, ShieldOff, UserX, Lock, Phone, ServerCrash } from "lucide-react";

import { ApiError, extractApiError } from "@/lib/api-error";

export type AuthAlertKind =
  | "missing_credentials"
  | "invalid_credentials"
  | "user_disabled"
  | "no_access"
  | "user_not_found"
  | "rate_limited"
  | "service_unavailable"
  | "internal_error";

export interface AuthAlertAction {
  /** Optional CTA button rendered next to the close button. */
  label: string;
  /** Lucide icon to render inside the action button. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Visual variant passed to <Button>. */
  variant?: "default" | "outline";
  /** Pre-built anchor href (e.g. mailto:). When set, the action opens
   *  this URL instead of calling `onClick`. */
  href?: string;
  /** Called when the user clicks the CTA. */
  onClick?: () => void;
}

export interface AuthAlert {
  kind: AuthAlertKind;
  title: string;
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * `true` for transient failures where "Thử lại" makes sense. Caller
   * is responsible for wiring the retry handler — `retry` is just a
   * signal that the modal should expose a primary CTA button.
   */
  retry?: boolean;
  action?: AuthAlertAction;
}

const TITLES: Record<AuthAlertKind, string> = {
  missing_credentials: "Thiếu thông tin đăng nhập",
  invalid_credentials: "Sai tài khoản hoặc mật khẩu",
  user_disabled: "Tài khoản đã bị vô hiệu hóa",
  no_access: "Không có quyền truy cập",
  user_not_found: "Không tìm thấy tài khoản",
  rate_limited: "Thử đăng nhập quá nhiều lần",
  service_unavailable: "Không thể kết nối máy chủ",
  internal_error: "Đăng nhập thất bại",
};

const ICONS: Record<AuthAlertKind, React.ComponentType<{ className?: string }>> = {
  missing_credentials: Mail,
  invalid_credentials: Lock,
  user_disabled: ShieldOff,
  no_access: ShieldOff,
  user_not_found: UserX,
  rate_limited: Lock,
  service_unavailable: ServerCrash,
  internal_error: ServerCrash,
};

const KIND_RETRY: Record<AuthAlertKind, boolean> = {
  missing_credentials: false,
  invalid_credentials: false,
  user_disabled: false,
  no_access: false,
  user_not_found: false,
  // Rate-limited errors should NOT offer a "Thử lại" CTA — the user
  // needs to wait, and clicking again would just re-trigger the
  // limit. They get the close button only.
  rate_limited: false,
  service_unavailable: true,
  internal_error: true,
};

export function mapAuthErrorToAlert(err: unknown): AuthAlert {
  // Pull `{ status, code, message }` from the axios error regardless
  // of whether `err` is a plain Error, an AxiosError, or our typed
  // wrapper.
  const parsed = extractApiError(err);
  const code = (parsed.code || "").toLowerCase() as AuthAlertKind | "";
  const status = parsed.status;

  // 1. Trust backend's `code` first — it's the source of truth.
  let kind: AuthAlertKind;
  if (code && code in TITLES) {
    kind = code;
  } else if (status === 401) {
    kind = "invalid_credentials";
  } else if (status === 403) {
    // Without a code, 403 could be either user_disabled or no_access;
    // pick user_disabled as the safer default and let the message
    // hint at the real reason.
    kind = "user_disabled";
  } else if (status === 404) {
    kind = "user_not_found";
  } else if (status === 429) {
    kind = "rate_limited";
  } else if (status === 400) {
    kind = "missing_credentials";
  } else if (status === 503) {
    kind = "service_unavailable";
  } else {
    kind = "internal_error";
  }

  const base: AuthAlert = {
    kind,
    title: TITLES[kind],
    message: parsed.message || "Đăng nhập thất bại.",
    icon: ICONS[kind],
    retry: KIND_RETRY[kind],
  };

  // 2. For permission / disabled / not-found errors, add a "Liên hệ
  //    quản trị" CTA so users aren't stuck.
  if (kind === "user_disabled" || kind === "no_access" || kind === "user_not_found") {
    base.action = {
      label: "Liên hệ quản trị",
      icon: Phone,
      variant: "outline",
      href: "tel:+8428xxxxxxx",
    };
  }

  return base;
}

/**
 * Convenience: also returns the underlying `ApiError` so callers can
 * pass additional context (e.g. log the response status).
 */
export function mapAuthError(err: unknown): { alert: AuthAlert; raw: ApiError } {
  return { alert: mapAuthErrorToAlert(err), raw: extractApiError(err) };
}