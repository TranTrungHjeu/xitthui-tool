"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CapabilityRadio } from "./CapabilityRadio";
import { kiro4PlusCapabilities } from "../constants";
import { formatDateForPdfShortYear } from "./CreateReportForm";
import { getTodayVietnam } from "@/lib/utils";
import type { Kiro4PlusReportData, Kiro4PlusScore } from "@/types/trialReport";

const KIRO_SUBJECTS = ["Kiro 4+", "Kiro Basic"];

interface Kiro4PlusFormProps {
  onSubmit: (data: Kiro4PlusReportData) => void;
  loading?: boolean;
  initialData?: Partial<Kiro4PlusReportData>;
  onDateChange?: (date: string) => void;
}

export function Kiro4PlusForm({ onSubmit, loading, initialData, onDateChange }: Kiro4PlusFormProps) {
  const [studentName, setStudentName] = useState(initialData?.studentName || "");
  const [ageGrade, setAgeGrade] = useState(initialData?.age_grade || "");
  const [subject, setSubject] = useState(initialData?.subject || "Kiro 4+");
  const [teacher, setTeacher] = useState(initialData?.teacher || "");
  const [campus, setCampus] = useState(initialData?.campus || "Thủ Dầu Một");
  const [recognition, setRecognition] = useState<Kiro4PlusScore | undefined>(initialData?.recognition?.score);
  const [assembly, setAssembly] = useState<Kiro4PlusScore | undefined>(initialData?.assembly?.score);
  const [programming, setProgramming] = useState<Kiro4PlusScore | undefined>(initialData?.programming?.score);
  const [communication, setCommunication] = useState<Kiro4PlusScore | undefined>(initialData?.communication?.score);
  const [teacherComment, setTeacherComment] = useState(initialData?.teacherComment || "");
  const [recommendation, setRecommendation] = useState(initialData?.recommendation || "");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayVietnam());

  const calculateAverage = () => {
    const scores = [recognition, assembly, programming, communication].filter(s => s !== undefined) as number[];
    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    const data: Kiro4PlusReportData = {
      studentName: studentName.trim(),
      age_grade: ageGrade.trim(),
      subject,
      teacher: teacher.trim(),
      campus: campus.trim(),
      date: formatDateForPdfShortYear(selectedDate ? new Date(selectedDate) : new Date()),
      recognition: recognition ? { score: recognition } : undefined,
      assembly: assembly ? { score: assembly } : undefined,
      programming: programming ? { score: programming } : undefined,
      communication: communication ? { score: communication } : undefined,
      teacherComment: teacherComment.trim(),
      recommendation: recommendation.trim(),
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          📊 Mức độ đánh giá theo thang điểm 1-5 tương ứng với mức độ thể hiện của học viên trong buổi trải nghiệm từ thấp đến cao
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">A</span>
          THÔNG TIN HỌC VIÊN
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DatePicker
            label="Ngày trải nghiệm *"
            id="kiroClassDate"
            value={selectedDate}
            onChange={(iso) => {
              setSelectedDate(iso);
              onDateChange?.(iso);
            }}
            required
          />

          <div className="space-y-1.5">
            <Label htmlFor="kiroStudentName">Họ và tên học viên *</Label>
            <Input
              id="kiroStudentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nhập họ và tên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kiroAgeGrade">Lớp</Label>
            <Input
              id="kiroAgeGrade"
              value={ageGrade}
              onChange={(e) => setAgeGrade(e.target.value)}
              placeholder="VD: 4-5 tuổi"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kiroSubject">Bộ môn trải nghiệm</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="kiroSubject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIRO_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kiroTeacher">Giáo viên hướng dẫn *</Label>
            <Input
              id="kiroTeacher"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="Nhập tên giáo viên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kiroCampus">Cơ sở</Label>
            <Input
              id="kiroCampus"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              placeholder="Thủ Dầu Một"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">B</span>
          ĐÁNH GIÁ NĂNG LỰC
        </h3>

        <CapabilityRadio
          title={kiro4PlusCapabilities.recognition.name}
          levels={kiro4PlusCapabilities.recognition.levels}
          value={recognition}
          onChange={(v) => setRecognition(v as Kiro4PlusScore)}
        />

        <CapabilityRadio
          title={kiro4PlusCapabilities.assembly.name}
          levels={kiro4PlusCapabilities.assembly.levels}
          value={assembly}
          onChange={(v) => setAssembly(v as Kiro4PlusScore)}
        />

        <CapabilityRadio
          title={kiro4PlusCapabilities.programming.name}
          levels={kiro4PlusCapabilities.programming.levels}
          value={programming}
          onChange={(v) => setProgramming(v as Kiro4PlusScore)}
        />

        <CapabilityRadio
          title={kiro4PlusCapabilities.communication.name}
          levels={kiro4PlusCapabilities.communication.levels}
          value={communication}
          onChange={(v) => setCommunication(v as Kiro4PlusScore)}
        />
      </div>

      {calculateAverage() > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            💡 Điểm trung bình: <strong>{calculateAverage().toFixed(2)}</strong> / 5.00
          </p>
        </div>
      )}

      <Separator />

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">C</span>
          NHẬN XÉT VÀ ĐỊNH HƯỚNG
        </h3>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 Điểm trung bình sẽ được tính tự động từ 4 năng lực đã đánh giá
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kiroComment">Nhận xét từ giáo viên *</Label>
            <Textarea
              id="kiroComment"
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="Nhận xét chi tiết về học viên..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kiroRecommend">Định hướng dành cho học viên</Label>
            <Textarea
              id="kiroRecommend"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Đề xuất lộ trình học tập phù hợp..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2 border-t">
        <Button type="submit" disabled={loading || !studentName.trim() || !teacher.trim() || !teacherComment.trim()}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Đang tạo...
            </>
          ) : (
            "Tạo PDF và Upload"
          )}
        </Button>
      </div>
    </form>
  );
}
