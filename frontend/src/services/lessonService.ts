import api from "./api";
import { Lesson, LessonContent, LessonFilter } from "@/types/lesson";

const API_BASE = "lesson";

function toQuery(filter: LessonFilter = {}) {
  const params = new URLSearchParams();
  if (filter.subject) params.set("subject", filter.subject);
  if (filter.courseCode) params.set("courseCode", filter.courseCode);
  if (filter.q) params.set("q", filter.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const lessonService = {
  getLessons: async (filter: LessonFilter = {}) => {
    const response = await api.get(`${API_BASE}${toQuery(filter)}`);
    return response.data;
  },

  getLesson: async (id: string) => {
    const response = await api.get(`${API_BASE}/${id}`);
    return response.data;
  },

  createLesson: async (payload: Partial<Lesson>) => {
    const response = await api.post(`${API_BASE}`, payload);
    return response.data;
  },

  updateLesson: async (id: string, payload: Partial<Lesson>) => {
    const response = await api.put(`${API_BASE}/${id}`, payload);
    return response.data;
  },

  deleteLesson: async (id: string) => {
    const response = await api.delete(`${API_BASE}/${id}`);
    return response.data;
  },

  generateQR: async (id: string, url?: string) => {
    const qs = url ? `?url=${encodeURIComponent(url)}` : "";
    const response = await api.get(`${API_BASE}/${id}/qr${qs}`);
    return response.data;
  },

  getContentBlocks: async (lessonId: string) => {
    const response = await api.get(`${API_BASE}/${lessonId}/content`);
    return response.data;
  },

  addContentBlock: async (lessonId: string, payload: Partial<LessonContent>) => {
    const response = await api.post(`${API_BASE}/${lessonId}/content`, payload);
    return response.data;
  },

  updateContentBlock: async (contentId: string, payload: Partial<LessonContent>) => {
    const response = await api.put(`${API_BASE}/content/${contentId}`, payload);
    return response.data;
  },

  deleteContentBlock: async (contentId: string) => {
    const response = await api.delete(`${API_BASE}/content/${contentId}`);
    return response.data;
  }
};
