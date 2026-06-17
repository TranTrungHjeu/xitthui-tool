import api from "./api";

export interface ZaloConfig {
  targetChatId: string | null;
  reminderTimes: string[];
  isLmsConfigured: boolean;
  mindxUsername: string | null;
}

export const zaloService = {
  getConfig: async () => {
    const res = await api.get<{ success: boolean; data: ZaloConfig }>(
      "/zalo/config",
    );
    return res.data;
  },

  updateConfig: async (data: {
    reminderTimes?: string[];
    linkCurrentUser?: boolean;
    lmsToken?: string;
    lmsRefreshToken?: string | null;
    mindxUser?: any;
  }) => {
    const res = await api.post<{ success: boolean; message: string }>(
      "/zalo/config",
      data,
    );
    return res.data;
  },

  triggerReminder: async () => {
    const res = await api.post<{ success: boolean; message: string }>(
      "/zalo/trigger",
    );
    return res.data;
  },
};
