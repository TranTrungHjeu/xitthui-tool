"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Users,
  GraduationCap,
  ClipboardCheck,
  Award,
  Brain,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  FileDown,
  Play,
  RotateCcw,
} from "lucide-react";
import { classService } from "@/services/classService";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface StatisticsTabProps {
  classData: any;
  submissionsData: any;
  rosterToApiStudentMap: Record<string, string>;
  submissionMap: Record<string, any>;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function StatisticsTab({
  classData,
  submissionsData,
  rosterToApiStudentMap,
  submissionMap,
}: StatisticsTabProps) {
  const { token } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [evaluationQueue, setEvaluationQueue] = useState<string[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<
    Record<string, any>
  >({});
  const [isExporting, setIsExporting] = useState(false);

  // Thêm state cho phần hiển thị kết quả bulk
  const [showBulkSummary, setShowBulkSummary] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    { id: string; name: string; success: boolean }[]
  >([]);

  const students = useMemo(() => {
    return (classData?.students || []).map((s: any) => s.student);
  }, [classData]);

  // Load saved evaluations from local storage when component mounts
  React.useEffect(() => {
    if (!classData?.id) return;
    const loadedResults: Record<string, any> = {};
    const studentsArr = (classData?.students || []).map((s: any) => s.student);
    studentsArr.forEach((s: any) => {
      const saved = localStorage.getItem(`ai_eval_${classData.id}_${s.id}`);
      if (saved) {
        try {
          loadedResults[s.id] = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse saved eval", e);
        }
      }
    });
    setEvaluationResults(loadedResults);
  }, [classData]);

  // 1. Tần suất đi học (Attendance Statistics)
  const attendanceStats = useMemo(() => {
    const defaultData = {
      chart: [
        { name: "Đúng giờ", value: 0, color: "#10b981" },
        { name: "Đi muộn", value: 0, color: "#f59e0b" },
        { name: "Vắng mặt", value: 0, color: "#ef4444" },
      ],
      rate: 0,
    };

    if (!classData?.slots) return defaultData;

    const stats = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
    };

    classData.slots.forEach((slot: any) => {
      slot.studentAttendance?.forEach((sa: any) => {
        const studentId = sa.student?.id || sa.studentId;
        if (selectedStudentId !== "all" && studentId !== selectedStudentId)
          return;

        if (["PRESENT", "ATTENDED"].includes(sa.status)) stats.PRESENT++;
        else if (["LATE", "LATE_ARRIVED"].includes(sa.status)) stats.LATE++;
        else if (["ABSENT", "ABSENT_WITH_NOTICE"].includes(sa.status))
          stats.ABSENT++;
      });
    });

    const total = stats.PRESENT + stats.LATE + stats.ABSENT;

    return {
      chart: [
        { name: "Đúng giờ", value: stats.PRESENT, color: "#10b981" },
        { name: "Đi muộn", value: stats.LATE, color: "#f59e0b" },
        { name: "Vắng mặt", value: stats.ABSENT, color: "#ef4444" },
      ],
      rate: total > 0 ? ((stats.PRESENT + stats.LATE) / total) * 100 : 0,
    };
  }, [classData, selectedStudentId]);

  // 2. Thống kê Bài tập về nhà & Bài kiểm tra (Tổng hợp học viên)
  const homeworkStats = useMemo(() => {
    const rosterStudents = classData?.students || [];
    const lessons = submissionsData?.lessons || [];

    const statsByStudent = rosterStudents.map((rosterItem: any) => {
      const student = rosterItem.student;
      const apiUid = rosterToApiStudentMap[student.id];

      let hwTotal = 0;
      let hwSubmitted = 0;
      let hwScoreSum = 0;

      let examTotal = 0;
      let examSubmitted = 0;
      let examScoreSum = 0;

      lessons.forEach((lesson: any) => {
        const submission = submissionMap[`${apiUid}-${lesson.id}`];
        const isExam = lesson.type === "CHECKPOINT";

        const isSubmitted =
          submission &&
          ["SUBMITTED", "RE_SUBMITTED", "GRADED", "MARKED"].includes(
            submission.status,
          );

        if (isExam) {
          examTotal++;
          if (isSubmitted) {
            examSubmitted++;
            examScoreSum += submission.score || 0;
          }
        } else {
          hwTotal++;
          if (isSubmitted) {
            hwSubmitted++;
            hwScoreSum += submission.score || 0;
          }
        }
      });

      return {
        id: student.id,
        name: student.fullName,
        hwRate: hwTotal > 0 ? (hwSubmitted / hwTotal) * 100 : 0,
        hwSubmitted,
        hwTotal,
        hwAvgScore: hwSubmitted > 0 ? hwScoreSum / hwSubmitted : 0,
        examRate: examTotal > 0 ? (examSubmitted / examTotal) * 100 : 0,
        examSubmitted,
        examTotal,
        examAvgScore: examSubmitted > 0 ? examScoreSum / examSubmitted : 0,
      };
    });

    return statsByStudent.sort((a: any, b: any) => b.hwAvgScore - a.hwAvgScore);
  }, [classData, submissionsData, rosterToApiStudentMap, submissionMap]);

  // 3. Chi tiết từng bài của học viên được chọn
  const studentDetailStats = useMemo(() => {
    if (selectedStudentId === "all") return [];

    // Get data for the selected student from homeworkStats
    const studentStat = homeworkStats.find(
      (s: any) => s.id === selectedStudentId,
    );
    const studentName = studentStat?.name || "Học viên";

    if (!submissionsData?.lessons || submissionsData.lessons.length === 0) {
      // Fallback: show student summary as single bar
      return studentStat
        ? [
            {
              name: studentName,
              fullName: studentName,
              score: studentStat.hwAvgScore || 0,
              isGraded: true,
              hwRate: studentStat.hwRate || 0,
              examRate: studentStat.examRate || 0,
              hwAvgScore: studentStat.hwAvgScore || 0,
              examAvgScore: studentStat.examAvgScore || 0,
              type: "Tổng hợp",
            },
          ]
        : [];
    }

    const apiUid =
      rosterToApiStudentMap[selectedStudentId] || selectedStudentId;
    return submissionsData.lessons.map((lesson: any) => {
      const submission = submissionMap[`${apiUid}-${lesson.id}`];
      const isExam = lesson.type === "CHECKPOINT";
      const isSubmitted =
        submission &&
        ["SUBMITTED", "RE_SUBMITTED", "GRADED", "MARKED"].includes(
          submission.status,
        );

      const score = submission?.score || 0;

      return {
        name: `B${lesson.displayOrder}`,
        fullName: lesson.name,
        score,
        isGraded:
          submission?.status === "MARKED" || submission?.status === "GRADED",
        hwRate: isSubmitted ? 100 : 0,
        examRate: isExam && isSubmitted ? 100 : 0,
        hwAvgScore: !isExam ? score : 0,
        examAvgScore: isExam ? score : 0,
        type: isExam ? "Kiểm tra" : "Bài tập",
      };
    });
  }, [
    selectedStudentId,
    homeworkStats,
    submissionsData,
    submissionMap,
    rosterToApiStudentMap,
  ]);

  // 4. Biểu đồ xu hướng điểm số theo thời gian
  const trendData = useMemo(() => {
    if (!submissionsData?.lessons) return [];

    return submissionsData.lessons
      .map((lesson: any) => {
        // Tính trung bình lớp
        const lessonSubmissions =
          submissionsData.submissions?.filter(
            (s: any) => s.lessonId === lesson.id && s.status === "MARKED",
          ) || [];

        const classAvgScore =
          lessonSubmissions.length > 0
            ? lessonSubmissions.reduce(
                (acc: number, curr: any) => acc + (curr.score || 0),
                0,
              ) / lessonSubmissions.length
            : null;

        // Tính cho học viên được chọn
        let studentScore = undefined;
        if (selectedStudentId !== "all") {
          const apiUid = rosterToApiStudentMap[selectedStudentId];
          const sub = submissionMap[`${apiUid}-${lesson.id}`];
          if (sub && (sub.status === "MARKED" || sub.status === "GRADED")) {
            studentScore = sub.score;
          }
        }

        return {
          name: `B${lesson.displayOrder}`,
          fullName: lesson.name,
          classAvg:
            classAvgScore !== null
              ? Number(classAvgScore.toFixed(1))
              : undefined,
          studentScore: studentScore,
        };
      })
      .filter(
        (d: any) => d.classAvg !== undefined || d.studentScore !== undefined,
      );
  }, [
    submissionsData,
    selectedStudentId,
    rosterToApiStudentMap,
    submissionMap,
  ]);

  const selectedStudentSummary = useMemo(() => {
    if (selectedStudentId === "all") {
      // Tính trung bình cả lớp
      const validHwRate = homeworkStats.filter(
        (s: any) => s.hwRate !== undefined,
      );
      const validAvgScore = homeworkStats.filter(
        (s: any) => s.hwAvgScore !== undefined,
      );

      const totalHwRate =
        validHwRate.length > 0
          ? validHwRate.reduce(
              (acc: number, s: any) => acc + (s.hwRate || 0),
              0,
            ) / validHwRate.length
          : 0;

      const totalAvgScore =
        validAvgScore.length > 0
          ? validAvgScore.reduce(
              (acc: number, s: any) => acc + (s.hwAvgScore || 0),
              0,
            ) / validAvgScore.length
          : 0;

      return { hwRate: totalHwRate, hwAvgScore: totalAvgScore };
    }
    const found = homeworkStats.find((s: any) => s.id === selectedStudentId);
    return found || { hwRate: 0, hwAvgScore: 0 };
  }, [homeworkStats, selectedStudentId]);

  const selectedStudent = useMemo(() => {
    return students.find((s: any) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handleAIEvaluation = async (
    studentId?: string,
    isSilent = false,
    showToast = true,
  ) => {
    const targetId = studentId || selectedStudentId;
    if (targetId === "all") return;

    const student = students.find((s: any) => s.id === targetId);
    if (!student) return;

    if (!isSilent) {
      setIsEvaluating(true);
      setShowAiDialog(true);
    }

    const toastId =
      isSilent && showToast
        ? toast.loading(`Đang phân tích AI: ${student.fullName}...`)
        : null;

    try {
      const result = await classService.getAIStudentEvaluation(
        token || "",
        classData.id,
        targetId,
        rosterToApiStudentMap,
      );

      if (result.success) {
        // Lưu vào state và Local Storage
        setEvaluationResults((prev) => ({ ...prev, [targetId]: result.data }));
        localStorage.setItem(
          `ai_eval_${classData.id}_${targetId}`,
          JSON.stringify(result.data),
        );

        if (!isSilent) {
          setAiReport(result.data);
        } else {
          if (toastId) toast.dismiss(toastId);
        }
        return true;
      } else {
        if (isSilent) {
          if (toastId) toast.dismiss(toastId);
        } else {
          alert("Lỗi đánh giá AI: " + result.error);
        }
        return false;
      }
    } catch (err: any) {
      console.error("AI Evaluation failed", err);
      if (isSilent) {
        if (toastId) toast.dismiss(toastId);
      } else {
        alert("Lỗi kết nối API đánh giá AI");
      }
      return false;
    } finally {
      if (!isSilent) setIsEvaluating(false);
    }
  };

  const handleEvaluateAll = async () => {
    if (students.length === 0) return;

    const summary: { id: string; name: string; success: boolean }[] = [];
    toast.info(`Bắt đầu phân tích AI cho ${students.length} học viên...`);
    setIsEvaluating(true);

    try {
      // Evaluate sequentially
      for (const student of students) {
        toast.loading(`Đang phân tích: ${student.fullName}...`, {
          id: "bulk_eval",
        });
        const success = await handleAIEvaluation(student.id, true, false);
        summary.push({
          id: student.id,
          name: student.fullName,
          success: success ?? false,
        });
      }

      toast.success("Đã hoàn thành phân tích toàn bộ lớp học!", {
        id: "bulk_eval",
      });
      setBulkResults(summary);
      setShowBulkSummary(true);
    } catch (e) {
      toast.error("Quá trình đánh giá bị gián đoạn", { id: "bulk_eval" });
    } finally {
      setIsEvaluating(false);
    }
  };

  const exportToPDF = async () => {
    const element = document.getElementById("ai-report-content");
    if (!element) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Bao_cao_AI_${selectedStudent?.fullName || "Hoc_vien"}.pdf`);
      toast.success("Đã xuất file PDF thành công!");
    } catch (err) {
      console.error("PDF Export failed", err);
      toast.error("Lỗi khi xuất file PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "Tiến bộ")
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "Đi xuống")
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Student Selector */}
      <Card className="bg-slate-50/50 border-dashed">
        <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              {selectedStudentId === "all" ? (
                <Users className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-sm font-bold">
                {selectedStudentId === "all"
                  ? "Thống kê cả lớp"
                  : `Thống kê: ${selectedStudent?.fullName}`}
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedStudentId === "all"
                  ? "Xem dữ liệu tổng hợp của tất cả học viên"
                  : "Theo dõi tiến độ và năng lực cá nhân học viên"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedStudentId === "all" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-primary/20 hover:bg-primary/5 text-primary font-semibold"
                onClick={handleEvaluateAll}
              >
                <Play className="w-4 h-4" />
                Đánh giá toàn bộ lớp
              </Button>
            ) : (
              <>
                {evaluationResults[selectedStudentId] && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 text-slate-600 border-slate-200"
                    onClick={() => {
                      setAiReport(evaluationResults[selectedStudentId]);
                      setShowAiDialog(true);
                    }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Xem lại bản trước đó
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-primary/20 hover:bg-primary/5 text-primary font-semibold"
                  onClick={() => handleAIEvaluation()}
                >
                  <Brain className="w-4 h-4" />
                  Đánh giá AI mới
                </Button>
              </>
            )}
            <Select
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
            >
              <SelectTrigger className="w-full sm:w-[240px] h-9">
                <SelectValue placeholder="Chọn học viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả học viên</SelectItem>
                {students.map((student: any) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Tỷ lệ chuyên cần
            </CardTitle>
            <CardDescription>
              {selectedStudentId === "all" ? "Tổng hợp lớp" : "Cá nhân"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceStats.chart}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {attendanceStats.chart.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {selectedStudentId === "all"
                ? "Xu hướng học tập lớp"
                : "So sánh xu hướng cá nhân"}
            </CardTitle>
            <CardDescription>
              Điểm trung bình các buổi học (0-10)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="classAvg"
                  name="Trung bình lớp"
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                {selectedStudentId !== "all" && (
                  <Line
                    type="monotone"
                    dataKey="studentScore"
                    name="Học viên"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#3b82f6" }}
                    activeDot={{ r: 7 }}
                  />
                )}
                {selectedStudentId === "all" && (
                  <Line
                    type="monotone"
                    dataKey="classAvg"
                    name="Điểm TB Lớp"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#3b82f6" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {selectedStudentId === "all"
              ? "So sánh năng lực học viên"
              : "Chi tiết năng lực cá nhân"}
          </CardTitle>
          <CardDescription>
            {selectedStudentId === "all"
              ? "Tỉ lệ nộp bài và điểm số trung bình của các học viên"
              : "Kết quả chi tiết từng bài học của học viên"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="scores">Điểm số</TabsTrigger>
              <TabsTrigger value="completion">Tỉ lệ nộp bài (%)</TabsTrigger>
            </TabsList>

            <TabsContent value="scores" className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    selectedStudentId === "all"
                      ? homeworkStats
                      : studentDetailStats
                  }
                  layout="vertical"
                  margin={{ left: 50, right: 50 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis type="number" domain={[0, 10]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      Number(value).toFixed(1),
                      name,
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="hwAvgScore"
                    name={
                      selectedStudentId === "all"
                        ? "Điểm TB Bài tập"
                        : "Điểm Bài tập"
                    }
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="hwAvgScore"
                      position="right"
                      formatter={(v: any) =>
                        v > 0 ? Number(v).toFixed(1) : ""
                      }
                      style={{ fontSize: "10px", fill: "#666" }}
                    />
                  </Bar>
                  <Bar
                    dataKey="examAvgScore"
                    name={
                      selectedStudentId === "all"
                        ? "Điểm TB Kiểm tra"
                        : "Điểm Kiểm tra"
                    }
                    fill="#8b5cf6"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="examAvgScore"
                      position="right"
                      formatter={(v: any) =>
                        v > 0 ? Number(v).toFixed(1) : ""
                      }
                      style={{ fontSize: "10px", fill: "#666" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="completion" className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    selectedStudentId === "all"
                      ? homeworkStats
                      : studentDetailStats
                  }
                  layout="vertical"
                  margin={{ left: 50, right: 60 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: any, name: any, props: any) => {
                      const data = props.payload;
                      if (selectedStudentId === "all") {
                        if (name.includes("Bài tập")) {
                          return [
                            `${Number(value).toFixed(1)}% (${data.hwSubmitted}/${data.hwTotal})`,
                            name,
                          ];
                        }
                        return [
                          `${Number(value).toFixed(1)}% (${data.examSubmitted}/${data.examTotal})`,
                          name,
                        ];
                      }
                      return [`${Number(value).toFixed(0)}%`, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="hwRate"
                    name={
                      selectedStudentId === "all"
                        ? "Tỉ lệ nộp Bài tập (%)"
                        : "Trạng thái nộp Bài tập"
                    }
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="hwRate"
                      position="right"
                      formatter={(v: any) =>
                        v > 0 ? `${Number(v).toFixed(0)}%` : ""
                      }
                      style={{ fontSize: "10px", fill: "#666" }}
                    />
                  </Bar>
                  <Bar
                    dataKey="examRate"
                    name={
                      selectedStudentId === "all"
                        ? "Tỉ lệ nộp Kiểm tra (%)"
                        : "Trạng thái nộp Kiểm tra"
                    }
                    fill="#ec4899"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="examRate"
                      position="right"
                      formatter={(v: any) =>
                        v > 0 ? `${Number(v).toFixed(0)}%` : ""
                      }
                      style={{ fontSize: "10px", fill: "#666" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal Tổng kết Đánh giá toàn lớp */}
      <Dialog open={showBulkSummary} onOpenChange={setShowBulkSummary}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold">
              Kết quả đánh giá AI toàn bộ lớp
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto py-2 space-y-3 pr-2">
            {bulkResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${result.success ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span className="font-medium">{result.name}</span>
                  {!result.success && (
                    <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                      Thất bại
                    </span>
                  )}
                </div>
                {result.success && evaluationResults[result.id] && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedStudentId(result.id);
                      setAiReport(evaluationResults[result.id]);
                      setShowAiDialog(true);
                    }}
                  >
                    Xem kết quả
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="default" onClick={() => setShowBulkSummary(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="h-[92vh] w-[96vw] !max-w-[96vw] overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <DialogHeader className="z-10 border-b bg-white px-6 py-5 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="flex items-center gap-3 text-lg font-bold">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-base">Phân tích năng lực AI</span>
                <span className="text-xs font-medium text-muted-foreground">
                  Học viên: {selectedStudent?.fullName}
                </span>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {aiReport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 border-slate-200 text-slate-600"
                  onClick={exportToPDF}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileDown className="h-3 w-3" />
                  )}
                  Xuất PDF
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-slate-100"
                onClick={() => setShowAiDialog(false)}
              >
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </DialogHeader>

          <div className="h-[calc(92vh-85px)] overflow-y-auto">
            {isEvaluating ? (
              <div className="flex min-h-[350px] flex-col items-center justify-center gap-4 px-6 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-2 text-center">
                  <p className="text-base font-semibold text-foreground">
                    AI đang xử lý dữ liệu...
                  </p>
                  <p className="text-sm animate-pulse">
                    Đang tổng hợp chuyên cần, điểm số và nhận xét
                  </p>
                </div>
              </div>
            ) : aiReport ? (
              <div
                id="ai-report-content"
                className="space-y-6 px-6 py-6 bg-white"
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  {[
                    { key: "attitude", label: "Thái độ", color: "blue" },
                    {
                      key: "assembly",
                      label: "Thiết bị / Lắp ráp",
                      color: "green",
                    },
                    {
                      key: "programming",
                      label: "Lập trình",
                      color: "purple",
                    },
                  ].map((item) => (
                    <Card
                      key={item.key}
                      className="overflow-hidden rounded-xl border bg-gradient-to-br from-white to-slate-50/50 shadow-sm"
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {item.label}
                          </span>
                          {getTrendIcon(aiReport.criteria[item.key].trend)}
                        </div>
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-bold tracking-tight text-slate-900 leading-none">
                            {aiReport.criteria[item.key].score}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            /10
                          </span>
                        </div>
                        <div className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Xu hướng: {aiReport.criteria[item.key].trend}
                        </div>
                        <p className="text-[12px] leading-relaxed text-slate-600">
                          {aiReport.criteria[item.key].analysis}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase text-slate-500">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Quá trình phát triển
                    </h4>
                    <div className="rounded-xl border border-primary/10 bg-primary/5 p-5 text-[13px] leading-relaxed text-slate-700 shadow-sm italic">
                      "{aiReport.overall_progress}"
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold uppercase text-slate-500">
                      Lộ trình cải thiện
                    </h4>
                    <div className="space-y-3 rounded-xl border bg-slate-50/50 p-5 shadow-sm">
                      {aiReport.suggestions.map((s: string, i: number) => (
                        <div
                          key={i}
                          className="flex gap-3 text-[13px] leading-6"
                        >
                          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <p className="text-slate-700">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Không thể tải phân tích AI. Vui lòng kiểm tra cấu hình Vertex AI
                hoặc dữ liệu trả về từ model.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
