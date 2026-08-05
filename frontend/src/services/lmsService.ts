"use client";

/**
 * LMS Service
 *
 * Public-client wrapper for the `/lms/*` endpoints.
 *
 * The route is intentionally public (no-auth). When a user is logged in,
 * the auth store's token is automatically attached to outbound requests
 * via the shared axios interceptor in `services/api.ts` (it appends
 * `token` to POST bodies). The controller also accepts a `token` field
 * passed directly in the request body for guests.
 */

import api from "./api";
import type {
  LmsClassesResponse,
  LmsClassSummary,
  LmsCommentHistoryResponse,
  LmsCriteriaTemplate,
  LmsChatPayload,
  LmsChatResponse,
  LmsGenerateCommentPayload,
  LmsGenerateCommentResponse,
  LmsGetClassesParams,
  LmsSaveCriteriaPayload,
  LmsSubject,
  LmsSyncClassPayload,
  LmsSyncClassResponse,
} from "../types/lms";

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  aiUnavailable?: boolean;
  reason?: string;
  subject?: string;
  ownerId?: string | null;
  count?: number;
  classId?: string;
  studentId?: string;
}

function unwrap<T>(response: { data: ApiEnvelope<T> }): ApiEnvelope<T> {
  return response.data || {};
}

export const lmsService = {
  generateComment: async (
    payload: LmsGenerateCommentPayload,
  ): Promise<LmsGenerateCommentResponse> => {
    const res = await api.post("/lms/generate-comment", payload);
    return unwrap<LmsGenerateCommentResponse["data"]>(res) as LmsGenerateCommentResponse;
  },

  syncClass: async (
    payload: LmsSyncClassPayload,
  ): Promise<LmsSyncClassResponse> => {
    const res = await api.post("/lms/sync-class", { classId: payload.classId });
    return unwrap<LmsSyncClassResponse["data"]>(res) as LmsSyncClassResponse;
  },

  getCriteria: async (subject: LmsSubject): Promise<LmsCriteriaTemplate[]> => {
    const res = await api.get("/lms/criteria", { params: { subject } });
    const env = unwrap<LmsCriteriaTemplate[]>(res);
    return (env.data || []) as LmsCriteriaTemplate[];
  },

  saveCriteria: async (
    payload: LmsSaveCriteriaPayload,
  ): Promise<LmsCriteriaTemplate | null> => {
    const res = await api.post("/lms/save-criteria", payload);
    const env = unwrap<LmsCriteriaTemplate>(res);
    return (env.data || null) as LmsCriteriaTemplate | null;
  },

  chat: async (payload: LmsChatPayload): Promise<LmsChatResponse> => {
    const res = await api.post("/lms/chat", payload);
    return unwrap<LmsChatResponse["data"]>(res) as LmsChatResponse;
  },

  getClasses: async (
    params?: LmsGetClassesParams,
  ): Promise<LmsClassSummary[]> => {
    const res = await api.get("/lms/classes", {
      params: {
        status: params?.status || "RUNNING",
        teacherCode: params?.teacherCode,
        search: params?.search,
      },
    });
    const env = unwrap<LmsClassSummary[]>(res) as LmsClassesResponse;
    return (env.data || []) as LmsClassSummary[];
  },

  getCommentHistory: async (params: {
    classId: string;
    studentId: string;
    upToSession?: number;
  }): Promise<LmsCommentHistoryResponse["data"]["history"]> => {
    const res = await api.get("/lms/comment-history", {
      params: {
        classId: params.classId,
        studentId: params.studentId,
        upToSession: params.upToSession ?? 14,
      },
    });
    const env = unwrap<LmsCommentHistoryResponse["data"]>(
      res,
    ) as LmsCommentHistoryResponse;
    return (env.data?.history || []) as LmsCommentHistoryResponse["data"]["history"];
  },
};

export type LmsService = typeof lmsService;
