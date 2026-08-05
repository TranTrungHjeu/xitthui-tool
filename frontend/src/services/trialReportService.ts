"use client";

import api from "./api";
import { useAuthStore } from "../store/useAuthStore";
import type {
  AllReportsQuery,
  DeleteRequestsQuery,
  DeleteRequest,
  RegisterReportPayload,
  RequestDeletePayload,
  ReviewDeleteRequestPayload,
  TrialReport,
  LegacyCreateReportPayload,
} from "../types/trialReport";

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  parentId?: string;
}

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().sessionId || null;
}

async function call<T>(
  method: "get" | "post",
  url: string,
  body?: Record<string, unknown>,
): Promise<ApiEnvelope<T>> {
  const response =
    method === "get"
      ? await api.get(url, { params: body })
      : await api.post(url, body);
  return response.data as ApiEnvelope<T>;
}

export const trialReportService = {
  /**
   * Canonical upload path (post browser-OAuth migration).
   *
   * The browser uploads the PDF directly to Drive via the user's OAuth
   * token (using `googleDriveService.uploadPDFFile`), then calls this
   * endpoint so the resulting file shows up in Mongo with metadata.
   *
   * Backend endpoint: POST /trial-report/reports/register
   */
  registerReport: async (payload: RegisterReportPayload) => {
    return call<TrialReport & { webViewLink?: string }>(
      "post",
      "/trial-report/reports/register",
      { ...payload, sessionId: payload.sessionId ?? getSessionId() },
    );
  },

  /**
   * Read a single report from Mongo.
   */
  getReport: async (id: string) => {
    return call<TrialReport>("get", `/trial-report/reports/${id}`);
  },

  /**
   * Legacy endpoints — kept for backward compat. No longer the
   * recommended upload path; the browser now drives the upload.
   */

  createReport: async (payload: LegacyCreateReportPayload) => {
    return call<TrialReport & { webViewLink?: string }>(
      "post",
      "/trial-report/reports",
      { ...payload, sessionId: payload.sessionId ?? getSessionId() },
    );
  },

  uploadPdf: async (payload: LegacyCreateReportPayload) => {
    return call<TrialReport & { webViewLink?: string }>(
      "post",
      "/trial-report/upload",
      { ...payload, sessionId: payload.sessionId ?? getSessionId() },
    );
  },

  requestDelete: async (payload: RequestDeletePayload) => {
    return call<DeleteRequest>("post", "/trial-report/delete-request", {
      ...payload,
      sessionId: payload.sessionId ?? getSessionId(),
    });
  },

  reviewDeleteRequest: async (
    id: string,
    payload: Omit<ReviewDeleteRequestPayload, "sessionId">,
  ) => {
    return call<DeleteRequest>(
      "post",
      `/trial-report/delete-request/${id}/review`,
      { ...payload, sessionId: getSessionId() },
    );
  },

  executeDelete: async (id: string) => {
    return call<TrialReport>("post", `/trial-report/reports/${id}/delete`, {
      sessionId: getSessionId(),
    });
  },

  getAllReports: async (query: AllReportsQuery = {}) => {
    const { sessionId, ...rest } = query;
    return call<TrialReport[]>(
      "get",
      "/trial-report/all-reports",
      { ...rest, sessionId: sessionId ?? getSessionId() } as Record<string, unknown>,
    );
  },

  getDeleteRequests: async (query: DeleteRequestsQuery = {}) => {
    const { sessionId, ...rest } = query;
    return call<DeleteRequest[]>(
      "get",
      "/trial-report/delete-requests",
      { ...rest, sessionId: sessionId ?? getSessionId() } as Record<string, unknown>,
    );
  },
};

export type TrialReportService = typeof trialReportService;
