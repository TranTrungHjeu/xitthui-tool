import api from "./api";

export const teacherService = {
  getTeachers: async (
    centers: string[] = ["6443460f94300678908f7974"],
    pageIndex = 0,
    itemsPerPage = 100,
  ) => {
    try {
      const response = await api.post("/teachers", {
        centers,
        pageIndex,
        itemsPerPage,
      });
      return response.data as {
        success: boolean;
        data: any[];
        pagination: { total: number };
        error?: string;
      };
    } catch (error) {
      console.error("Error fetching teachers:", error);
      throw error;
    }
  },
  getTeacherSchedules: async (
    teacherIds: string[],
    dateGte: string,
    dateLte: string,
    forceRefresh = false,
  ) => {
    try {
      const response = await api.post("/teachers/schedules", {
        teacherIds,
        dateGte,
        dateLte,
        forceRefresh,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher schedules:", error);
      throw error;
    }
  },
  saveTeacherVisibility: async (userId: string, hiddenTeacherIds: string[]) => {
    try {
      const response = await api.post("/teachers/visibility", {
        userId,
        hiddenTeacherIds,
      });
      return response.data;
    } catch (error) {
      console.error("Error saving teacher visibility:", error);
      throw error;
    }
  },
  getTeacherVisibility: async (userId: string) => {
    try {
      const response = await api.get(`/teachers/visibility/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher visibility:", error);
      throw error;
    }
  },
  syncPersonnel: async (
    roles?: string[],
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await api.post("/teachers/sync", { roles });
      return response.data;
    } catch (error) {
      console.error("Error triggering teacher sync:", error);
      throw error;
    }
  },
};
