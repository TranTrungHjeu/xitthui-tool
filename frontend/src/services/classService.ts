import api from "./api";
import { ClassData } from "../types";

export const classService = {
  getClasses: async (
    _token: string, // Unused as interceptor handles it
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
    _token: string,
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
  syncNotifications: async (_token: string, roles?: string[]): Promise<any> => {
    const response = await api.post("/classes/sync-notifications", {
      roles,
    });
    return response.data;
  },
  sendNotificationEmails: async (
    _token: string,
    roles?: string[],
  ): Promise<any> => {
    const response = await api.post("/classes/send-notification-emails", {
      roles,
    });
    return response.data;
  },
  getClassesDetails: async (
    _token: string,
    classIds: string[],
  ): Promise<ClassData[]> => {
    const response = await api.post("/classes/details", { classIds });
    return response.data.data;
  },
  getClassById: async (_token: string, classId: string): Promise<ClassData> => {
    const response = await api.post("/classes/detail", { classId });
    return response.data.data;
  },
  updateEvaluation: async (token: string, payload: any) => {
    const response = await api.post("/update-evaluation", {
      token,
      payload,
    });
    return response.data;
  },
  getSubmissions: async (token: string, classId: string): Promise<any> => {
    const response = await api.post("/submissions", {
      token,
      classId,
    });
    return response.data.data;
  },
  getCourseVersion: async (token: string, classId: string): Promise<any> => {
    const response = await api.post("/course-version", {
      token,
      classId,
    });
    return response.data.data;
  },
  getAIStudentEvaluation: async (
    token: string,
    classId: string,
    studentId: string,
    rosterToApiMap: Record<string, string>,
  ): Promise<any> => {
    const response = await api.post("/student-evaluation", {
      token,
      classId,
      studentId,
      rosterToApiMap,
    });
    return response.data;
  },
  getStudents: async (
    _token: string, // Unused as interceptor handles it
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
