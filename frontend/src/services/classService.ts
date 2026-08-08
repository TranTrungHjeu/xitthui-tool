import api from "./api";
import { ClassData } from "../types";

export const classService = {
  getClasses: async (
    teacherId: string,
    centreIds?: string[],
    roles?: string[],
    options?: {
      statusIn?: string[];
      status?: string;
      page?: number;
      limit?: number;
      search?: string;
      centre?: string;
      weekday?: string;
      role?: string;
      userName?: string;
      category?: string;
    },
  ): Promise<{ data: ClassData[]; meta: any }> => {
    const response = await api.post("/classes", {
      teacherId,
      centreIds,
      roles,
      statusIn: options?.statusIn,
      status: options?.status,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
      centre: options?.centre,
      weekday: options?.weekday,
      role: options?.role,
      userName: options?.userName,
      category: options?.category,
    });
    return { data: response.data.data, meta: response.data.meta };
  },
  getClassesNotifications: async (
    teacherId: string,
    centreIds?: string[],
    roles?: string[],
    email?: string,
  ): Promise<any[]> => {
    const response = await api.post("/classes/notifications", {
      teacherId,
      centreIds,
      roles,
      email,
    });
    return response.data.data;
  },
  sendReminderEmailsNow: async (roles?: string[]): Promise<any> => {
    const response = await api.post("/classes/notifications/send-emails-now", {
      roles,
    });
    return response.data;
  },
  syncNotifications: async (roles?: string[]): Promise<any> => {
    const response = await api.post("/classes/notifications/sync", {
      roles,
    });
    return response.data;
  },
  getClassesDetails: async (classIds: string[]): Promise<ClassData[]> => {
    const response = await api.post("/classes/details", { classIds });
    return response.data.data;
  },
  getClassById: async (classId: string, noCache?: boolean): Promise<ClassData> => {
    const response = await api.post("/classes/detail", { classId, noCache });
    return response.data.data;
  },
  updateEvaluation: async (payload: any) => {
    const response = await api.post("/update-evaluation", { payload });
    return response.data;
  },
  getSubmissions: async (classId: string): Promise<any> => {
    const response = await api.post("/submissions", { classId });
    return response.data.data;
  },
  getCourseVersion: async (classId: string): Promise<any> => {
    const response = await api.post("/course-version", { classId });
    return response.data.data;
  },
  getAIStudentEvaluation: async (
    classId: string,
    studentId: string,
    rosterToApiMap: Record<string, string>,
  ): Promise<any> => {
    const response = await api.post("/student-evaluation", {
      classId,
      studentId,
      rosterToApiMap,
    });
    return response.data;
  },
  getStudents: async (
    teacherId: string,
    centreIds?: string[],
    roles?: string[],
    options?: {
      statusIn?: string[];
      page?: number;
      limit?: number;
      search?: string;
      centre?: string;
      classId?: string;
    },
  ): Promise<{ data: any[]; meta: any }> => {
    const response = await api.post("/classes/students", {
      teacherId,
      centreIds,
      roles,
      statusIn: options?.statusIn,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
      centre: options?.centre,
      classId: options?.classId,
    });
    return { data: response.data.data, meta: response.data.meta };
  },
  syncStudents: async (
    roles?: string[],
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    const response = await api.post("/classes/sync-students", {
      roles,
    });
    return response.data;
  },
};
