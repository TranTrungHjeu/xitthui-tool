"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trialReportService } from "@/services/trialReportService";
import type {
  ReportAuditAction,
  ReportAuditEvent,
} from "@/types/trialReport";

interface ActivityFeedProps {
  reportId: string | null;
  reportName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renders a vertical timeline of the most recent audit events for a
 * single report. The backend returns up to 50 entries (newest first),
 * which we display as a chronological story (oldest at the top).
 */
export function ActivityFeed({
  reportId,
  reportName,
  open,
  onOpenChange,
}: ActivityFeedProps) {
  const [events, setEvents] = useState<ReportAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !reportId) {
      setEvents([]);
      setError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await trialReportService.getReportAudit(reportId, 50);
        if (cancelled) return;
        if (res.success) {
          setEvents((res.data || []) as ReportAuditEvent[]);
        } else {
          setError(res.error || "Không thể tải lịch sử thao tác.");
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(
          err?.response?.data?.error ||
            err?.message ||
            "Lỗi kết nối máy chủ khi tải lịch sử.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, reportId]);

  // Display newest at the top of the drawer — easier to scan.
  const ordered = [...events].sort((a, b) => {
    const at = new Date(a.at || 0).getTime();
    const bt = new Date(b.at || 0).getTime();
    return bt - at;
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-md border-slate-200/70">
        <DialogHeader>
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <DialogTitle>Lịch sử thao tác</DialogTitle>
          <DialogDescription>
            {reportName ? (
              <>
                Phiếu:{" "}
                <span className="font-medium text-foreground">
                  {reportName}
                </span>
              </>
            ) : (
              "Các hành động gần đây trên phiếu này."
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Đang tải lịch sử...
          </div>
        ) : error ? (
          <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 text-xs text-muted-foreground">
            <Clock className="h-8 w-8 text-slate-300 mb-2" />
            Chưa có thao tác nào được ghi lại.
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto scrollbar-thin space-y-2 pr-1">
            {ordered.map((event) => (
              <li
                key={event._id}
                className="flex items-start gap-3 px-3 py-2 rounded-lg border border-slate-200/70 bg-white"
              >
                <div className="shrink-0 mt-0.5">
                  <ActionIcon action={event.action} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {actionLabel(event.action)}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDate(event.at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bởi:{" "}
                    <span className="font-medium text-foreground">
                      {event.actorName || "Ẩn danh"}
                    </span>
                  </p>
                  {renderMetaExtra(event)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function actionLabel(action: ReportAuditAction): string {
  switch (action) {
    case "upload":
      return "Upload phiếu";
    case "delete":
      return "Xóa phiếu";
    case "restore":
      return "Khôi phục phiếu";
    default:
      return action;
  }
}

function ActionIcon({ action }: { action: ReportAuditAction }) {
  const className = "h-4 w-4";
  switch (action) {
    case "upload":
      return (
        <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Upload className={`${className} text-emerald-600`} />
        </div>
      );
    case "delete":
      return (
        <div className="h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center">
          <Trash2 className={`${className} text-rose-600`} />
        </div>
      );
    default:
      return (
        <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">
          <Activity className={`${className} text-slate-500`} />
        </div>
      );
  }
}

function renderMetaExtra(event: ReportAuditEvent) {
  const meta = event.meta || {};
  const reason =
    typeof meta.reason === "string" && meta.reason.trim()
      ? meta.reason
      : null;
  const note =
    typeof meta.note === "string" && meta.note.trim()
      ? meta.note
      : null;
  const reviewAction =
    typeof meta.reviewAction === "string" ? meta.reviewAction : null;

  if (!reason && !note && !reviewAction) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reason && (
        <Badge variant="outline" className="text-[10px] font-normal">
          Lý do: {reason}
        </Badge>
      )}
      {reviewAction && (
        <Badge variant="outline" className="text-[10px] font-normal">
          {reviewAction === "approve" ? "Duyệt" : "Từ chối"}
        </Badge>
      )}
      {note && (
        <Badge variant="outline" className="text-[10px] font-normal">
          Ghi chú: {note}
        </Badge>
      )}
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
