import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVER_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Variable to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: any[] = [];

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

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_SERVER_API_URL}/refresh-token`,
          { refreshToken },
        );

        if (response.data.success) {
          const { lmsToken, lmsRefreshToken } = response.data;
          useAuthStore.getState().updateToken(lmsToken, lmsRefreshToken);

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
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
