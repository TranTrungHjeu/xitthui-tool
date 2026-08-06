"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Copy,
  Pencil,
  CalendarCheck,
  BarChart3,
  Users,
  MapPin,
  Calendar,
  Check,
} from "lucide-react";
import CatLoader from "@/components/CatLoader";
import EvaluationDialog from "@/components/EvaluationDialog";
import StatisticsTab from "@/app/dashboard/classes/[id]/StatisticsTab";
import { formatDate, formatTime } from "@/lib/date";
import { shouldShowGrading } from "@/lib/class";
import { useMinLoading } from "@/hooks/useMinLoading";

interface ClassDetailModalProps {
  classId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ClassDetailModal({
  classId,
  open,
  onClose,
}: ClassDetailModalProps) {
  const { user, token } = useAuthStore();
  const [classData, setClassData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const showLoading = useMinLoading(isLoading, 600);

  const processClassData = (data: any) => {
    const sortedSlots = [...(data.slots || [])].sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    setClassData({ ...data, slots: sortedSlots });

    const now = new Date();
    let initialActiveIndex = -1;

    for (let i = sortedSlots.length - 1; i >= 0; i--) {
      const slot = sortedSlots[i];
      const slotDate = new Date(slot.date);

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

    if (initialActiveIndex === -1) {
      initialActiveIndex = 0;
    }

    setActiveSlotIndex(initialActiveIndex);
  };

  const fetchClassDetails = async () => {
    if (!user || !classId) return;

    try {
      setIsLoading(true);
      const classDetails = await classService.getClassById(
        token || "",
        classId,
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
    if (open && classId) {
      fetchClassDetails();
    } else {
      setClassData(null);
    }
  }, [classId, open, user, token]);

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
    if (!classId) return;
    try {
      const courseVersionData = await classService.getCourseVersion(
        token || "",
        classId,
      );
      if (courseVersionData?.lessons) {
        setHomeworkLessons(courseVersionData.lessons);
      }
    } catch (err) {
      console.error("Failed to fetch course version", err);
    }
  };

  const fetchSubmissions = async () => {
    if (!classId) return;
    try {
      const data = await classService.getSubmissions(token || "", classId);
      if (data && data.students && data.lessons && data.submissions) {
        setSubmissionsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch submissions", err);
    }
  };

  useEffect(() => {
    if (canShowGrading && classId && open) {
      fetchHomeworkData();
      fetchSubmissions();
    }
  }, [canShowGrading, classId, open, token]);

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

  const rosterToApiStudentMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (classData?.students && submissionsData.students) {
      classData.students.forEach((rosterItem: any) => {
        if (!rosterItem.student) return;
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
          map[rosterItem.student.id] = rosterItem.student.id;
        }
      });
    }
    return map;
  }, [classData, submissionsData.students]);

  const students = useMemo(() => {
    if (!classData) return [];
    const map = new Map();

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

  const formatCommentContent = (text: string) => {
    if (!text)
      return '<p class="italic text-muted-foreground text-center py-6">Chưa có nhận xét cho học viên trong buổi học này.</p>';

    let cleanText = text.replace(/\u200B/g, "");

    if (/<p>|<br>|<li>|<strong>/i.test(cleanText)) {
      return cleanText;
    }

    const lines = cleanText.split("\n");
    let htmlContent = "";
    let inList = false;

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        if (inList) {
          htmlContent += "</ul>";
          inList = false;
        }
        return;
      }

      const isHeader =
        /^([A-ZĐÁÀẢÃẠĂÂẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\s]+):/u.test(
          trimmed,
        );

      const isScore = /^Điểm/i.test(trimmed);

      if (isHeader) {
        if (inList) {
          htmlContent += "</ul>";
          inList = false;
        }
        htmlContent += `<h4 class="font-bold text-foreground uppercase tracking-wider mt-4 mb-2 text-xs">${trimmed}</h4>`;
      } else if (isScore) {
        if (inList) {
          htmlContent += "</ul>";
          inList = false;
        }
        htmlContent += `<p class="font-semibold text-primary mb-1.5 text-xs">${trimmed}</p>`;
      } else {
        if (!inList) {
          htmlContent +=
            '<ul class="list-disc pl-5 space-y-1.5 marker:text-muted-foreground text-foreground text-xs">';
          inList = true;
        }
        const textWithoutBullet = trimmed.replace(/^[-+*•]\s*/, "");
        htmlContent += `<li class="pl-1">${textWithoutBullet}</li>`;
      }
    });

    if (inList) {
      htmlContent += "</ul>";
    }

    return htmlContent;
  };

  const handleCopyCode = () => {
    if (!classData?.name) return;
    navigator.clipboard.writeText(classData.name);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {classData?.name || "Chi tiết lớp học"}
              </h2>
              {classData?.name && (
                <button
                  onClick={handleCopyCode}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Sao chép mã lớp"
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              )}
              {classData?.status && (
                <StatusBadge type="class" status={classData.status} />
              )}
            </div>
            {classData && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>{classData.course?.name || classData.course?.shortName}</span>
                {classData.centre && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {classData.centre.shortName || classData.centre.name}
                  </span>
                )}
                {classData.startDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(classData.startDate)} – {formatDate(classData.endDate)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {showLoading ? (
            <div className="flex items-center justify-center py-20 min-h-[400px]">
              <CatLoader />
            </div>
          ) : !classData ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Không tìm thấy thông tin chi tiết lớp học.
              </p>
              <Button size="sm" variant="outline" onClick={onClose}>
                Đóng
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="sessions" className="space-y-6">
              <div className="w-full overflow-x-auto select-none no-scrollbar flex pb-1">
                <TabsList className="inline-flex w-auto bg-muted/60 p-1 rounded-xl shadow-xs border border-border/60 whitespace-nowrap">
                  <TabsTrigger
                    value="sessions"
                    className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Buổi học
                  </TabsTrigger>
                  {canShowGrading && (
                    <TabsTrigger
                      value="grading"
                      className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Chấm bài
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="students"
                    className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Học viên ({students.length})
                  </TabsTrigger>
                  {canShowGrading && (
                    <TabsTrigger
                      value="stats"
                      className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Thống kê
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* TAB 1: SESSIONS */}
              <TabsContent value="sessions" className="space-y-4">
                <Card className="border-border/60 shadow-xs">
                  <CardContent className="px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-semibold text-foreground">
                          Chọn buổi học
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Xem chi tiết điểm danh và nội dung bài học
                        </p>
                      </div>
                      <Select
                        value={activeSlotIndex.toString()}
                        onValueChange={(val) => setActiveSlotIndex(parseInt(val))}
                      >
                        <SelectTrigger className="h-8 w-full text-xs font-semibold sm:w-[260px]">
                          <SelectValue placeholder="Chọn buổi học" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          {classData.slots?.map((slot: any, index: number) => (
                            <SelectItem key={slot._id} value={index.toString()}>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold">
                                  Buổi {index + 1}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
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

                {activeSlot && (
                  <div className="space-y-4">
                    {activeSlot.summary && (
                      <Card className="border-border/60 shadow-xs">
                        <CardContent className="pt-4 pb-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <FileText className="h-3.5 w-3.5" />
                              Nội dung buổi học
                            </div>
                            <div
                              className="text-xs prose max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{
                                __html: activeSlot.summary,
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="border-border/60 shadow-xs">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 border-b border-border/40">
                        <div className="space-y-0.5">
                          <CardTitle className="text-xs font-semibold text-foreground">
                            Điểm danh & Nhận xét
                          </CardTitle>
                          <CardDescription className="text-[11px]">
                            {formatTime(activeSlot.startTime)} –{" "}
                            {formatTime(activeSlot.endTime)} (Đã nhận xét:{" "}
                            {activeSlot.studentAttendance?.filter(
                              (sa: any) => sa.comment,
                            )?.length || 0}
                            /{activeSlot.studentAttendance?.length || 0})
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="h-9 bg-muted/20">
                                <TableHead className="w-[180px] text-xs font-bold uppercase tracking-wider">Học viên</TableHead>
                                <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider">Trạng thái</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider">Nhận xét của GV</TableHead>
                                <TableHead className="w-[80px] text-right text-xs font-bold uppercase tracking-wider">Thao tác</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeSlot.studentAttendance?.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                                    Chưa có dữ liệu điểm danh.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                activeSlot.studentAttendance?.map((sa: any) => (
                                  <TableRow key={sa._id || sa.student?.id}>
                                    <TableCell className="font-semibold text-xs text-foreground">
                                      {sa.student?.fullName || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <StatusBadge type="attendance" status={sa.status} />
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <div
                                        className="prose prose-xs max-w-none text-xs text-foreground"
                                        dangerouslySetInnerHTML={{
                                          __html: formatCommentContent(sa.comment),
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs font-semibold text-primary"
                                        onClick={() =>
                                          setEditingStudent({
                                            ...sa,
                                            slotId: activeSlot._id,
                                            classId: classData.id,
                                          })
                                        }
                                      >
                                        Sửa
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: GRADING (Chấm bài) */}
              {canShowGrading && (
                <TabsContent value="grading" className="space-y-4">
                  <Card className="border-border/60 shadow-xs">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="text-xs font-semibold">Chấm bài tập về nhà</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-9 bg-muted/20">
                            <TableHead className="w-[180px] text-xs font-bold uppercase tracking-wider">Học viên</TableHead>
                            {homeworkLessons.map((l: any) => (
                              <TableHead key={l.id} className="text-xs font-bold text-center uppercase tracking-wider min-w-[100px]">
                                {l.name || `Bài ${l.displayOrder}`}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((st: any) => (
                            <TableRow key={st.id}>
                              <TableCell className="font-semibold text-xs text-foreground">
                                {st.fullName}
                              </TableCell>
                              {homeworkLessons.map((l: any) => {
                                const apiUid = rosterToApiStudentMap[st.id];
                                const sub = submissionMap[`${apiUid}-${l.id}`];
                                return (
                                  <TableCell key={l.id} className="text-center text-xs">
                                    {sub ? (
                                      <span className="font-semibold text-emerald-600">Đã nộp</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* TAB 3: STUDENTS */}
              <TabsContent value="students" className="space-y-4">
                <Card className="border-border/60 shadow-xs">
                  <CardHeader className="px-4 py-3">
                    <CardTitle className="text-xs font-semibold">Danh sách học viên ({students.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-9 bg-muted/20">
                          <TableHead className="text-xs font-bold uppercase tracking-wider">Họ và tên</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider">Giới tính</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider">Chuyên cần</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((st: any) => (
                          <TableRow key={st.id}>
                            <TableCell className="font-semibold text-xs text-foreground">
                              {st.fullName}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {st.gender === "MALE" ? "Nam" : st.gender === "FEMALE" ? "Nữ" : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              {st.attendedCount} / {st.totalCount} buổi
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 4: STATS */}
              {canShowGrading && (
                <TabsContent value="stats">
                  <StatisticsTab
                    classData={classData}
                    submissionsData={submissionsData}
                    rosterToApiStudentMap={rosterToApiStudentMap}
                    submissionMap={submissionMap}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>

        {/* Evaluation Dialog */}
        {editingStudent && (
          <EvaluationDialog
            isOpen={!!editingStudent}
            onOpenChange={(open) => !open && setEditingStudent(null)}
            student={editingStudent}
            slotId={editingStudent.slotId}
            classId={editingStudent.classId}
            onSuccess={() => {
              setEditingStudent(null);
              fetchClassDetails();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
