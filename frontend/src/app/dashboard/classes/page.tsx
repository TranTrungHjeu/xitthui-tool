"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { ClassData } from "@/types";
import { classService } from "@/services/classService";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Search, CalendarPlus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, formatTime } from "@/lib/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function getTeacherByRole(cls: any, roleShortName: string) {
  const frequencyMap = new Map<string, { name: string; count: number }>();

  if (Array.isArray(cls.slots)) {
    cls.slots.forEach((slot: any) => {
      if (Array.isArray(slot.teachers)) {
        slot.teachers.forEach((tAssignment: any) => {
          if (tAssignment.role?.shortName === roleShortName) {
            const teacher = tAssignment.teacher;
            if (teacher) {
              const id = teacher.id || teacher._id || teacher.fullName;
              const current = frequencyMap.get(id) || {
                name: teacher.fullName,
                count: 0,
              };
              frequencyMap.set(id, { ...current, count: current.count + 1 });
            }
          }
        });
      }
    });
  }

  if (frequencyMap.size === 0 && Array.isArray(cls.teachers)) {
    cls.teachers.forEach((tAssignment: any) => {
      if (tAssignment.role?.shortName === roleShortName) {
        const teacher = tAssignment.teacher;
        if (teacher) {
          const id = teacher.id || teacher._id || teacher.fullName;
          const current = frequencyMap.get(id) || {
            name: teacher.fullName,
            count: 0,
          };
          frequencyMap.set(id, { ...current, count: current.count + 1 });
        }
      }
    });
  }

  if (frequencyMap.size === 0) return "-";

  const sorted = Array.from(frequencyMap.values()).sort(
    (a, b) => b.count - a.count,
  );
  return sorted[0]?.name || "-";
}

function getClassTimeRange(cls: any) {
  const slots = cls.slots || [];
  const slotWithTime = slots.find(
    (slot: any) => slot.startTime || slot.endTime,
  );

  if (slotWithTime?.startTime || slotWithTime?.endTime) {
    return `${formatTime(slotWithTime.startTime)} - ${formatTime(slotWithTime.endTime)}`;
  }

  return "N/A";
}

function getClassWeekdayIndexes(cls: any) {
  const uniqueDays = new Set<number>();

  (cls.slots || []).forEach((slot: any) => {
    if (!slot.date) return;
    const date = new Date(slot.date);
    if (!Number.isNaN(date.getTime())) {
      uniqueDays.add(date.getDay());
    }
  });

  return Array.from(uniqueDays).sort((a, b) => a - b);
}

function getClassWeekdays(cls: any) {
  const weekdayMap = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const sortedDays = getClassWeekdayIndexes(cls);

  if (sortedDays.length === 0) return "N/A";

  return sortedDays.map((day) => weekdayMap[day]).join(", ");
}

function getHourFromTimeValue(timeVal: any): number {
  if (!timeVal) return NaN;
  const timeStr = String(timeVal).trim();

  // Case 1: Full ISO string (e.g. 2026-06-09T18:00:00.000Z)
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    if (!Number.isNaN(d.getTime())) {
      return d.getHours(); // Local hours
    }
    const timePart = timeStr.split("T")[1];
    const hourPart = timePart?.split(":")[0];
    if (hourPart) {
      const h = Number(hourPart);
      if (!Number.isNaN(h)) return h;
    }
  }

  // Case 2: Contains space (e.g. "2026-06-09 18:00:00")
  if (timeStr.includes(" ")) {
    const timePart = timeStr.split(" ")[1];
    const hourPart = timePart?.split(":")[0];
    if (hourPart) {
      const h = Number(hourPart);
      if (!Number.isNaN(h)) return h;
    }
  }

  // Case 3: Pure time string (e.g. "18:00" or "18:00:00")
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const h = Number(parts[0]);
    if (!Number.isNaN(h)) return h;
  }

  // Case 4: Standard Date parsing
  const d = new Date(timeStr);
  if (!Number.isNaN(d.getTime())) {
    return d.getHours();
  }

  return NaN;
}

function getClassShift(cls: any) {
  const slots = cls.slots || [];
  const slotWithTime = slots.find((slot: any) => slot.startTime);

  if (!slotWithTime?.startTime) return "other";

  const hour = getHourFromTimeValue(slotWithTime.startTime);

  if (Number.isNaN(hour)) return "other";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function matchesTimeWindowFilter(cls: any, filterValue: string): boolean {
  if (filterValue === "all") return true;

  const getStartOfDay = (dateStr: string | Date | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = getStartOfDay(cls.startDate);
  const endDate = getStartOfDay(cls.endDate);

  const ONE_DAY_MS = 1000 * 60 * 60 * 24;

  switch (filterValue) {
    case "running":
      // Đang dạy hiện tại: ngày bắt đầu <= hôm nay và ngày kết thúc >= hôm nay
      return !!(startDate && endDate && startDate <= today && endDate >= today);

    case "starting_soon": {
      // Sắp khai giảng (Bắt đầu trong 7 ngày tới): ngày bắt đầu > hôm nay và ngày bắt đầu <= hôm nay + 7 ngày
      if (!startDate) return false;
      const diffDays = Math.ceil(
        (startDate.getTime() - today.getTime()) / ONE_DAY_MS,
      );
      return diffDays > 0 && diffDays <= 7;
    }

    case "ending_soon": {
      // Sắp kết thúc (Kết thúc trong 7 ngày tới): ngày kết thúc >= hôm nay và ngày kết thúc <= hôm nay + 7 ngày
      if (!endDate) return false;
      const diffDays = Math.ceil(
        (endDate.getTime() - today.getTime()) / ONE_DAY_MS,
      );
      return diffDays >= 0 && diffDays <= 7;
    }

    case "ending_30": {
      // Kết thúc trong 30 ngày tới: ngày kết thúc >= hôm nay và ngày kết thúc <= hôm nay + 30 ngày
      if (!endDate) return false;
      const diffDays = Math.ceil(
        (endDate.getTime() - today.getTime()) / ONE_DAY_MS,
      );
      return diffDays >= 0 && diffDays <= 30;
    }

    case "started_recently": {
      // Mới bắt đầu trong 30 ngày: ngày bắt đầu <= hôm nay và ngày bắt đầu >= hôm nay - 30 ngày
      if (!startDate) return false;
      const diffDays = Math.floor(
        (today.getTime() - startDate.getTime()) / ONE_DAY_MS,
      );
      return diffDays >= 0 && diffDays <= 30;
    }

    case "ended":
      // Đã kết thúc: ngày kết thúc < hôm nay
      return !!(endDate && endDate < today);

    default:
      return true;
  }
}

function isTeacherInRole(cls: any, roleShortName: string, teacherId?: string) {
  if (!teacherId) return false;

  const slots = Array.isArray(cls.slots) ? cls.slots : [];
  for (const slot of slots) {
    const matched = (slot.teachers || []).some(
      (assignment: any) =>
        assignment.role?.shortName === roleShortName &&
        assignment.teacher?.id === teacherId,
    );
    if (matched) return true;
  }

  return (cls.teachers || []).some(
    (assignment: any) =>
      assignment.role?.shortName === roleShortName &&
      assignment.teacher?.id === teacherId,
  );
}

function parseDateTime(dateVal: any, timeVal: any): Date | null {
  if (!timeVal) return null;
  const timeStr = String(timeVal).trim();

  // Full ISO string format
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Combined date and time format
  if (dateVal) {
    const dateStr = String(dateVal).split("T")[0];
    const d = new Date(`${dateStr}T${timeStr}`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const d = new Date(timeStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildGoogleCalendarUrl(cls: any) {
  const slots = [...(cls.slots || [])]
    .filter((item: any) => item.date && item.startTime && item.endTime)
    .sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

  const firstSlot = slots[0];
  if (!firstSlot) return null;

  const start = parseDateTime(firstSlot.date, firstSlot.startTime);
  const end = parseDateTime(firstSlot.date, firstSlot.endTime);

  if (!start || !end) return null;

  const formatGoogleDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");

  const details = [
    `Lớp: ${cls.name}`,
    `Khóa học: ${cls.course?.shortName || cls.course?.name || "N/A"}`,
    `Lịch dạy: ${getClassWeekdays(cls)} | ${getClassTimeRange(cls)}`,
    `LEC: ${getTeacherByRole(cls, "LEC")}`,
    `TA: ${getTeacherByRole(cls, "TA")}`,
    `Tổng số buổi: ${cls.slots?.length || 0} buổi`,
  ].join("\n");

  const title = `${cls.name} - ${cls.course?.shortName || "Lớp học"}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details,
  });

  // Add Recurrence Rule (RRULE) for Google Calendar so that it automatically schedules weekly
  const weekdayIndexes = getClassWeekdayIndexes(cls);
  if (weekdayIndexes.length > 0 && cls.endDate) {
    const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const byDayStr = weekdayIndexes.map((idx) => RRULE_DAYS[idx]).join(",");

    const untilDate = new Date(cls.endDate);
    untilDate.setHours(23, 59, 59, 999);
    const untilStr = formatGoogleDate(untilDate);

    params.append(
      "recur",
      `RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${byDayStr}`,
    );
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function ClassesTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          </TableCell>
          <TableCell>
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          </TableCell>
          <TableCell>
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
          </TableCell>
          <TableCell>
            <div className="h-9 w-36 animate-pulse rounded bg-slate-200" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function ClassesPage() {
  const router = useRouter();
  const {
    user,
    token,
    classes: storedClasses,
    lastClassesFetch,
    lastClassDetailsFetch,
    setClasses: setStoredClasses,
    mergeClassDetails,
  } = useAuthStore();
  const [classes, setClasses] = useState<ClassData[]>(storedClasses || []);
  const [isLoading, setIsLoading] = useState(!storedClasses);
  const [isEnriching, setIsEnriching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeWindowFilter, setTimeWindowFilter] = useState("all");
  const [weekdayFilter, setWeekdayFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    if (storedClasses) {
      setClasses(storedClasses as ClassData[]);
      setIsLoading(false);
    }
  }, [storedClasses]);

  useEffect(() => {
    let isCancelled = false;

    const fetchClasses = async () => {
      console.log(
        "[ClassesPage] Fetching classes for teacherId:",
        user?.teacherId,
      );
      if (!user?.teacherId) {
        console.warn("[ClassesPage] No teacherId found in user store");
        setIsLoading(false);
        return;
      }

      const CACHE_TIME = 5 * 60 * 1000;
      if (
        storedClasses &&
        lastClassesFetch &&
        Date.now() - lastClassesFetch < CACHE_TIME
      ) {
        setClasses(storedClasses as ClassData[]);
        setIsLoading(false);
        return;
      }

      try {
        const data = await classService.getClasses(token || "", user.teacherId);
        if (isCancelled) return;
        setClasses(data);
        setStoredClasses(data);
      } catch (err) {
        console.error("Failed to fetch classes", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchClasses();

    return () => {
      isCancelled = true;
    };
  }, [
    user?.teacherId,
    token,
    storedClasses,
    lastClassesFetch,
    setStoredClasses,
  ]);

  useEffect(() => {
    let isCancelled = false;

    const enrichClasses = async () => {
      if (!classes.length || !user?.teacherId) return;

      const DETAIL_CACHE_TIME = 5 * 60 * 1000;
      const classIdsToEnrich = classes
        .filter((cls: any) => {
          const hasDetailedSlots = Array.isArray(cls.slots)
            ? cls.slots.some((slot: any) => Array.isArray(slot.teachers))
            : false;
          const detailFetchedAt = lastClassDetailsFetch?.[cls.id];

          return (
            !hasDetailedSlots &&
            (!detailFetchedAt ||
              Date.now() - detailFetchedAt >= DETAIL_CACHE_TIME)
          );
        })
        .map((cls) => cls.id);

      if (classIdsToEnrich.length === 0) return;

      setIsEnriching(true);
      try {
        const detailedClasses = await classService.getClassesDetails(
          token || "",
          classIdsToEnrich,
        );
        if (isCancelled) return;
        mergeClassDetails(detailedClasses);
        setClasses((prev) =>
          prev.map((existingClass) => {
            const detailedClass = detailedClasses.find(
              (cls) => cls.id === existingClass.id,
            );
            return detailedClass
              ? { ...existingClass, ...detailedClass }
              : existingClass;
          }),
        );
      } catch (err) {
        console.warn("Failed to enrich class details", err);
      } finally {
        if (!isCancelled) {
          setIsEnriching(false);
        }
      }
    };

    enrichClasses();

    return () => {
      isCancelled = true;
    };
  }, [
    classes,
    token,
    user?.teacherId,
    lastClassDetailsFetch,
    mergeClassDetails,
  ]);

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const matchesSearch =
        cls.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.course?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.course?.shortName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesTimeWindow = matchesTimeWindowFilter(cls, timeWindowFilter);

      const matchesWeekday =
        weekdayFilter === "all" ||
        getClassWeekdayIndexes(cls).includes(Number(weekdayFilter));

      const matchesShift =
        shiftFilter === "all" || getClassShift(cls) === shiftFilter;

      const matchesRole =
        roleFilter === "all" ||
        isTeacherInRole(cls, roleFilter, user?.teacherId);

      return (
        matchesSearch &&
        matchesTimeWindow &&
        matchesWeekday &&
        matchesShift &&
        matchesRole
      );
    });
  }, [
    classes,
    searchQuery,
    timeWindowFilter,
    weekdayFilter,
    shiftFilter,
    roleFilter,
    user?.teacherId,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setTimeWindowFilter("all");
    setWeekdayFilter("all");
    setShiftFilter("all");
    setRoleFilter("all");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Danh sách lớp học
            </h2>
            <p className="text-muted-foreground">
              Quản lý và theo dõi các lớp học bạn đang giảng dạy
              {isEnriching ? " • Đang tải chi tiết lớp..." : ""}
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tên lớp, khóa học..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Select
                value={timeWindowFilter}
                onValueChange={setTimeWindowFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Thời gian nghiệp vụ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả thời gian</SelectItem>
                  <SelectItem value="running">Đang dạy hiện tại</SelectItem>
                  <SelectItem value="starting_soon">
                    Bắt đầu trong 7 ngày tới
                  </SelectItem>
                  <SelectItem value="ending_soon">
                    Kết thúc trong 7 ngày tới
                  </SelectItem>
                  <SelectItem value="ending_30">
                    Kết thúc trong 30 ngày tới
                  </SelectItem>
                  <SelectItem value="started_recently">
                    Mới bắt đầu trong 30 ngày
                  </SelectItem>
                  <SelectItem value="ended">Đã kết thúc</SelectItem>
                </SelectContent>
              </Select>

              <Select value={weekdayFilter} onValueChange={setWeekdayFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Thứ trong tuần" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả các thứ</SelectItem>
                  <SelectItem value="1">Thứ 2</SelectItem>
                  <SelectItem value="2">Thứ 3</SelectItem>
                  <SelectItem value="3">Thứ 4</SelectItem>
                  <SelectItem value="4">Thứ 5</SelectItem>
                  <SelectItem value="5">Thứ 6</SelectItem>
                  <SelectItem value="6">Thứ 7</SelectItem>
                  <SelectItem value="0">Chủ nhật</SelectItem>
                </SelectContent>
              </Select>

              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Ca học" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ca</SelectItem>
                  <SelectItem value="morning">Sáng</SelectItem>
                  <SelectItem value="afternoon">Chiều</SelectItem>
                  <SelectItem value="evening">Tối</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Vai trò giảng dạy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vai trò</SelectItem>
                  <SelectItem value="LEC">Tôi là LEC</SelectItem>
                  <SelectItem value="TA">Tôi là TA</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="w-full"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Xóa bộ lọc
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên lớp</TableHead>
                <TableHead>Lịch dạy</TableHead>
                <TableHead>Ngày bắt đầu</TableHead>
                <TableHead>Ngày kết thúc</TableHead>
                <TableHead>LEC</TableHead>
                <TableHead>TA</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Lịch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <ClassesTableSkeleton />
              ) : filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Không tìm thấy lớp học nào.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map((cls) => {
                  const hasDetailedTeachers = Array.isArray(cls.slots)
                    ? cls.slots.some((slot: any) =>
                        Array.isArray(slot.teachers),
                      )
                    : false;
                  const googleCalendarUrl = hasDetailedTeachers
                    ? buildGoogleCalendarUrl(cls)
                    : null;

                  return (
                    <TableRow
                      key={cls.id}
                      className="group cursor-pointer transition-all hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:shadow-md relative"
                      onClick={() =>
                        router.push(`/dashboard/classes/${cls.id}`)
                      }
                    >
                      <TableCell className="font-medium relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200 ease-in-out" />
                        <div className="flex flex-col">
                          <span className="group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 inline-block font-bold">
                            {cls.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {cls.course?.shortName || "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {getClassWeekdays(cls)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getClassTimeRange(cls)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(cls.startDate)}</TableCell>
                      <TableCell>{formatDate(cls.endDate)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">
                        {hasDetailedTeachers ? (
                          getTeacherByRole(cls, "LEC")
                        ) : (
                          <span className="text-muted-foreground">
                            Đang tải...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">
                        {hasDetailedTeachers ? (
                          getTeacherByRole(cls, "TA")
                        ) : (
                          <span className="text-muted-foreground">
                            Đang tải...
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge type="class" status={cls.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {hasDetailedTeachers ? (
                          googleCalendarUrl ? (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={googleCalendarUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                Google Calendar
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Không có slot
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Đang tải...
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

