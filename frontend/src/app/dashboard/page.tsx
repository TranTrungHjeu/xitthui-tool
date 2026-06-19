"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useMinLoading } from "@/hooks/useMinLoading";
import { classService } from "@/services/classService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Users,
  AlertCircle,
  Loader2,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import CatLoader from "@/components/CatLoader";
import { formatVietnameseDate } from "@/lib/date";
import { isKhiemAccount } from "@/lib/utils";
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [refreshNotifTrigger, setRefreshNotifTrigger] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState("");

  const isFetchingAny = isLoading || isLoadingNotifications;
  const showLoadingAll = useMinLoading(isInitialLoad && isFetchingAny, 1000);

  const classes = storedClasses || [];

  useEffect(() => {
    if (!isLoading && !isLoadingNotifications) {
      setIsInitialLoad(false);
    }
  }, [isLoading, isLoadingNotifications]);

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

        const isKheim = isKhiemAccount(user);

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

        const isKheim = isKhiemAccount(user);

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
    refreshNotifTrigger,
  ]);

  const handleSyncNotifications = async () => {
    const isTE = user?.appRoles?.includes("TE" as any);
    if (!isAuthenticated || !isTE) {
      return;
    }

    setIsSyncing(true);
    try {
      await classService.syncNotifications("", user?.appRoles);
      // Trigger reload notifications
      setRefreshNotifTrigger((prev) => prev + 1);
      setSuccessModalMessage("Đã đồng bộ thông báo thành công!");
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      console.error("[Dashboard] Error syncing notifications:", err);
      alert("Lỗi khi đồng bộ: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendReminderEmails = async () => {
    const isTE = user?.appRoles?.includes("TE" as any);
    if (!isAuthenticated || !isTE) {
      return;
    }

    setIsSendingEmails(true);
    try {
      await classService.sendNotificationEmails("", user?.appRoles);
      setSuccessModalMessage("Đã gửi email nhắc nhở thành công!");
      setIsSuccessModalOpen(true);
      setRefreshNotifTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error("[Dashboard] Error sending emails:", err);
      alert("Lỗi khi gửi email: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSendingEmails(false);
    }
  };

  if (showLoadingAll) {
    return (
      <div className="flex items-center justify-center h-full w-full py-20 min-h-[60vh]">
        <CatLoader />
      </div>
    );
  }

  return (
    <>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Thông báo</CardTitle>
                <CardDescription>Các hoạt động cần xử lý ngay</CardDescription>
              </div>
              {user?.appRoles?.includes("TE" as any) && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                    onClick={() => setIsEmailModalOpen(true)}
                    disabled={isSendingEmails || isLoadingNotifications}
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    {isSendingEmails ? "Đang gửi..." : "Gửi email nhắc nhở"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setIsSyncModalOpen(true)}
                    disabled={isSyncing || isLoadingNotifications}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                    />
                    {isSyncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {user?.appRoles?.includes("TE" as any) && (
                <div className="mb-4 p-2.5 bg-amber-50/70 border border-amber-100/80 rounded-lg text-[11px] text-amber-800 flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Lưu ý: Dữ liệu của cơ sở được đồng bộ tự động từ LMS định kỳ
                    mỗi 30 phút, do đó một số cập nhật mới có thể chưa hiển thị
                    ngay lập tức.
                  </span>
                </div>
              )}
              {isSyncing || isLoadingNotifications ? (
                <div className="flex items-center justify-center py-10">
                  <CatLoader />
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

      {/* Email Confirmation Dialog */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Xác nhận gửi email nhắc nhở</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ gửi email nhắc nhở chấm điểm đến những giáo viên có
              lớp học cần chấm điểm. Bạn có chắc chắn muốn gửi không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsEmailModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                setIsEmailModalOpen(false);
                handleSendReminderEmails();
              }}
            >
              Gửi email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Confirmation Dialog */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Xác nhận đồng bộ thông báo</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ đồng bộ lại thông báo từ LMS. Quá trình này có thể mất
              một chút thời gian. Bạn có muốn tiếp tục?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setIsSyncModalOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setIsSyncModalOpen(false);
                handleSyncNotifications();
              }}
            >
              Đồng bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Thành công</DialogTitle>
            <DialogDescription>{successModalMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button onClick={() => setIsSuccessModalOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
