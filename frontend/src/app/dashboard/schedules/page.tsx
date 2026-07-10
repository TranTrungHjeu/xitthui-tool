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
    <div className="p-3 bg-white rounded-xl shadow-xl border border-slate-200 w-[280px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-slate-800 capitalize">
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
          <div key={day} className="text-[11px] font-semibold text-slate-400">
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
                ${!isCurrentMonth ? "text-slate-300" : "text-slate-700 hover:bg-slate-100"}
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
    const localTime = getLocalTime(sch.startTime);
    if (localDate && localTime) {
      uniqueSlotsSet.add(`${localDate}_${localTime}`);
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

  const schedulesByTeacher: Record<string, Record<string, Schedule[]>> = {};
  relevantSchedules.forEach((sch) => {
    const localDate = getLocalDate(sch);
    const localTime = getLocalTime(sch.startTime);
    const slot = `${localDate}_${localTime}`;

    if (!schedulesByTeacher[sch.teacherId]) {
      schedulesByTeacher[sch.teacherId] = {};
    }
    if (!schedulesByTeacher[sch.teacherId][slot]) {
      schedulesByTeacher[sch.teacherId][slot] = [];
    }
    schedulesByTeacher[sch.teacherId][slot].push(sch);
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
        return "bg-green-100";
      case 3:
        return "bg-yellow-100";
      case 4:
        return "bg-purple-100";
      case 5:
        return "bg-pink-100";
      case 6:
        return "bg-orange-100";
      default:
        return "bg-slate-100";
    }
  };

  const getDayCellBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const dayIndex = new Date(dateStr).getDay();
    switch (dayIndex) {
      case 1:
        return "bg-blue-50/70";
      case 2:
        return "bg-green-50/70";
      case 3:
        return "bg-yellow-50/70";
      case 4:
        return "bg-purple-50/70";
      case 5:
        return "bg-pink-50/70";
      case 6:
        return "bg-orange-50/70";
      default:
        return "bg-slate-50/70";
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
          <span className="font-semibold text-[8px] md:text-[9px] text-slate-800">
            {displayDay} - {dateDisplay}
          </span>
          <span className="text-[8px] md:text-[9px] text-slate-700 font-mono font-bold">{timeStr}</span>
        </div>
      );
    } catch {
      return <span>{slotKey}</span>;
    }
  };

  const getScheduleStyle = (sch: Schedule) => {
    if (checkIsOtherCentre(sch)) {
      return "bg-slate-100 text-slate-400 border-slate-200/80";
    }

    const titleLower = (sch.title || "").toLowerCase();

    if (sch.type === "OFFICE_HOURS") {
      return "bg-yellow-300 text-slate-900 border-yellow-400";
    }

    if (sch.type === "AVAILABLE") {
      return "bg-green-300 text-slate-900 border-green-400";
    }

    if (sch.type === "CLASS_SESSION") {
      if (titleLower.includes("checkpoint")) {
        return "bg-purple-200 text-purple-900 border-purple-300";
      }
      if (titleLower.includes("demo")) {
        return "bg-blue-200 text-blue-900 border-blue-300";
      }
      return "bg-orange-400 text-slate-900 border-orange-500";
    }

    return "bg-slate-200 text-slate-800 border-slate-300";
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

  const getScheduleTitle = (sch: Schedule) => {
    const centerName =
      sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "—";
    const start = getLocalTime(sch.startTime);
    const end = getLocalTime(sch.endTime);
    return `${start} - ${end}\nCơ sở: ${centerName}\nGhi chú: ${sch.description || sch.officeHour?.type || "—"}`;
  };

  const weekStr = `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")}`;

  return (
    <div className="p-1.5 sm:p-3 space-y-1.5 h-[calc(100vh-76px)] md:h-[calc(100vh-16px)] overflow-hidden flex flex-col">
      <div className="flex flex-col gap-1.5 shrink-0">
        {/* Title and Action Buttons Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-none">Lịch làm việc</h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {isLoading ? "Đang tải..." : `Tuần: ${weekStr}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="h-8 px-2 text-[11px] font-semibold gap-1 bg-white active:scale-95 transition-all shrink-0"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Tải lại</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 bg-white text-[11px] px-2 shrink-0"
                >
                  <Filter className="h-3 w-3 text-slate-500" />
                  <span>Nhân sự ({visibleTeachersCount}/{teachersList.length})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-72 max-h-80 overflow-y-auto bg-white"
                align="end"
              >
                <DropdownMenuLabel>Chọn nhân sự hiển thị</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={hideTeachersWithoutSchedules}
                      onChange={(e) =>
                        setHideTeachersWithoutSchedules(e.target.checked)
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>Chỉ hiện GV có lịch (trong cơ sở)</span>
                  </label>
                </div>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between p-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 flex-1"
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
                    className="text-xs h-8 flex-1"
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
                  <div className="p-3 text-xs text-slate-400 text-center">
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
        </div>

        {/* Date Navigator and Search Row */}
        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-3 items-stretch sm:items-center">
          {/* Week navigator */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm h-8.5 transition-all hover:border-slate-300 justify-between flex-1 sm:flex-none">
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-none rounded-l-lg"
              onClick={handlePrevWeek}
              title="Tuần trước"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div
              className="relative h-full border-x border-slate-200 flex-1 sm:flex-none"
              ref={datePickerRef}
            >
              <div
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className={`flex items-center justify-center gap-1.5 px-3 h-full hover:bg-slate-50 transition-colors cursor-pointer min-w-[110px] sm:min-w-[130px] select-none text-[11px] font-bold text-slate-700 ${isDatePickerOpen ? "bg-slate-50 ring-1 ring-primary/20" : ""}`}
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
              className="h-full w-8 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-none"
              onClick={handleNextWeek}
              title="Tuần tiếp theo"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <div className="h-full border-l border-slate-200">
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
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Tìm theo tên giáo viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-[11px] bg-white w-full"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-2.5 text-xs text-white bg-destructive rounded-lg shrink-0">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative flex-1 flex flex-col">
        {showLoading && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center min-h-[60vh]">
            <CatLoader />
          </div>
        )}

        <div className="overflow-auto flex-1 custom-scrollbar no-vertical-scrollbar">
          <table className="w-max min-w-full border-collapse caption-bottom text-xs">
            <TableHeader className="sticky top-0 z-40 shadow-sm">
              <TableRow className="border-b-2 border-slate-300">
                <TableHead
                  onClick={() => {
                    setSelectedHighlightTeacherId(null);
                    setSelectedHighlightSlot(null);
                  }}
                  className="sticky left-0 top-0 z-50 bg-slate-200 min-w-[90px] max-w-[120px] md:min-w-[105px] md:max-w-[130px] border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-slate-700 font-semibold text-[10px] md:text-[11px] py-1 px-1.5 cursor-pointer select-none hover:bg-slate-300 transition-colors"
                >
                  Giáo viên
                </TableHead>
                {displayedSlots.map((slot) => (
                  <TableHead
                    key={slot}
                    onClick={() => handleHeaderClick(slot)}
                    className={`sticky top-0 z-40 border-r border-slate-300 min-w-[70px] md:min-w-[72px] p-0.5 text-center cursor-pointer select-none transition-colors hover:bg-slate-200/80 ${
                      selectedHighlightSlot === slot 
                        ? "ring-2 ring-inset ring-red-500 bg-red-200 text-red-950 font-bold" 
                        : getDayHeaderBg(slot)
                    }`}
                  >
                    {formatSlotHeader(slot)}
                  </TableHead>
                ))}
                {displayedSlots.length === 0 && (
                  <TableHead className="bg-slate-100">Lịch trình</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayedTeachers.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={displayedSlots.length + 1}
                    className="text-center py-16 text-slate-400 bg-white"
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
                displayedTeachers.map((teacher) => (
                  <TableRow
                    key={teacher.id}
                    className="hover:bg-slate-50/50 group border-b border-slate-300"
                  >
                    <TableCell
                      onClick={() => handleTeacherClick(teacher.id)}
                      className={`sticky left-0 z-30 group-hover:bg-slate-50 border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium text-slate-800 p-1 align-middle whitespace-nowrap text-[9px] md:text-[10px] leading-none min-w-[90px] max-w-[120px] md:min-w-[105px] md:max-w-[130px] overflow-hidden truncate cursor-pointer transition-colors ${
                        selectedHighlightTeacherId === teacher.id
                          ? "bg-red-200 text-red-950 font-bold ring-2 ring-inset ring-red-500"
                          : "bg-white"
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeacher(teacher);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 cursor-pointer font-semibold transition-colors"
                        title={`Xem lịch tuần của ${teacher.fullName}`}
                      >
                        {isMobile ? getShortTeacherName(teacher.fullName) : teacher.fullName}
                      </button>
                    </TableCell>

                    {displayedSlots.map((slot) => {
                      const cellSchedules =
                        schedulesByTeacher[teacher.id]?.[slot] || [];
                      return (
                        <TableCell
                          key={slot}
                          onClick={() => handleCellClick(teacher.id, slot)}
                          className={`relative hover:z-[60] border-r border-slate-300 p-0.25 md:p-0.5 align-top min-w-[70px] md:min-w-[72px] cursor-pointer transition-all ${
                            selectedHighlightTeacherId === teacher.id && selectedHighlightSlot === slot
                              ? "bg-red-200 text-red-950 font-bold ring-2 ring-inset ring-red-500 z-20"
                              : selectedHighlightTeacherId === teacher.id
                              ? "bg-red-100 text-red-950 font-bold"
                              : selectedHighlightSlot === slot
                              ? "bg-red-100 text-red-950 font-bold"
                              : getDayCellBg(slot)
                          }`}
                        >
                          {cellSchedules.length > 0 ? (
                            <div className="space-y-0.5">
                              {cellSchedules.map((sch, i) => {
                                const isOther = checkIsOtherCentre(sch);
                                return (
                                  <Tooltip key={i} delayDuration={100}>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewingSchedule(sch);
                                        }}
                                        className={`rounded border shadow-sm transition-all cursor-pointer overflow-hidden p-0.5 md:p-1 ${getScheduleStyle(sch)}`}
                                      >
                                        <div className="text-[8.5px] md:text-[9px] leading-none p-0 md:p-1 flex flex-col gap-0.5 md:gap-1">
                                          <span className="font-bold truncate text-[9px] md:text-[10px] block leading-none">
                                            {sch.classSite?.class?.name
                                              ? getShortClassName(sch.classSite.class.name)
                                              : (sch.type === "OFFICE_HOURS" ? "OFFICE" : sch.type)}
                                          </span>
                                          {isOther ? (
                                            <span className="truncate text-[7.5px] md:text-[8px] block text-slate-400 font-normal leading-none mt-0.5">
                                              ({getShortCentreName(sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "Cơ sở khác")})
                                            </span>
                                          ) : (
                                            sch.type !== "OFFICE_HOURS" && (
                                              <span className="truncate text-[7.5px] md:text-[9px] block opacity-90 leading-none mt-0.5">
                                                {getSessionShortName(sch)}
                                              </span>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[100] w-[280px] sm:w-[350px] max-w-[400px] p-2.5 bg-slate-800 text-white text-xs leading-relaxed shadow-lg whitespace-pre-line border-0">
                                      {getScheduleTitle(sch)}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="min-h-[22px] w-full"></div>
                          )}
                        </TableCell>
                      );
                    })}

                    {displayedSlots.length === 0 && (
                      <TableCell className="text-center text-slate-400 py-8">
                        Không có lịch dạy trong tuần này.
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 p-1.5 shrink-0 flex flex-wrap gap-2.5 sm:gap-6 text-[10px] sm:text-xs font-semibold text-slate-500 items-center justify-center">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-orange-400 border border-orange-500"></div>
            Lớp học
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-200 border border-purple-300"></div>
            Checkpoint
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-200 border border-blue-300"></div>
            Demo
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-yellow-300 border border-yellow-400"></div>
            Office Hours
          </div>
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
            <DialogTitle className="text-base font-bold text-slate-900">
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
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-slate-400 font-medium">Giáo viên:</span>
                  <span className="text-slate-800 font-bold text-right">
                    {teachersList.find(t => t.id === viewingSchedule.teacherId)?.fullName || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Thời gian:</span>
                  <span className="text-slate-800 font-semibold font-mono">
                    {getLocalTime(viewingSchedule.startTime)} - {getLocalTime(viewingSchedule.endTime)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Ngày dạy:</span>
                  <span className="text-slate-800 font-semibold">
                    {format(new Date(getLocalDate(viewingSchedule)), "dd/MM/yyyy")}
                  </span>
                </div>

                <div className="flex justify-between items-start gap-4">
                  <span className="text-slate-400 font-medium">Cơ sở:</span>
                  <span className="text-slate-800 font-semibold text-right">
                    {viewingSchedule.classSite?.centre?.name || viewingSchedule.officeHour?.centre?.name || "—"}
                    {checkIsOtherCentre(viewingSchedule) && " (Dạy chéo)"}
                  </span>
                </div>

                {viewingSchedule.description && (
                  <div className="space-y-1 pt-2 border-t border-slate-50">
                    <p className="text-slate-400 font-medium">Ghi chú / Nội dung:</p>
                    <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100/50 whitespace-pre-wrap leading-normal">
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
