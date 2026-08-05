"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Send } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { payrollService } from "@/services/payrollService";
import type { PayrollRecord } from "@/types/payroll";

interface ReportPayrollIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PayrollRecord | null;
  onReported?: () => void;
}

export function ReportPayrollIssueDialog({
  open,
  onOpenChange,
  record,
  onReported,
}: ReportPayrollIssueDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset buffer khi mở/đóng dialog.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!record) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập lý do báo cáo.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await payrollService.createIssue({
        payrollRecordId: record._id,
        reason: trimmed,
      });
      if (res.success) {
        toast.success(
          `Đã gửi báo cáo công lương Uncheck vô lý tới TE ${record.teacherName || ""}.`,
        );
        setReason("");
        onOpenChange(false);
        onReported?.();
      } else {
        toast.error("Gửi báo cáo thất bại", {
          description: res.error,
        });
      }
    } catch (err: any) {
      toast.error("Lỗi", { description: err?.message ?? String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Báo cáo công lương Uncheck vô lý
          </DialogTitle>
          <DialogDescription>
            Báo cáo sẽ được gửi tới TE thekhiem để tổng hợp gửi team Tech.
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30 dark:border-amber-700">
            <div className="font-medium">
              {record.teacherName || "(không rõ GV)"}
            </div>
            <div className="text-xs text-muted-foreground">
              {record.className || "—"} ·{" "}
              {record.slotTime
                ? new Date(record.slotTime).toLocaleString("vi-VN")
                : "—"}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Lý do cụ thể <span className="text-destructive">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            placeholder="VD: GV không ghi nhận buổi học bù cho lớp LEGO... bị thiếu công..."
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            disabled={submitting}
          />
          <div className="text-xs text-muted-foreground text-right">
            {reason.length}/1000
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !reason.trim()}
          >
            <Send className="h-4 w-4" />
            Gửi báo cáo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
