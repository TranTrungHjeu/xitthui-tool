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
import type { ArtReportData } from "@/types/trialReport";
import type { ArtScore } from "@/types/trialReport";
import { technologyLevels, creativityLevels, designPrinciplesLevels, artCommunicationLevels, selfLearningLevels } from "../constants";
import { getTodayVietnamDate } from "@/lib/utils";
import { formatDateForPdfShortYear } from "./CreateReportForm";

const ART_SUBJECTS = ["Art 4+", "Kids Art", "Visual Art", "Visual Creation", "Art Illustration", "Graphic Design"];

interface ArtFormProps {
  onSubmit: (data: ArtReportData) => void;
  loading?: boolean;
  initialData?: Partial<ArtReportData>;
}

export function ArtForm({ onSubmit, loading, initialData }: ArtFormProps) {
  const [studentName, setStudentName] = useState(initialData?.studentName || "");
  const [ageGrade, setAgeGrade] = useState(initialData?.age_grade || "");
  const [subject, setSubject] = useState(initialData?.subject || "Art 4+");
  const [teacher, setTeacher] = useState(initialData?.teacher || "");
  const [campus, setCampus] = useState(initialData?.campus || "Thủ Dầu Một");
  const [technology, setTechnology] = useState<ArtScore | undefined>(initialData?.technology?.score);
  const [creativity, setCreativity] = useState<ArtScore | undefined>(initialData?.creativity?.score);
  const [designPrinciples, setDesignPrinciples] = useState<ArtScore | undefined>(initialData?.designPrinciples?.score);
  const [communication, setCommunication] = useState<ArtScore | undefined>(initialData?.communication?.score);
  const [selfLearning, setSelfLearning] = useState<ArtScore | undefined>(initialData?.selfLearning?.score);
  const [teacherComment, setTeacherComment] = useState(initialData?.teacherComment || "");
  const [recommendation, setRecommendation] = useState(initialData?.recommendation || "");

  const calculateAverage = () => {
    const scores = [technology, creativity, designPrinciples, communication, selfLearning].filter(s => s !== undefined) as number[];
    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    const data: ArtReportData = {
      studentName: studentName.trim(),
      age_grade: ageGrade.trim(),
      subject,
      teacher: teacher.trim(),
      campus: campus.trim(),
      date: initialData?.date || formatDateForPdfShortYear(getTodayVietnamDate()),
      technology: technology ? { score: technology } : undefined,
      creativity: creativity ? { score: creativity } : undefined,
      designPrinciples: designPrinciples ? { score: designPrinciples } : undefined,
      communication: communication ? { score: communication } : undefined,
      selfLearning: selfLearning ? { score: selfLearning } : undefined,
      teacherComment: teacherComment.trim(),
      recommendation: recommendation.trim(),
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          🎨 Mức độ đánh giá theo thang điểm 1-4 tương ứng với mức độ thể hiện của học viên trong buổi trải nghiệm từ thấp đến cao
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">A</span>
          THÔNG TIN HỌC VIÊN
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="artStudentName">Họ và tên học viên *</Label>
            <Input
              id="artStudentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nhập họ và tên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="artAgeGrade">Lớp</Label>
            <Input
              id="artAgeGrade"
              value={ageGrade}
              onChange={(e) => setAgeGrade(e.target.value)}
              placeholder="VD: Lớp 3"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="artSubject">Bộ môn trải nghiệm</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="artSubject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ART_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="artTeacher">Giáo viên hướng dẫn *</Label>
            <Input
              id="artTeacher"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="Nhập tên giáo viên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="artCampus">Cơ sở</Label>
            <Input
              id="artCampus"
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
          title="1. Sử dụng công nghệ & công cụ"
          subtitle="Quan sát khả năng điều khiển Ipad và phần mềm vẽ Vector (Giao diện, công cụ, layer, undo/redo)."
          levels={technologyLevels}
          value={technology}
          onChange={(v) => setTechnology(v as ArtScore)}
        />

        <CapabilityRadio
          title="2. Sáng tạo & thiết kế"
          subtitle="Khả năng phát triển ý tưởng và hiện thực hóa sáng tạo qua bài vẽ."
          levels={creativityLevels}
          value={creativity}
          onChange={(v) => setCreativity(v as ArtScore)}
        />

        <CapabilityRadio
          title="3. Kiến thức về nguyên lý thiết kế & nghệ thuật"
          subtitle="Hiểu biết sơ khởi về các yếu tố nghệ thuật: hình khối, tỷ lệ, màu sắc, ánh sáng và bóng."
          levels={designPrinciplesLevels}
          value={designPrinciples}
          onChange={(v) => setDesignPrinciples(v as ArtScore)}
        />

        <CapabilityRadio
          title="4. Giao tiếp & ý tưởng"
          subtitle="Khả năng trình bày quá trình sáng tạo và giải thích ý tưởng qua tác phẩm."
          levels={artCommunicationLevels}
          value={communication}
          onChange={(v) => setCommunication(v as ArtScore)}
        />

        <CapabilityRadio
          title="5. Tinh thần tự học & phản hồi"
          subtitle="Quan sát mức độ chủ động tìm tòi, tự đánh giá và sẵn sàng thử nghiệm các phương pháp mới."
          levels={selfLearningLevels}
          value={selfLearning}
          onChange={(v) => setSelfLearning(v as ArtScore)}
        />
      </div>

      {calculateAverage() > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            💡 Điểm trung bình: <strong>{calculateAverage().toFixed(2)}</strong> / 4.00
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
            💡 Điểm trung bình sẽ được tính tự động từ 5 năng lực đã đánh giá
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="artComment">Nhận xét của giáo viên *</Label>
            <Textarea
              id="artComment"
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="Nhận xét chi tiết về học viên..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="artRecommend">Định hướng dành cho học viên</Label>
            <Textarea
              id="artRecommend"
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
