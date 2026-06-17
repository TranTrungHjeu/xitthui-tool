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
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

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
      const isTE = user?.appRoles?.includes("TE" as any);
      if (!isAuthenticated || (!user?.teacherId && !isTE)) {
        setIsLoading(false);
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
        let targetCentres = user?.teacherCentres?.map((c: any) => c.id || c);

        const isKheim =
          user?.username === "lekhiem2002" ||
          user?.email === "lekhiem2002@mindx.net.vn" ||
          user?.email === "lethekhiem2002@mindx.net.vn";

        if (isKheim && user?.teacherCentres) {
          const tdmCentre: any = user.teacherCentres.find((c: any) => {
            const name =
              typeof c === "object" ? c?.name || c?.shortName : String(c);
            return (name || "").toLowerCase().includes("thủ dầu một");
          });
          if (tdmCentre) {
            const id = typeof tdmCentre === "object" ? tdmCentre.id : tdmCentre;
            targetCentres = [id];
          }
        }

        const data = await classService.getClasses(
          "", // token is handled by interceptor
          user?.teacherId || "",
          targetCentres,
          user?.appRoles,
          { statusIn: ["RUNNING", "IN_PROGRESS", "ĐANG_DIỄN_RA"] },
        );
        if (isMounted) {
          setStoredClasses(data?.data || []);
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

  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async () => {
      const isTE = user?.appRoles?.includes("TE" as any);
      if (!isAuthenticated || (!user?.teacherId && !isTE)) {
        return;
      }

      setIsLoadingNotifications(true);
      try {
        let targetCentres = user?.teacherCentres?.map((c: any) => c.id || c);

        const isKheim =
          user?.username === "lekhiem2002" ||
          user?.email === "lekhiem2002@mindx.net.vn" ||
          user?.email === "lethekhiem2002@mindx.net.vn";

        if (isKheim && user?.teacherCentres) {
          const tdmCentre: any = user.teacherCentres.find((c: any) => {
            const name =
              typeof c === "object" ? c?.name || c?.shortName : String(c);
            return (name || "").toLowerCase().includes("thủ dầu một");
          });
          if (tdmCentre) {
            const id = typeof tdmCentre === "object" ? tdmCentre.id : tdmCentre;
            targetCentres = [id];
          }
        }

        const data = await classService.getClassesNotifications(
          "", // token
          user?.teacherId || "",
          targetCentres,
          user?.appRoles,
          user?.email,
        );

        if (isMounted) {
          setNotificationsList(data || []);
        }
      } catch (err: any) {
        console.error("[Dashboard] Error fetching notifications:", err);
      } finally {
        if (isMounted) {
          setIsLoadingNotifications(false);
        }
      }
    };

    fetchNotifications();

    return () => {
      isMounted = false;
    };
  }, [
    user?.teacherId,
    user?.email,
    isAuthenticated,
    user?.appRoles,
    user?.teacherCentres,
    user?.username,
  ]);

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
            {isLoadingNotifications ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  Đang lấy thông báo...
                </p>
              </div>
            ) : notificationsList.length > 0 ? (
              <div className="space-y-3">
                {notificationsList.map((item, index) => (
                  <div
                    key={`feedback-${index}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      item.isLate
                        ? "bg-red-50/50 border-red-100"
                        : "bg-orange-50/50 border-orange-100"
                    } transition-colors`}
                  >
                    <div className="flex-1 space-y-1.5">
                      <p
                        className={`text-sm font-medium leading-tight ${
                          item.isLate ? "text-red-800" : "text-orange-800"
                        }`}
                      >
                        {item.message}
                      </p>

                      {(item.lec || item.ta) && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {item.lec && (
                            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-[11px]">
                              <span className="font-semibold text-blue-700">
                                LEC:
                              </span>
                              <span className="text-slate-700 font-medium">
                                {item.lec}
                              </span>
                            </div>
                          )}
                          {item.ta && (
                            <div className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md text-[11px]">
                              <span className="font-semibold text-purple-700">
                                TA:
                              </span>
                              <span className="text-slate-700 font-medium">
                                {item.ta}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center text-xs text-muted-foreground pt-1">
                        <span className="font-medium text-slate-600">
                          {formatVietnameseDate(new Date(item.date))}
                        </span>
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="text-slate-600">
                          {item.studentCount} học viên chưa chấm
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có buổi học nào cần chấm điểm
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
