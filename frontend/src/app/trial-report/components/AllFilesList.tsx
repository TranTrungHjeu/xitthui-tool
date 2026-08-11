"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Trash2,
  Inbox,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { trialReportService } from "@/services/trialReportService";
import type { ReportType, TrialReport } from "@/types/trialReport";
import { PasswordConfirmDialog } from "./PasswordConfirmDialog";

interface AllFilesListProps {
  onError: (msg: string | null) => void;
  canDelete?: boolean;
  viewMode?: "table" | "cards";
  from?: string;
  to?: string;
  teacherCode?: string;
  studentName?: string;
  reportType?: string;
  filterTrigger?: number;
}

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

const REPORT_TYPES: ReportType[] = [
  "Kiro4+",
  "Robotics",
  "Coding",
  "Art",
  "pdf-upload",
];

const REPORT_TYPE_STYLES: Record<string, string> = {
  "Kiro4+": "bg-violet-50 text-violet-700 border-violet-200",
  Robotics: "bg-amber-50 text-amber-700 border-amber-200",
  Coding: "bg-blue-50 text-blue-700 border-blue-200",
  Art: "bg-pink-50 text-pink-700 border-pink-200",
  "pdf-upload": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// Mongo `fileName` is normally stored as the clean original name (the
// controller writes `uploaded.name`, not the R2 key), but legacy rows
// may still carry the `{ulid}__` prefix. Only strip when present so we
// don't double-trim already-clean names.
function displayFileName(rawName: string): string {
  if (!rawName) return rawName;
  const idx = rawName.indexOf("__");
  return idx >= 0 ? rawName.slice(idx + 2) : rawName;
}

export function AllFilesList({ onError, canDelete = false, viewMode = "table", from, to, teacherCode, studentName, reportType, filterTrigger }: AllFilesListProps) {
  const [reports, setReports] = useState<TrialReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [deleting, setDeleting] = useState<TrialReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // P2.3 bulk-selection state. `selectedIds` is a Set so add/remove
  // stays O(1) regardless of how many rows the search returned. The
  // bulk dialog + sticky bar both derive their visibility from
  // `size > 0`. We never persist this — switching folders/filters
  // should always start with a clean slate.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  // Header checkbox derived state. `allSelected` covers the
  // fully-checked case, `someSelected` covers the indeterminate
  // state when only a subset of the loaded rows are checked.
  const allSelected = reports.length > 0 && selectedIds.size === reports.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (prev.size > 0) return new Set();
      return new Set(reports.map((r) => r._id));
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const load = async () => {
    setIsLoading(true);
    onError(null);
    try {
      const res = await trialReportService.getAllReports({
        from: from || undefined,
        to: to || undefined,
        teacherCode: teacherCode || undefined,
        studentName: studentName || undefined,
        reportType: (reportType as ReportType) || undefined,
        pageSize: 200,
      });
      if (res.success) {
        setReports(res.data || []);
      } else {
        onError(res.error || "Không thể tải danh sách phiếu.");
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error ||
          err.message ||
          "Lỗi kết nối máy chủ khi tải phiếu.",
      );
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterTrigger, from, to, teacherCode, studentName, reportType]);

  const handleDelete = async (password: string) => {
    if (!deleting) return;
    setIsDeleting(true);
    onError(null);
    try {
      // executeDirectDelete verifies the shared password server-side
      // (constant-time compare against TRIAL_REPORT_DELETE_PASSWORD).
      const res = await trialReportService.executeDirectDelete(deleting._id, {
        password,
      });
      if (res.success) {
        setDeleting(null);
        await load();
        toast.success("Đã xóa thành công.");
      } else {
        onError(res.error || "Không thể xóa phiếu.");
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error || err.message || "Lỗi khi xóa phiếu.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // P2.3 bulk hard-delete. Fans out across every selected row,
  // calls `executeDirectDelete` for each (same shared password for
  // every row). Counts success and fail so we can show a toast.
  const submitBulkDelete = async (password: string) => {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    onError(null);
    setBulkProgress("");
    const ids = Array.from(selectedIds);
    const total = ids.length;
    let success = 0;
    let fail = 0;
    for (let i = 0; i < total; i++) {
      const id = ids[i];
      setBulkProgress(`Đang xóa ${i + 1}/${total}...`);
      try {
        const res = await trialReportService.executeDirectDelete(id, {
          password,
        });
        if (res.success) {
          success += 1;
        } else {
          fail += 1;
        }
      } catch (err) {
        fail += 1;
      }
    }
    setBulkProgress("");
    setBulkSubmitting(false);
    setBulkOpen(false);
    toast.success(
      `Đã xóa ${success} phiếu${fail ? ` (${fail} thất bại)` : ""}.`,
    );
    clearSelection();
    await load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Results */}
      {isLoading || (isInitialLoad && reports.length === 0) ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Đang tải...
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Không có phiếu nào</p>
          <p className="text-xs text-slate-400 mt-1">Thử điều chỉnh bộ lọc phía trên</p>
        </div>
      ) : (
        <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm shadow-black/[0.02]">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Tổng cộng <span className="font-semibold text-foreground">{reports.length}</span> phiếu
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="w-[40px] pl-4 pr-0">
                  <Checkbox
                    checked={
                      allSelected ? true : someSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả"
                  />
                </TableHead>
                <TableHead className="font-semibold text-slate-600">Tên file</TableHead>
                <TableHead className="font-semibold text-slate-600">Loại</TableHead>
                <TableHead className="font-semibold text-slate-600">Học viên</TableHead>
                <TableHead className="font-semibold text-slate-600">GV</TableHead>
                <TableHead className="font-semibold text-slate-600">Ngày học</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r._id} className="hover:bg-slate-50/50">
                  <TableCell className="pl-4 pr-0">
                    <Checkbox
                      checked={selectedIds.has(r._id)}
                      onCheckedChange={() => toggleRow(r._id)}
                      aria-label={`Chọn ${displayFileName(r.fileName)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[260px] truncate text-slate-800">
                    {displayFileName(r.fileName)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                        REPORT_TYPE_STYLES[r.reportType] || "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {r.reportType}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {r.studentName || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {r.teacherName || r.teacherCode || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(r.classDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {r.webViewLink && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-primary"
                        >
                          <a href={r.webViewLink} target="_blank" rel="noreferrer" title="Mở file">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Xóa
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* P2.3 sticky bottom bar — renders only when at least one row
          is selected. Stays pinned to the bottom of the AllFilesList
          container so it follows the user as they scroll through the
          search results. */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 left-0 right-0 z-10 mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-black/5">
          <span className="text-sm font-medium text-slate-700">
            Đã chọn {selectedIds.size} phiếu
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Bỏ chọn
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkOpen(true)}
              >
                Xóa tất cả
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bulk delete — password-gated. One password applies to every
          selected row. Backend verifies the password once per request
          (via `executeDirectDelete`). */}
      <PasswordConfirmDialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (!bulkSubmitting) setBulkOpen(open);
        }}
        title={`Xóa ${selectedIds.size} phiếu đã chọn?`}
        description="Hành động không thể hoàn tác."
        busy={bulkSubmitting}
        progress={bulkProgress}
        confirmLabel={`Xóa ${selectedIds.size} phiếu`}
        onConfirm={submitBulkDelete}
      />

      {/* Single-row delete — password-gated. */}
      <PasswordConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Xác nhận xóa phiếu"
        busy={isDeleting}
        confirmLabel="Xóa"
        onConfirm={handleDelete}
      />
    </div>
  );
}
