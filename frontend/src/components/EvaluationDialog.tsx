"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";

interface EvaluationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  slotId: string;
  classId: string;
  onSuccess?: () => void;
}

export default function EvaluationDialog({
  isOpen,
  onOpenChange,
  student,
  slotId,
  classId,
  onSuccess,
}: EvaluationDialogProps) {
  const { token, clearClasses } = useAuthStore();
  const [comment, setComment] = useState(student?.comment || "");
  const [status, setStatus] = useState(student?.status || "PRESENT");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const payload = {
        classId,
        slotId,
        studentAttendances: [
          {
            studentId: student.studentId,
            status,
            comment,
          },
        ],
      };

      const res = await classService.updateEvaluation(token || "", payload);
      if (res.success) {
        setSuccess(true);
        // Clear classes cache to force refetch with new evaluation data
        clearClasses();

        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        setError(res.error || "Cập nhật thất bại");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Cập nhật nhận xét: {student?.student?.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-xs bg-green-500/10 text-green-600 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Cập nhật thành công!
            </div>
          )}

          <div className="space-y-2">
            <Label>Trạng thái điểm danh</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">Có mặt (PRESENT)</SelectItem>
                <SelectItem value="ATTENDED">Có mặt (ATTENDED)</SelectItem>
                <SelectItem value="ABSENT">Vắng mặt (ABSENT)</SelectItem>
                <SelectItem value="ABSENT_WITH_NOTICE">Vắng có phép</SelectItem>
                <SelectItem value="LATE">Đi muộn (LATE)</SelectItem>
                <SelectItem value="LATE_ARRIVED">
                  Đi muộn (LATE_ARRIVED)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Nội dung nhận xét (HTML/Text)</Label>
            <textarea
              id="comment"
              className="flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập nhận xét..."
            />
            <p className="text-[10px] text-muted-foreground italic">
              * Lưu ý: Hệ thống hỗ trợ tag HTML cơ bản như {"<p>"}, {"<strong>"}
              , {"<ul>"}, {"<li>"}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || success}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

