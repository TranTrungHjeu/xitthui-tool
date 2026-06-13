"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/useAuthStore";
import { teacherService } from "../../../services/teacherService";
import {
  Table,
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
import { Loader2, Search, CalendarClock, Calendar, RefreshCw, Filter } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { TeacherScheduleModal } from "../../../components/TeacherScheduleModal";

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
    class?: { name: string };
    centre?: { name: string };
  };
  officeHour?: {
    type: string;
    centre?: { name: string };
  };
}

interface Teacher {
  id: string;
  fullName: string;
  code: string;
}

export default function SchedulesPage() {
  const { token, user } = useAuthStore();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hiddenTeacherIds, setHiddenTeacherIds] = useState<Set<string>>(new Set());

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

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

  const fetchSchedulesForDate = async (date: Date) => {
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

      const teachersRes = await teacherService.getTeachers(token);
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

      const schedulesRes = await teacherService.getTeacherSchedules(token, teacherIds, dateGte, dateLte);
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
    const timeoutId = setTimeout(() => {
      fetchSchedulesForDate(selectedDate);
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const newDate = new Date(e.target.value);
      setSelectedDate(newDate);
    }
  };

  const handleRefresh = () => {
    fetchSchedulesForDate(selectedDate);
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
        await teacherService.saveTeacherVisibility(user.id, Array.from(newHidden));
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
        await teacherService.saveTeacherVisibility(user.id, Array.from(allHidden));
      } catch (err) {
        console.error("Failed to save visibility preference:", err);
      }
    }
  };

  const getLocalDate = (sch: Schedule) => {
    try {
      if (sch.startTime && sch.startTime.length > 10 && sch.startTime.includes("T")) {
        return format(new Date(sch.startTime), "yyyy-MM-dd");
      }
      if (sch.date) {
        if (sch.date.length > 10 && sch.date.includes("T")) {
          return format(new Date(sch.date), "yyyy-MM-dd");
        }
        return sch.date.substring(0, 10);
      }
      return "";
    } catch {
      return sch.date || "";
    }
  };

  const getLocalTime = (timeStr: string) => {
    if (!timeStr) return "";
    try {
      if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
      if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return timeStr.substring(0, 5);

      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return format(date, "HH:mm");
    } catch {
      return timeStr;
    }
  };

  const filteredTeachers = teachersList.filter((t) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q);
  });

  const displayedTeachers = filteredTeachers.filter((t) => !hiddenTeacherIds.has(t.id));
  const visibleTeachersCount = teachersList.filter((t) => !hiddenTeacherIds.has(t.id)).length;

  const activeTeacherIds = new Set(displayedTeachers.map((t) => t.id));
  const relevantSchedules = schedules.filter(
    (s) => activeTeacherIds.has(s.teacherId) && (s.type === "CLASS_SESSION" || s.type === "OFFICE_HOURS")
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
      case 1: return "bg-blue-100";
      case 2: return "bg-green-100";
      case 3: return "bg-yellow-100";
      case 4: return "bg-purple-100";
      case 5: return "bg-pink-100";
      case 6: return "bg-orange-100";
      default: return "bg-slate-100";
    }
  };

  const getDayCellBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const dayIndex = new Date(dateStr).getDay();
    switch (dayIndex) {
      case 1: return "bg-blue-50/70";
      case 2: return "bg-green-50/70";
      case 3: return "bg-yellow-50/70";
      case 4: return "bg-purple-50/70";
      case 5: return "bg-pink-50/70";
      case 6: return "bg-orange-50/70";
      default: return "bg-slate-50/70";
    }
  };

  const formatSlotHeader = (slotKey: string) => {
    const [dateStr, timeStr] = slotKey.split("_");
    try {
      const parts = dateStr.split("-");
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const shortDay = dayMap[dateObj.getDay()];
      return (
        <div className="flex flex-col items-center leading-none whitespace-nowrap">
          <span className="font-semibold text-[9px] text-slate-800">{shortDay}</span>
          <span className="text-[9px] text-slate-700 font-mono">{timeStr}</span>
        </div>
      );
    } catch {
      return <span>{slotKey}</span>;
    }
  };

  const getScheduleStyle = (type: string) => {
    switch (type) {
      case "CLASS_SESSION":
        return "bg-orange-400 text-slate-900 border-orange-500";
      case "OFFICE_HOURS":
        return "bg-yellow-300 text-slate-900 border-yellow-400";
      case "AVAILABLE":
        return "bg-green-300 text-slate-900 border-green-400";
      default:
        return "bg-slate-200 text-slate-800 border-slate-300";
    }
  };

  const getScheduleTitle = (sch: Schedule) => {
    const centerName = sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "—";
    const start = getLocalTime(sch.startTime);
    const end = getLocalTime(sch.endTime);
    return `${start} - ${end}\nCơ sở: ${centerName}\nGhi chú: ${sch.description || sch.officeHour?.type || "—"}`;
  };

  const weekStr = `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yyyy")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yyyy")}`;

  return (
    <div className="p-6 md:p-8 space-y-6 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Lịch làm việc</h1>
            <p className="text-sm text-slate-500">
              {isLoading ? "Đang tải..." : `Tuần: ${weekStr} (${relevantSchedules.length} lịch)`}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-md p-1 px-2 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-500" />
            <Input
              type="date"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={handleDateChange}
              className="border-0 bg-transparent focus-visible:ring-0 shadow-none h-8 w-auto min-w-[130px]"
            />
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Tìm theo tên giáo viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 h-10 bg-white shrink-0">
                <Filter className="h-4 w-4 text-slate-500" />
                Nhân sự ({visibleTeachersCount}/{teachersList.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto bg-white" align="end">
              <DropdownMenuLabel>Chọn nhân sự hiển thị</DropdownMenuLabel>
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
                <div className="p-3 text-xs text-slate-400 text-center">Không có nhân sự nào</div>
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

          <Button onClick={handleRefresh} disabled={isLoading} className="shrink-0 gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Lấy dữ liệu
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-white bg-destructive rounded-lg shrink-0">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative flex-1 flex flex-col">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div className="overflow-auto flex-1 custom-scrollbar">
          <Table className="w-max min-w-full border-collapse">
            <TableHeader className="sticky top-0 z-40 shadow-sm">
              <TableRow className="border-b-2 border-slate-300">
                <TableHead className="sticky left-0 top-0 z-50 bg-slate-200 min-w-[130px] max-w-[160px] border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-slate-700 font-semibold text-[11px] py-1 px-1.5">
                  Giáo viên
                </TableHead>
                {sortedSlots.map((slot) => (
                  <TableHead
                    key={slot}
                    className={`sticky top-0 z-40 border-r border-slate-300 min-w-[64px] p-0.5 text-center ${getDayHeaderBg(slot)}`}
                  >
                    {formatSlotHeader(slot)}
                  </TableHead>
                ))}
                {sortedSlots.length === 0 && <TableHead className="bg-slate-100">Lịch trình</TableHead>}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayedTeachers.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={sortedSlots.length + 1} className="text-center py-16 text-slate-400 bg-white">
                    {search
                      ? "Không tìm thấy giáo viên nào."
                      : teachersList.length > 0 && hiddenTeacherIds.size === teachersList.length
                      ? "Tất cả giáo viên đã bị ẩn. Vui lòng chọn hiển thị giáo viên."
                      : "Không có dữ liệu giáo viên."}
                  </TableCell>
                </TableRow>
              ) : (
                displayedTeachers.map((teacher) => (
                  <TableRow key={teacher.id} className="hover:bg-slate-50/50 group border-b border-slate-300">
                    <TableCell className="sticky left-0 z-30 bg-white group-hover:bg-slate-50 border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium text-slate-800 p-1 align-middle whitespace-nowrap text-[10px] leading-none">
                      <button
                        onClick={() => setSelectedTeacher(teacher)}
                        className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 cursor-pointer font-semibold transition-colors"
                        title={`Xem lịch tuần của ${teacher.fullName}`}
                      >
                        {teacher.fullName}
                      </button>
                    </TableCell>

                    {sortedSlots.map((slot) => {
                      const cellSchedules = schedulesByTeacher[teacher.id]?.[slot] || [];
                      return (
                        <TableCell
                          key={slot}
                          className={`border-r border-slate-300 p-0.5 align-top min-w-[72px] ${getDayCellBg(slot)}`}
                        >
                          {cellSchedules.length > 0 ? (
                            <div className="space-y-0.5">
                              {cellSchedules.map((sch, i) => (
                                <div
                                  key={i}
                                  className={`group/card relative rounded border border-slate-400 shadow-sm transition-all cursor-default ${getScheduleStyle(sch.type)}`}
                                >
                                  <div className="text-[9px] leading-none p-0.5">
                                    <span className="font-semibold truncate text-[9px] block leading-none">
                                      {sch.classSite?.class?.name || (sch.type === "OFFICE_HOURS" ? "OFFICE" : sch.title || sch.type)}
                                    </span>
                                  </div>
                                  
                                  {/* Tooltip on hover */}
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover/card:block z-[60] w-max max-w-[200px] p-2 bg-slate-800 text-white text-[10px] leading-tight rounded-md shadow-lg whitespace-pre-line">
                                    {getScheduleTitle(sch)}
                                    {/* Arrow */}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-slate-800"></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="min-h-[22px] w-full"></div>
                          )}
                        </TableCell>
                      );
                    })}

                    {sortedSlots.length === 0 && (
                      <TableCell className="text-center text-slate-400 py-8">
                        Không có lịch dạy trong tuần này.
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 p-3 shrink-0 flex gap-6 text-xs font-medium text-slate-600 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-orange-400 border border-orange-500"></div>
            Lớp học
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-yellow-300 border border-yellow-400"></div>
            Office Hours
          </div>
        </div>
      </div>
      {/* Teacher Schedule Modal */}
      <TeacherScheduleModal
        isOpen={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        teacher={selectedTeacher}
        schedules={selectedTeacher ? schedules.filter((s) => s.teacherId === selectedTeacher.id) : []}
        weekStart={selectedDate}
      />
    </div>
  );
}
