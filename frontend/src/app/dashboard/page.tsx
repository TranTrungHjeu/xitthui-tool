"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ChevronLeft,
} from "lucide-react"; // Removed ChevronsLeft, ChevronsRight as they are not used
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
import {
  isKhiemAccount,
  isActualKhiemAccount,
  getRelativeDateString,
  formatSlotDateTime,
} from "@/lib/utils";
import { ClassData, Slot, Attendance } from "@/types";
import { getSessionExamType, getSessionExamLabel } from "@/lib/courseConfig";
import WeeklyScheduleCalendar from "@/components/WeeklyScheduleCalendar";
import { CalendarApi } from "@fullcalendar/core"; // CalendarApi is from @fullcalendar/core
import FullCalendar from "@fullcalendar/react"; // FullCalendar component for useRef type
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; // Make sure this path is correct

export default function DashboardOverview() {
  const calendarRef = useRef<FullCalendar | null>(null); // FullCalendar type for ref
  const [calendarTitle, setCalendarTitle] = useState("");
  const [currentView, setCurrentView] = useState("timeGridWeek"); // default view

  const handleDatesSet = (dateInfo: any) => {
    setCalendarTitle(dateInfo.view.title);
    setCurrentView(dateInfo.view.type);
  };

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
  };

  const handleViewChange = (viewName: string) => {
    if (viewName) {
      calendarRef.current?.getApi().changeView(viewName);
      setCurrentView(viewName);
    }
  };

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
  const [copiedClassCode, setCopiedClassCode] = useState<string | null>(null);

  const handleCopyClassCode = (className: string) => {
    navigator.clipboard.writeText(className).catch(() => {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = className;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopiedClassCode(className);
    setTimeout(() => setCopiedClassCode(null), 2000);
  };
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [refreshNotifTrigger, setRefreshNotifTrigger] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState("");
  const [selectedEventSlots, setSelectedEventSlots] = useState<any[] | null>(null);
  const [isClassDetailModalOpen, setIsClassDetailModalOpen] = useState(false);
  const [syncingClassId, setSyncingClassId] = useState<string | null>(null);

  const [isTeListExpanded, setIsTeListExpanded] = useState(false);
  const [expandedClassIds, setExpandedClassIds] = useState<string[]>([]);
  const [detailedClasses, setDetailedClasses] = useState<ClassData[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const getTeacherNamesByRoleForSlot = (
    slot: any,
    classTeachers: any[],
    roleShortName: "LEC" | "TA",
  ) => {
    const slotTeachers = slot.teachers || [];
    const matchedSlotTeachers = slotTeachers.filter(
      (t: any) => t.role?.shortName === roleShortName && t.isActive !== false,
    );
    if (matchedSlotTeachers.length > 0) {
      return matchedSlotTeachers
        .map((t: any) => t.teacher?.fullName)
        .filter(Boolean)
        .join(", ");
    }
    const matchedClassTeachers = classTeachers.filter(
      (t: any) => t.role?.shortName === roleShortName && t.isActive !== false,
    );
    if (matchedClassTeachers.length > 0) {
      return matchedClassTeachers
        .map((t: any) => t.teacher?.fullName)
        .filter(Boolean)
        .join(", ");
    }
    return null;
  };

  const toggleClassExpand = (classId: string) => {
    setExpandedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  const teGroupedNotifications = useMemo(() => {
    const grouped: {
      [classId: string]: {
        classId: string;
        className: string;
        isLate: boolean;
        slots: Array<{
          date: string;
          startTime?: string;
          endTime?: string;
          sessionIndex?: number;
          studentCount: number;
          isLate: boolean;
          lec: string;
          ta: string;
          te: string;
        }>;
      };
    } = {};

    notificationsList.forEach((item) => {
      if (!grouped[item.classId]) {
        grouped[item.classId] = {
          classId: item.classId,
          className: item.className,
          isLate: false,
          slots: [],
        };
      }
      grouped[item.classId].slots.push({
        date: item.date,
        startTime: item.startTime || "",
        endTime: item.endTime || "",
        sessionIndex: item.sessionIndex,
        studentCount: item.studentCount,
        isLate: !!item.isLate,
        lec: item.lec || "",
        ta: item.ta || "",
        te: item.te || "",
      });
      if (item.isLate) {
        grouped[item.classId].isLate = true;
      }
    });

    const list = Object.values(grouped);
    list.sort((a, b) => a.className.localeCompare(b.className));

    const lateClasses = list.filter((c) => c.isLate);
    const ontimeClasses = list.filter((c) => !c.isLate);

    const totalClasses = list.length;

    return {
      lateClasses,
      ontimeClasses,
      totalClasses,
    };
  }, [notificationsList]);

  const renderClassAccordionItem = (cls: any) => {
    const isExpanded = expandedClassIds.includes(cls.classId);
    return (
      <div
        key={cls.classId}
        className="border border-slate-100 rounded-lg overflow-hidden shadow-sm"
      >
        {/* Class Row Header */}
        <div
          onClick={() => toggleClassExpand(cls.classId)}
          className={`cursor-pointer w-full flex items-center justify-between px-2.5 py-1.5 text-left font-semibold text-xs transition-colors duration-150 ${
            isExpanded
              ? "bg-slate-100 text-slate-800 border-b border-slate-200"
              : "bg-white hover:bg-slate-50 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                cls.isLate ? "bg-destructive" : "bg-accent"
              }`}
            />
            <span>{cls.className}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyClassCode(cls.className);
              }}
              className="p-1 rounded hover:bg-slate-100 transition-colors"
              title="Copy mã lớp"
            >
              {copiedClassCode === cls.className ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            )}
          </div>
        </div>

        {/* Slots Detail List */}
        {isExpanded && (
          <div className="bg-slate-50/70 p-2 space-y-1.5">
            {cls.slots.map((slot: any, sIdx: number) => {
              const computedSessionIndex =
                slot.sessionIndex !== undefined && slot.sessionIndex !== null
                  ? slot.sessionIndex + 1
                  : null;

              const examLabel = computedSessionIndex
                ? getSessionExamLabel(cls.className, computedSessionIndex)
                : `Buổi ${sIdx + 1}`;

              return (
                <div
                  key={sIdx}
                  className="p-2 rounded-lg border border-slate-200 bg-white space-y-2"
                >
                  <div className="flex items-start justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">
                        {examLabel}
                      </span>
                      <span className="text-slate-500 text-xs font-mono">
                        {formatSlotDateTime(
                          slot.date,
                          slot.startTime,
                          slot.endTime,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          slot.isLate
                            ? "bg-destructive/10 text-destructive"
                            : "bg-accent text-accent-foreground"
                        }`}
                      >
                        {slot.isLate ? "TRỄ" : "ĐÚNG HẠN"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground">
                        {slot.studentCount} HV
                      </span>
                    </div>
                  </div>

                  {(slot.lec || slot.te || slot.ta) && (
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-slate-200">
                      {slot.lec && (
                        <div className="text-xs">
                          <span className="font-semibold text-blue-700">
                            LEC:
                          </span>
                          <span className="text-slate-600 ml-1">
                            {slot.lec}
                          </span>
                        </div>
                      )}
                      {slot.te && (
                        <div className="text-xs">
                          <span className="font-semibold text-emerald-700">
                            TE:
                          </span>
                          <span className="text-slate-600 ml-1">{slot.te}</span>
                        </div>
                      )}
                      {slot.ta && (
                        <div className="text-xs">
                          <span className="font-semibold text-purple-700">
                            TA:
                          </span>
                          <span className="text-slate-600 ml-1">{slot.ta}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const isFetchingAny = isLoading || isLoadingNotifications;
  const showLoadingAll = useMinLoading(isInitialLoad && isFetchingAny, 1000);
  const showLoadingDetails = useMinLoading(isLoadingDetails, 1000);
  const showLoadingNotifications = useMinLoading(
    isSyncing || isLoadingNotifications,
    1000,
  );

  const classes = storedClasses || [];

  const activeClassIdsStr = useMemo(() => {
    return classes
      .filter((c) => c.status !== "FINISHED" && c.status !== "ENDED")
      .map((c) => c.id)
      .sort()
      .join(",");
  }, [classes]);

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
        if (isMounted) {
          setDetailedClasses(data || []);
        }
      } catch (err) {
        console.error("[Dashboard] Error fetching class details:", err);
      } finally {
        if (isMounted) {
          setIsLoadingDetails(false);
        }
      }
    };

    fetchClassDetails();

    return () => {
      isMounted = false;
    };
  }, [activeClassIdsStr]);

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

        // Helper to extract HH:MM:SS reliably
        const getHoursAndMinutesFromTime = (timeStr: string): string => {
          if (!timeStr) return "00:00:00";
          try {
            let dateObj: Date;
            if (timeStr.includes("T")) {
              // Likely an ISO string already
              dateObj = new Date(timeStr);
            } else {
              // Assume it's just time part, prefix with a dummy date
              dateObj = new Date(`2000-01-01T${timeStr}`);
            }

            if (isNaN(dateObj.getTime())) {
              console.warn(
                `Could not parse time string for extraction: ${timeStr}`,
              );
              return "00:00:00"; // Fallback
            }

            const hours = String(dateObj.getHours()).padStart(2, "0");
            const minutes = String(dateObj.getMinutes()).padStart(2, "0");
            const seconds = String(dateObj.getSeconds()).padStart(2, "0");
            return `${hours}:${minutes}:${seconds}`;
          } catch (e) {
            console.warn(
              `Error processing time string ${timeStr} for extraction:`,
              e,
            );
            return "00:00:00";
          }
        };

        const now = new Date();
        const currentDay = now.getDay();
        const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + mondayDiff,
        );
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + 6,
        );
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
          const formattedDate = `${year}-${month}-${day}`;
          slotsList.push({
            classId: cls.id,
            className: cls.name,
            date: formattedDate, // Use the consistently formatted date
            startTime: getHoursAndMinutesFromTime(slot.startTime),
            endTime: getHoursAndMinutesFromTime(slot.endTime),
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
      let dateA: Date;
      if (a.date.includes("/")) {
        const parts = a.date.split("/");
        dateA = new Date(
          parseInt(parts[2], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[0], 10),
        );
      } else {
        dateA = new Date(a.date);
      }

      let dateB: Date;
      if (b.date.includes("/")) {
        const parts = b.date.split("/");
        dateB = new Date(
          parseInt(parts[2], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[0], 10),
        );
      } else {
        dateB = new Date(b.date);
      }

      const timeDiff = dateA.getTime() - dateB.getTime();
      if (timeDiff !== 0) return timeDiff;

      const getHoursAndMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        if (timeStr.includes("T")) {
          const d = new Date(timeStr);
          return d.getHours() * 60 + d.getMinutes();
        }
        const parts = timeStr.split(":");
        return (
          (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)
        );
      };

      return getHoursAndMinutes(a.startTime) - getHoursAndMinutes(b.startTime);
    });

    return slotsList;
  }, [detailedClasses]);

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
          "", // token is handled by interceptor
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

  const handleSyncClassDetails = async (classId: string) => {
    if (!classId) return;
    setSyncingClassId(classId);
    try {
      const updatedClass = await classService.getClassById("", classId, true);
      if (updatedClass) {
        setDetailedClasses((prev) =>
          prev.map((c) => (c.id === classId ? updatedClass : c))
        );
        if (selectedEventSlots) {
          setSelectedEventSlots((prevSlots) => {
            if (!prevSlots) return null;
            return prevSlots.map((slot) => {
              if (slot.classId === classId) {
                const updatedSlot = updatedClass.slots?.find(
                  (s: any) => s.index === slot.sessionIndex
                );
                return {
                  ...slot,
                  classItem: updatedClass,
                  slot: updatedSlot || slot.slot,
                };
              }
              return slot;
            });
          });
        }
      }
    } catch (err: any) {
      console.error("[Dashboard] Error syncing class details:", err);
      alert("Lỗi khi đồng bộ chi tiết lớp học: " + (err.response?.data?.error || err.message));
    } finally {
      setSyncingClassId(null);
    }
  };

  const handleCalendarEventClick = (aggregatedSlots: any[]) => {
    setSelectedEventSlots(aggregatedSlots);
    setIsClassDetailModalOpen(true);
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
      <div className="p-4 sm:p-6 space-y-6 max-w-full mx-auto">
        {/* Removed "Lịch dạy" and date info from here as per user request. */}
        {/* <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              Lịch dạy
            </h1>
            <p className="text-muted-foreground text-sm">
              Tuần này, {formatVietnameseDate(new Date())}
            </p>
          </div>
        </div> */}

        <div className="grid gap-6 grid-cols-1 xl:grid-cols-12">
          <main className="col-span-1 xl:col-span-9">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-0">
                {" "}
                {/* Removed duplicate CardHeader */}
                <div className="flex flex-col">
                  <CardTitle className="text-xl font-bold">Lịch học</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {calendarTitle}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    className="h-8 px-2"
                    title="Tuần trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="h-8 px-3"
                    title="Hôm nay"
                  >
                    Hôm nay
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 px-2"
                    title="Tuần tới"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={currentView}
                    onValueChange={handleViewChange}
                    className="ml-4"
                  >
                    <ToggleGroupItem
                      value="dayGridMonth"
                      aria-label="Xem theo tháng"
                      className="h-8 px-3 text-xs"
                    >
                      Tháng
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="timeGridWeek"
                      aria-label="Xem theo tuần"
                      className="h-8 px-3 text-xs"
                    >
                      Tuần
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="timeGridDay"
                      aria-label="Xem theo ngày"
                      className="h-8 px-3 text-xs"
                    >
                      Ngày
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0.5">
                {showLoadingDetails ? (
                  <div className="flex items-center justify-center py-10">
                    <CatLoader />
                  </div>
                ) : upcomingSlotsThisWeek.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Không có lớp học nào có lịch trong tuần này
                  </p>
                ) : (
                  <WeeklyScheduleCalendar
                    ref={calendarRef}
                    slots={upcomingSlotsThisWeek}
                    onDatesSet={handleDatesSet}
                  />
                )}
              </CardContent>
            </Card>
          </main>

          <aside className="col-span-1 xl:col-span-3">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="flex flex-col justify-between gap-2 p-4 pb-2">
                <div>
                  <CardTitle className="text-base font-bold">
                    Thông báo
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Các hoạt động cần xử lý
                  </CardDescription>
                </div>
                {user?.appRoles?.includes("TE" as any) && (
                  <div className="flex items-center gap-2 self-start">
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
              <CardContent className="p-4 pt-0">
                {showLoadingNotifications ? (
                  <div className="flex items-center justify-center py-10">
                    <CatLoader />
                  </div>
                ) : notificationsList.length > 0 ? (
                  user?.appRoles?.includes("TE" as any) ? (
                    /* TE Accordion Layout */
                    <div className="space-y-2">
                      {/* Summary Button */}
                      <button
                        onClick={() => setIsTeListExpanded(!isTeListExpanded)}
                        className={`w-full flex items-center justify-between p-2.5 border rounded-md transition-all duration-200 text-left font-semibold text-xs ${
                          teGroupedNotifications.lateClasses.length > 0
                            ? "bg-red-50 border-red-200 hover:bg-red-100 text-red-800"
                            : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span className="font-bold">
                            Lớp chưa nhận xét:{" "}
                            {teGroupedNotifications.totalClasses}
                            <span className="font-normal">
                              {" "}
                              (Trễ: {
                                teGroupedNotifications.lateClasses.length
                              }{" "}
                              | Còn hạn:{" "}
                              {teGroupedNotifications.ontimeClasses.length})
                            </span>
                          </span>
                        </div>
                        {isTeListExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                      </button>

                      {/* Class List Accordion */}
                      {isTeListExpanded && (
                        <div className="space-y-4 pl-1 transition-all duration-300">
                          {/* SECTION 1: TRỄ NHẬN XÉT */}
                          {teGroupedNotifications.lateClasses.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-destructive uppercase tracking-wider pl-1">
                                Trễ nhận xét (
                                {teGroupedNotifications.lateClasses.length})
                              </div>
                              <div className="space-y-2">
                                {teGroupedNotifications.lateClasses.map((cls) =>
                                  renderClassAccordionItem(cls),
                                )}
                              </div>
                            </div>
                          )}

                          {/* SECTION 2: CÒN HẠN (TRONG 48H) */}
                          {teGroupedNotifications.ontimeClasses.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-accent-foreground uppercase tracking-wider pl-1">
                                Còn hạn (trong 48h) (
                                {teGroupedNotifications.ontimeClasses.length})
                              </div>
                              <div className="space-y-2">
                                {teGroupedNotifications.ontimeClasses.map(
                                  (cls) => renderClassAccordionItem(cls),
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Teacher Flat List Layout */
                    <div className="space-y-3">
                      {notificationsList.map((item, index) => {
                        const computedSessionIndex =
                          item.sessionIndex !== undefined &&
                          item.sessionIndex !== null
                            ? item.sessionIndex + 1
                            : null;

                        const examType = computedSessionIndex
                          ? getSessionExamType(
                              item.className,
                              computedSessionIndex,
                            )
                          : null;
                        const examLabel = computedSessionIndex
                          ? getSessionExamLabel(
                              item.className,
                              computedSessionIndex,
                            )
                          : `Buổi ${item.sessionIndex + 1 || index + 1}`;

                        let cardStyle = "";
                        if (examType) {
                          const borderClass =
                            examType === "checkpoint1" ||
                            examType === "checkpoint2"
                              ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                              : "border-accent/20 bg-accent/5 hover:bg-accent/10";
                          cardStyle = `p-3 rounded-lg border ${borderClass} flex flex-col gap-2 transition-all shadow-sm`;
                        } else {
                          cardStyle = `p-3 rounded-lg border ${
                            item.isLate
                              ? "bg-destructive/10 border-destructive/20 hover:bg-destructive/20"
                              : "bg-accent/50 border-accent/60 hover:bg-accent/70"
                          } flex flex-col gap-2 transition-all shadow-sm`;
                        }

                        return (
                          <div key={`feedback-${index}`} className={cardStyle}>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 text-[13.5px]">
                                    {item.className}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleCopyClassCode(item.className)
                                    }
                                    className="p-0.5 rounded hover:bg-slate-100 transition-colors flex-shrink-0"
                                    title="Copy m\u00e3 l\u1edbp"
                                  >
                                    {copiedClassCode === item.className ? (
                                      <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                                <span className="text-[11.5px] text-slate-500 font-mono">
                                  {examLabel} -{" "}
                                  {formatSlotDateTime(
                                    item.date,
                                    item.startTime,
                                    item.endTime,
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.isLate
                                      ? "bg-red-50 text-red-700 border border-red-200/60"
                                      : "bg-amber-50 text-amber-700 border border-amber-200/60"
                                  }`}
                                >
                                  {item.isLate ? "Trễ" : "Còn hạn"}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200/60">
                                  Chưa nhận xét: {item.studentCount} học viên
                                </span>
                              </div>
                            </div>

                            {/* LEC / TA tags */}
                            {(item.lec || item.ta) && (
                              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100/60">
                                {item.lec && (
                                  <div className="inline-flex items-center gap-1 bg-blue-50/60 border border-blue-100/60 px-2 py-0.5 rounded text-[10px]">
                                    <span className="font-semibold text-blue-700">
                                      LEC:
                                    </span>
                                    <span className="text-slate-600 font-medium">
                                      {item.lec}
                                    </span>
                                  </div>
                                )}
                                {item.ta && (
                                  <div className="inline-flex items-center gap-1 bg-purple-50/60 border border-purple-100/60 px-2 py-0.5 rounded text-[10px]">
                                    <span className="font-semibold text-purple-700">
                                      TA:
                                    </span>
                                    <span className="text-slate-600 font-medium">
                                      {item.ta}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Không có buổi học nào cần chấm điểm
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
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
