import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

// ─── iOS ITP fix: token lives in localStorage so it survives even when
//     cross-site cookies are blocked by Intelligent Tracking Prevention.
//     The header is sent alongside the cookie (withCredentials: true) so
//     the backend can fall back to it on iOS while still using the cookie
//     everywhere else. ────────────────────────────────────────────────────────

const LOCAL_STORAGE_TOKEN_KEY = "lms_auth_token";

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, token);
    } catch {
      // Quota exceeded or private browsing — fail silently.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
    } catch {
      // Already unavailable.
    }
  },
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVER_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Inject the localStorage token as a fallback Authorization header so iOS
// (ITP) clients that cannot receive cookies still authenticate correctly.
api.interceptors.request.use((config) => {
  const storedToken = tokenStorage.get();
  if (storedToken) {
    config.headers.set("Authorization", `Bearer ${storedToken}`);
  }
  return config;
});


let isRefreshing = false;
let failedQueue: any[] = [];

/**
 * Broadcast that the session has ended so the UI layer (a SessionGuard
 * provider inside the React tree) can show a friendly toast and redirect
 * to /login. Keeping this as a window event avoids leaking Next.js' router
 * into the axios service layer.
 *
 * The event is dispatched exactly once per session, even if multiple
 * requests 401 simultaneously — the queued requests resolved by the failed
 * `processQueue(...)` call don't trigger another logout here.
 */
const SESSION_EXPIRED_EVENT = "auth:session-expired";
function dispatchSessionExpired() {
  if (typeof window === "undefined") return;
  // Avoid duplicate dispatches when several 401s land at the same time.
  if ((window as any).__sessionExpiredDispatched) return;
  (window as any).__sessionExpiredDispatched = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  // Reset after a tick so a *future* login → eventual expiry can fire again.
  setTimeout(() => {
    (window as any).__sessionExpiredDispatched = false;
  }, 1000);
}

export { SESSION_EXPIRED_EVENT };

const processQueue = (error: any, _token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      // The refreshed token now lives in the rotated httpOnly cookie; the
      // browser will send it automatically on the retried request. Nothing
      // to inject into the body or the Authorization header anymore.
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Add a request interceptor
//
// NOTE: the LMS token used to be injected into the request body here.
// That was the root cause of the 400 "Token is required" errors on the
// dashboard: the auth store's `token`/`sessionId` were hydrated from
// localStorage asynchronously, so the first request after a reload
// fired with `token: null` in the body.
//
// The token now travels in an httpOnly cookie set by the server. The
// browser sends it automatically because `withCredentials: true`
// (above) keeps the cookie attached to every request to the same
// origin. We do NOT add an Authorization header here — the cookie is
// the source of truth.
//
// We also used to abort every request when `isAuthenticated` was
// false. That broke the login flow on a fresh tab (the user is
// obviously not authenticated yet when they POST /login). The fix is
// to only abort calls to authenticated endpoints.
const AUTH_REQUIRED_PREFIXES = [
  "/classes",
  "/classes/notifications",
  "/classes/notifications/send-emails-now",
  "/classes/notifications/sync",
  "/classes/detail",
  "/classes/details",
  "/classes/students",
  "/classes/sync-students",
  "/classes/download-attachment",
  "/teachers",
  "/spreadsheet",
  "/trial-report",
  "/me",
  "/update-evaluation",
  "/submissions",
  "/course-version",
  "/student-evaluation",
];
// Per-endpoint allowlist of paths that don't require an authenticated
// session. These keep working even when `useAuthStore.isAuthenticated`
// is false.
const PUBLIC_PATH_EXACT = new Set<string>([
  // LMS tool is listed in PUBLIC_TOOLS and should be accessible without auth
  // (covered by /lms prefix below)
]);

// Public paths where any sub-path under the prefix is also public.
// (e.g. /trial-report/reports/* all skip auth — they are protected
// by the shared delete password instead.)
const PUBLIC_PATH_PREFIXES = [
  "/trial-report/reports",
  "/lms",
  "/payroll",
  "/zalo",
  "/lesson",
];

function requiresAuth(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0];
  if (PUBLIC_PATH_EXACT.has(path)) return false;
  if (PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  return AUTH_REQUIRED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const { isAuthenticated } = useAuthStore.getState();
      // Only block authenticated endpoints when the user is logged out.
      // Public endpoints (/login, /refresh-token, /logout) must always
      // reach the server.
      if (!isAuthenticated && requiresAuth(config.url)) {
        throw new axios.CanceledError("Not authenticated");
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // `error.config` is undefined when the request never left the client
    // (e.g. axios is cancelled, network failure before send, or our
    // own auth interceptor threw `CanceledError`). Skip the retry
    // logic and let the caller's `catch` handle it.
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // C. Retry 5xx + 429 with exponential backoff.
    // LMS outages and Lighthouse rate-limits show up as transient 5xx/429.
    // A bounded retry with exponential backoff often clears the issue
    // without bothering the user. We cap at 3 retries to avoid long
    // delays on truly broken endpoints.
    if (
      !originalRequest._retryCount &&
      (error.response?.status === 429 ||
        (error.response?.status >= 500 && error.response?.status < 600))
    ) {
      originalRequest._retryCount = 1;
      const delay = 200 * 2 ** 0; // 200ms
      await new Promise((r) => setTimeout(r, delay));
      return api(originalRequest);
    }
    if (
      originalRequest._retryCount &&
      originalRequest._retryCount < 3 &&
      (error.response?.status === 429 ||
        (error.response?.status >= 500 && error.response?.status < 600))
    ) {
      originalRequest._retryCount += 1;
      const delay = 200 * 2 ** (originalRequest._retryCount - 1); // 200, 400, 800ms
      await new Promise((r) => setTimeout(r, delay));
      return api(originalRequest);
    }

    // Handle 401 Unauthorized (Token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { logout } = useAuthStore.getState();

      try {
        // Call /refresh-token. The sessionId cookie is sent automatically,
        // and the server returns Set-Cookie headers that rotate the
        // httpOnly `lms_token` cookie. We don't need to do anything
        // with the response body — the browser persists the cookie.
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_SERVER_API_URL}/refresh-token`,
          {},
          { withCredentials: true },
        );

        if (response.data.success) {
          processQueue(null);
          return api(originalRequest);
        } else {
          console.error(
            "Refresh token backend response indicated failure:",
            response.data.error,
          );
          processQueue(
            new Error(response.data.error || "Refresh token failed"),
            null,
          );
          logout();
          dispatchSessionExpired();
          return Promise.reject(
            new Error(response.data.error || "Refresh token failed"),
          );
        }
      } catch (refreshError) {
        console.error("Error during token refresh:", refreshError);
        processQueue(refreshError, null);
        logout();
        dispatchSessionExpired();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // B. Handle 400 "Token is required" — happens when the cookie is
    // missing entirely (e.g. user cleared cookies, expired session, or
    // sessionId cookie is gone). The 401 path above handles expired
    // cookies; this branch handles the "no cookie at all" case.
    if (error.response?.status === 400) {
      const errorMsg = String(error.response?.data?.error || "");
      if (errorMsg.toLowerCase().includes("token")) {
        console.warn("[Auth] No auth cookie — forcing logout");
        useAuthStore.getState().logout();
        dispatchSessionExpired();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
