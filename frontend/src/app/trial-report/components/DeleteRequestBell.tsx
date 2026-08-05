"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { trialReportService } from "@/services/trialReportService";
import { deleteFile as driveDeleteFile } from "@/services/googleDriveService";
import type { DeleteRequest } from "@/types/trialReport";

interface DeleteRequestBellProps {
  onError: (msg: string | null) => void;
  onChanged: () => void;
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

export function DeleteRequestBell({
  onError,
  onChanged,
}: DeleteRequestBellProps) {
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    onError(null);
    try {
      const res = await trialReportService.getDeleteRequests({
        status: "pending",
        pageSize: 100,
      });
      if (res.success) {
        setRequests(res.data || []);
      } else {
        onError(res.error || "Không thể tải yêu cầu xóa.");
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error ||
          err.message ||
          "Lỗi kết nối máy chủ khi tải yêu cầu xóa.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleReview = async (
    id: string,
    action: "approve" | "reject",
  ) => {
    setReviewingId(id);
    onError(null);
    try {
      const res = await trialReportService.reviewDeleteRequest(id, { action });
      if (res.success && res.data) {
        if (action === "approve") {
          // Browser trashes the Drive file first (the backend no longer
          // touches Drive to avoid the service-account `storageQuotaExceeded`
          // error). Mongo soft-delete always runs as a follow-up.
          try {
            await driveDeleteFile(res.data.reportId);
          } catch (driveErr) {
            console.warn(
              "Drive trash failed (continuing to Mongo delete):",
              driveErr,
            );
          }
          try {
            await trialReportService.executeDelete(res.data.reportId);
          } catch (execErr) {
            console.warn("executeDelete after approve failed", execErr);
          }
        }
        await load();
        onChanged();
      } else {
        onError(res.error || "Không thể xét duyệt yêu cầu.");
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error ||
          err.message ||
          "Lỗi khi xét duyệt yêu cầu.",
      );
    } finally {
      setReviewingId(null);
    }
  };

  const pendingCount = requests.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-9"
          onClick={() => {
            setOpen((prev) => !prev);
            if (!open) load();
          }}
        >
          <Bell className="h-4 w-4" />
          Yêu cầu xóa
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] rounded-full"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <Card className="border-0 shadow-none">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Yêu cầu xóa ({pendingCount})
            </h4>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={load}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Tải lại"
              )}
            </Button>
          </div>

          {isLoading && requests.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
              Đang tải...
            </div>
          ) : requests.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Không có yêu cầu nào đang chờ.
            </div>
          ) : (
            <ul className="max-h-[400px] overflow-y-auto scrollbar-thin divide-y">
              {requests.map((req) => (
                <li key={req._id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm truncate flex-1">
                      {req.fileName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDate(req.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">
                      {req.requestedByName || "Ẩn danh"}
                    </span>
                    : {req.reason}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => handleReview(req._id, "reject")}
                      disabled={reviewingId === req._id}
                    >
                      <X className="h-3.5 w-3.5" />
                      Từ chối
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7"
                      onClick={() => handleReview(req._id, "approve")}
                      disabled={reviewingId === req._id}
                    >
                      {reviewingId === req._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Duyệt & xóa
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
}