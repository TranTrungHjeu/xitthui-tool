"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission } from "@/lib/utils";
import { trialReportService } from "@/services/trialReportService";
import type { TrialReport } from "@/types/trialReport";
import {
  KpiCards,
  type KpiItem,
} from "./components/KpiCards";
import {
  ReportsPerDayChart,
  bucketReportsByDay,
  buildDailyBuckets,
  type DailyBucket,
} from "./components/ReportsPerDayChart";

/**
 * "Tổng quan" — TE-only dashboard for trial-report.
 *
 * Gated by `canViewAll`: anyone landing here without the flag is bounced
 * to `/dashboard/tools/trial-report` (the standard browser view).
 *
 * For now the KPIs are derived client-side from `getAllReports` until the
 * backend exposes dedicated count endpoints. The page fires a few small
 * parallel fetches and falls back to placeholder values if a particular
 * shape isn't supported yet — this keeps the dashboard usable while we
 * wire the real aggregation endpoints.
 */
export default function OverviewPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const hasAccess = useMemo(
    () => hasPermission(user, "canViewAll"),
    [user],
  );

  // Bounce non-authorized users once we've finished hydrating.
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) return;
    if (!user) return;
    if (!hasAccess) {
      router.replace("/dashboard/tools/trial-report");
    }
  }, [isHydrated, isAuthenticated, user, hasAccess, router]);

  const [reports, setReports] = useState<TrialReport[]>([]);
  const [pendingDeleteCount, setPendingDeleteCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Compute a wide enough window to cover the 14-day chart *plus*
    // "Phiếu tuần này" — we want every counter to come from the same
    // dataset so the numbers don't disagree because of paging.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - 13);

    const to = formatYmd(today);
    const from = formatYmd(windowStart);

    try {
      // Fetch reports only — the delete-request count endpoint was
      // retired when the request/review workflow was replaced by the
      // password-gated direct delete.
      const [reportsRes] = await Promise.allSettled([
        trialReportService.getAllReports({
          from,
          to,
          pageSize: 500,
        }),
      ]);

      const nextReports: TrialReport[] =
        reportsRes.status === "fulfilled" && reportsRes.value.success
          ? (reportsRes.value.data ?? [])
          : [];
      setReports(nextReports);
      // No more "pending delete" count — deletes are immediate.
      setPendingDeleteCount(0);

      if (
        reportsRes.status === "rejected" ||
        (reportsRes.status === "fulfilled" && !reportsRes.value.success)
      ) {
        const reason =
          (reportsRes.status === "fulfilled" && reportsRes.value.error) ||
          (reportsRes.status === "rejected" &&
            (reportsRes.reason as Error)?.message) ||
          "Không thể tải dữ liệu tổng quan.";
        setError(reason);
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi không xác định khi tải tổng quan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!hasAccess) return;
    load();
  }, [isHydrated, hasAccess, refreshKey, load]);

  const buckets: DailyBucket[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - 13);
    const counts = bucketReportsByDay(reports);
    return buildDailyBuckets(windowStart, 14, counts);
  }, [reports]);

  const kpiItems: KpiItem[] = useMemo(() => {
    const totalThisWeek = reports.length;

    // Teacher active = distinct teacher codes in the window.
    const teacherCodes = new Set<string>();
    let topTemplate: { label: string; count: number } | null = null;
    const templateCounts: Record<string, number> = {};
    for (const r of reports) {
      if (r.teacherCode) teacherCodes.add(r.teacherCode);
      const t = r.reportType || "Khác";
      templateCounts[t] = (templateCounts[t] ?? 0) + 1;
    }
    for (const [label, count] of Object.entries(templateCounts)) {
      if (!topTemplate || count > topTemplate.count) {
        topTemplate = { label, count };
      }
    }

    return [
      {
        label: "Phiếu tuần này",
        value: totalThisWeek,
        tone: "amber",
        hint: "14 ngày gần nhất",
      },
      {
        label: "Đang chờ duyệt",
        value: pendingDeleteCount,
        tone: "violet",
        hint: pendingDeleteCount > 0 ? "Yêu cầu xóa" : undefined,
      },
      {
        label: "Teacher active",
        value: teacherCodes.size,
        tone: "emerald",
        hint: teacherCodes.size > 0 ? "Mã GV khác nhau" : undefined,
      },
      {
        label: "Top template",
        value: topTemplate ? topTemplate.label : "—",
        tone: "sky",
        hint: topTemplate ? `${topTemplate.count} phiếu` : "Chưa có dữ liệu",
      },
    ];
  }, [reports, pendingDeleteCount]);

  if (!isHydrated) {
    return (
      <main className="mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center justify-center min-h-[300px] text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Đang tải...
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user || !hasAccess) {
    return (
      <main className="mx-auto px-4 sm:px-6 py-10">
        <Card className="max-w-md mx-auto p-8 text-center">
          <div className="h-10 w-10 mx-auto rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold mb-1 text-slate-800">
            Không có quyền truy cập
          </h2>
          <p className="text-sm text-slate-500">
            Trang Tổng quan chỉ dành cho TE có quyền{" "}
            <code className="font-mono text-[11px]">canViewAll</code>.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.replace("/dashboard/tools/trial-report")}
          >
            Quay lại Phiếu trải nghiệm
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-5 mx-auto px-4 sm:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </span>
            Tổng quan — Phiếu trải nghiệm
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Xem nhanh số liệu phiếu, yêu cầu đang chờ duyệt và teacher đang
            hoạt động. Số liệu đang ở chế độ placeholder — backend sẽ bổ sung
            endpoint tổng hợp sau.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={isLoading}
          title="Tải lại"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Tải lại
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      <KpiCards items={kpiItems} isLoading={isLoading} />

      <ReportsPerDayChart buckets={buckets} isLoading={isLoading} />
    </main>
  );
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}