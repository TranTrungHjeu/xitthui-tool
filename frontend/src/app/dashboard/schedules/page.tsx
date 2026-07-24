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
  RotateCcw,
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

  // Grab to scroll horizontally
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isDraggingActive = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("[role='menuitem']")
    ) {
      return;
    }
    isDragging.current = true;
    isDraggingActive.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = "grabbing";
      scrollContainerRef.current.style.userSelect = "none";
    }
    startX.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    scrollLeftStart.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  const handleDragMouseUpOrLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = "grab";
      scrollContainerRef.current.style.userSelect = "";
    }
    // Delay resetting isDraggingActive to capture and block click event
    setTimeout(() => {
      isDraggingActive.current = false;
    }, 50);
  };

  const handleDragMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
    
    if (Math.abs(x - startX.current) > 5) {
      isDraggingActive.current = true;
    }

    e.preventDefault();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
    }
  };

  const handleContainerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingActive.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  
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

  const filteredTeachers = useMemo(() => {
    return teachersList.filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
      );
    });
  }, [teachersList, search]);

  const displayedTeachers = useMemo(() => {
    return filteredTeachers.filter((t) => {
      if (hiddenTeacherIds.has(t.id)) return false;
      if (hideTeachersWithoutSchedules) {
        return teachersWithSchedules.has(t.id);
      }
      return true;
    });
  }, [filteredTeachers, hiddenTeacherIds, hideTeachersWithoutSchedules, teachersWithSchedules]);

  const visibleTeachersCount = useMemo(() => {
    return teachersList.filter((t) => {
      if (hiddenTeacherIds.has(t.id)) return false;
      if (hideTeachersWithoutSchedules) {
        return teachersWithSchedules.has(t.id);
      }
      return true;
    }).length;
  }, [teachersList, hiddenTeacherIds, hideTeachersWithoutSchedules, teachersWithSchedules]);

  const relevantSchedules = useMemo(() => {
    const activeTeacherIds = new Set(displayedTeachers.map((t) => t.id));
    return centerSchedules.filter((s) => activeTeacherIds.has(s.teacherId));
  }, [centerSchedules, displayedTeachers]);

  const displayedSlots = useMemo(() => {
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

    return Array.from(uniqueSlotsSet).sort((a, b) => {
      const [dateA, timeA] = a.split("_");
      const [dateB, timeB] = b.split("_");
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return timeA.localeCompare(timeB);
    });
  }, [relevantSchedules]);

  const getColDuration = useMemo(() => {
    const durations = displayedSlots.map((currentSlot, colIdx) => {
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
    });
    return (colIdx: number) => durations[colIdx] ?? 120;
  }, [displayedSlots]);

  const schedulesByTeacher = useMemo(() => {
    const map: Record<string, Record<string, Schedule[]>> = {};
    relevantSchedules.forEach((sch) => {
      const localDate = getLocalDate(sch);
      const localTime = getLocalTime(sch.startTime);
      if (localDate && localTime) {
        const slot = `${localDate}_${localTime}`;

        if (!map[sch.teacherId]) {
          map[sch.teacherId] = {};
        }
        if (!map[sch.teacherId][slot]) {
          map[sch.teacherId][slot] = [];
        }
        map[sch.teacherId][slot].push(sch);
      }
    });
    return map;
  }, [relevantSchedules]);

  // Precompute grid cell rendering attributes (colspans, skip states, card position styles)
  const computedGrid = useMemo(() => {
    const grid: Record<string, Record<string, {
      schedules: Schedule[];
      colSpan: number;
      skip: boolean;
      cards: { left: string; width: string }[];
    }>> = {};

    displayedTeachers.forEach((teacher) => {
      grid[teacher.id] = {};
      
      displayedSlots.forEach((slot) => {
        grid[teacher.id][slot] = {
          schedules: [],
          colSpan: 1,
          skip: false,
          cards: []
        };
      });

      const skipSlots = new Set<string>();

      displayedSlots.forEach((slot, colIndex) => {
        if (skipSlots.has(slot)) {
          grid[teacher.id][slot].skip = true;
          return;
        }

        const cellSchedules = schedulesByTeacher[teacher.id]?.[slot] || [];
        grid[teacher.id][slot].schedules = cellSchedules;

        if (cellSchedules.length > 0) {
          let maxSpan = 1;
          cellSchedules.forEach((sch) => {
            let actualEndMin = timeToMinutes(getLocalTime(sch.endTime));
            const [slotDate] = slot.split("_");

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

          grid[teacher.id][slot].colSpan = maxSpan;

          for (let offset = 1; offset < maxSpan; offset++) {
            const nextIdx = colIndex + offset;
            if (nextIdx < displayedSlots.length) {
              skipSlots.add(displayedSlots[nextIdx]);
            }
          }

          // Compute card dimensions
          const cards: { left: string; width: string }[] = [];
          cellSchedules.forEach((sch) => {
            const actualStartMin = timeToMinutes(getLocalTime(sch.startTime));
            let actualEndMin = timeToMinutes(getLocalTime(sch.endTime));
            const [slotDate] = slot.split("_");

            const getXCoordinate = (timeMin: number) => {
              for (let colOffset = 0; colOffset < maxSpan; colOffset++) {
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
              return maxSpan;
            };

            const xStart = getXCoordinate(actualStartMin);
            const xEnd = getXCoordinate(actualEndMin);
            
            let leftPercent = (xStart / maxSpan) * 100;
            let widthPercent = ((xEnd - xStart) / maxSpan) * 100;
            if (leftPercent + widthPercent > 100) {
              widthPercent = 100 - leftPercent;
            }

            cards.push({
              left: `${leftPercent}%`,
              width: `${widthPercent}%`
            });
          });

          grid[teacher.id][slot].cards = cards;
        }
      });
    });

    return grid;
  }, [displayedTeachers, displayedSlots, schedulesByTeacher, getColDuration]);

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
    const slotDate = new Date(dateStr);
    const isToday = isSameDay(slotDate, new Date());
    if (isToday) {
      return "bg-primary/10 text-primary font-bold border-b-2 border-primary shadow-2xs";
    }
    const dayIndex = slotDate.getDay();
    if (dayIndex === 0 || dayIndex === 6) {
      return "bg-muted/60 text-muted-foreground";
    }
    return "bg-card text-foreground";
  };

  const getDayCellBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const slotDate = new Date(dateStr);
    const isToday = isSameDay(slotDate, new Date());
    if (isToday) {
      return "bg-primary/[0.03] dark:bg-primary/[0.06]";
    }
    const dayIndex = slotDate.getDay();
    if (dayIndex === 0 || dayIndex === 6) {
      return "bg-muted/20";
    }
    return "bg-card hover:bg-accent/30";
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
      const isToday = isSameDay(dateObj, new Date());
      const dayLabel = dayMap[dateObj.getDay()];
      const displayDay = dayLabel.replace("Thứ ", "T");
      const dateDisplay = format(dateObj, "dd/MM");
      return (
        <div className="flex flex-col items-center leading-none whitespace-nowrap gap-0.5 py-0.5">
          <span className={`font-bold text-[8.5px] md:text-[9.5px] ${isToday ? "text-primary" : "text-foreground"}`}>
            {displayDay} - {dateDisplay}
          </span>
          <span className={`text-[8px] md:text-[9px] font-mono font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{timeStr}</span>
        </div>
      );
    } catch {
      return <span>{slotKey}</span>;
    }
  };

  const getScheduleStyle = (sch: Schedule) => {
    if (checkIsOtherCentre(sch)) {
      return "bg-muted/80 text-muted-foreground border-border/80";
    }

    const titleLower = (sch.title || "").toLowerCase();

    if (sch.type === "OFFICE_HOURS") {
      return "bg-[#eab308] text-slate-950 border-[#ca8a04] font-semibold shadow-2xs";
    }

    if (sch.type === "AVAILABLE") {
      return "bg-emerald-600 text-white border-emerald-700 shadow-2xs";
    }

    if (sch.type === "CLASS_SESSION") {
      if (titleLower.includes("checkpoint")) {
        return "bg-[#d97706] text-white border-[#b45309] shadow-2xs";
      }
      if (titleLower.includes("demo")) {
        return "bg-[#059669] text-white border-[#047857] shadow-2xs";
      }
      return "bg-[#000056] dark:bg-[#000056] text-white border-[#000056] shadow-2xs hover:bg-[#08086b]";
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
    info = info.replace(/^[\s-:]+|[\s-:]+$/g, "");
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
      bgClass = "bg-[#E31F26] text-white border-[#E31F26] font-extrabold shadow-2xs";
    } else if (upper === "TA" || upper === "TEACHING_ASSISTANT") {
      label = "TG";
      bgClass = "bg-[#FFD62D] text-slate-950 border-[#eab308] font-extrabold shadow-2xs";
    } else if (upper === "EXAMINER" || upper === "EXAM" || upper === "GK" || upper === "JUDGE" || upper.includes("EXAM") || upper.includes("GK") || upper.includes("JUDGE")) {
      label = "GK";
      bgClass = "bg-purple-600 text-white border-purple-600 font-extrabold shadow-2xs";
    } else if (upper === "SUBSTITUTE" || upper === "COVER" || upper === "SUB" || upper === "SUPPLY" || upper.includes("SUB") || upper.includes("COVER") || upper.includes("SUPPLY")) {
      label = "DT";
      bgClass = "bg-rose-600 text-white border-rose-600 font-extrabold shadow-2xs";
    }

    return (
      <span className={`text-[8.5px] md:text-[9.5px] px-1 py-0.5 rounded-[4px] font-sans shrink-0 leading-none border ${bgClass}`}>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        {/* Left: Week Navigator and Week label */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week label & Status */}
          <span className="text-sm font-bold text-foreground min-w-[130px]">
            {isLoading ? "Đang tải..." : `Tuần: ${weekStr}`}
          </span>

          {/* Navigator buttons */}
          <div className="flex items-center bg-card border border-border rounded-lg shadow-sm h-9 transition-all hover:border-border justify-between">
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
              className="relative h-full border-x border-border flex items-center"
              ref={datePickerRef}
            >
              <div
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className={`flex items-center justify-center gap-1.5 px-3 h-full hover:bg-muted/50 transition-colors cursor-pointer select-none text-[11px] font-bold text-foreground ${isDatePickerOpen ? "bg-muted/50 ring-1 ring-primary/20" : ""}`}
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
        </div>

        {/* Right: Actions and Search */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
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

          <div className="relative w-full sm:w-48 lg:w-64">
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

        <div
          ref={scrollContainerRef}
          className="overflow-auto flex-1 custom-scrollbar no-vertical-scrollbar cursor-grab"
          onMouseDown={handleDragMouseDown}
          onMouseMove={handleDragMouseMove}
          onMouseUp={handleDragMouseUpOrLeave}
          onMouseLeave={handleDragMouseUpOrLeave}
          onClickCapture={handleContainerClickCapture}
        >
          <table className="w-max min-w-full border-collapse caption-bottom text-xs">
            <TableHeader className="sticky top-0 z-40 shadow-sm">
              <TableRow className="border-b-2 border-border">
                <TableHead
                  onClick={() => {
                    setSelectedHighlightTeacherId(null);
                    setSelectedHighlightSlot(null);
                  }}
                  className="sticky left-0 top-0 z-50 bg-muted min-w-[90px] max-w-[120px] md:min-w-[105px] md:max-w-[130px] border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-foreground font-semibold text-[10px] md:text-[11px] py-1 px-1.5 cursor-pointer select-none"
                >
                  Giáo viên
                </TableHead>
                {displayedSlots.map((slot) => (
                  <TableHead
                    key={slot}
                    onClick={() => handleHeaderClick(slot)}
                    className={`sticky top-0 z-40 border-r border-border min-w-[70px] md:min-w-[72px] p-0.5 text-center cursor-pointer select-none ${getDayHeaderBg(slot)}`}
                  >
                    {formatSlotHeader(slot)}
                  </TableHead>
                ))}
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
                  return (
                    <TableRow
                      key={teacher.id}
                      className="group border-b border-border"
                    >
                      <TableCell
                        onClick={() => handleTeacherClick(teacher.id)}
                        className="sticky left-0 z-30 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium text-foreground p-1 align-middle whitespace-nowrap text-[9px] md:text-[10px] leading-none min-w-[90px] max-w-[120px] md:min-w-[105px] md:max-w-[130px] overflow-hidden truncate cursor-pointer bg-card"
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

                      {displayedSlots.map((slot) => {
                        const cellData = computedGrid[teacher.id]?.[slot];
                        if (!cellData) return null;
                        if (cellData.skip) return null;

                        const { schedules: cellSchedules, colSpan } = cellData;

                        return (
                          <TableCell
                            key={slot}
                            colSpan={colSpan}
                            onClick={() => handleCellClick(teacher.id, slot)}
                            className={`relative hover:z-[60] border-r border-border p-0 align-top cursor-pointer transition-all ${
                              colSpan === 1 ? "min-w-[70px] md:min-w-[72px]" : ""
                            } ${getDayCellBg(slot)}`}
                          >
                            {cellSchedules.length > 0 ? (
                              <div className="flex flex-col w-full h-full gap-[1px]">
                                {cellSchedules.map((sch, i) => {
                                  const cardData = cellData.cards[i];
                                  const isOther = checkIsOtherCentre(sch);

                                  return (
                                    <div 
                                      key={i} 
                                      className="relative group/tooltip hover:z-[100] transition-all"
                                      style={{
                                        marginLeft: cardData?.left || "0%",
                                        width: cardData?.width || "100%"
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
