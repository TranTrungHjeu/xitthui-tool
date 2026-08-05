import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVER_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Variable to prevent multiple refresh calls
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

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      // Use the store directly to get the latest token
      const token = useAuthStore.getState().token;
      if (token) {
        // Many MindX endpoints expect token in the body
        if (config.method?.toLowerCase() === "post") {
          // Only add token to body if it's a plain object
          if (
            config.data &&
            typeof config.data === "object" &&
            !(config.data instanceof FormData)
          ) {
            config.data = {
              ...config.data,
              token: token,
            };
          } else if (!config.data) {
            config.data = { token };
          }
        }
        // Also add to headers as standard practice
        config.headers.Authorization = `Bearer ${token}`;
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
    const originalRequest = error.config;

    // Handle 401 Unauthorized (Token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.method?.toLowerCase() === "post") {
              let data = originalRequest.data || {};
              if (typeof data === "string") {
                try {
                  data = JSON.parse(data);
                } catch (e) {
                  /* not JSON */
                }
              }
              if (typeof data === "object" && data !== null) {
                data.token = token;
                originalRequest.data = JSON.stringify(data);
              }
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { sessionId, logout } = useAuthStore.getState();

      if (!sessionId) {
        logout(); // Log out if no session ID is available
        dispatchSessionExpired();
        isRefreshing = false;
        processQueue(new Error("No session ID available"), null); // Reject pending requests
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_SERVER_API_URL}/refresh-token`,
          { sessionId },
        );

        if (response.data.success) {
          const { lmsToken, sessionId: newSessionId } = response.data;
          useAuthStore.getState().updateToken(lmsToken, newSessionId);

          processQueue(null, lmsToken);

          if (originalRequest.method?.toLowerCase() === "post") {
            // Need to update token in the body
            let data = originalRequest.data || {};
            if (typeof data === "string") {
              try {
                data = JSON.parse(data);
              } catch (e) {
                /* not JSON */
              }
            }
            if (typeof data === "object" && data !== null) {
              data.token = lmsToken;
              originalRequest.data = JSON.stringify(data);
            }
          }
          originalRequest.headers.Authorization = `Bearer ${lmsToken}`;

          return api(originalRequest);
        } else {
          // If refresh token request was successful but the backend indicates failure
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

    return Promise.reject(error);
  },
);

export default api;