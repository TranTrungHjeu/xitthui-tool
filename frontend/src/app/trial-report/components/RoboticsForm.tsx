"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CapabilityRadio } from "./CapabilityRadio";
import { roboticsCapabilities } from "../constants";
import { getTodayVietnam, getTodayVietnamDate } from "@/lib/utils";
import { formatDateForPdfShortYear } from "./CreateReportForm";
import type { RoboticsReportData } from "@/types/trialReport";
import type { RoboticsScore } from "@/types/trialReport";

const ROBOTIC_SUBJECTS = ["Robotic PreB", "Robotic ArmB", "Robotic SemiB"];

interface RoboticsFormProps {
  onSubmit: (data: RoboticsReportData) => void;
  loading?: boolean;
  initialData?: Partial<RoboticsReportData>;
}

export function RoboticsForm({ onSubmit, loading, initialData }: RoboticsFormProps) {
  const [studentName, setStudentName] = useState(initialData?.studentName || "");
  const [ageGrade, setAgeGrade] = useState(initialData?.age_grade || "");
  const [subject, setSubject] = useState(initialData?.subject || "Robotic PreB");
  const [teacher, setTeacher] = useState(initialData?.teacher || "");
  const [campus, setCampus] = useState(initialData?.campus || "Thủ Dầu Một");
  const [recognition, setRecognition] = useState<RoboticsScore | undefined>(initialData?.recognition?.score);
  const [assembly, setAssembly] = useState<RoboticsScore | undefined>(initialData?.assembly?.score);
  const [programming, setProgramming] = useState<RoboticsScore | undefined>(initialData?.programming?.score);
  const [communication, setCommunication] = useState<RoboticsScore | undefined>(initialData?.communication?.score);
  const [teacherComment, setTeacherComment] = useState(initialData?.teacherComment || "");
  const [recommendation, setRecommendation] = useState(initialData?.recommendation || "");

  const calculateAverage = () => {
    const scores = [recognition, assembly, programming, communication].filter(s => s !== undefined) as number[];
    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    const data: RoboticsReportData = {
      studentName: studentName.trim(),
      age_grade: ageGrade.trim(),
      subject,
      teacher: teacher.trim(),
      campus: campus.trim(),
      date: initialData?.date || formatDateForPdfShortYear(getTodayVietnamDate()),
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
          <div className="space-y-1.5">
            <Label htmlFor="robStudentName">Họ và tên học viên *</Label>
            <Input
              id="robStudentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nhập họ và tên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="robAgeGrade">Lớp</Label>
            <Input
              id="robAgeGrade"
              value={ageGrade}
              onChange={(e) => setAgeGrade(e.target.value)}
              placeholder="VD: Lớp 3"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="robSubject">Bộ môn trải nghiệm</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="robSubject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROBOTIC_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="robTeacher">Giáo viên hướng dẫn *</Label>
            <Input
              id="robTeacher"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="Nhập tên giáo viên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="robCampus">Cơ sở</Label>
            <Input
              id="robCampus"
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
          title={roboticsCapabilities.recognition.name}
          levels={roboticsCapabilities.recognition.levels}
          value={recognition}
          onChange={(v) => setRecognition(v as RoboticsScore)}
        />

        <CapabilityRadio
          title={roboticsCapabilities.assembly.name}
          levels={roboticsCapabilities.assembly.levels}
          value={assembly}
          onChange={(v) => setAssembly(v as RoboticsScore)}
        />

        <CapabilityRadio
          title={roboticsCapabilities.programming.name}
          levels={roboticsCapabilities.programming.levels}
          value={programming}
          onChange={(v) => setProgramming(v as RoboticsScore)}
        />

        <CapabilityRadio
          title={roboticsCapabilities.communication.name}
          levels={roboticsCapabilities.communication.levels}
          value={communication}
          onChange={(v) => setCommunication(v as RoboticsScore)}
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
            <Label htmlFor="robComment">Nhận xét từ giáo viên *</Label>
            <Textarea
              id="robComment"
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="Nhận xét chi tiết về học viên..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="robRecommend">Định hướng dành cho học viên</Label>
            <Textarea
              id="robRecommend"
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
