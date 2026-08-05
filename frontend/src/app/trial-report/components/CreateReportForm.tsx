"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trialReportService } from "@/services/trialReportService";
import {
  uploadPDFFile as driveUploadPDFFile,
  getGoogleUserInfo,
} from "@/services/googleDriveService";
import {
  REPORT_TEMPLATES,
  type ReportType,
  type Kiro4PlusReportData,
  type RoboticsReportData,
  type CodingReportData,
  type ArtReportData,
} from "@/types/trialReport";
import { Kiro4PlusForm } from "./Kiro4PlusForm";
import { RoboticsForm } from "./RoboticsForm";
import { CodingForm } from "./CodingForm";
import { ArtForm } from "./ArtForm";
import { generateRoboticsPDF, generateRoboticsFilename } from "@/lib/roboticsPdfFiller";
import { generateCodingPDF, generateCodingFilename } from "@/lib/codingPdfFiller";
import { generateArtPDF, generateArtFilename } from "@/lib/artPdfFiller";
import { generateKiro4PlusPDF, generateKiro4PlusFilename } from "@/lib/kiro4PlusPdfFiller";

interface CreateReportFormProps {
  folderId: string | null;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string) => void;
  onClose: () => void;
}

const TEMPLATE_OPTIONS: { type: ReportType; icon: string; label: string }[] = [
  { type: "Kiro4+", icon: "🤸", label: "Robotics 4+" },
  { type: "Robotics", icon: "🤖", label: "Robotics" },
  { type: "Coding", icon: "💻", label: "Coding" },
  { type: "Art", icon: "🎨", label: "Art" },
];

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_\.]/g, "_").slice(0, 200);
}

function formatDateParts(classDate: string): {
  year: string;
  month: string;
  day: string;
} {
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

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || "application/pdf" });
}

function formatDateForPdf(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateForPdfShortYear(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Push a generated PDF blob to Drive via the user's OAuth token, then
 * register the resulting file with the backend. Mirrors the sub-project
 * `UploadForm` pattern (browser-direct upload → backend metadata upsert).
 */
async function uploadAndRegister(
  pdfBlob: Blob,
  fileName: string,
  meta: {
    reportType: ReportType;
    classDate: string;
    teacherName: string;
    studentName: string;
    folderId: string | null;
  },
) {
  const { year, month, day } = formatDateParts(meta.classDate);
  const file = blobToFile(pdfBlob, fileName);

  const uploaded = await driveUploadPDFFile({
    year,
    month,
    day,
    teacher: meta.teacherName,
    studentName: meta.studentName,
    file,
  });

  const userInfo = await getGoogleUserInfo().catch(() => null);

  return trialReportService.registerReport({
    driveFileId: uploaded.id,
    fileName: uploaded.name,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    webViewLink: uploaded.webViewLink,
    webContentLink: uploaded.webContentLink,
    parentFolderId: uploaded.parents?.[0] || meta.folderId || null,
    reportType: meta.reportType,
    classDate: meta.classDate,
    teacherName: meta.teacherName,
    studentName: meta.studentName,
    uploadedByEmail: userInfo?.email || null,
  });
}

export function CreateReportForm({
  folderId,
  onError,
  onSuccess,
  onClose,
}: CreateReportFormProps) {
  const [reportType, setReportType] = useState<ReportType>("Kiro4+");
  const [classDate, setClassDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateChange = (date: string) => {
    setClassDate(date);
  };

  const handleSubmitKiro4Plus = async (data: Kiro4PlusReportData) => {
    onError(null);
    setIsSubmitting(true);

    try {
      const pdfBlob = await generateKiro4PlusPDF(data);
      const fileName = safeFilename(generateKiro4PlusFilename(data));

      const res = await uploadAndRegister(pdfBlob, fileName, {
        reportType: "Kiro4+",
        classDate,
        teacherName: data.teacher,
        studentName: data.studentName,
        folderId,
      });

      if (res.success) {
        onSuccess(`Đã tạo phiếu: ${fileName}`);
        onClose();
      } else {
        throw new Error(res.error || "Không thể tạo phiếu.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi khi tạo phiếu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRobotics = async (data: RoboticsReportData) => {
    setIsSubmitting(true);
    onError(null);

    try {
      const pdfBlob = await generateRoboticsPDF(data);
      const fileName = safeFilename(generateRoboticsFilename(data));

      const res = await uploadAndRegister(pdfBlob, fileName, {
        reportType: "Robotics",
        classDate,
        teacherName: data.teacher,
        studentName: data.studentName,
        folderId,
      });

      if (res.success) {
        onSuccess(`Đã tạo phiếu: ${fileName}`);
        onClose();
      } else {
        throw new Error(res.error || "Không thể tạo phiếu.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi khi tạo phiếu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCoding = async (data: CodingReportData) => {
    setIsSubmitting(true);
    onError(null);

    try {
      const pdfBlob = await generateCodingPDF(data);
      const fileName = safeFilename(generateCodingFilename(data));

      const res = await uploadAndRegister(pdfBlob, fileName, {
        reportType: "Coding",
        classDate,
        teacherName: data.teacher,
        studentName: data.studentName,
        folderId,
      });

      if (res.success) {
        onSuccess(`Đã tạo phiếu: ${fileName}`);
        onClose();
      } else {
        throw new Error(res.error || "Không thể tạo phiếu.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi khi tạo phiếu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitArt = async (data: ArtReportData) => {
    setIsSubmitting(true);
    onError(null);

    try {
      const pdfBlob = await generateArtPDF(data);
      const fileName = safeFilename(generateArtFilename(data));

      const res = await uploadAndRegister(pdfBlob, fileName, {
        reportType: "Art",
        classDate,
        teacherName: data.teacher,
        studentName: data.studentName,
        folderId,
      });

      if (res.success) {
        onSuccess(`Đã tạo phiếu: ${fileName}`);
        onClose();
      } else {
        throw new Error(res.error || "Không thể tạo phiếu.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi khi tạo phiếu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">Chọn template phiếu:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setReportType(opt.type)}
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

      <Separator />

      <div className="border-t pt-4">
        {reportType === "Kiro4+" && (
          <Kiro4PlusForm
            onSubmit={handleSubmitKiro4Plus}
            loading={isSubmitting}
            initialData={{ date: formatDateForPdfShortYear(new Date(classDate)) }}
            onDateChange={handleDateChange}
          />
        )}

        {reportType === "Robotics" && (
          <RoboticsForm
            onSubmit={handleSubmitRobotics}
            loading={isSubmitting}
            initialData={{ date: formatDateForPdfShortYear(new Date(classDate)) }}
          />
        )}

        {reportType === "Coding" && (
          <CodingForm
            onSubmit={handleSubmitCoding}
            loading={isSubmitting}
            initialData={{ date: formatDateForPdfShortYear(new Date(classDate)) }}
          />
        )}

        {reportType === "Art" && (
          <ArtForm
            onSubmit={handleSubmitArt}
            loading={isSubmitting}
            initialData={{ date: formatDateForPdfShortYear(new Date(classDate)) }}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </Button>
      </div>
    </div>
  );
}
