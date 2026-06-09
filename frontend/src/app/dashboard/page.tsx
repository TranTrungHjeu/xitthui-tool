"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Users, AlertCircle, Loader2, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatVietnameseDate } from "@/lib/date";
import { ClassData, Slot, Attendance } from "@/types";

export default function DashboardOverview() {
  const {
    user,
    isAuthenticated,
    classes: storedClasses,
    lastClassesFetch,
    setClasses: setStoredClasses,
  } = useAuthStore();
  const [isLoading, setIsLoading] = useState(!storedClasses);
  const [error, setError] = useState("");

  const classes = storedClasses || [];

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.firstName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async (force = false) => {
      if (!isAuthenticated || !user?.teacherId) {
        return;
      }

      // Optimize: Use cache if fresh
      const CACHE_TIME = 5 * 60 * 1000;
      if (
        !force &&
        storedClasses &&
        lastClassesFetch &&
        Date.now() - lastClassesFetch < CACHE_TIME
      ) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await classService.getClasses(
          "", // token is handled by interceptor
          user.teacherId,
        );
        if (isMounted) {
          setStoredClasses(data || []);
        }
      } catch (err: any) {
        setError("Không thể tải dữ liệu dashboard");
        // Log chi tiết lỗi từ backend trả về
        console.error(
          "[Dashboard] Error detail:",
          err.response?.data || err.message,
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [
    user?.teacherId,
    isAuthenticated,
    storedClasses,
    lastClassesFetch,
    setStoredClasses,
  ]);

  const notifications = useMemo(() => {
    const now = new Date();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

    const overdueFeedbackList: {
      classId: string;
      className: string;
      date: string;
      studentCount: number;
    }[] = [];
    // const newStudentsMap = new Map<string, { className: string; count: number }>();

    classes.forEach((cls: ClassData) => {
      if (!cls.slots) return;

      // 1. Logic for "Chưa chấm điểm buổi học qua" (Overdue Feedback)
      cls.slots.forEach((slot: Slot) => {
        // Ensure slot.date and slot.endTime exist for accurate calculation
        if (!slot.date || !slot.endTime) return;

        // Combine date and endTime to create a full datetime string, then parse
        const [hour, minute] = slot.endTime.split(":").map(Number);
        const slotEndDateTime = new Date(slot.date);
        slotEndDateTime.setHours(hour, minute, 0, 0); // Set time components

        const timeDiff = now.getTime() - slotEndDateTime.getTime();

        // Check if slot ended more than 48 hours ago
        if (timeDiff > FORTY_EIGHT_HOURS) {
          const studentsNeedingFeedback = (slot.studentAttendance || []).filter(
            (sa: Attendance) =>
              (sa.status === "PRESENT" || sa.status === "ATTENDED") &&
              !sa.comment, // Student was present but has no comment
          );

          if (studentsNeedingFeedback.length > 0) {
            overdueFeedbackList.push({
              classId: cls.id,
              className: cls.name,
              date: slot.date,
              studentCount: studentsNeedingFeedback.length,
            });
          }
        }
      });

      // 2. Logic for "Học viên mới đăng ký" (New Students)
      // This is a placeholder. Without specific 'enrollmentDate' in the student object
      // or a way to determine 'new' from the API, this remains hardcoded or requires a backend change.
      // For now, I'll remove the hardcoded new student notification from the UI.
    });

    // Sort overdue by date descending
    overdueFeedbackList.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      overdueFeedback: overdueFeedbackList,
      // newStudents: Array.from(newStudentsMap.values())
    };
  }, [classes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Chào {displayName}
          </h2>
          <p className="text-muted-foreground text-sm">
            Hôm nay là {formatVietnameseDate(new Date())}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Lớp học sắp tới</CardTitle>
            <CardDescription>
              Danh sách các lớp học có lịch trong tuần này
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classes.filter(
              (c) => c.status !== "FINISHED" && c.status !== "ENDED",
            ).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Không có lớp học nào đang diễn ra
              </p>
            ) : (
              <div className="space-y-4">
                {classes
                  .filter(
                    (c) => c.status !== "FINISHED" && c.status !== "ENDED",
                  )
                  .slice(0, 5)
                  .map((cls) => (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-primary/10 p-2 rounded">
                          <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {cls.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cls.course?.name || "Khóa học chưa xác định"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge type="class" status={cls.status} />
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Thông báo</CardTitle>
            <CardDescription>Các hoạt động cần xử lý ngay</CardDescription>
          </CardHeader>
          <CardContent>
            {notifications.overdueFeedback.length > 0 ? (
              <div className="space-y-4">
                {notifications.overdueFeedback.map((item, index) => (
                  <div
                    key={`feedback-${index}`}
                    className="flex items-start space-x-4 text-sm"
                  >
                    <div className="mt-0.5 bg-orange-100 p-1.5 rounded-full">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {item.studentCount} học viên cần chấm điểm buổi học qua
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lớp {item.className} -{" "}
                        {formatVietnameseDate(new Date(item.date))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có buổi học nào cần chấm điểm
              </p>
            )}

            {/* New Students notification (if implemented with dynamic data) */}
            {/* For now, it's removed as new student logic isn't fully defined with available data */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
