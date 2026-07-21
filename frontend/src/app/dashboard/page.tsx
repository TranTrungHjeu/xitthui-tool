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
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Users,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Calendar,
  CalendarDays,
  Layers,
  Mail,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Inbox,
  Award,
  Ban,
  GraduationCap,
} from "lucide-react";
import { cn, isKhiemAccount, isActualKhiemAccount, formatSlotDateTime } from "@/lib/utils";
import { ClassData, Slot } from "@/types";
import { getSessionExamType, getSessionExamLabel } from "@/lib/courseConfig";
import WeeklyScheduleList from "@/components/WeeklyScheduleList";
import { toast } from "sonner";

interface NotificationItem {
  classId: string;
  className: string;
  date: string;
  startTime?: string;
  endTime?: string;
  sessionIndex?: number;
  studentCount: number;
  isLate: boolean;
  lec?: string;
  ta?: string;
  te?: string;
}

function ScheduleLegend({ className }: { className?: string }) {
  const items = [
    {
      label: "Lớp thường",
      color: "bg-primary",
      icon: GraduationCap,
    },
    {
      label: "Checkpoint",
      color: "bg-info",
      icon: Award,
    },
    {
      label: "Demo cuối khóa",
      color: "bg-success",
      icon: Sparkles,
    },
    {
      label: "Đã hoàn thành",
      color: "bg-muted-foreground",
      icon: CheckCircle2,
    },
    {
      label: "Đã hủy",
      color: "bg-muted-foreground/40",
      icon: Ban,
      strikethrough: true,
    },
  ];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-1.5",
              item.strikethrough && "opacity-70",
            )}
          >
            <span
              className={cn(
                "inline-block w-2.5 h-2.5 rounded-sm border border-border",
                item.color,
              )}
              style={
                item.strikethrough
                  ? { textDecoration: "line-through" }
                  : undefined
              }
            />
            <Icon className="h-3 w-3" />
            <span
              className={cn(
                "font-medium",
                item.strikethrough && "line-through",
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardOverview() {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayDiff = day === 0 ? -6 : 1 - day;
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayDiff,
    );
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const calendarTitle = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `${fmt(weekStart)} – ${fmt(end)}/${end.getFullYear()}`;
  }, [weekStart]);

  const handlePrev = () => {
    setWeekStart((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };
  const handleNext = () => {
    setWeekStart((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };
  const handleToday = () => {
    const now = new Date();
    const day = now.getDay();
    const mondayDiff = day === 0 ? -6 : 1 - day;
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayDiff,
    );
    monday.setHours(0, 0, 0, 0);
    setWeekStart(monday);
  };

  const {
    user,
    isAuthenticated,
    classes: storedClasses,
    lastClassesFetch,
    setClasses: setStoredClasses,
  } = useAuthStore();
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(!storedClasses);
  const [copiedClassCode, setCopiedClassCode] = useState<string | null>(null);

  const handleCopyClassCode = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopiedClassCode(text);
    toast.success("Đã sao chép", { description: text });
    setTimeout(() => setCopiedClassCode(null), 2000);
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [refreshNotifTrigger, setRefreshNotifTrigger] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [expandedClassIds, setExpandedClassIds] = useState<string[]>([]);
  const [detailedClasses, setDetailedClasses] = useState<ClassData[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [syncingClassId, setSyncingClassId] = useState<string | null>(null);

  const toggleClassExpand = (classId: string) => {
    setExpandedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  const teGroupedNotifications = useMemo(() => {
    const grouped: Record<
      string,
      {
        classId: string;
        className: string;
        isLate: boolean;
        slots: NotificationItem[];
      }
    > = {};

    notificationsList.forEach((item) => {
      if (!grouped[item.classId]) {
        grouped[item.classId] = {
          classId: item.classId,
          className: item.className,
          isLate: false,
          slots: [],
        };
      }
      grouped[item.classId].slots.push(item);
      if (item.isLate) grouped[item.classId].isLate = true;
    });

    const list = Object.values(grouped).sort((a, b) =>
      a.className.localeCompare(b.className),
    );

    return {
      lateClasses: list.filter((c) => c.isLate),
      ontimeClasses: list.filter((c) => !c.isLate),
      totalClasses: list.length,
    };
  }, [notificationsList]);

  const isFetchingAny = isLoading || isLoadingNotifications;
  const showLoadingAll = useMinLoading(isInitialLoad && isFetchingAny, 600);
  const showLoadingDetails = useMinLoading(isLoadingDetails, 600);
  const showLoadingNotifications = useMinLoading(
    isSyncing || isLoadingNotifications,
    600,
  );

  const classes = storedClasses || [];

  /* ── Stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const activeClasses = classes.filter(
      (c) => c.status !== "FINISHED" && c.status !== "ENDED",
    );
    return {
      totalClasses: classes.length,
      activeClasses: activeClasses.length,
      lateNotifications: teGroupedNotifications.lateClasses.length,
      ontimeNotifications: teGroupedNotifications.ontimeClasses.length,
    };
  }, [classes, teGroupedNotifications]);

  const activeClassIdsStr = useMemo(() => {
    return classes
      .filter((c) => c.status !== "FINISHED" && c.status !== "ENDED")
      .map((c) => c.id)
      .sort()
      .join(",");
  }, [classes]);

  /* ── Fetch class details for upcoming slots ───────────────── */
  useEffect(() => {
    let isMounted = true;
    const fetchClassDetails = async () => {
      const activeClasses = classes.filter(
        (c) => c.status !== "FINISHED" && c.status !== "ENDED",
      );
      if (activeClasses.length === 0) {
        setDetailedClasses([]);
        return;
      }
      setIsLoadingDetails(true);
      try {
        const classIds = activeClasses.map((c) => c.id);
        const data = await classService.getClassesDetails("", classIds);
        if (isMounted) setDetailedClasses(data || []);
      } catch (err) {
        console.error("[Dashboard] Error fetching class details:", err);
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    };
    fetchClassDetails();
    return () => {
      isMounted = false;
    };
  }, [activeClassIdsStr]);

  /* ── Upcoming slots (this week) ───────────────────────────── */
  const upcomingSlotsThisWeek = useMemo(() => {
    const slotsList: Array<{
      classId: string;
      className: string;
      date: string;
      startTime: string;
      endTime: string;
      sessionIndex?: number;
      slot: Slot;
      classItem: ClassData;
    }> = [];

    detailedClasses.forEach((cls) => {
      if (cls.status === "FINISHED" || cls.status === "ENDED") return;
      const slots = cls.slots || [];
      slots.forEach((slot) => {
        if (!slot.date) return;
        let parsedDate: Date;
        if (slot.date.includes("/")) {
          const parts = slot.date.split("/");
          parsedDate = new Date(
            parseInt(parts[2], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[0], 10),
          );
        } else {
          parsedDate = new Date(slot.date);
        }
        if (isNaN(parsedDate.getTime())) return;

        const extractTime = (timeStr: string): string => {
          if (!timeStr) return "00:00:00";
          try {
            const dateObj = new Date(
              timeStr.includes("T") ? timeStr : `2000-01-01T${timeStr}`,
            );
            if (isNaN(dateObj.getTime())) return "00:00:00";
            return `${String(dateObj.getHours()).padStart(2, "0")}:${String(
              dateObj.getMinutes(),
            ).padStart(2, "0")}:${String(dateObj.getSeconds()).padStart(2, "0")}`;
          } catch {
            return "00:00:00";
          }
        };

        const monday = new Date(weekStart);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const targetMidnight = new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate(),
        );

        if (targetMidnight >= monday && targetMidnight <= sunday) {
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
          const day = String(parsedDate.getDate()).padStart(2, "0");
          slotsList.push({
            classId: cls.id,
            className: cls.name,
            date: `${year}-${month}-${day}`,
            startTime: extractTime(slot.startTime),
            endTime: extractTime(slot.endTime),
            sessionIndex:
              slot.index !== undefined
                ? slot.index
                : (slot as any).sessionIndex,
            slot,
            classItem: cls,
          });
        }
      });
    });

    slotsList.sort((a, b) => {
      const da = new Date(a.date.includes("/") ? a.date.split("/").reverse().join("-") : a.date).getTime();
      const db = new Date(b.date.includes("/") ? b.date.split("/").reverse().join("-") : b.date).getTime();
      if (da !== db) return da - db;
      const toMin = (t: string) => {
        const p = t.split(":");
        return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
      };
      return toMin(a.startTime) - toMin(b.startTime);
    });

    return slotsList;
  }, [detailedClasses, weekStart]);

  useEffect(() => {
    if (!isLoading && !isLoadingNotifications) setIsInitialLoad(false);
  }, [isLoading, isLoadingNotifications]);

  /* ── Initial fetch ───────────────────────────────────────── */
  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async (force = false) => {
      const isTE = user?.appRoles?.includes("TE" as any);
      if (!isAuthenticated || (!user?.teacherId && !isTE)) {
        setIsLoading(false);
        return;
      }
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
        const isKheim = isActualKhiemAccount(user);
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
          "",
          user?.teacherId || "",
          targetCentres,
          user?.appRoles,
          {
            statusIn: [
              "RUNNING",
              "IN_PROGRESS",
              "ĐANG_DIỄN_RA",
              "OPEN",
              "PRE_OPEN",
              "PREPARING",
              "PENDING",
            ],
            limit: 1000,
          },
        );
        if (isMounted) setStoredClasses(data?.data || []);
      } catch (err: any) {
        setError("Không thể tải dữ liệu dashboard");
        console.error(
          "[Dashboard] Error detail:",
          err.response?.data || err.message,
        );
      } finally {
        if (isMounted) setIsLoading(false);
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

  /* ── Notifications ──────────────────────────────────────── */
  const [error, setError] = useState("");
  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      const isTE = user?.appRoles?.includes("TE" as any);
      if (!isAuthenticated || (!user?.teacherId && !isTE)) return;

      setIsLoadingNotifications(true);
      try {
        let targetCentres = user?.teacherCentres?.map((c: any) => c.id || c);
        const isKheim = isActualKhiemAccount(user);
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
          "",
          user?.teacherId || "",
          targetCentres,
          user?.appRoles,
          user?.email,
        );
        if (isMounted) setNotificationsList(data || []);
      } catch (err: any) {
        console.error("[Dashboard] Error fetching notifications:", err);
      } finally {
        if (isMounted) setIsLoadingNotifications(false);
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
    if (!isAuthenticated || !isTE) return;
    setIsSyncing(true);
    try {
      await classService.syncNotifications("", user?.appRoles);
      setRefreshNotifTrigger((prev) => prev + 1);
      toast.success("Đồng bộ thông báo thành công");
    } catch (err: any) {
      console.error("[Dashboard] Error syncing notifications:", err);
      toast.error("Lỗi đồng bộ", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendReminderEmails = async () => {
    const isTE = user?.appRoles?.includes("TE" as any);
    if (!isAuthenticated || !isTE) return;
    setIsSendingEmails(true);
    try {
      await classService.sendNotificationEmails("", user?.appRoles);
      toast.success("Đã gửi email nhắc nhở");
      setRefreshNotifTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error("[Dashboard] Error sending emails:", err);
      toast.error("Lỗi gửi email", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setIsSendingEmails(false);
    }
  };

  /* ── Render notification card ───────────────────────────── */
  const renderNotificationCard = (item: NotificationItem, index: number) => {
    const computedSessionIndex =
      item.sessionIndex !== undefined && item.sessionIndex !== null
        ? item.sessionIndex + 1
        : null;
    const examType = computedSessionIndex
      ? getSessionExamType(item.className, computedSessionIndex)
      : null;
    const examLabel = computedSessionIndex
      ? getSessionExamLabel(item.className, computedSessionIndex)
      : `Buổi ${(item.sessionIndex ?? index) + 1}`;

    const isCheckpoint =
      examType === "checkpoint1" || examType === "checkpoint2";

    return (
      <div
        key={`feedback-${index}`}
        className="rounded-lg border bg-card p-3 hover:bg-accent/30 transition-all"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">
                {item.className}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCopyClassCode(item.className)}
                    className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                  >
                    {copiedClassCode === item.className ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sao chép mã lớp</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {examLabel} · {formatSlotDateTime(item.date, item.startTime, item.endTime)}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            {item.isLate ? (
              <Badge variant="destructive" className="gap-1">
                <Clock className="h-3 w-3" />
                Trễ
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <Clock className="h-3 w-3" />
                Còn hạn
              </Badge>
            )}
            {isCheckpoint && (
              <Badge variant="info" className="text-[10px]">
                Checkpoint
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            Chưa nhận xét: <span className="font-semibold text-foreground">{item.studentCount}</span> học viên
          </span>
          {(item.lec || item.ta) && (
            <div className="flex gap-2 text-xs">
              {item.lec && (
                <span>
                  <span className="text-muted-foreground">LEC:</span>{" "}
                  <span className="font-medium">{item.lec}</span>
                </span>
              )}
              {item.ta && (
                <span>
                  <span className="text-muted-foreground">TA:</span>{" "}
                  <span className="font-medium">{item.ta}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderClassAccordionItem = (cls: any) => {
    const isExpanded = expandedClassIds.includes(cls.classId);
    return (
      <div
        key={cls.classId}
        className="rounded-lg border border-border overflow-hidden"
      >
        <button
          onClick={() => toggleClassExpand(cls.classId)}
          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium transition-colors ${
            isExpanded
              ? "bg-muted/50"
              : "hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                cls.isLate ? "bg-destructive" : "bg-success"
              }`}
            />
            <span className="truncate">{cls.className}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="font-mono">
              {cls.slots.length} buổi
            </Badge>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        {isExpanded && (
          <div className="p-2 space-y-2 bg-muted/20 border-t border-border">
            {cls.slots.map((slot: NotificationItem, sIdx: number) =>
              renderNotificationCard(slot, sIdx),
            )}
          </div>
        )}
      </div>
    );
  };

  const isTE = user?.appRoles?.includes("TE" as any);

  if (showLoadingAll) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Tổng quan"
        description="Theo dõi lịch học và các thông báo quan trọng của bạn"
        actions={
          isTE ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEmailModalOpen(true)}
                disabled={isSendingEmails || isLoadingNotifications}
              >
                <Mail className="h-4 w-4" />
                Gửi email nhắc nhở
              </Button>
              <Button
                size="sm"
                onClick={() => setIsSyncModalOpen(true)}
                disabled={isSyncing || isLoadingNotifications}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                />
                Đồng bộ ngay
              </Button>
            </div>
          ) : null
        }
      />

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Lớp đang hoạt động"
          value={stats.activeClasses}
          icon={<CalendarDays className="h-4 w-4" />}
          variant="primary"
          description={`Tổng ${stats.totalClasses} lớp`}
        />
        <StatCard
          label="Buổi cần nhận xét"
          value={stats.lateNotifications + stats.ontimeNotifications}
          icon={<Inbox className="h-4 w-4" />}
          variant="info"
          description={`${stats.ontimeNotifications} còn hạn`}
        />
        <StatCard
          label="Trễ nhận xét"
          value={stats.lateNotifications}
          icon={<AlertCircle className="h-4 w-4" />}
          variant="destructive"
          description="Cần xử lý ngay"
        />
        <StatCard
          label="Đúng hạn"
          value={stats.ontimeNotifications}
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="success"
          description="Trong 48h"
        />
      </div>

      {/* ── Main grid ─────────────────────────────────────── */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-12">
        <Card className="col-span-1 xl:col-span-8 overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Lịch học tuần này
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {calendarTitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border border-border bg-card overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none"
                  onClick={handlePrev}
                  aria-label="Tuần trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 rounded-none border-x border-border"
                  onClick={handleToday}
                >
                  Hôm nay
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none"
                  onClick={handleNext}
                  aria-label="Tuần sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showLoadingDetails ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <WeeklyScheduleList
                slots={upcomingSlotsThisWeek}
                weekStart={weekStart}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Notifications panel ──────────────────────── */}
        <Card className="col-span-1 xl:col-span-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Thông báo nhận xét
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Các buổi cần chấm điểm
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Layers className="h-4 w-4" />
                    {teGroupedNotifications.totalClasses}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tổng lớp</span>
                    <span className="font-semibold">
                      {teGroupedNotifications.totalClasses}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trễ hạn</span>
                    <span className="font-semibold text-destructive">
                      {teGroupedNotifications.lateClasses.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Còn hạn</span>
                    <span className="font-semibold text-success">
                      {teGroupedNotifications.ontimeClasses.length}
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {showLoadingNotifications ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : notificationsList.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-7 w-7 text-success" />}
                title="Tất cả đã xong!"
                description="Không có buổi học nào cần chấm điểm."
              />
            ) : isTE ? (
              <>
                {teGroupedNotifications.lateClasses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                        Trễ nhận xét
                      </span>
                      <Badge variant="destructive" className="text-[10px]">
                        {teGroupedNotifications.lateClasses.length}
                      </Badge>
                    </div>
                    {teGroupedNotifications.lateClasses.map((cls) =>
                      renderClassAccordionItem(cls),
                    )}
                  </div>
                )}
                {teGroupedNotifications.ontimeClasses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-warning">
                        Còn hạn (48h)
                      </span>
                      <Badge variant="warning" className="text-[10px]">
                        {teGroupedNotifications.ontimeClasses.length}
                      </Badge>
                    </div>
                    {teGroupedNotifications.ontimeClasses.map((cls) =>
                      renderClassAccordionItem(cls),
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {notificationsList.map((item, index) =>
                  renderNotificationCard(item, index),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialogs ──────────────────────────────────────── */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gửi email nhắc nhở</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ gửi email nhắc nhở chấm điểm đến những giáo viên có lớp
              học cần chấm điểm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setIsEmailModalOpen(false);
                handleSendReminderEmails();
              }}
              disabled={isSendingEmails}
            >
              {isSendingEmails ? "Đang gửi..." : "Gửi email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đồng bộ thông báo</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ đồng bộ lại thông báo từ LMS. Quá trình này có thể mất
              một chút thời gian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncModalOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setIsSyncModalOpen(false);
                handleSyncNotifications();
              }}
              disabled={isSyncing}
            >
              {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
