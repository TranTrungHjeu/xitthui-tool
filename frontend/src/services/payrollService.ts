"use client";

import api from "./api";
import type {
  PayrollMonthlyRollup,
  PayrollPeriod,
  PayrollSearchParams,
  PayrollSearchResponse,
  PayrollSummary,
  PayrollUploadResponse,
  PayrollPreviewResponse,
  PayrollIssueStatus,
  PayrollIssueReport,
  PayrollIssueListResponse,
  PayrollIssueNotifyResponse,
  PayrollIssueHistoryResponse,
  PayrollCentreOption,
} from "../types/payroll";

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  // Server-side diagnostic (only sent in non-production by notify endpoint).
  detail?: string;
  pagination?: PayrollSearchResponse["pagination"];
}

function getSessionId(): string | null {
  // sessionId now lives in the httpOnly cookie. Returning null is safe —
  // the server reads the cookie in `cookieAuth` middleware and ignores
  // body values.
  if (typeof window === "undefined") return null;
  return null;
}

function getAuthHeader(): Record<string, string> {
  // The cookie is sent automatically by the browser via withCredentials.
  // No manual Authorization header is needed.
  return {};
}

async function call<T>(
  method: "get" | "post" | "delete" | "patch",
  url: string,
  body?: Record<string, unknown>,
): Promise<ApiEnvelope<T>> {
  const response =
    method === "get"
      ? await api.get(url, { params: body })
      : method === "delete"
        ? await api.delete(url, { data: body })
        : method === "patch"
          ? await api.patch(url, body)
          : await api.post(url, body);
  return response.data as ApiEnvelope<T>;
}

function buildQuery(params: PayrollSearchParams | undefined): Record<string, unknown> {
  if (!params) return { sessionId: getSessionId() };
  const out: Record<string, unknown> = { sessionId: getSessionId() };
  if (params.q) out.q = params.q;
  if (params.periodId) out.periodId = params.periodId;
  if (params.type) out.type = params.type;
  if (params.classRole) out.classRole = params.classRole;
  if (params.centre) out.centre = params.centre;
  if (params.status) out.status = params.status;
  if (params.month) out.month = params.month;
  if (params.year) out.year = params.year;
  if (params.page) out.page = params.page;
  if (params.pageSize) out.pageSize = params.pageSize;
  return out;
}

async function uploadFile<T>(
  url: string,
  file: File,
  extra: Record<string, string | number>,
): Promise<ApiEnvelope<T>> {
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== "") {
      form.append(k, String(v));
    }
  }
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_API_URL || "";
  const response = await fetch(`${baseUrl}${url}`, {
    method: "POST",
    body: form,
    credentials: "include",
    headers: getAuthHeader(),
  });
  const json = await response.json().catch(() => ({}));
  return json as ApiEnvelope<T>;
}

export const payrollService = {
  // ---- Public read endpoints ----
  getPeriods: async () => {
    return call<PayrollPeriod[]>("get", "/payroll/periods");
  },

  // Distinct centre shortnames present in payroll data (all periods
  // unless `periodId` is supplied). Used by the search form to render
  // a <select> instead of a free-text input.
  getCentres: async (periodId?: string) => {
    const params: { periodId?: string } = {};
    if (periodId && periodId !== "ALL") params.periodId = periodId;
    return call<PayrollCentreOption[]>("get", "/payroll/centres", params);
  },

  searchRecords: async (params?: PayrollSearchParams) => {
    return call<PayrollSearchResponse["data"]>(
      "get",
      "/payroll/search",
      buildQuery(params),
    );
  },

  getSummary: async (periodId: string) => {
    return call<PayrollSummary>("get", "/payroll/summary", {
      periodId,
      sessionId: getSessionId(),
    });
  },

  getMonthlyRollup: async (periodId: string) => {
    return call<PayrollMonthlyRollup[]>(
      "get",
      "/payroll/monthly-rollup",
      { periodId, sessionId: getSessionId() },
    );
  },

  // ---- Admin endpoints ----
  adminListPeriods: async () => {
    return call<PayrollPeriod[]>("get", "/payroll/admin/periods", {
      sessionId: getSessionId(),
    });
  },

  previewPeriod: async (
    file: File,
    extra: Record<string, string | number> = {},
  ): Promise<ApiEnvelope<PayrollPreviewResponse>> => {
    return uploadFile<PayrollPreviewResponse>(
      "/payroll/admin/preview",
      file,
      {
        ...extra,
        sessionId: getSessionId() || "",
      },
    );
  },

  uploadPeriod: async (
    file: File,
    extra: { month?: number; year?: number; label?: string } = {},
  ): Promise<ApiEnvelope<PayrollUploadResponse>> => {
    return uploadFile<PayrollUploadResponse>(
      "/payroll/admin/periods",
      file,
      {
        ...extra,
        sessionId: getSessionId() || "",
      },
    );
  },

  archivePeriod: async (id: string) => {
    return call<PayrollPeriod>("delete", `/payroll/admin/periods/${id}`, {
      sessionId: getSessionId(),
    });
  },

  purgePeriod: async (id: string) => {
    return call<{ id: string; label: string; recordsDeleted: number }>(
      "delete",
      `/payroll/admin/periods/${id}/purge`,
      { sessionId: getSessionId() },
    );
  },

  // ---- Payroll Issue Reports ----
  createIssue: async (payload: {
    payrollRecordId: string;
    reason: string;
  }) => {
    return call<PayrollIssueReport>("post", "/payroll/issues", {
      ...payload,
      sessionId: getSessionId(),
    });
  },

  listIssues: async (params: {
    periodId?: string;
    status?: PayrollIssueStatus;
    centreShortname?: string;
    page?: number;
    pageSize?: number;
  } = {}) => {
    return call<PayrollIssueListResponse["data"]>(
      "get",
      "/payroll/admin/payroll-issues",
      {
        ...params,
        sessionId: getSessionId(),
      },
    );
  },

  notifyIssue: async (payload: {
    issueIds: string[];
    customIntro?: string;
    customConclusion?: string;
    mode?: "smtp" | "outlook";
  }) => {
    return call<PayrollIssueNotifyResponse>(
      "post",
      "/payroll/admin/payroll-issues/notify",
      {
        ...payload,
        sessionId: getSessionId(),
      },
    );
  },

  resolveIssue: async (id: string, payload: {
    action: "resolved" | "dismissed";
    note?: string;
  }) => {
    return call<PayrollIssueReport>(
      "patch",
      `/payroll/admin/payroll-issues/${id}/resolve`,
      {
        ...payload,
        sessionId: getSessionId(),
      },
    );
  },

  getIssueHistory: async (id: string) => {
    return call<PayrollIssueHistoryResponse>(
      "get",
      `/payroll/admin/payroll-issues/${id}/history`,
      { sessionId: getSessionId() },
    );
  },
};

export type PayrollService = typeof payrollService;