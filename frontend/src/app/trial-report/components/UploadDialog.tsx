"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2, Upload } from "lucide-react";
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
  uploadPDFFile as r2UploadPDFFile,
} from "@/services/r2Service";
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
 * Templates available for the "Tạo phiếu mới" wizard. Excludes
 * `pdf-upload` (which only applies to the upload tab). Mirrors the
 * picker previously embedded inside `CreateReportForm`.
 */
const CREATE_TEMPLATE_OPTIONS: { type: ReportType; icon: string; label: string }[] = [
  { type: "Kiro4+", icon: "🤸", label: "Robotics 4+" },
  { type: "Robotics", icon: "🤖", label: "Robotics" },
  { type: "Coding", icon: "💻", label: "Coding" },
  { type: "Art", icon: "🎨", label: "Art" },
];

/**
 * Build the date hierarchy parts the R2 uploader needs:
 *   year  = YYYY
 *   month = MM
 *   day   = DD/MM/YYYY (Vietnamese format kept for parity with the
 *           folder layout used before migration)
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
    return { year: String(y), month: mm, day: `${dd}-${mm}-${y}` };
  }
  const [, y, mm, dd] = m;
  return { year: y, month: mm, day: `${dd}-${mm}-${y}` };
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
  // Wizard state for the "Tạo phiếu mới" tab. `createReportType` is
  // intentionally separate from `reportType` (which is used by the
  // upload tab and defaults to "pdf-upload").
  const [createReportType, setCreateReportType] = useState<ReportType>("Kiro4+");
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setPickedFile(null);
    setClassDate(getTodayVietnam());
    setTeacherName("");
    setStudentName("");
    setReportType("pdf-upload");
    setCreateReportType("Kiro4+");
    setCreateStep(1);
    setIsSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  /**
   * Two-step upload:
   *   1. push the PDF to R2 via the backend's multipart endpoint
   *      (which mirrors the previous Year > Month > Day > Teacher
   *      folder tree)
   *   2. POST the resulting file metadata to /trial-report/reports/register
   *      so Mongo learns about the new file
   *
   * Order matters: if step 1 succeeds but step 2 fails, the file still
   * lives in R2 and the user can retry by resubmitting the form.
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
      onError("Vui lòng nhập tên giáo viên (cần thiết để tạo thư mục trên R2).");
      return;
    }

    setIsSubmitting(true);
    try {
      const { year, month, day } = formatDateParts(classDate);
      const teacher = teacherName.trim();

      const uploaded = await r2UploadPDFFile({
        year,
        month,
        day,
        teacher,
        studentName: studentName.trim(),
        file: pickedFile,
      });

      const res = await trialReportService.registerReport({
        r2Key: uploaded.id, // R2 object key is the unique storage id
        fileName: uploaded.name,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        webViewLink: uploaded.webViewLink,
        reportType,
        classDate,
        teacherName: teacher,
        studentName: studentName.trim(),
        uploadedByEmail: null,
      });

      if (res.success) {
        toast.success("Đã upload phiếu thành công");
        handleOpenChange(false);
        onRefresh();
      } else {
        onError(
          res.error ||
            "Upload lên R2 thành công nhưng backend không ghi nhận được.",
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
      <DrawerContent side="right" width={720}>
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
            {createStep === 1 ? (
              <CreateWizardStep1
                reportType={createReportType}
                onReportTypeChange={setCreateReportType}
                classDate={classDate}
                onClassDateChange={setClassDate}
                teacherName={teacherName}
                onTeacherNameChange={setTeacherName}
                studentName={studentName}
                onStudentNameChange={setStudentName}
                onCancel={() => handleOpenChange(false)}
                onContinue={() => setCreateStep(2)}
              />
            ) : (
              <CreateWizardStep2
                summary={{
                  reportType: createReportType,
                  classDate,
                  teacherName,
                  studentName,
                }}
                onBack={() => setCreateStep(1)}
                folderId={folderId}
                onError={onError}
                onClose={() => handleOpenChange(false)}
                onRefresh={onRefresh}
                onClassDateChange={setClassDate}
              />
            )}
          </TabsContent>
        </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard sub-components                                                */
/* ------------------------------------------------------------------ */

interface CreateWizardStep1Props {
  reportType: ReportType;
  onReportTypeChange: (type: ReportType) => void;
  classDate: string;
  onClassDateChange: (date: string) => void;
  teacherName: string;
  onTeacherNameChange: (name: string) => void;
  studentName: string;
  onStudentNameChange: (name: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}

/**
 * Step 1 of the "Tạo phiếu mới" wizard. Picks the template and the
 * three metadata fields (date / teacher / student) that are shared
 * across every form template. Validation only requires student +
 * teacher before advancing; everything else is collected in Step 2.
 */
function CreateWizardStep1({
  reportType,
  onReportTypeChange,
  classDate,
  onClassDateChange,
  teacherName,
  onTeacherNameChange,
  studentName,
  onStudentNameChange,
  onCancel,
  onContinue,
}: CreateWizardStep1Props) {
  const canContinue =
    studentName.trim().length > 0 && teacherName.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <ol className="flex items-center gap-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[11px] font-semibold">
            1
          </span>
          <span className="font-medium text-foreground">Thông tin chung</span>
        </li>
        <li className="h-px flex-1 bg-border" aria-hidden />
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full border bg-background text-muted-foreground inline-flex items-center justify-center text-[11px] font-semibold">
            2
          </span>
          <span>Chi tiết phiếu</span>
        </li>
      </ol>

      <div className="p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">Chọn template phiếu:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CREATE_TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => onReportTypeChange(opt.type)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                reportType === opt.type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              <span className="mr-1.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="createClassDate">Ngày buổi học *</Label>
          <DatePicker
            id="createClassDate"
            value={classDate}
            onChange={onClassDateChange}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="createStudentName">Tên học viên *</Label>
          <Input
            id="createStudentName"
            value={studentName}
            onChange={(e) => onStudentNameChange(e.target.value)}
            placeholder="Nhập họ và tên"
            required
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="createTeacherName">Tên giáo viên *</Label>
          <Input
            id="createTeacherName"
            value={teacherName}
            onChange={(e) => onTeacherNameChange(e.target.value)}
            placeholder="VD: Nguyễn Quốc Dũng"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          Tiếp tục
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

interface CreateWizardStep2Props {
  summary: {
    reportType: ReportType;
    classDate: string;
    teacherName: string;
    studentName: string;
  };
  onBack: () => void;
  folderId: string | null;
  onError: (msg: string | null) => void;
  onClose: () => void;
  onRefresh: () => void;
  /**
   * Forwarded to `CreateReportForm` so any DatePicker change in the
   * sub-forms bubbles back up to the parent (which owns the
   * canonical `classDate` state).
   */
  onClassDateChange: (date: string) => void;
}

/**
 * Step 2 renders the existing `CreateReportForm` and shows a small
 * summary header (template + date + student) so the user can confirm
 * the metadata they entered in Step 1. "Quay lại" returns to Step 1;
 * the sub-form keeps `initialData` in sync via the props passed in.
 */
function CreateWizardStep2({
  summary,
  onBack,
  folderId,
  onError,
  onClose,
  onRefresh,
  onClassDateChange,
}: CreateWizardStep2Props) {
  const template = CREATE_TEMPLATE_OPTIONS.find(
    (o) => o.type === summary.reportType,
  );

  return (
    <div className="space-y-4">
      {/* Step indicator (step 2 active) */}
      <ol className="flex items-center gap-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full border bg-background text-muted-foreground inline-flex items-center justify-center text-[11px] font-semibold">
            1
          </span>
          <span>Thông tin chung</span>
        </li>
        <li className="h-px flex-1 bg-primary" aria-hidden />
        <li className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[11px] font-semibold">
            2
          </span>
          <span className="font-medium text-foreground">Chi tiết phiếu</span>
        </li>
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Quay lại
          </button>
          <span className="text-muted-foreground/60">|</span>
          <span className="truncate">
            <span className="mr-1">{template?.icon}</span>
            {template?.label}
            <span className="text-muted-foreground/60"> · </span>
            {summary.studentName || "(chưa nhập tên)"}
            <span className="text-muted-foreground/60"> · </span>
            {summary.classDate}
          </span>
        </div>
      </div>

      <CreateReportForm
        folderId={folderId}
        onError={onError}
        onClose={onClose}
        onRefresh={onRefresh}
        initialReportType={summary.reportType}
        initialClassDate={summary.classDate}
        initialTeacherName={summary.teacherName}
        initialStudentName={summary.studentName}
        onClassDateChange={onClassDateChange}
      />
    </div>
  );
}
