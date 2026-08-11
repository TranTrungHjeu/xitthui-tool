"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trialReportService } from "@/services/trialReportService";
import type { TrialReport } from "@/types/trialReport";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError?: (message: string) => void;
}

const REPORT_TYPE_STYLES: Record<string, string> = {
  "Kiro4+": "border-violet-200 bg-violet-50 text-violet-700",
  Robotics: "border-amber-200 bg-amber-50 text-amber-700",
  Coding: "border-blue-200 bg-blue-50 text-blue-700",
  Art: "border-pink-200 bg-pink-50 text-pink-700",
  "pdf-upload": "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalize(value?: string | null): string {
  return (value || "").trim().toLocaleLowerCase("vi-VN");
}

export function CommandPalette({
  open,
  onOpenChange,
  onError,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<TrialReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!open || hasLoaded.current) return;

    let cancelled = false;
    setIsLoading(true);

    trialReportService
      .getAllReports({ pageSize: 500 })
      .then((response) => {
        if (cancelled) return;
        if (response.success) {
          setReports(response.data || []);
          hasLoaded.current = true;
        } else {
          onError?.(response.error || "Không thể tải dữ liệu tìm kiếm.");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Không thể tải dữ liệu tìm kiếm.";
        onError?.(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, onError]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const search = normalize(query);
    const matches = search
      ? reports.filter((report) =>
          [
            report.fileName,
            report.studentName,
            report.teacherName,
            report.teacherCode,
            report.reportType,
          ].some((value) => normalize(value).includes(search)),
        )
      : reports;

    return matches.slice(0, 10);
  }, [query, reports]);

  const openReport = (report: TrialReport) => {
    if (!report.webViewLink) return;
    window.open(report.webViewLink, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-slate-200/70 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Tìm kiếm phiếu trải nghiệm</DialogTitle>
          <DialogDescription>
            Tìm theo tên file, học viên, giáo viên hoặc loại phiếu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 pr-12">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên file, học viên, giáo viên, loại phiếu..."
            aria-label="Tìm kiếm phiếu trải nghiệm"
            className="h-10 border-0 px-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải dữ liệu tìm kiếm...
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Không tìm thấy phiếu phù hợp.
            </div>
          ) : (
            <ul className="space-y-1">
              {results.map((report) => (
                <li key={report._id}>
                  <button
                    type="button"
                    disabled={!report.webViewLink}
                    onClick={() => openReport(report)}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {report.fileName}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{report.studentName || "Chưa có học viên"}</span>
                        <span>
                          {report.teacherName || report.teacherCode || "Chưa có GV"}
                          {report.teacherName && report.teacherCode
                            ? ` (${report.teacherCode})`
                            : ""}
                        </span>
                        <span>{formatDate(report.classDate || report.createdAt)}</span>
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={REPORT_TYPE_STYLES[report.reportType] || "border-slate-200 bg-slate-50 text-slate-700"}
                    >
                      {report.reportType}
                    </Badge>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-400">
          Hiển thị tối đa 10 kết quả
        </div>
      </DialogContent>
    </Dialog>
  );
}
