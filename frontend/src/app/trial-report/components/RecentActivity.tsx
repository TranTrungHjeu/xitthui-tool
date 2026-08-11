"use client";

import { useEffect, useState } from "react";
import { Clock, ExternalLink, Loader2 } from "lucide-react";
import { trialReportService } from "@/services/trialReportService";
import { useAuthStore } from "@/store/useAuthStore";
import type { TrialReport } from "@/types/trialReport";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function displayFileName(rawName: string): string {
  if (!rawName) return rawName;
  const idx = rawName.indexOf("__");
  return idx >= 0 ? rawName.slice(idx + 2) : rawName;
}

export function RecentActivity() {
  const user = useAuthStore((s) => s.user);
  const [reports, setReports] = useState<TrialReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        // Backend doesn't yet support `uploadedByEmail` filter — fetch all
        // and filter client-side.
        const res = await trialReportService.getAllReports({ pageSize: 200 });
        if (cancelled) return;
        if (res.success && res.data) {
          const myReports = (res.data as TrialReport[])
            .filter((r) => r.uploadedByEmail === user.email)
            .slice(0, 10);
          setReports(myReports);
        }
      } catch {
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  return (
    <div className="px-4 py-3 border-b border-slate-100">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          Hoạt động gần đây
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-3 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          Đang tải...
        </div>
      ) : reports.length === 0 ? (
        <p className="text-xs text-slate-400 py-1">Chưa có hoạt động</p>
      ) : (
        <ul className="space-y-0.5">
          {reports.map((r) => (
            <li key={r._id}>
              {r.webViewLink ? (
                <a
                  href={r.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs hover:bg-amber-50 transition-colors group"
                >
                  <ExternalLink className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="truncate text-slate-600 group-hover:text-emerald-700">
                    {displayFileName(r.fileName)}
                  </span>
                  <span className="shrink-0 text-slate-400 ml-auto pl-1">
                    {formatDate(r.createdAt || r.classDate)}
                  </span>
                </a>
              ) : (
                <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs">
                  <span className="truncate text-slate-400">
                    {displayFileName(r.fileName)}
                  </span>
                  <span className="shrink-0 text-slate-400 ml-auto pl-1">
                    {formatDate(r.createdAt || r.classDate)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
