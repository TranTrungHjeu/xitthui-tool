import api from "./api";

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post("/login", credentials);
    return response.data;
  },
  refreshToken: async (sessionId: string) => {
    const response = await api.post("/refresh-token", { sessionId });
    return response.data;
  },
  logout: async (sessionId: string) => {
    const response = await api.post("/logout", { sessionId });
    return response.data;
  },
  testToken: async (token: string, userId: string) => {
    const response = await api.post("/test-token", { token, userId });
    return response.data;
  },
};
