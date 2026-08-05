"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trialReportService } from "@/services/trialReportService";
import {
  listFilesInFolder,
  getRootFolderId as getDriveRootFolderId,
  initializeGoogleDrive,
  isUserSignedIn,
} from "@/services/googleDriveService";
import type { DriveFile } from "@/types/trialReport";

interface FileListProps {
  folderId: string | null;
  folderName: string;
  onError: (msg: string | null) => void;
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

export function FileList({ folderId, folderName, onError }: FileListProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [requesting, setRequesting] = useState<DriveFile | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadFiles(folderId);
  }, [folderId]);

  const loadFiles = async (id: string | null) => {
    setIsLoading(true);
    onError(null);
    try {
      // gapi may not be loaded yet when this fires on first mount.
      // Calling `listFilesInFolder` directly would throw
      // `gapi is not defined`. Initialize first.
      try {
        await initializeGoogleDrive();
      } catch (initErr: any) {
        setFiles([]);
        onError(
          initErr?.message || "Không thể khởi tạo Google Drive",
        );
        return;
      }

      // Don't call Drive when there's no token — the previous behaviour
      // triggered `assertTokenValid` → auto-popup OAuth, which the
      // browser blocks outside of a user gesture and left the page in
      // an empty state with no recovery path.
      if (!isUserSignedIn()) {
        setFiles([]);
        return;
      }

      // Browser-direct Drive listing (was: trialReportService.getFiles).
      // The backend proxy was removed because service-account Drive
      // listing hits `storageQuotaExceeded` for personal folders.
      const target = id || getDriveRootFolderId() || undefined;
      const items = await listFilesInFolder(target);
      setFiles(items as DriveFile[]);
    } catch (err: any) {
      onError(
        err.response?.data?.error ||
          err.message ||
          "Lỗi kết nối Google Drive khi tải file.",
      );
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  const openRequestDialog = (file: DriveFile) => {
    setRequesting(file);
    setReason("");
  };

  const closeRequestDialog = () => {
    if (isSubmitting) return;
    setRequesting(null);
    setReason("");
  };

  const submitRequest = async () => {
    if (!requesting) return;
    if (!reason.trim()) {
      onError("Vui lòng nhập lý do xóa.");
      return;
    }
    setIsSubmitting(true);
    onError(null);
    try {
      const res = await trialReportService.requestDelete({
        reportId: requesting.id,
        reason: reason.trim(),
      });
      if (res.success) {
        closeRequestDialog();
        onError(null);
        alert("Đã gửi yêu cầu xóa. TE/Admin sẽ xét duyệt.");
      } else {
        onError(res.error || "Không thể gửi yêu cầu xóa.");
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error || err.message || "Lỗi khi gửi yêu cầu xóa.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
      ) : (
        <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm shadow-black/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="w-[55%] font-semibold text-slate-600">Tên file</TableHead>
                <TableHead className="font-semibold text-slate-600">Kích thước</TableHead>
                <TableHead className="font-semibold text-slate-600">Ngày tạo</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="truncate font-medium text-slate-800" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(file.createdTime)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {file.webViewLink && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-primary"
                        >
                          <a href={file.webViewLink} target="_blank" rel="noreferrer" title="Mở trong Drive">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => openRequestDialog(file)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Yêu cầu xóa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!requesting}
        onOpenChange={(open) => {
          if (!open) closeRequestDialog();
        }}
      >
        <DialogContent className="border-slate-200/70">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Yêu cầu xóa phiếu</DialogTitle>
            <DialogDescription>
              File: <span className="font-medium text-foreground">{requesting?.name}</span>. TE/Admin
              sẽ xét duyệt yêu cầu của bạn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do xóa *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Upload nhầm, sai tên học viên..."
              disabled={isSubmitting}
              className="h-10"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRequestDialog}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button onClick={submitRequest} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Gửi yêu cầu"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
