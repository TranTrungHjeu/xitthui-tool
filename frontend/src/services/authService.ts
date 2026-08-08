import api from "./api";

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post("/login", credentials);
    return response.data;
  },
  // sessionId is now read from the httpOnly cookie by the server, so the
  // FE doesn't need to pass it in the body. We keep the same signature so
  // legacy callers don't break — the argument is simply ignored.
  refreshToken: async (_sessionId?: string) => {
    const response = await api.post("/refresh-token", {});
    return response.data;
  },
  logout: async (_sessionId?: string) => {
    const response = await api.post("/logout", {});
    return response.data;
  },
  // testToken was used to validate the localStorage token. With the
  // cookie-based auth it is no longer needed — the server is the
  // source of truth. Kept as a thin wrapper that returns success when
  // the cookie is still valid, so any leftover callers don't break.
  testToken: async (_token?: string, _userId?: string) => {
    const response = await api.get("/me");
    return response.data;
  },
};