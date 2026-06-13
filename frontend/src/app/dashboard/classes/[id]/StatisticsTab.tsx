"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  User,
  Users,
  GraduationCap,
  ClipboardCheck,
  Award,
  Brain,
  Loader2,
  X,
  FileDown,
  Play,
  RotateCcw,
} from "lucide-react";
import { classService } from "../../../../services/classService";
import { useAuthStore } from "../../../../store/useAuthStore";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { toast } from "sonner";

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

    setIsEvaluating(true);

    try {
      toast.loading(`Đang phân tích... (0/${students.length})`, {
        id: "bulk_eval",
      });

      let completedCount = 0;

      // Xử lý song song (chạy đồng thời các request)
      const promises = students.map(async (student: any) => {
        const success = await handleAIEvaluation(student.id, true, false);

        completedCount++;
        toast.loading(
          `Đang phân tích... (${completedCount}/${students.length})`,
          {
            id: "bulk_eval",
          },
        );

        return {
          id: student.id,
          name: student.fullName,
          success: success ?? false,
        };
      });

      const summary = await Promise.all(promises);

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
    if (!aiReport || !selectedStudent) return;

    try {
      setIsExporting(true);
      toast.loading("Đang tạo file PDF...", { id: "pdf_export" });

      // Dynamic import to avoid Next.js build/SSR issues with @react-pdf/renderer
      const { pdf } = await import("@react-pdf/renderer");
      const { AIReportPDF } =
        await import("../../../../components/AIReportPDF");

      // Generate PDF blob using @react-pdf/renderer
      const blob = await pdf(
        <AIReportPDF
          selectedStudent={selectedStudent}
          classData={classData}
          aiReport={aiReport}
        />,
      ).toBlob();

      // Create a download link and trigger click
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Bao_cao_AI_${selectedStudent.fullName}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Đã xuất file PDF thành công!", { id: "pdf_export" });
    } catch (err) {
      console.error("PDF Export failed", err);
      toast.error("Lỗi khi xuất file PDF", { id: "pdf_export" });
    } finally {
      setIsExporting(false);
    }
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
            <div className="flex items-center gap-2">
              {Object.keys(evaluationResults).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-slate-200 text-slate-600"
                  onClick={() => setShowBulkSummary(true)}
                >
                  <Brain className="w-4 h-4" />
                  Kết quả AI toàn lớp
                </Button>
              )}
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
            </div>
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

      {/* Modal Báo cáo AI */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-xl bg-slate-50">
          <DialogHeader className="px-5 py-4 border-b bg-white shadow-sm flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <Brain className="h-4 w-4 text-blue-700" />
              </div>
              Bản báo cáo năng lực
            </DialogTitle>
            <div className="flex items-center gap-2">
              {aiReport && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-2 shadow-sm font-semibold text-xs"
                  onClick={exportToPDF}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileDown className="h-3 w-3" />
                  )}
                  Tải xuống PDF
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-slate-200"
                onClick={() => setShowAiDialog(false)}
              >
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[75vh] overflow-y-auto">
            {isEvaluating ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 py-10 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Hệ thống đang xử lý dữ liệu...
                  </p>
                  <p className="text-xs animate-pulse">
                    Đang tổng hợp và phân tích đánh giá
                  </p>
                </div>
              </div>
            ) : aiReport ? (
              <div className="p-4 sm:p-5">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  {/* Info Header */}
                  <div className="bg-slate-800 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h2 className="text-base font-bold uppercase tracking-wider text-slate-100">
                        Báo Cáo Năng Lực Học Viên
                      </h2>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs w-full sm:w-auto">
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] font-semibold uppercase">
                          Học viên
                        </span>
                        <span className="font-medium truncate max-w-[120px]">
                          {selectedStudent?.fullName}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] font-semibold uppercase">
                          Lớp
                        </span>
                        <span className="font-medium truncate max-w-[120px]">
                          {classData?.name}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] font-semibold uppercase">
                          Khóa học
                        </span>
                        <span className="font-medium truncate max-w-[120px]">
                          {classData?.course?.name}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] font-semibold uppercase">
                          Ngày tạo
                        </span>
                        <span className="font-medium">
                          {new Date().toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-5 text-slate-700">
                    {/* I. Tiêu chí đánh giá */}
                    <section>
                      <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1">
                        <Award className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-800">
                          I. ĐÁNH GIÁ TIÊU CHÍ KỸ NĂNG
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(Array.isArray(aiReport.criteria)
                          ? aiReport.criteria
                          : Object.entries(aiReport.criteria || {}).map(
                              ([k, v]: [string, any]) => ({
                                ...v,
                                label:
                                  v.label ||
                                  (k === "attitude"
                                    ? "Thái độ"
                                    : k === "assembly"
                                      ? "Lắp ráp"
                                      : k === "programming"
                                        ? "Lập trình"
                                        : k),
                              }),
                            )
                        ).map((item: any, index: number) => (
                          <div
                            key={index}
                            className="bg-slate-50 rounded-lg border border-slate-100 p-2.5 flex flex-col h-full hover:shadow-sm transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <h4 className="font-bold text-slate-800 text-xs">
                                {item.label}
                              </h4>
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                  {item.score}/10
                                </span>
                                <span
                                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    item.trend === "Tiến bộ"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : item.trend === "Đi xuống"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {item.trend}
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-600 text-xs leading-relaxed flex-grow text-justify">
                              {item.analysis}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* II. Đánh giá chung */}
                    <section>
                      <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1">
                        <ClipboardCheck className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-bold text-slate-800">
                          II. TỔNG HỢP NHẬN XÉT
                        </h3>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                        <div className="space-y-2 text-slate-600 text-xs leading-relaxed text-justify">
                          {String(aiReport.overall_progress)
                            .split(/(?=\[(?:L|T|Đ)\])/g)
                            .map((segment: string, idx: number) => {
                              const text = segment.trim();
                              if (!text) return null;

                              const match = text.match(
                                /^\[(L|T|Đ)\]\s*([\s\S]*)$/,
                              );
                              const label = match?.[1];
                              const content = (match?.[2] || text).trim();

                              const titleMap: Record<string, string> = {
                                L: "Tư duy / Kiến thức",
                                T: "Thao tác / Lập trình",
                                Đ: "Đề xuất hỗ trợ",
                              };

                              return (
                                <div
                                  key={idx}
                                  className="flex flex-col sm:flex-row gap-1 sm:gap-2"
                                >
                                  {label && (
                                    <div className="sm:w-1/4 shrink-0">
                                      <span className="inline-block font-semibold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded text-[10px] w-full sm:w-auto">
                                        {titleMap[label] || `[${label}]`}
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    className={label ? "sm:w-3/4" : "w-full"}
                                  >
                                    <p>{content}</p>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </section>

                    {/* III. Đề xuất / Phương án hỗ trợ */}
                    <section>
                      <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1">
                        <GraduationCap className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-bold text-slate-800">
                          III. ĐỀ XUẤT HỖ TRỢ
                        </h3>
                      </div>
                      <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                        <ul className="space-y-1.5">
                          {aiReport.suggestions.map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <div className="mt-0.5 bg-amber-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center shrink-0 text-[9px] font-bold shadow-sm">
                                {i + 1}
                              </div>
                              <span className="text-slate-700 leading-relaxed text-xs font-medium">
                                {s}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Không thể tải báo cáo đánh giá. Vui lòng kiểm tra lại kết nối.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
