"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { trialReportService } from "@/services/trialReportService";
import {
  uploadPDFFile as r2UploadPDFFile,
} from "@/services/r2Service";
import {
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
  onClose: () => void;
  onRefresh: () => void;
  /**
   * Controlled values coming from the parent wizard's Step 1.
   * `onClassDateChange` is optional because the Robotics / Coding /
   * Art sub-forms don't surface their own DatePicker back to the
   * parent — only `Kiro4PlusForm` does. The parent still receives
   * the latest date via these props.
   */
  initialReportType: ReportType;
  initialClassDate: string;
  initialTeacherName: string;
  initialStudentName: string;
  onClassDateChange?: (date: string) => void;
}

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
    return { year: String(y), month: mm, day: `${dd}-${mm}-${y}` };
  }
  const [, y, mm, dd] = m;
  return { year: y, month: mm, day: `${dd}-${mm}-${y}` };
}

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || "application/pdf" });
}

export function formatDateForPdfShortYear(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Push a generated PDF blob to R2 via the backend's multipart endpoint,
 * then register the resulting file with the backend. Mirrors the
 * sub-project `UploadForm` pattern (browser-direct upload → backend
 * metadata upsert).
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

  const uploaded = await r2UploadPDFFile({
    year,
    month,
    day,
    teacher: meta.teacherName,
    studentName: meta.studentName,
    file,
  });

  return trialReportService.registerReport({
    r2Key: uploaded.id,
    fileName: uploaded.name,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    webViewLink: uploaded.webViewLink,
    reportType: meta.reportType,
    classDate: meta.classDate,
    teacherName: meta.teacherName,
    studentName: meta.studentName,
    uploadedByEmail: null,
  });
}

export function CreateReportForm({
  folderId,
  onError,
  onClose,
  onRefresh,
  initialReportType,
  initialClassDate,
  initialTeacherName,
  initialStudentName,
  onClassDateChange,
}: CreateReportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The parent wizard owns these values. We just consume them so
  // the sub-forms can pre-fill and the PDF/R2 metadata stays in
  // sync with what the user entered in Step 1.
  const reportType = initialReportType;
  const classDate = initialClassDate;
  const teacherName = initialTeacherName;
  const studentName = initialStudentName;

  const handleDateChange = (date: string) => {
    onClassDateChange?.(date);
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
        toast.success("Đã tạo phiếu thành công");
        onClose();
        onRefresh();
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
        toast.success("Đã tạo phiếu thành công");
        onClose();
        onRefresh();
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
        toast.success("Đã tạo phiếu thành công");
        onClose();
        onRefresh();
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
        toast.success("Đã tạo phiếu thành công");
        onClose();
        onRefresh();
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
      <Separator />

      <div className="border-t pt-4">
        {reportType === "Kiro4+" && (
          <Kiro4PlusForm
            onSubmit={handleSubmitKiro4Plus}
            loading={isSubmitting}
            initialData={{
              studentName,
              teacher: teacherName,
              date: formatDateForPdfShortYear(new Date(classDate)),
            }}
            initialClassDate={classDate}
            onDateChange={handleDateChange}
          />
        )}

        {reportType === "Robotics" && (
          <RoboticsForm
            onSubmit={handleSubmitRobotics}
            loading={isSubmitting}
            initialData={{
              studentName,
              teacher: teacherName,
              date: formatDateForPdfShortYear(new Date(classDate)),
            }}
          />
        )}

        {reportType === "Coding" && (
          <CodingForm
            onSubmit={handleSubmitCoding}
            loading={isSubmitting}
            initialData={{
              studentName,
              teacher: teacherName,
              date: formatDateForPdfShortYear(new Date(classDate)),
            }}
          />
        )}

        {reportType === "Art" && (
          <ArtForm
            onSubmit={handleSubmitArt}
            loading={isSubmitting}
            initialData={{
              studentName,
              teacher: teacherName,
              date: formatDateForPdfShortYear(new Date(classDate)),
            }}
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
