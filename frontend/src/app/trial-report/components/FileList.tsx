"use client";

import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Trash2,
  Inbox,
  Upload,
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
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { trialReportService } from "@/services/trialReportService";
import { PasswordConfirmDialog } from "./PasswordConfirmDialog";
import {
  getDownloadUrl,
  listFilesInFolder,
} from "@/services/r2Service";
import type { StorageItem } from "@/services/r2Service";

interface FileListProps {
  folderId: string | null;
  folderName: string;
  onError: (msg: string | null) => void;
  viewMode?: "table" | "cards";
  /** Called after a successful delete so the parent can refresh sidebar state. */
  onRefresh?: () => void;
}

function displayFileName(fileName: string): string {
  return fileName.replace(/^.*?__/, "");
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
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

export function FileList({
  folderId,
  folderName,
  onError,
  viewMode = "table",
  onRefresh,
}: FileListProps) {
  const [files, setFiles] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [requesting, setRequesting] = useState<StorageItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // P2.3 bulk selection state. `selectedIds` is a Set so add/remove
  // stays O(1) regardless of how many rows the folder has. The bulk
  // dialog + sticky bar both derive their visibility from `size > 0`.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handlePreview = async (file: StorageItem) => {
    setPreviewingId(file.id);
    try {
      const key = file.id.startsWith("trial-reports/") ? file.id : `trial-reports/${file.id}`;
      const url = await getDownloadUrl(key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Không lấy được link xem file");
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDownload = async (file: StorageItem) => {
    setDownloadingId(file.id);
    try {
      const key = file.id.startsWith("trial-reports/") ? file.id : `trial-reports/${file.id}`;
      const displayName = displayFileName(file.name);
      // Pass filename → backend signs URL with Content-Disposition:
      // attachment, so the browser triggers a Save-As dialog
      // (vs. inline preview which is what Xem does).
      const url = await getDownloadUrl(key, undefined, displayName);
      // Open in same tab so the browser handles the download UI
      window.location.href = url;
    } catch {
      toast.error("Không lấy được link tải file");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    loadFiles(folderId);
    // Reset the selection whenever the folder changes — the IDs in
    // the new folder are a different set and we don't want to leave
    // the user thinking their selection survived.
    setSelectedIds(new Set());
  }, [folderId]);

  const loadFiles = async (id: string | null) => {
    setIsLoading(true);
    onError(null);
    try {
      const target = id || null;
      const items = await listFilesInFolder(target);
      setFiles(items);
    } catch (err: any) {
      onError(
        err.response?.data?.error ||
          err.message ||
          "Lỗi khi tải danh sách file.",
      );
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  const openRequestDialog = (file: StorageItem) => {
    setRequesting(file);
  };

  const closeRequestDialog = () => {
    if (isSubmitting) return;
    setRequesting(null);
  };

  const submitRequest = async (password: string) => {
    if (!requesting) return;
    setIsSubmitting(true);
    onError(null);
    try {
      // Direct delete — replaces the old request/review flow. The
      // shared delete password (TRIAL_REPORT_DELETE_PASSWORD) is the
      // authorization gate; no separate TE/Admin approval step.
      const res = await trialReportService.executeDirectDelete(requesting.id, {
        password,
      });
      if (res.success) {
        closeRequestDialog();
        toast.success("Đã xóa thành công.");
        await loadFiles(folderId);
        onRefresh?.();
      } else {
        onError(res.error || "Không thể xóa phiếu.");
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error || err.message || "Lỗi khi xóa phiếu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // P2.3 bulk-selection helpers. Toggling always returns a brand-new
  // Set so React notices the reference change and re-renders the
  // header checkbox + sticky bar.
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
      // If anything is selected, clear. Otherwise select everything
      // currently loaded. `files` is the source of truth for the
      // header indeterminate state so we read from it directly.
      if (prev.size > 0) return new Set();
      return new Set(files.map((f) => f.id));
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Header checkbox state — `indeterminate` is what React passes to a
  // native checkbox when only some rows are checked.
  const allSelected = files.length > 0 && selectedIds.size === files.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const submitBulkRequest = async (password: string) => {
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
    await loadFiles(folderId);
    onRefresh?.();
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      {isLoading || (isInitialLoad && files.length === 0) ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Đang tải...
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Chưa có file nào</p>
          <p className="text-xs text-slate-400 mt-1">Upload phiếu đầu tiên cho thư mục này</p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <article
              key={file.id}
              className="group relative flex min-w-0 flex-col rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-black/[0.02] transition-colors hover:border-amber-300"
            >
              <div className="absolute right-3 top-3">
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={() => toggleRow(file.id)}
                  aria-label={`Chọn ${displayFileName(file.name)}`}
                />
              </div>
              <div className="flex min-w-0 items-start gap-3 pr-7">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="truncate text-sm font-semibold text-slate-800"
                    title={displayFileName(file.name)}
                  >
                    {displayFileName(file.name)}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{formatBytes(file.size)}</span>
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    <time dateTime={file.createdDate ?? undefined}>
                      {formatDate(file.createdDate)}
                    </time>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-t-slate-100 pt-3">
                {previewingId === file.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-400"
                    disabled
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-slate-500 hover:text-primary"
                    onClick={() => handlePreview(file)}
                    title="Xem trước PDF"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Xem
                  </Button>
                )}
                {downloadingId === file.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-400"
                    disabled
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-slate-500 hover:text-primary"
                    onClick={() => handleDownload(file)}
                    title="Tải xuống"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Tải
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-slate-500 hover:text-primary"
                  onClick={() => openRequestDialog(file)}
                  title="Yêu cầu xóa"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Xóa
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-slate-200/70 rounded-xl overflow-visible bg-white shadow-sm shadow-black/[0.02] relative z-0">
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
                <TableHead className="font-semibold text-slate-600">Kích thước</TableHead>
                <TableHead className="font-semibold text-slate-600">Ngày tạo</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id} className="hover:bg-slate-50/50">
                  <TableCell className="pl-4 pr-0">
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onCheckedChange={() => toggleRow(file.id)}
                      aria-label={`Chọn ${displayFileName(file.name)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="truncate font-medium text-slate-800" title={file.name}>
                        {displayFileName(file.name)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(file.createdDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {previewingId === file.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400"
                          disabled
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-primary"
                          title="Xem trước PDF"
                          onClick={() => handlePreview(file)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {downloadingId === file.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400"
                          disabled
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-primary"
                          title="Tải xuống"
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-destructive"
                        title="Yêu cầu xóa"
                        onClick={() => openRequestDialog(file)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* P2.3 sticky bottom bar — renders only when at least one row
          is selected. Stays pinned to the bottom of the FileList
          container so it follows the user as they scroll. */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 left-0 right-0 z-10 mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-black/5">
          <span className="text-sm font-medium text-slate-700">
            Đã chọn {selectedIds.size} file
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Bỏ chọn
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setBulkOpen(true);
              }}
            >
              Xóa tất cả
            </Button>
          </div>
        </div>
      )}

      {/* Bulk delete — password-gated. The same shared password is
          applied to every selected row sequentially. */}
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
        onConfirm={submitBulkRequest}
      />

      {/* Single-row delete — password-gated. */}
      <PasswordConfirmDialog
        open={!!requesting}
        onOpenChange={(open) => {
          if (!open) closeRequestDialog();
        }}
        title="Xác nhận xóa phiếu"
        busy={isSubmitting}
        confirmLabel="Xóa"
        onConfirm={submitRequest}
      />
    </div>
  );
}
