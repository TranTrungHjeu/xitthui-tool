"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CriteriaScoreInput } from "./CriteriaScoreInput";
import { CapabilityScoreDisplay } from "./CapabilityScoreDisplay";
import { codingCriteriaGroups } from "../constants";
import { formatDateForPdfShortYear } from "./CreateReportForm";
import type { CodingReportData, CodingCriteriaGroup } from "@/types/trialReport";

const CODING_SUBJECTS = ["Scratch Creator", "Game Creator", "Python", "Web Creator"];

const ALL_CRITERIA_KEYS = Object.values(codingCriteriaGroups).flatMap(
  (g) => g.criteria.map((c) => c.key)
);
const MAX_SCORE = ALL_CRITERIA_KEYS.length * 0.25;

interface CodingFormProps {
  onSubmit: (data: CodingReportData) => void;
  loading?: boolean;
  initialData?: Partial<CodingReportData>;
}

export function CodingForm({ onSubmit, loading, initialData }: CodingFormProps) {
  const [studentName, setStudentName] = useState(initialData?.studentName || "");
  const [ageGrade, setAgeGrade] = useState(initialData?.age_grade || "");
  const [subject, setSubject] = useState(initialData?.subject || "Scratch Creator");
  const [teacher, setTeacher] = useState(initialData?.teacher || "");
  const [teacherComment, setTeacherComment] = useState(initialData?.teacherComment || "");
  const [recommendation, setRecommendation] = useState(initialData?.recommendation || "");

  const [criteria, setCriteria] = useState<CodingCriteriaGroup>(() => {
    if (initialData?.computationalThinking || initialData?.creativity || initialData?.communication || initialData?.problemSolving || initialData?.computerSkills) {
      const result: CodingCriteriaGroup = {};
      if (initialData.computationalThinking) Object.assign(result, initialData.computationalThinking);
      if (initialData.creativity) Object.assign(result, initialData.creativity);
      if (initialData.communication) Object.assign(result, initialData.communication);
      if (initialData.problemSolving) Object.assign(result, initialData.problemSolving);
      if (initialData.computerSkills) Object.assign(result, initialData.computerSkills);
      return result;
    }
    return {};
  });

  const totalScore = ALL_CRITERIA_KEYS.reduce((sum, key) => sum + (criteria[key] || 0), 0);

  const handleCriteriaChange = (key: string, value: number) => {
    setCriteria(prev => ({ ...prev, [key]: value }));
  };

  const handleAutoFill = (targetScore: number) => {
    const scorePerCriterion = targetScore / ALL_CRITERIA_KEYS.length;
    const newCriteria: CodingCriteriaGroup = {};
    ALL_CRITERIA_KEYS.forEach(key => {
      newCriteria[key] = Math.round(scorePerCriterion * 100) / 100;
    });
    setCriteria(newCriteria);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    const data: CodingReportData = {
      studentName: studentName.trim(),
      age_grade: ageGrade.trim(),
      subject,
      teacher: teacher.trim(),
      date: initialData?.date || formatDateForPdfShortYear(new Date()),
      computationalThinking: {
        understand_digital_products: criteria.understand_digital_products || 0,
        explain_knowledge: criteria.explain_knowledge || 0,
        apply_knowledge: criteria.apply_knowledge || 0,
        develop_features: criteria.develop_features || 0,
      },
      creativity: {
        follow_instructions: criteria.follow_instructions || 0,
        suggest_ideas: criteria.suggest_ideas || 0,
        create_features: criteria.create_features || 0,
        build_new_projects: criteria.build_new_projects || 0,
      },
      communication: {
        interact_with_teacher: criteria.interact_with_teacher || 0,
        share_problems: criteria.share_problems || 0,
        propose_ideas: criteria.propose_ideas || 0,
        present_product: criteria.present_product || 0,
      },
      problemSolving: {
        aware_of_problems: criteria.aware_of_problems || 0,
        find_problems: criteria.find_problems || 0,
        suggest_solutions: criteria.suggest_solutions || 0,
        solve_problems: criteria.solve_problems || 0,
      },
      computerSkills: {
        use_mouse_keyboard: criteria.use_mouse_keyboard || 0,
        know_programming_app: criteria.know_programming_app || 0,
        use_programming_app: criteria.use_programming_app || 0,
        use_internet: criteria.use_internet || 0,
      },
      teacherComment: teacherComment.trim(),
      recommendation: recommendation.trim(),
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          ✅ Mỗi tiêu chí: <strong>Chưa đạt (0 điểm)</strong> hoặc <strong>Đạt (0.25 điểm)</strong>
          <br />
          📊 Tổng điểm tối đa: {MAX_SCORE.toFixed(2)} điểm ({ALL_CRITERIA_KEYS.length} tiêu chí × 0.25)
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">A</span>
          THÔNG TIN HỌC VIÊN
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="codingStudentName">Họ và tên học viên *</Label>
            <Input
              id="codingStudentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nhập họ và tên"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codingAgeGrade">Lớp</Label>
            <Input
              id="codingAgeGrade"
              value={ageGrade}
              onChange={(e) => setAgeGrade(e.target.value)}
              placeholder="VD: Lớp 3"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codingSubject">Bộ môn trải nghiệm</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="codingSubject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODING_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codingTeacher">Giáo viên hướng dẫn *</Label>
            <Input
              id="codingTeacher"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="Nhập tên giáo viên"
              required
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">B</span>
          ĐÁNH GIÁ TƯ DUY, KỸ NĂNG
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h5 className="font-medium text-sm mb-3">I. TƯ DUY MÁY TÍNH, TƯ DUY THUẬT TOÁN</h5>
            <div className="space-y-3">
              {codingCriteriaGroups.computationalThinking.criteria.map(c => (
                <CriteriaScoreInput
                  key={c.key}
                  label={c.label}
                  value={criteria[c.key] || 0}
                  onChange={(v) => handleCriteriaChange(c.key, v)}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h5 className="font-medium text-sm mb-3">II. TƯ DUY SÁNG TẠO</h5>
            <div className="space-y-3">
              {codingCriteriaGroups.creativity.criteria.map(c => (
                <CriteriaScoreInput
                  key={c.key}
                  label={c.label}
                  value={criteria[c.key] || 0}
                  onChange={(v) => handleCriteriaChange(c.key, v)}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h5 className="font-medium text-sm mb-3">III. KỸ NĂNG GIAO TIẾP, HỢP TÁC</h5>
            <div className="space-y-3">
              {codingCriteriaGroups.communication.criteria.map(c => (
                <CriteriaScoreInput
                  key={c.key}
                  label={c.label}
                  value={criteria[c.key] || 0}
                  onChange={(v) => handleCriteriaChange(c.key, v)}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h5 className="font-medium text-sm mb-3">IV. KỸ NĂNG GIẢI QUYẾT VẤN ĐỀ</h5>
            <div className="space-y-3">
              {codingCriteriaGroups.problemSolving.criteria.map(c => (
                <CriteriaScoreInput
                  key={c.key}
                  label={c.label}
                  value={criteria[c.key] || 0}
                  onChange={(v) => handleCriteriaChange(c.key, v)}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h5 className="font-medium text-sm mb-3">V. KỸ NĂNG SỬ DỤNG MÁY TÍNH</h5>
            <div className="space-y-3">
              {codingCriteriaGroups.computerSkills.criteria.map(c => (
                <CriteriaScoreInput
                  key={c.key}
                  label={c.label}
                  value={criteria[c.key] || 0}
                  onChange={(v) => handleCriteriaChange(c.key, v)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <CapabilityScoreDisplay
        totalScore={totalScore}
        maxScore={MAX_SCORE}
        onAutoFill={handleAutoFill}
        label="Điểm tổng kết"
      />

      <Separator />

      <div className="space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">C</span>
          NHẬN XÉT VÀ ĐỊNH HƯỚNG
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="codingComment">Nhận xét của giáo viên *</Label>
            <Textarea
              id="codingComment"
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="Nhận xét chi tiết về học viên..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codingRecommend">Định hướng dành cho học viên</Label>
            <Textarea
              id="codingRecommend"
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
