"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useAuthStore } from "../../../store/useAuthStore";
import { teacherService } from "../../../services/teacherService";
import { isActualKhiemAccount } from "../../../lib/utils";
import { extractHHMM, extractDatePart } from "../../../lib/date";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "../../../components/ui/dropdown-menu";
import {
  Loader2,
  Search,
  CalendarClock,
  Calendar,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  startOfWeek,
  endOfWeek,
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import { TeacherScheduleModal } from "../../../components/TeacherScheduleModal";
import CatLoader from "../../../components/CatLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { PageHeader } from "../../../components/ui/page-header";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";

interface Schedule {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  teacherRole?: string;
  classSite?: {
    class?: { name: string; numberOfSessions?: number };
    centre?: { id?: string; name: string };
  };
  officeHour?: {
    type: string;
    centre?: { id?: string; name: string };
  };
}

interface Teacher {
  id: string;
  fullName: string;
  code: string;
}

function CustomDatePicker({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  // Dùng locale vi cho phần tháng nếu cần, hoặc tự format
  const monthName = format(currentMonth, "MMMM, yyyy", { locale: vi });

  return (
    <div className="p-3 bg-card rounded-xl shadow-xl border border-border w-[280px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground capitalize">
          {monthName}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-[11px] font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(day);
                onClose();
              }}
              className={`h-8 w-8 rounded-md flex items-center justify-center text-xs transition-colors
                ${!isCurrentMonth ? "text-muted-foreground/70" : "text-foreground hover:bg-muted"}
                ${isSelected ? "bg-primary text-white hover:bg-primary/90 font-bold shadow-sm" : ""}
                ${isToday && !isSelected ? "text-primary font-bold bg-primary/10" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const { token, user } = useAuthStore();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hiddenTeacherIds, setHiddenTeacherIds] = useState<Set<string>>(
    new Set(),
  );

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [hideTeachersWithoutSchedules, setHideTeachersWithoutSchedules] =
    useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
  
  // Highlight row/column selection for comparison
  const [selectedHighlightTeacherId, setSelectedHighlightTeacherId] = useState<string | null>(null);
  const [selectedHighlightSlot, setSelectedHighlightSlot] = useState<string | null>(null);

  // Reset highlights on week change
  useEffect(() => {
    setSelectedHighlightTeacherId(null);
    setSelectedHighlightSlot(null);
  }, [selectedDate]);

  const handleCellClick = (teacherId: string, slot: string) => {
    if (selectedHighlightTeacherId === teacherId && selectedHighlightSlot === slot) {
      setSelectedHighlightTeacherId(null);
      setSelectedHighlightSlot(null);
    } else {
      setSelectedHighlightTeacherId(teacherId);
      setSelectedHighlightSlot(slot);
    }
  };

  const handleTeacherClick = (teacherId: string) => {
    if (selectedHighlightTeacherId === teacherId && selectedHighlightSlot === null) {
      setSelectedHighlightTeacherId(null);
    } else {
      setSelectedHighlightTeacherId(teacherId);
      setSelectedHighlightSlot(null);
    }
  };

  const handleHeaderClick = (slot: string) => {
    if (selectedHighlightSlot === slot && selectedHighlightTeacherId === null) {
      setSelectedHighlightSlot(null);
    } else {
      setSelectedHighlightSlot(slot);
      setSelectedHighlightTeacherId(null);
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showLoading = useMinLoading(isLoading, 1000);

  const teacherCentreIds = useMemo(() => {
    const centres = user?.teacherCentres;
    if (!Array.isArray(centres) || centres.length === 0) {
      return ["6443460f94300678908f7974"];
    }

    let resolvedCentres = centres
      .map((centre) => (typeof centre === "string" ? centre : centre.id))
      .filter(Boolean);

    // Limit to "Thủ Dầu Một" center if it is the master account of TE Khiêm
    if (isActualKhiemAccount(user)) {
      const tdmCentre = centres.find((c: any) => {
        const name = typeof c === "object" ? c?.name || c?.shortName : String(c);
        return (name || "").toLowerCase().includes("thủ dầu một");
      });
      if (tdmCentre) {
        const id = typeof tdmCentre === "object" ? tdmCentre.id : tdmCentre;
        resolvedCentres = [id];
      }
    }

    return resolvedCentres;
  }, [user]);

  useEffect(() => {
    const loadVisibilityPrefs = async () => {
      if (!user?.id) return;
      try {
        const res = await teacherService.getTeacherVisibility(user.id);
        if (res.success && res.preferences?.hiddenTeacherIds) {
          setHiddenTeacherIds(new Set(res.preferences.hiddenTeacherIds));
        }
      } catch (err) {
        console.warn("Failed to load visibility preferences:", err);
      }
    };
    loadVisibilityPrefs();
  }, [user?.id]);

  const fetchSchedulesForDate = async (date: Date, forceRefresh = false) => {
    if (!token) return;

    const timer = setTimeout(() => {
      setIsLoading(true);
      setError(null);
    }, 0);

    try {
      const monday = startOfWeek(date, { weekStartsOn: 1 });
      const sunday = endOfWeek(date, { weekStartsOn: 1 });

      const dateGte = monday.toISOString();
      const dateLte = sunday.toISOString();

      const teachersRes = await teacherService.getTeachers(
        token,
        teacherCentreIds,
      );
      if (!teachersRes.success) {
        throw new Error(teachersRes.error || "Lỗi lấy danh sách nhân sự.");
      }

      const fetchedTeachers: Teacher[] = teachersRes.data || [];
      setTeachersList(fetchedTeachers);

      const teacherIds = fetchedTeachers.map((t) => t.id);

      if (teacherIds.length === 0) {
        setSchedules([]);
        return;
      }

      const schedulesRes = await teacherService.getTeacherSchedules(
        token,
        teacherIds,
        dateGte,
        dateLte,
        forceRefresh,
      );
      if (schedulesRes.success) {
        setSchedules(schedulesRes.data || []);
      } else {
        throw new Error(schedulesRes.error || "Lỗi lấy lịch làm việc.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi kết nối.";
      setError(message);
    } finally {
      clearTimeout(timer);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(e.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchSchedulesForDate(selectedDate);
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, teacherCentreIds, selectedDate]);

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
  };

  const handleRefresh = () => {
    fetchSchedulesForDate(selectedDate, true);
  };

  const handlePrevWeek = () => {
    const newDate = addDays(selectedDate, -7);
    setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addDays(selectedDate, 7);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const toggleTeacherVisibility = async (teacherId: string) => {
    const newHidden = new Set(hiddenTeacherIds);
    if (newHidden.has(teacherId)) {
      newHidden.delete(teacherId);
    } else {
      newHidden.add(teacherId);
    }
    setHiddenTeacherIds(newHidden);

    if (user?.id) {
      try {
        await teacherService.saveTeacherVisibility(
          user.id,
          Array.from(newHidden),
        );
      } catch (err) {
        console.error("Failed to save visibility preference:", err);
      }
    }
  };

  const showAllTeachers = async () => {
    setHiddenTeacherIds(new Set());
    if (user?.id) {
      try {
        await teacherService.saveTeacherVisibility(user.id, []);
      } catch (err) {
        console.error("Failed to save visibility preference:", err);
      }
    }
  };

  const hideAllTeachers = async () => {
    const allHidden = new Set(teachersList.map((t) => t.id));
    setHiddenTeacherIds(allHidden);
    if (user?.id) {
      try {
        await teacherService.saveTeacherVisibility(
          user.id,
          Array.from(allHidden),
        );
      } catch (err) {
        console.error("Failed to save visibility preference:", err);
      }
    }
  };

  const getLocalDate = (sch: Schedule) => {
    try {
      // Extract date part directly to avoid timezone date-shift issues (+08:00 string near midnight)
      if (sch.startTime && sch.startTime.includes("T")) {
        return extractDatePart(sch.startTime);
      }
      if (sch.date) {
        return extractDatePart(sch.date);
      }
      return "";
    } catch {
      return sch.date || "";
    }
  };

  const getLocalTime = (timeStr: string) => {
    if (!timeStr) return "";
    // Extract HH:mm directly — avoids timezone offset issues (+08:00 vs +07:00 from MindX)
    const hhmm = extractHHMM(timeStr);
    if (hhmm) return `${String(hhmm.hours).padStart(2, "0")}:${String(hhmm.minutes).padStart(2, "0")}`;
    return "";
  };

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    // Extract HH:mm directly — no timezone conversion
    const hhmm = extractHHMM(timeStr);
    if (hhmm) return hhmm.hours * 60 + hhmm.minutes;
    return 0;
  };

  const getShortClassName = (name: string): string => {
    if (!name) return "";
    return name
      .replace(/^(TDM|DA|TA|SG|OL|HN|BH|HP|QN|VTH|NT|HĐ|NX)-/i, "") // Remove center prefix
      .replace(/^(C4K|ROB|ART)-/i, ""); // Remove division prefix
  };

  const getShortCentreName = (name: string): string => {
    if (!name) return "";
    const lower = name.toLowerCase();
    if (lower.includes("thuận an")) return "TA";
    if (lower.includes("thủ dầu một")) return "TDM";
    if (lower.includes("dĩ an")) return "DA";
    if (lower.includes("online")) return "OL";
    if (lower.includes("song hành")) return "SH";
    if (lower.includes("hà đông")) return "HĐ";
    if (lower.includes("nguyễn trãi")) return "NT";
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase();
  };

  const getShortTeacherName = (fullName: string): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(-2).join(" ");
  };

  const centerSchedules = useMemo(() => {
    return schedules.filter((s) => {
      return s.type === "CLASS_SESSION" || s.type === "OFFICE_HOURS";
    });
  }, [schedules]);

  const checkIsOtherCentre = (sch: Schedule) => {
    const scheduleCentreId =
      sch.classSite?.centre?.id || sch.officeHour?.centre?.id;
    return (
      !!scheduleCentreId &&
      teacherCentreIds.length > 0 &&
      !teacherCentreIds.includes(scheduleCentreId)
    );
  };

  const teachersWithSchedules = useMemo(() => {
    return new Set(centerSchedules.map((s) => s.teacherId));
  }, [centerSchedules]);

  const filteredTeachers = teachersList.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
    );
  });

  const displayedTeachers = filteredTeachers.filter((t) => {
    if (hiddenTeacherIds.has(t.id)) return false;
    if (hideTeachersWithoutSchedules) {
      return teachersWithSchedules.has(t.id);
    }
    return true;
  });

  const visibleTeachersCount = teachersList.filter((t) => {
    if (hiddenTeacherIds.has(t.id)) return false;
    if (hideTeachersWithoutSchedules) {
      return teachersWithSchedules.has(t.id);
    }
    return true;
  }).length;

  const activeTeacherIds = new Set(displayedTeachers.map((t) => t.id));
  const relevantSchedules = centerSchedules.filter((s) =>
    activeTeacherIds.has(s.teacherId),
  );

  const uniqueSlotsSet = new Set<string>();
  relevantSchedules.forEach((sch) => {
    const localDate = getLocalDate(sch);
    const startLocalTime = getLocalTime(sch.startTime);
    const endLocalTime = getLocalTime(sch.endTime);
    if (localDate && startLocalTime) {
      uniqueSlotsSet.add(`${localDate}_${startLocalTime}`);
    }
    if (localDate && endLocalTime) {
      uniqueSlotsSet.add(`${localDate}_${endLocalTime}`);
    }
  });

  const sortedSlots = Array.from(uniqueSlotsSet).sort((a, b) => {
    const [dateA, timeA] = a.split("_");
    const [dateB, timeB] = b.split("_");
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return timeA.localeCompare(timeB);
  });

  const displayedSlots = useMemo(() => {
    return sortedSlots;
  }, [sortedSlots]);

  const getColDuration = (colIdx: number) => {
    const currentSlot = displayedSlots[colIdx];
    if (!currentSlot) return 120;
    const [currentDate, currentStartStr] = currentSlot.split("_");
    const currentStart = timeToMinutes(currentStartStr);
    if (colIdx + 1 < displayedSlots.length) {
      const [nextDate, nextStartStr] = displayedSlots[colIdx + 1].split("_");
      if (nextDate === currentDate) {
        return timeToMinutes(nextStartStr) - currentStart;
      }
    }
    return 120; // Default 2 hours
  };

  const schedulesByTeacher: Record<string, Record<string, Schedule[]>> = {};
  relevantSchedules.forEach((sch) => {
    const localDate = getLocalDate(sch);
    const localTime = getLocalTime(sch.startTime);
    if (localDate && localTime) {
      const slot = `${localDate}_${localTime}`;

      if (!schedulesByTeacher[sch.teacherId]) {
        schedulesByTeacher[sch.teacherId] = {};
      }
      if (!schedulesByTeacher[sch.teacherId][slot]) {
        schedulesByTeacher[sch.teacherId][slot] = [];
      }
      schedulesByTeacher[sch.teacherId][slot].push(sch);
    }
  });

  const dayMap: Record<number, string> = {
    0: "CN",
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
  };

  const getDayHeaderBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const dayIndex = new Date(dateStr).getDay();
    switch (dayIndex) {
      case 1:
        return "bg-blue-100";
      case 2:
        return "bg-success/15";
      case 3:
        return "bg-warning/15";
      case 4:
        return "bg-purple-100";
      case 5:
        return "bg-pink-100";
      case 6:
        return "bg-orange-100";
      default:
        return "bg-muted";
    }
  };

  const getDayCellBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const dayIndex = new Date(dateStr).getDay();
    switch (dayIndex) {
      case 1:
        return "bg-blue-50/70";
      case 2:
        return "bg-success/10";
      case 3:
        return "bg-warning/10";
      case 4:
        return "bg-purple-50/70";
      case 5:
        return "bg-pink-50/70";
      case 6:
        return "bg-orange-50/70";
      default:
        return "bg-muted/50/70";
    }
  };

  const formatSlotHeader = (slotKey: string) => {
    const [dateStr, timeStr] = slotKey.split("_");
    try {
      const parts = dateStr.split("-");
      const dateObj = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
      );
      const dayLabel = dayMap[dateObj.getDay()];
      const displayDay = dayLabel.replace("Thứ ", "T");
      const dateDisplay = format(dateObj, "dd/MM");
      return (
        <div className="flex flex-col items-center leading-none whitespace-nowrap gap-0.5">
          <span className="font-semibold text-[8px] md:text-[9px] text-foreground">
            {displayDay} - {dateDisplay}
          </span>
          <span className="text-[8px] md:text-[9px] text-foreground font-mono font-bold">{timeStr}</span>
        </div>
      );
    } catch {
      return <span>{slotKey}</span>;
    }
  };

  const getScheduleStyle = (sch: Schedule) => {
    if (checkIsOtherCentre(sch)) {
      return "bg-muted text-muted-foreground border-border/80";
    }

    const titleLower = (sch.title || "").toLowerCase();

    if (sch.type === "OFFICE_HOURS") {
      return "bg-warning text-foreground border-warning";
    }

    if (sch.type === "AVAILABLE") {
      return "bg-success text-foreground border-success";
    }

    if (sch.type === "CLASS_SESSION") {
      if (titleLower.includes("checkpoint")) {
        return "bg-purple-200 text-purple-900 border-purple-300";
      }
      if (titleLower.includes("demo")) {
        return "bg-blue-200 text-blue-900 border-blue-300";
      }
      return "bg-orange-400 text-foreground border-orange-500";
    }

    return "bg-muted text-foreground border-border";
  };

  const getSessionShortName = (sch: Schedule) => {
    if (sch.type === "OFFICE_HOURS") return "OFFICE";
    if (!sch.title) return sch.type;

    let info = sch.title;
    if (sch.classSite?.class?.name) {
      info = info.replace(sch.classSite.class.name, "");
    }
    // Remove leading/trailing dashes, colons, and spaces
    info = info.replace(/^[\s-:]+|[\s-:]+$/g, "");
    // Standardize "buổi X/Y" to "Buổi X"
    info = info.replace(/buổi\s*(\d+)(?:\/\d+)?/i, "Buổi $1");

    return info || "Session";
  };

  const renderRoleBadge = (role?: string) => {
    if (!role) return null;
    const upper = role.toUpperCase();
    let label = role;
    let bgClass = "bg-muted text-foreground border-border";

    if (upper === "LEC" || upper === "LECTURER") {
      label = "GV";
      bgClass = "bg-orange-100 text-orange-700 border-orange-200";
    } else if (upper === "TA" || upper === "TEACHING_ASSISTANT") {
      label = "TG";
      bgClass = "bg-blue-100 text-blue-700 border-blue-200";
    } else if (upper === "EXAMINER" || upper === "EXAM" || upper === "GK" || upper === "JUDGE" || upper.includes("EXAM") || upper.includes("GK") || upper.includes("JUDGE")) {
      label = "GK";
      bgClass = "bg-purple-100 text-purple-700 border-purple-200";
    } else if (upper === "SUBSTITUTE" || upper === "COVER" || upper === "SUB" || upper === "SUPPLY" || upper.includes("SUB") || upper.includes("COVER") || upper.includes("SUPPLY")) {
      label = "DT";
      bgClass = "bg-destructive/15 text-destructive border-destructive/30";
    }

    return (
      <span className={`text-[8.5px] md:text-[9.5px] px-1 py-0.5 rounded-[4px] font-sans font-bold uppercase shrink-0 leading-none border ${bgClass}`}>
        {label}
      </span>
    );
  };

  const getScheduleTitle = (sch: Schedule) => {
    const centerName =
      sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "—";
    const start = getLocalTime(sch.startTime);
    const end = getLocalTime(sch.endTime);
    
    let roleName = sch.teacherRole;
    if (roleName) {
      const upper = roleName.toUpperCase();
      if (upper === "LEC" || upper === "LECTURER") roleName = "Giảng viên (GV)";
      else if (upper === "TA" || upper === "TEACHING_ASSISTANT") roleName = "Trợ giảng (TG)";
      else if (upper === "EXAMINER" || upper === "EXAM" || upper === "GK" || upper === "JUDGE" || upper.includes("EXAM") || upper.includes("GK") || upper.includes("JUDGE")) roleName = "Giám khảo (GK)";
      else if (upper === "SUBSTITUTE" || upper === "COVER" || upper === "SUB" || upper === "SUPPLY" || upper.includes("SUB") || upper.includes("COVER") || upper.includes("SUPPLY")) roleName = "Dạy thay (DT)";
    }
    const rolePart = roleName ? `\nVai trò: ${roleName}` : "";
    return `${start} - ${end}\nCơ sở: ${centerName}${rolePart}\nGhi chú: ${sch.description || sch.officeHour?.type || "—"}`;
  };

  const weekStr = `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")}`;

  return (
    <div className="p-3 sm:p-6 space-y-4 h-[calc(100vh-76px)] md:h-screen overflow-hidden flex flex-col">
      <PageHeader
        icon={CalendarClock}
        title="Lịch làm việc"
        description={isLoading ? "Đang tải..." : `Tuần: ${weekStr}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Tải lại</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Nhân sự ({visibleTeachersCount}/{teachersList.length})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-72 max-h-80 overflow-y-auto"
                align="end"
              >
                <DropdownMenuLabel>Chọn nhân sự hiển thị</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={hideTeachersWithoutSchedules}
                      onChange={(e) =>
                        setHideTeachersWithoutSchedules(e.target.checked)
                      }
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Chỉ hiện GV có lịch (trong cơ sở)</span>
                  </label>
                </div>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between p-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.preventDefault();
                      showAllTeachers();
                    }}
                  >
                    Hiện tất cả
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.preventDefault();
                      hideAllTeachers();
                    }}
                  >
                    Ẩn tất cả
                  </Button>
                </div>
                <DropdownMenuSeparator />
                {teachersList.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    Không có nhân sự nào
                  </div>
                ) : (
                  teachersList.map((teacher) => (
                    <DropdownMenuCheckboxItem
                      key={teacher.id}
                      checked={!hiddenTeacherIds.has(teacher.id)}
                      onCheckedChange={() => toggleTeacherVisibility(teacher.id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {teacher.fullName} {teacher.code ? `(${teacher.code})` : ""}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex flex-col gap-3">
        {/* Date Navigator and Search Row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
          {/* Week navigator */}
          <div className="flex items-center bg-card border border-border rounded-lg shadow-sm h-9 transition-all hover:border-border justify-between flex-1 sm:flex-none">
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-none rounded-l-lg"
              onClick={handlePrevWeek}
              title="Tuần trước"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div
              className="relative h-full border-x border-border flex-1 sm:flex-none"
              ref={datePickerRef}
            >
              <div
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className={`flex items-center justify-center gap-1.5 px-3 h-full hover:bg-muted/50 transition-colors cursor-pointer min-w-[110px] sm:min-w-[130px] select-none text-[11px] font-bold text-foreground ${isDatePickerOpen ? "bg-muted/50 ring-1 ring-primary/20" : ""}`}
              >
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{format(selectedDate, "dd/MM/yyyy")}</span>
              </div>

              {isDatePickerOpen && (
                <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50">
                  <CustomDatePicker
                    selectedDate={selectedDate}
                    onSelect={handleDateChange}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-none"
              onClick={handleNextWeek}
              title="Tuần tiếp theo"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <div className="h-full border-l border-border">
              <Button
                variant="ghost"
                className="h-full px-2 text-[10px] font-extrabold text-primary hover:bg-primary/10 rounded-none rounded-r-lg"
                onClick={handleToday}
              >
                H.Nay
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 sm:w-48 lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên giáo viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-full"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg shrink-0 border border-destructive/20">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden relative flex-1 flex flex-col">
        {showLoading && (
          <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center min-h-[60vh]">
            <CatLoader />
          </div>
        )}

        <div className="overflow-auto flex-1 custom-scrollbar no-vertical-scrollbar">
          <table className="w-max min-w-full border-collapse caption-bottom text-xs">
            <TableHeader className="sticky top-0 z-40 shadow-sm">
              <TableRow className="border-b-2 border-border">
                <TableHead
                  onClick={() => {
                    setSelectedHighlightTeacherId(null);
                    setSelectedHighlightSlot(null);
                  }}
                  className="sticky left-0 top-0 z-50 bg-muted min-w-[90px] max-w-[120px] md:min-w-[105px] md:max-w-[130px] border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-foreground font-semibold text-[10px] md:text-[11px] py-1 px-1.5 cursor-pointer select-none hover:bg-muted transition-colors"
                >
                  Giáo viên
                </TableHead>
                {displayedSlots.map((slot) => (
                  <TableHead
                    key={slot}
                    onClick={() => handleHeaderClick(slot)}
                    className={`sticky top-0 z-40 border-r border-border min-w-[70px] md:min-w-[72px] p-0.5 text-center cursor-pointer select-none transition-colors hover:bg-muted/80 ${
                      selectedHighlightSlot === slot 
                        ? "ring-2 ring-inset ring-destructive bg-destructive/10 text-destructive font-bold" 
                        : getDayHeaderBg(slot)
                    }`}
                  >
                    {formatSlotHeader(slot)}
                  </TableHead>
                ))}
                {displayedSlots.length === 0 && (
                  <TableHead className="bg-muted">Lịch trình</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayedTeachers.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={displayedSlots.length + 1}
                    className="text-center py-16 text-muted-foreground bg-card"
                  >
                    {search
                      ? "Không tìm thấy giáo viên nào."
                      : teachersList.length > 0 &&
                          hiddenTeacherIds.size === teachersList.length
                        ? "Tất cả giáo viên đã bị ẩn. Vui lòng chọn hiển thị giáo viên."
                        : "Không có dữ liệu giáo viên."}
                  </TableCell>
                </TableRow>
              ) : (
                displayedTeachers.map((teacher) => {
                  let skipCount = 0;
                  return (
                    <TableRow
                      key={teacher.id}
                      className="hover:bg-muted/30 group border-b border-border"
                    >
                      <TableCell
                        onClick={() => handleTeacherClick(teacher.id)}
                        className={`sticky left-0 z-30 group-hover:bg-muted/50 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium text-foreground p-1 align-middle whitespace-nowrap text-[9px] md:text-[10px] leading-none min-w-[90px] max-w-[120px] md:min-w-[105px] md:max-w-[130px] overflow-hidden truncate cursor-pointer transition-colors ${
                          selectedHighlightTeacherId === teacher.id
                            ? "bg-destructive/10 text-destructive font-bold ring-2 ring-inset ring-destructive"
                            : "bg-card"
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeacher(teacher);
                          }}
                          className="text-primary hover:text-primary hover:underline underline-offset-2 cursor-pointer font-semibold transition-colors"
                          title={`Xem lịch tuần của ${teacher.fullName}`}
                        >
                          {isMobile ? getShortTeacherName(teacher.fullName) : teacher.fullName}
                        </button>
                      </TableCell>

                      {displayedSlots.map((slot, colIndex) => {
                        if (skipCount > 0) {
                          skipCount--;
                          return null;
                        }

                        const cellSchedules =
                          schedulesByTeacher[teacher.id]?.[slot] || [];

                        // 1. Calculate cell colSpan based on schedules
                        const colSpan = cellSchedules.length > 0 ? (() => {
                          let maxSpan = 1;
                          cellSchedules.forEach((sch) => {
                            let actualEndMin = timeToMinutes(getLocalTime(sch.endTime));
                            const [slotDate] = slot.split("_");

                            // Extend end time if it matches a slot start
                            const isExactEndSlot = displayedSlots.some((s) => {
                              const [sDate, timeStr] = s.split("_");
                              return sDate === slotDate && timeToMinutes(timeStr) === actualEndMin;
                            });
                            if (isExactEndSlot) {
                              const slotIdx = displayedSlots.findIndex((s) => {
                                const [sDate, timeStr] = s.split("_");
                                return sDate === slotDate && timeToMinutes(timeStr) === actualEndMin;
                              });
                              if (slotIdx !== -1) {
                                actualEndMin += getColDuration(slotIdx);
                              }
                            }

                            let span = 1;
                            for (let idx = colIndex + 1; idx < displayedSlots.length; idx++) {
                              const [nextDate, nextTimeStr] = displayedSlots[idx].split("_");
                              if (nextDate !== slotDate) break;
                              const nextTimeMin = timeToMinutes(nextTimeStr);
                              if (actualEndMin > nextTimeMin) {
                                span++;
                              } else {
                                break;
                              }
                            }
                            if (span > maxSpan) maxSpan = span;
                          });
                          return maxSpan;
                        })() : 1;

                        if (colSpan > 1) {
                          skipCount = colSpan - 1;
                        }

                        // Calculate total duration for spanned columns
                        let totalDuration = 0;
                        for (let idx = colIndex; idx < colIndex + colSpan; idx++) {
                          totalDuration += getColDuration(idx);
                        }

                        return (
                          <TableCell
                            key={slot}
                            colSpan={colSpan}
                            onClick={() => handleCellClick(teacher.id, slot)}
                            className={`relative hover:z-[60] border-r border-border p-0 align-top cursor-pointer transition-all ${
                              colSpan === 1 ? "min-w-[70px] md:min-w-[72px]" : ""
                            } ${
                              selectedHighlightTeacherId === teacher.id && selectedHighlightSlot === slot
                                ? "bg-destructive/10 text-destructive font-bold ring-2 ring-inset ring-destructive z-20"
                                : selectedHighlightTeacherId === teacher.id
                                ? "bg-destructive/15 text-destructive font-bold"
                                : selectedHighlightSlot === slot
                                ? "bg-destructive/15 text-destructive font-bold"
                                : getDayCellBg(slot)
                            }`}
                          >
                            {cellSchedules.length > 0 ? (
                              <div className="flex flex-col w-full h-full gap-[1px]">
                                {cellSchedules.map((sch, i) => {
                                  const isOther = checkIsOtherCentre(sch);
                                  
                                  const actualStartMin = timeToMinutes(getLocalTime(sch.startTime));
                                  let actualEndMin = timeToMinutes(getLocalTime(sch.endTime));
                                  const [slotDate] = slot.split("_");
                                  
                                  // Extend end time if it matches a slot start
                                  const isExactEndSlot = displayedSlots.some((s) => {
                                    const [sDate, timeStr] = s.split("_");
                                    return sDate === slotDate && timeToMinutes(timeStr) === actualEndMin;
                                  });
                                  if (isExactEndSlot) {
                                    const slotIdx = displayedSlots.findIndex((s) => {
                                      const [sDate, timeStr] = s.split("_");
                                      return sDate === slotDate && timeToMinutes(timeStr) === actualEndMin;
                                    });
                                    if (slotIdx !== -1) {
                                      actualEndMin += getColDuration(slotIdx);
                                    }
                                  }

                                  // Coordinate transformation: calculate card position relative to equal-width columns
                                  const getXCoordinate = (timeMin: number) => {
                                    for (let colOffset = 0; colOffset < colSpan; colOffset++) {
                                      const currentIdx = colIndex + colOffset;
                                      const slotKey = displayedSlots[currentIdx];
                                      const [_, currentStartStr] = slotKey.split("_");
                                      const colStart = timeToMinutes(currentStartStr);
                                      const colDur = getColDuration(currentIdx);
                                      const colEnd = colStart + colDur;
                                      
                                      if (timeMin >= colStart && timeMin <= colEnd) {
                                        const posInCol = (timeMin - colStart) / colDur;
                                        return colOffset + posInCol;
                                      }
                                    }
                                    if (timeMin < timeToMinutes(slot.split("_")[1])) return 0;
                                    return colSpan;
                                  };

                                  const xStart = getXCoordinate(actualStartMin);
                                  const xEnd = getXCoordinate(actualEndMin);
                                  
                                  let leftPercent = (xStart / colSpan) * 100;
                                  let widthPercent = ((xEnd - xStart) / colSpan) * 100;
                                  if (leftPercent + widthPercent > 100) {
                                    widthPercent = 100 - leftPercent;
                                  }

                                  return (
                                    <div 
                                      key={i} 
                                      className="relative group/tooltip hover:z-[100] transition-all"
                                      style={{
                                        marginLeft: `${leftPercent}%`,
                                        width: `${widthPercent}%`
                                      }}
                                    >
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewingSchedule(sch);
                                        }}
                                        className={`w-full cursor-pointer overflow-hidden p-1.5 transition-all hover:brightness-95 rounded ${getScheduleStyle(sch)}`}
                                      >
                                        <div className="flex flex-col gap-0.5 w-full">
                                          <div className="flex items-center justify-between gap-1 w-full">
                                            <span className="font-bold truncate text-[9px] md:text-[10px] block leading-tight flex-1">
                                              {sch.classSite?.class?.name
                                                ? getShortClassName(sch.classSite.class.name)
                                                : (sch.type === "OFFICE_HOURS" ? "OFFICE" : sch.type)}
                                            </span>
                                            {sch.teacherRole && renderRoleBadge(sch.teacherRole)}
                                          </div>
                                          {isOther ? (
                                            <span className="truncate text-[7.5px] md:text-[8px] block text-muted-foreground font-normal leading-none">
                                              ({getShortCentreName(sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "Cơ sở khác")})
                                            </span>
                                          ) : (
                                            sch.type !== "OFFICE_HOURS" && (
                                              <span className="truncate text-[7.5px] md:text-[9px] block opacity-90 leading-none">
                                                {getSessionShortName(sch)}
                                              </span>
                                            )
                                          )}
                                        </div>
                                      </div>
                                      {/* Tooltip */}
                                      <div
                                        role="tooltip"
                                        className="pointer-events-none absolute z-[9999] hidden group-hover/tooltip:flex bottom-full left-1/2 -translate-x-1/2 mb-2 w-[280px] sm:w-[350px] max-w-[400px] p-2.5 bg-foreground/90 text-white text-xs leading-relaxed shadow-lg whitespace-pre-line border-0 rounded-md animate-in fade-in-0 zoom-in-95 duration-150"
                                      >
                                        {getScheduleTitle(sch)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="min-h-[28px] w-full"></div>
                            )}
                          </TableCell>
                        );
                      })}

                      {displayedSlots.length === 0 && (
                        <TableCell className="text-center text-muted-foreground py-8">
                          Không có lịch dạy trong tuần này.
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
              </TableBody>
            </table>
          </div>
      </div>
      {/* Teacher Schedule Modal */}
      <TeacherScheduleModal
        isOpen={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        teacher={selectedTeacher}
        schedules={
          selectedTeacher
            ? schedules.filter((s) => s.teacherId === selectedTeacher.id)
            : []
        }
        weekStart={selectedDate}
      />

      {/* Schedule Detail Dialog */}
      <Dialog
        open={!!viewingSchedule}
        onOpenChange={(open) => {
          if (!open) setViewingSchedule(null);
        }}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Chi tiết lịch làm việc
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thông tin chi tiết về ca dạy/lịch trực của giáo viên.
            </DialogDescription>
          </DialogHeader>

          {viewingSchedule && (
            <div className="space-y-4 mt-2 text-xs">
              {/* Header block with color indicator */}
              <div className={`p-3 rounded-xl border ${getScheduleStyle(viewingSchedule)}`}>
                <p className="font-extrabold text-sm">
                  {viewingSchedule.classSite?.class?.name || 
                    (viewingSchedule.type === "OFFICE_HOURS" ? "Lịch trực văn phòng" : viewingSchedule.type)}
                </p>
                <p className="text-[10px] opacity-90 mt-0.5 font-bold">
                  {viewingSchedule.type === "OFFICE_HOURS" 
                    ? viewingSchedule.officeHour?.type || "OFFICE" 
                    : getSessionShortName(viewingSchedule)}
                </p>
              </div>

              {/* Detail fields */}
              <div className="space-y-3 border-t border-border/60 pt-3">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground font-medium">Giáo viên:</span>
                  <span className="text-foreground font-bold text-right flex items-center gap-1.5 justify-end">
                    {teachersList.find(t => t.id === viewingSchedule.teacherId)?.fullName || "—"}
                    {viewingSchedule.teacherRole && renderRoleBadge(viewingSchedule.teacherRole)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Thời gian:</span>
                  <span className="text-foreground font-semibold font-mono">
                    {getLocalTime(viewingSchedule.startTime)} - {getLocalTime(viewingSchedule.endTime)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Ngày dạy:</span>
                  <span className="text-foreground font-semibold">
                    {format(new Date(getLocalDate(viewingSchedule)), "dd/MM/yyyy")}
                  </span>
                </div>

                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground font-medium">Cơ sở:</span>
                  <span className="text-foreground font-semibold text-right">
                    {viewingSchedule.classSite?.centre?.name || viewingSchedule.officeHour?.centre?.name || "—"}
                    {checkIsOtherCentre(viewingSchedule) && " (Dạy chéo)"}
                  </span>
                </div>

                {viewingSchedule.description && (
                  <div className="space-y-1 pt-2 border-t border-border/40">
                    <p className="text-muted-foreground font-medium">Ghi chú / Nội dung:</p>
                    <p className="text-foreground bg-muted/50 p-2 rounded border border-border/60/50 whitespace-pre-wrap leading-normal">
                      {viewingSchedule.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
