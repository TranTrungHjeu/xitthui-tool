"use client";

import api from "./api";
import type {
  AllReportsQuery,
  RegisterReportPayload,
  ReportAuditEvent,
  TrialReport,
  LegacyCreateReportPayload,
} from "../types/trialReport";

export interface DirectDeletePayload {
  password: string;
}

export interface DirectDeleteResult {
  id: string;
  deletedAt: string;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  parentId?: string;
}

function getSessionId(): string | null {
  // The sessionId now lives in an httpOnly cookie set by the server, so
  // the FE doesn't have it. We keep this accessor for backward compat
  // with the legacy `sessionId` field in service payloads — the backend
  // reads the cookie first and ignores any body value, so sending
  // `null` here is safe.
  if (typeof window === "undefined") return null;
  return null;
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
   * Canonical upload path — file is uploaded to R2 first (multipart),
   * then this endpoint registers the metadata in Mongo using the R2
   * object key as the unique id.
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

  /**
   * Legacy alias — old backend-driven upload path (service-account).
   * Browser now drives uploads to R2, then calls `registerReport`.
   * This route exists only for any external caller that hasn't migrated
   * to the new flow. @deprecated since R2 migration — prefer
   * `registerReport` with the R2 object key.
   */
  createReport: async (payload: LegacyCreateReportPayload) => {
    if (typeof console !== "undefined") {
      console.warn("[trialReportService] createReport is deprecated. Use registerReport + /r2/upload instead.");
    }
    return call<TrialReport & { webViewLink?: string }>(
      "post",
      "/trial-report/reports",
      { ...payload, sessionId: payload.sessionId ?? getSessionId() },
    );
  },

  /**
   * Legacy alias for `createReport`. Same deprecation as above.
   * @deprecated since R2 migration — prefer `registerReport`.
   */
  uploadPdf: async (payload: LegacyCreateReportPayload) => {
    if (typeof console !== "undefined") {
      console.warn("[trialReportService] uploadPdf is deprecated. Use registerReport + /r2/upload instead.");
    }
    return call<TrialReport & { webViewLink?: string }>(
      "post",
      "/trial-report/upload",
      { ...payload, sessionId: payload.sessionId ?? getSessionId() },
    );
  },

  /**
   * Password-gated direct delete. Replaces the old 2-step
   * request/review workflow — the caller passes the shared delete
   * password configured in `TRIAL_REPORT_DELETE_PASSWORD`, and the
   * server deletes immediately (soft-delete Mongo + hard-delete R2).
   *
   * Backend endpoint: POST /trial-report/reports/:id/direct-delete
   * Body: { password }
   */
  executeDirectDelete: async (id: string, payload: DirectDeletePayload) => {
    // Pass `id` as query param so the R2 object key (which may
    // contain slashes) doesn't break URL parsing on the server.
    return call<DirectDeleteResult>(
      "post",
      `/trial-report/reports/direct-delete`,
      { password: payload.password, id },
    );
  },

  /**
   * Legacy hard-delete that bypasses the password gate. The FE does
   * not call this — it stays around as an internal escape hatch.
   * @deprecated since direct-delete migration — use
   * `executeDirectDelete(id, { password })`.
   */
  executeDelete: async (id: string) => {
    if (typeof console !== "undefined") {
      console.warn("[trialReportService] executeDelete is deprecated. Use executeDirectDelete with a password.");
    }
    return call<TrialReport>("post", `/trial-report/reports/${id}/delete`, {});
  },

  getAllReports: async (query: AllReportsQuery = {}) => {
    const { sessionId, ...rest } = query;
    return call<TrialReport[]>(
      "get",
      "/trial-report/all-reports",
      { ...rest, sessionId: sessionId ?? getSessionId() } as Record<string, unknown>,
    );
  },

  /**
   * Fetch the audit log for a single report. Returns the last 50
   * events by default. Backend enforces auth (owner or TE/Admin).
   */
  getReportAudit: async (reportId: string, limit = 50) => {
    return call<ReportAuditEvent[]>(
      "get",
      `/trial-report/reports/${encodeURIComponent(reportId)}/audit`,
      { limit, sessionId: getSessionId() } as Record<string, unknown>,
    );
  },
};

export type TrialReportService = typeof trialReportService;
