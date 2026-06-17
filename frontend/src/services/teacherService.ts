import api from "./api";

export const teacherService = {
  getTeachers: async (
    token: string,
    centers: string[] = ["6443460f94300678908f7974"],
    pageIndex = 0,
    itemsPerPage = 100,
  ) => {
    try {
      const response = await api.post("/teachers", {
        token,
        centers,
        pageIndex,
        itemsPerPage,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching teachers:", error);
      throw error;
    }
  },
  getTeacherSchedules: async (
    token: string,
    teacherIds: string[],
    dateGte: string,
    dateLte: string,
  ) => {
    try {
      const response = await api.post("/teachers/schedules", {
        token,
        teacherIds,
        dateGte,
        dateLte,
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
};
