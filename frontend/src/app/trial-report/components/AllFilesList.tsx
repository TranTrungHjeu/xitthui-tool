"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Trash2,
  Filter,
  Inbox,
  Search,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trialReportService } from "@/services/trialReportService";
import { deleteFile as driveDeleteFile } from "@/services/googleDriveService";
import type { ReportType, TrialReport } from "@/types/trialReport";

interface AllFilesListProps {
  onError: (msg: string | null) => void;
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

export function AllFilesList({ onError }: AllFilesListProps) {
  const [reports, setReports] = useState<TrialReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reportType, setReportType] = useState<string>("");
  const [deleting, setDeleting] = useState<TrialReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    onError(null);
    try {
      // Trash the file in Drive first via the user's OAuth token (browser
      // path; backend no longer touches Drive because of service-account
      // storage quota). Then ask the backend to soft-delete the Mongo row.
      try {
        await driveDeleteFile(deleting._id);
      } catch (driveErr: any) {
        // Even if Drive trash fails (token expired / file in another
        // account), continue — the Mongo row will still be hidden from
        // the UI, and an admin can clean the Drive file up later.
        console.warn("Drive trash failed (continuing to Mongo delete):", driveErr);
      }
      const res = await trialReportService.executeDelete(deleting._id);
      if (res.success) {
        setDeleting(null);
        await load();
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Filter Card */}
      <div className="border border-slate-200/70 rounded-xl bg-gradient-to-br from-card to-muted/20 shadow-sm shadow-black/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Filter className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Bộ lọc</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs font-medium text-slate-600">Từ ngày</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs font-medium text-slate-600">Đến ngày</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacherCodeFilter" className="text-xs font-medium text-slate-600">Mã GV</Label>
              <Input
                id="teacherCodeFilter"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="I3470"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studentNameFilter" className="text-xs font-medium text-slate-600">Tên học viên</Label>
              <Input
                id="studentNameFilter"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reportTypeFilter" className="text-xs font-medium text-slate-600">Loại</Label>
              <select
                id="reportTypeFilter"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Tất cả</option>
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={load} disabled={isLoading} size="sm" className="h-9 shadow-sm shadow-primary/20">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Lọc
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

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
                  <TableCell className="font-medium max-w-[260px] truncate text-slate-800">
                    {r.fileName}
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
                          <a href={r.webViewLink} target="_blank" rel="noreferrer" title="Mở trong Drive">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Xóa
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
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="border-slate-200/70">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Xác nhận xóa phiếu</DialogTitle>
            <DialogDescription>
              File sẽ được chuyển vào thùng rác trên Drive và soft-delete trong
              MongoDB. Hành động này sẽ được ghi log.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            File: <span className="font-medium text-foreground">{deleting?.fileName}</span>
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Xóa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
