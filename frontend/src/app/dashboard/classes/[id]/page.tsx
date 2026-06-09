"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useAuthStore } from "../../../../store/useAuthStore";
import { classService } from "../../../../services/classService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { Button } from "../../../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  Loader2,
  ChevronLeft,
  FileText,
  Copy,
  Pencil,
  GraduationCap,
  CalendarCheck,
  BarChart3,
  Users,
} from "lucide-react";
import EvaluationDialog from "../../../../components/EvaluationDialog";
import StatisticsTab from "./StatisticsTab";
import { useRouter } from "next/navigation";
import { formatDate, formatTime } from "../../../../lib/date";
import { shouldShowGrading } from "../../../../lib/class";

export default function ClassDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { user, token } = useAuthStore();
  const [classData, setClassData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  const processClassData = (data: any) => {
    const sortedSlots = [...(data.slots || [])].sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    setClassData({ ...data, slots: sortedSlots });

    const now = new Date();
    // Tìm buổi học cuối cùng đã diễn ra hoặc đang diễn ra (gần nhất so với hiện tại)
    let initialActiveIndex = -1;

    for (let i = sortedSlots.length - 1; i >= 0; i--) {
      const slot = sortedSlots[i];
      const slotDate = new Date(slot.date);

      // Thiết lập thời gian bắt đầu của slot để so sánh chính xác hơn
      if (slot.startTime) {
        const [hour, minute] = slot.startTime.split(":").map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
          slotDate.setHours(hour, minute, 0, 0);
        }
      }

      if (slotDate <= now) {
        initialActiveIndex = i;
        break;
      }
    }

    // Nếu không tìm thấy buổi nào đã diễn ra (lớp chưa bắt đầu), mặc định chọn buổi 1
    if (initialActiveIndex === -1) {
      initialActiveIndex = 0;
    }

    setActiveSlotIndex(initialActiveIndex);
  };

  const fetchClassDetails = async () => {
    if (!user?.teacherId) return;

    try {
      setIsLoading(true);
      const classDetails = await classService.getClassById(
        token || "",
        id as string,
      );
      if (classDetails) {
        processClassData(classDetails);
      }
    } catch (err) {
      console.error("Failed to fetch class details", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetails();
  }, [id, user]);

  const activeSlot = classData?.slots?.[activeSlotIndex];

  const canShowGrading = useMemo(() => {
    return shouldShowGrading(classData?.course?.shortName);
  }, [classData]);

  const [submissionsData, setSubmissionsData] = useState<{
    students: any[];
    lessons: any[];
    submissions: any[];
  }>({ students: [], lessons: [], submissions: [] });
  const [homeworkLessons, setHomeworkLessons] = useState<any[]>([]);

  const fetchHomeworkData = async () => {
    try {
      const courseVersionData = await classService.getCourseVersion(
        token || "",
        id as string,
      );
      if (courseVersionData?.lessons) {
        setHomeworkLessons(courseVersionData.lessons);
      }
    } catch (err) {
      console.error("Failed to fetch course version", err);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const data = await classService.getSubmissions(token || "", id as string);
      if (data && data.students && data.lessons && data.submissions) {
        setSubmissionsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch submissions", err);
    }
  };

  useEffect(() => {
    if (canShowGrading) {
      fetchHomeworkData();
      fetchSubmissions();
    }
  }, [canShowGrading, id, token]);

  // Normalize submissions into an easily accessible dictionary: submissionMap[`${studentUid}-${lessonId}`]
  const submissionMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (submissionsData.submissions) {
      submissionsData.submissions.forEach((sub) => {
        const key = `${sub.studentUid}-${sub.lessonId}`;
        map[key] = sub;
      });
    }
    return map;
  }, [submissionsData]);

  // Create a fast lookup for API studentUid based on class roster student IDs
  const rosterToApiStudentMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (classData?.students && submissionsData.students) {
      classData.students.forEach((rosterItem: any) => {
        if (!rosterItem.student) return;
        // The API returns displayName and studentUid. We match by name or by assuming id == studentUid
        const matchedApiStudent = submissionsData.students.find(
          (apiS: any) =>
            apiS.studentUid === rosterItem.student.id ||
            apiS.id === rosterItem.student.id ||
            apiS.displayName?.toLowerCase() ===
              rosterItem.student.fullName?.toLowerCase(),
        );

        if (matchedApiStudent) {
          map[rosterItem.student.id] = matchedApiStudent.studentUid;
        } else {
          // Fallback mapping if no direct match found
          map[rosterItem.student.id] = rosterItem.student.id;
        }
      });
    }
    return map;
  }, [classData, submissionsData.students]);

  const students = useMemo(() => {
    if (!classData) return [];
    const map = new Map();

    // Khởi tạo danh sách học viên từ roster của lớp (classData.students)
    if (Array.isArray(classData.students)) {
      classData.students.forEach((item: any) => {
        const student = item.student;
        if (student && student.id) {
          map.set(student.id, {
            ...student,
            attendedCount: 0,
            totalCount: 0,
          });
        }
      });
    }

    // Cập nhật thống kê chuyên cần từ các buổi học (slots)
    classData.slots?.forEach((s: any) => {
      s.studentAttendance?.forEach((sa: any) => {
        const studentId = sa.student?.id || sa.studentId;
        if (!studentId) return;

        if (!map.has(studentId)) {
          map.set(studentId, {
            ...(sa.student || {}),
            id: studentId,
            attendedCount: 0,
            totalCount: 0,
          });
        }

        const info = map.get(studentId);
        info.totalCount++;
        if (
          ["PRESENT", "ATTENDED", "LATE", "LATE_ARRIVED"].includes(sa.status)
        ) {
          info.attendedCount++;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      (a.fullName || "").localeCompare(b.fullName || ""),
    );
  }, [classData]);

  const copyToClipboard = (text: string) => {
    const cleanText = text.replace(/<[^>]*>/g, "");
    navigator.clipboard.writeText(cleanText);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold">Không tìm thấy lớp học</h2>
        <Button variant="link" onClick={() => router.back()}>
          Quay lại
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {classData.name}
            </h2>
            <StatusBadge type="class" status={classData.status} />
          </div>
          <p className="text-muted-foreground">{classData.course?.name}</p>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="inline-flex w-auto bg-slate-100/80 p-1 rounded-2xl shadow-sm border border-slate-200/50 backdrop-blur-sm">
          <TabsTrigger
            value="sessions"
            className="flex items-center gap-2.5 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.08)] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-white/50"
          >
            <CalendarCheck className="w-4 h-4" />
            Buổi học
          </TabsTrigger>
          {canShowGrading && (
            <TabsTrigger
              value="grading"
              className="flex items-center gap-2.5 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.08)] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-white/50"
            >
              <Pencil className="w-4 h-4" />
              Chấm bài
            </TabsTrigger>
          )}
          <TabsTrigger
            value="students"
            className="flex items-center gap-2.5 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.08)] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-white/50"
          >
            <Users className="w-4 h-4" />
            Học viên
          </TabsTrigger>
          {canShowGrading && (
            <TabsTrigger
              value="stats"
              className="flex items-center gap-2.5 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.08)] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-white/50"
            >
              <BarChart3 className="w-4 h-4" />
              Thống kê
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold leading-none">
                      Chọn buổi học
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Xem chi tiết điểm danh và nội dung bài học
                    </p>
                  </div>
                  <Select
                    value={activeSlotIndex.toString()}
                    onValueChange={(val) => setActiveSlotIndex(parseInt(val))}
                  >
                    <SelectTrigger className="h-8 w-full text-xs md:w-[260px]">
                      <SelectValue placeholder="Chọn buổi học" />
                    </SelectTrigger>
                    <SelectContent>
                      {classData.slots?.map((slot: any, index: number) => (
                        <SelectItem key={slot._id} value={index.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Buổi {index + 1}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              ({formatDate(slot.date)})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="w-full">
              {activeSlot ? (
                <div className="space-y-4">
                  {activeSlot.summary && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <FileText className="h-3.5 w-3.5" />
                            Nội dung buổi học
                          </div>
                          <div
                            className="text-sm prose max-w-none prose-sm"
                            dangerouslySetInnerHTML={{
                              __html: activeSlot.summary,
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-semibold leading-none">
                          Điểm danh & Nhận xét
                        </CardTitle>
                        <CardDescription className="text-[11px] leading-4">
                          {formatTime(activeSlot.startTime)} -{" "}
                          {formatTime(activeSlot.endTime)} (Đã nhận xét:{" "}
                          {activeSlot.studentAttendance?.filter(
                            (sa: any) => sa.comment,
                          )?.length || 0}
                          /{activeSlot.studentAttendance?.length || 0})
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => {
                            const allComments = activeSlot.studentAttendance
                              ?.filter((sa: any) => sa.comment)
                              .map(
                                (sa: any) =>
                                  `Học viên: ${sa.student?.fullName}\nNhận xét: ${sa.comment.replace(/<[^>]*>/g, "")}`,
                              )
                              .join("\n\n---\n\n");
                            if (allComments) {
                              navigator.clipboard.writeText(allComments);
                            }
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Sao chép tất cả
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-9 pl-4 text-xs">
                              Học viên
                            </TableHead>
                            <TableHead className="h-9 text-xs">
                              Trạng thái
                            </TableHead>
                            <TableHead className="h-9 text-xs">
                              Nhận xét
                            </TableHead>
                            <TableHead className="h-9 pr-4 text-right text-xs">
                              Thao tác
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeSlot.studentAttendance?.map((sa: any) => (
                            <TableRow key={sa._id}>
                              <TableCell className="pl-4 py-2.5 font-medium">
                                <div className="text-sm">
                                  {sa.student?.fullName || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  type="attendance"
                                  status={sa.status}
                                  className="text-[10px]"
                                />
                              </TableCell>
                              <TableCell className="max-w-xs py-2.5">
                                {sa.comment ? (
                                  <div
                                    className="text-xs line-clamp-2 text-muted-foreground"
                                    dangerouslySetInnerHTML={{
                                      __html: sa.comment,
                                    }}
                                  />
                                ) : (
                                  <span className="text-xs italic text-slate-400">
                                    Chưa có nhận xét
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 pr-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {sa.comment && (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        copyToClipboard(sa.comment)
                                      }
                                      title="Copy nhận xét"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => setEditingStudent(sa)}
                                    title="Sửa nhận xét"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        Xem
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                      <DialogHeader>
                                        <DialogTitle>
                                          Nhận xét: {sa.student?.fullName}
                                        </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-xs font-bold text-muted-foreground uppercase">
                                              Trạng thái
                                            </p>
                                            <div className="mt-1">
                                              <StatusBadge
                                                type="attendance"
                                                status={sa.status}
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-muted-foreground uppercase">
                                              Gửi LMS
                                            </p>
                                            <div className="mt-1">
                                              <StatusBadge
                                                type="lms"
                                                status={sa.sendCommentStatus}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                                            Nội dung nhận xét
                                          </p>
                                          <div
                                            className="p-4 bg-slate-50 border rounded-lg text-sm leading-relaxed min-h-[100px]"
                                            dangerouslySetInnerHTML={{
                                              __html:
                                                sa.comment ||
                                                "<i>Chưa có nhận xét</i>",
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-slate-400">
                  <FileText className="h-10 w-10 mb-2 opacity-20" />
                  <p>Chọn một buổi học bên trái để xem chi tiết</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {canShowGrading && (
          <TabsContent value="grading" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Bảng chấm bài</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={fetchSubmissions}
                >
                  <Loader2
                    className={`h-3 w-3 mr-2 ${isLoading ? "animate-spin" : ""}`}
                  />
                  Làm mới
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <div className="min-w-max">
                  <div
                    className="grid border-b bg-muted/30"
                    style={{
                      gridTemplateColumns: `160px repeat(${homeworkLessons.length}, minmax(76px, 1fr))`,
                    }}
                  >
                    <div className="sticky left-0 z-10 border-r bg-muted/30 px-2 py-2 text-xs font-medium">
                      Học viên
                    </div>
                    {homeworkLessons.map((lesson, index) => {
                      const isCheckpoint = lesson.type === "CHECKPOINT";
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          className={`border-r px-1.5 py-2 text-center transition-colors ${
                            activeSlotIndex === index
                              ? "bg-primary/10 font-semibold text-primary"
                              : isCheckpoint
                                ? "bg-orange-50 hover:bg-orange-100"
                                : "bg-slate-100 hover:bg-muted/50"
                          }`}
                          onClick={() => setActiveSlotIndex(index)}
                          title={lesson.name}
                        >
                          <div
                            className={`truncate text-[10px] font-bold ${isCheckpoint ? "text-orange-600" : ""}`}
                          >
                            {isCheckpoint ? "KT" : "B"}
                            {lesson.displayOrder}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {students.length > 0 ? (
                    students.map((student) => (
                      <div
                        key={student.id}
                        className="grid border-b last:border-b-0"
                        style={{
                          gridTemplateColumns: `160px repeat(${homeworkLessons.length}, minmax(76px, 1fr))`,
                        }}
                      >
                        <div className="sticky left-0 z-10 flex items-center border-r bg-background px-2 py-2">
                          <div className="truncate text-xs font-medium">
                            {student.fullName}
                          </div>
                        </div>

                        {homeworkLessons.map((lesson, index) => {
                          const apiStudentUid =
                            rosterToApiStudentMap[student.id] || student.id;
                          const studentSubmission =
                            submissionMap[`${apiStudentUid}-${lesson.id}`];

                          let badgeStatus = "NOT_SUBMITTED";
                          if (studentSubmission) {
                            badgeStatus =
                              studentSubmission.status || badgeStatus;
                          }

                          return (
                            <div
                              key={`${student.id}-${lesson.id}`}
                              className={`border-r px-1 py-2 ${
                                activeSlotIndex === index ? "bg-primary/5" : ""
                              }`}
                            >
                              <div className="flex min-h-[52px] flex-col items-center justify-center gap-1 text-center">
                                <StatusBadge
                                  type="attendance"
                                  status={badgeStatus}
                                  count={studentSubmission?.submittedCount}
                                  className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                                />
                                {studentSubmission?.score !== null &&
                                  studentSubmission?.score !== undefined && (
                                    <div className="text-[10px] font-bold text-primary leading-none">
                                      {studentSubmission.score}
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-400">
                      Không có học viên
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {canShowGrading && (
          <TabsContent value="stats" className="space-y-4">
            <StatisticsTab
              classData={classData}
              submissionsData={submissionsData}
              rosterToApiStudentMap={rosterToApiStudentMap}
              submissionMap={submissionMap}
            />
          </TabsContent>
        )}

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách học viên</CardTitle>
              <CardDescription>
                Thống kê chuyên cần của học viên trong lớp
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tên học viên</TableHead>
                    <TableHead>Chuyên cần</TableHead>
                    <TableHead>Tỉ lệ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-6 font-medium">
                        {s.fullName}
                      </TableCell>
                      <TableCell>
                        {s.attendedCount} / {s.totalCount} buổi
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: `${(s.attendedCount / s.totalCount) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold">
                            {Math.round((s.attendedCount / s.totalCount) * 100)}
                            %
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editingStudent && activeSlot && (
        <EvaluationDialog
          isOpen={!!editingStudent}
          onOpenChange={(open) => !open && setEditingStudent(null)}
          student={editingStudent}
          slotId={activeSlot._id}
          classId={classData.id}
          onSuccess={fetchClassDetails}
        />
      )}
    </div>
  );
}
