"use client";

import { useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/toast";
import { trialReportService } from "@/services/trialReportService";
import { getTodayVietnam } from "@/lib/utils";
import {
  uploadPDFFile as driveUploadPDFFile,
  getGoogleUserInfo,
} from "@/services/googleDriveService";
import { CreateReportForm } from "./CreateReportForm";
import type { ReportType } from "@/types/trialReport";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string | null;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
}

const REPORT_TYPE_OPTIONS: ReportType[] = [
  "Kiro4+",
  "Robotics",
  "Coding",
  "Art",
  "pdf-upload",
];

/**
 * Build the date hierarchy parts the Drive uploader needs (same as the
 * Vite sub-project):
 *   year  = YYYY
 *   month = MM
 *   day   = DD/MM/YYYY (Vietnamese format used by the original)
 */
function formatDateParts(classDate: string): {
  year: string;
  month: string;
  day: string;
} {
  // classDate is "YYYY-MM-DD" from the DatePicker. Parse defensively.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(classDate || "");
  if (!m) {
    const d = new Date();
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { year: String(y), month: mm, day: `${dd}/${mm}/${y}` };
  }
  const [, y, mm, dd] = m;
  return { year: y, month: mm, day: `${dd}/${mm}/${y}` };
}

export function UploadDialog({
  open,
  onOpenChange,
  folderId,
  onError,
  onRefresh,
}: UploadDialogProps) {
  const [tab, setTab] = useState<"upload" | "create">("upload");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [classDate, setClassDate] = useState<string>(getTodayVietnam());
  const [teacherName, setTeacherName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reportType, setReportType] = useState<ReportType>("pdf-upload");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setPickedFile(null);
    setClassDate(getTodayVietnam());
    setTeacherName("");
    setStudentName("");
    setReportType("pdf-upload");
    setIsSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  /**
   * Two-step upload:
   *   1. push the PDF to Drive via the user's OAuth token
   *      (auto-creates Year > Month > Day > Teacher folder tree)
   *   2. POST the resulting file metadata to /trial-report/reports/register
   *      so Mongo learns about the new file
   *
   * Order matters: if step 1 succeeds but step 2 fails, the file still
   * lives in Drive and the user can retry by resubmitting the form.
   */
  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    if (!pickedFile) {
      onError("Vui lòng chọn file PDF.");
      return;
    }
    if (!studentName.trim()) {
      onError("Vui lòng nhập tên học viên.");
      return;
    }
    if (pickedFile.type && pickedFile.type !== "application/pdf") {
      onError("Chỉ chấp nhận file PDF.");
      return;
    }
    if (!teacherName.trim()) {
      onError("Vui lòng nhập tên giáo viên (cần thiết để tạo thư mục trên Drive).");
      return;
    }

    setIsSubmitting(true);
    try {
      const { year, month, day } = formatDateParts(classDate);
      const teacher = teacherName.trim();

      const uploaded = await driveUploadPDFFile({
        year,
        month,
        day,
        teacher,
        studentName: studentName.trim(),
        file: pickedFile,
      });

      const userInfo = await getGoogleUserInfo().catch(() => null);

      const res = await trialReportService.registerReport({
        driveFileId: uploaded.id,
        fileName: uploaded.name,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        webViewLink: uploaded.webViewLink,
        webContentLink: uploaded.webContentLink,
        parentFolderId: uploaded.parents?.[0] || folderId || null,
        reportType,
        classDate,
        teacherName: teacher,
        studentName: studentName.trim(),
        uploadedByEmail: userInfo?.email || null,
      });

      if (res.success) {
        toast.success("Đã upload phiếu thành công");
        handleOpenChange(false);
        onRefresh();
      } else {
        onError(
          res.error ||
            "Upload lên Drive thành công nhưng backend không ghi nhận được. File đã nằm trong Drive của bạn — có thể cần dọn thủ công.",
        );
      }
    } catch (err: any) {
      onError(
        err.response?.data?.error || err.message || "Lỗi khi upload file.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent side="right" width={1000}>
        <DrawerClose />
        <DrawerHeader>
          <DrawerTitle>Thêm phiếu trải nghiệm</DrawerTitle>
          <DrawerDescription>
            Upload PDF có sẵn hoặc tạo mới từ form
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">

        <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "create")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="upload">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger value="create">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Tạo phiếu mới
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/30 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPickedFile(f || null);
                }}
                className="hidden"
                id="pdf-upload-input"
              />
              <label htmlFor="pdf-upload-input" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click hoặc kéo file vào đây</p>
                <p className="text-xs text-muted-foreground/70">Chỉ chấp nhận file PDF, tối đa 10MB</p>
              </label>
            </div>
            {pickedFile && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{pickedFile.name}</p>
                  <p className="text-xs text-green-600">{(pickedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickedFile(null)}
                >
                  Xóa
                </Button>
              </div>
            )}

            <form onSubmit={handleUploadPdf} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="uploadReportType">Loại phiếu</Label>
                  <Select
                    value={reportType}
                    onValueChange={(v) => setReportType(v as ReportType)}
                  >
                    <SelectTrigger id="uploadReportType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt === "pdf-upload" ? "PDF upload" : opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="uploadClassDate">Ngày buổi học *</Label>
                  <DatePicker
                    id="uploadClassDate"
                    value={classDate}
                    onChange={setClassDate}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="uploadStudentName">Tên học viên *</Label>
                  <Input
                    id="uploadStudentName"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="uploadTeacherName">Tên giáo viên *</Label>
                  <Input
                    id="uploadTeacherName"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="VD: Nguyễn Quốc Dũng"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting || !pickedFile}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload PDF
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="create" className="mt-3">
            <CreateReportForm
              folderId={folderId}
              onError={onError}
              onClose={() => handleOpenChange(false)}
              onRefresh={onRefresh}
            />
          </TabsContent>
        </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
