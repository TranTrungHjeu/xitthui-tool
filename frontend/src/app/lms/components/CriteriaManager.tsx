"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { lmsService } from "@/services/lmsService";
import type { LmsCriteriaTemplate, LmsSubject } from "@/types/lms";

interface CriteriaManagerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly criteriaList: LmsCriteriaTemplate[];
  readonly currentSubject: LmsSubject;
  readonly onRefresh: () => Promise<void> | void;
  readonly onEdit: (template: LmsCriteriaTemplate) => void;
  readonly onCreate: () => void;
}

export function CriteriaManager({
  open,
  onClose,
  criteriaList,
  currentSubject,
  onRefresh,
  onEdit,
  onCreate,
}: CriteriaManagerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmDeleteId(null);
    }
  }, [open]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const existing = criteriaList.find((c) => c._id === id);
      if (!existing) {
        toast.error("Không tìm thấy bộ tiêu chí");
        return;
      }
      const cloneWithoutId: LmsCriteriaTemplate = {
        ...existing,
        sections: [],
      };
      await lmsService.saveCriteria({
        id,
        name: existing.name,
        subject: existing.subject,
        sections: [],
        type: existing.type,
      });
      toast.success("Đã xóa bộ tiêu chí (sections cleared)");
      await onRefresh();
    } catch (err: any) {
      toast.error("Lỗi xóa", { description: err?.message });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleResetToDefault = async () => {
    setSavingDefault(true);
    try {
      toast.info("Lưu ý: tiêu chí mặc định được cung cấp tự động bởi backend, không thể tạo bản mới từ UI.");
    } finally {
      setSavingDefault(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quản lý bộ tiêu chí</DialogTitle>
          <DialogDescription>
            Danh sách bộ tiêu chí cho môn{" "}
            <span className="font-semibold">{currentSubject}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {criteriaList.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">
              Chưa có bộ tiêu chí nào
            </div>
          )}
          {criteriaList.map((c) => {
            const isDefault = c.type === "default";
            return (
              <Card
                key={c._id}
                className="p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    {isDefault && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        Mặc định
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {c.sections?.length || 0} nhóm
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.sections?.reduce((acc, s) => acc + (s.criteria?.length || 0), 0) || 0} tiêu chí
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(c)}
                    disabled={isDefault}
                  >
                    Sửa
                  </Button>
                  {confirmDeleteId === c._id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(c._id)}
                        disabled={deletingId === c._id}
                      >
                        {deletingId === c._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Xác nhận"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Hủy
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteId(c._id)}
                      disabled={isDefault}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleResetToDefault}
            disabled={savingDefault}
          >
            Khôi phục mặc định
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Đóng
            </Button>
            <Button onClick={onCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Tạo mới
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CriteriaManager;
