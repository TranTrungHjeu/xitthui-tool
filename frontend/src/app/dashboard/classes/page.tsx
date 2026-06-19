"use client";

import { useEffect, useMemo, useState, useDeferredValue, useRef } from "react";
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
import CatLoader from "@/components/CatLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import {
  Search,
  CalendarPlus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, formatTime } from "@/lib/date";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface EnrichedClassData extends ClassData {
  computed: {
    weekdayIndexes: number[];
    lecName: string;
    taName: string;
    timeRange: string;
    weekdays: string;
    searchString: string;
  };
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

function getTeacherByRole(cls: any, roleShortName: string) {
  if (Array.isArray(cls.teachers)) {
    const activeTeachers = cls.teachers.filter(
      (tAssignment: any) =>
        tAssignment.role?.shortName === roleShortName &&
        tAssignment.isActive !== false,
    );
    if (activeTeachers.length > 0) {
      return activeTeachers
        .map((t: any) => t.teacher?.fullName)
        .filter(Boolean)
        .join(", ");
    }
  }

  return "-";
}

function getRealTeacherByRole(cls: any, roleShortName: string) {
  const countTeachersFromSlots = (slotsToCount: any[]) => {
    const map = new Map<string, { name: string; count: number }>();
    slotsToCount.forEach((slot: any) => {
      if (Array.isArray(slot.teachers)) {
        slot.teachers.forEach((tAssignment: any) => {
          if (tAssignment.role?.shortName === roleShortName) {
            const teacher = tAssignment.teacher;
            if (teacher) {
              const id = teacher.id || teacher._id || teacher.fullName;
              const current = map.get(id) || {
                name: teacher.fullName,
                count: 0,
              };
              map.set(id, { ...current, count: current.count + 1 });
            }
          }
        });
      }
    });
    return map;
  };

  const getTopTeacher = (map: Map<string, { name: string; count: number }>) => {
    if (map.size === 0) return null;
    const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return sorted[0]?.name;
  };

  if (Array.isArray(cls.slots)) {
    const now = new Date().getTime();

    // 1. Ưu tiên đếm trên các slot đã diễn ra (past slots)
    const pastSlots = cls.slots.filter((slot: any) => {
      if (!slot.date || !slot.endTime) return false;
      const endDateTime = parseDateTime(slot.date, slot.endTime);
      return endDateTime && endDateTime.getTime() <= now;
    });

    const pastMap = countTeachersFromSlots(pastSlots);
    const topPast = getTopTeacher(pastMap);
    if (topPast) return topPast;

    // 2. Nếu chưa có slot nào diễn ra hoặc chưa gán GV, đếm trên toàn bộ slots
    const allMap = countTeachersFromSlots(cls.slots);
    const topAll = getTopTeacher(allMap);
    if (topAll) return topAll;
  }

  // 3. Fallback dùng cấu hình mặc định
  return getTeacherByRole(cls, roleShortName);
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

function buildGoogleCalendarUrl(cls: EnrichedClassData, realSlots?: any[]) {
  const slotsToUse = realSlots || cls.slots || [];
  const slots = [...slotsToUse]
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
    `Lịch dạy: ${cls.computed?.weekdays || "N/A"} | ${cls.computed?.timeRange || "N/A"}`,
    `LEC: ${cls.computed?.lecName || "N/A"}`,
    `TA: ${cls.computed?.taName || "N/A"}`,
    `Tổng số buổi: ${slotsToUse.length || 0} buổi`,
  ].join("\n");

  const title = `${cls.name} - ${cls.course?.shortName || "Lớp học"}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details,
  });

  // Add Recurrence Rule (RRULE) for Google Calendar so that it automatically schedules weekly
  const weekdayIndexes = cls.computed.weekdayIndexes;
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

export default function ClassesPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [enrichedClasses, setEnrichedClasses] = useState<EnrichedClassData[]>(
    [],
  );
  const [paginationMeta, setPaginationMeta] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const showLoading = useMinLoading(isLoading, 1000);
  const [isPendingFilter, setIsPendingFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [weekdayFilter, setWeekdayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("RUNNING");
  const [roleFilter, setRoleFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // State lưu trữ dữ liệu chi tiết tải bất đồng bộ (Lazy load)
  const [detailedClasses, setDetailedClasses] = useState<
    Record<string, ClassData>
  >({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>(
    {},
  );

  // Sử dụng Refs để quản lý trạng thái fetch tránh bị loop dependency
  const fetchedClassIdsRef = useRef<Set<string>>(new Set());
  const fetchingClassIdsRef = useRef<Set<string>>(new Set());

  // Lấy danh sách các cơ sở từ profile user
  const availableCentres = useMemo(() => {
    if (!user?.teacherCentres) return [];
    return user.teacherCentres.map((c: any) => ({
      id: c.id || c,
      name: c.name || c.shortName || c.id || c,
    }));
  }, [user?.teacherCentres]);

  // Khởi tạo bộ lọc trung tâm mặc định
  const [centreFilter, setCentreFilter] = useState("default_tdm");

  useEffect(() => {
    if (centreFilter === "default_tdm" && user) {
      if (availableCentres.length > 0) {
        const tdmCentre = availableCentres.find((c: any) =>
          (c.name || "").toLowerCase().includes("thủ dầu một"),
        );
        if (tdmCentre) {
          setCentreFilter(tdmCentre.id);
        } else {
          setCentreFilter("all");
        }
      } else {
        setCentreFilter("all");
      }
    }
  }, [user, availableCentres, centreFilter]);

  // Dùng setTimeout debounce cho search query để tránh gọi API liên tục khi gõ
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Các filter khác (dropdown) thay đổi là fetch luôn, không cần debounce
  const deferredWeekday = weekdayFilter;
  const deferredStatus = statusFilter;
  const deferredRole = roleFilter;
  const deferredCentre = centreFilter;

  useEffect(() => {
    let isCancelled = false;

    // Nếu chưa resolve default (trong trường hợp fallback), thì không fetch
    if (centreFilter === "default_tdm") return;

    const fetchClasses = async () => {
      console.log(
        "[ClassesPage] Fetching classes for teacherId:",
        user?.teacherId,
        "centreFilter:",
        centreFilter,
        "roles:",
        user?.appRoles,
      );

      const isTE = user?.appRoles?.includes("TE" as any);
      if (!user?.teacherId && !isTE) {
        console.warn("[ClassesPage] No teacherId found and user is not TE");
        if (!isCancelled) setIsLoading(false);
        return;
      }

      setIsPendingFilter(true);
      if (enrichedClasses.length === 0) {
        setIsLoading(true);
      }
      try {
        if (!user) return;

        // Xác định các centreIds sẽ fetch
        const targetCentres =
          centreFilter === "all"
            ? availableCentres.map((c) => c.id)
            : [centreFilter];

        let statusIn: string[] | undefined = undefined;

        console.log("[ClassesPage] Filter Status changed to:", deferredStatus);

        // Ưu tiên dùng statusFilter để quyết định statusIn gửi lên MindX
        if (deferredStatus !== "all") {
          statusIn = [deferredStatus];
        }

        console.log("[ClassesPage] Generated statusIn array:", statusIn);

        const res = await classService.getClasses(
          token || "",
          user.teacherId || "",
          targetCentres,
          user.appRoles,
          {
            statusIn,
            status: deferredStatus,
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            search: debouncedSearchQuery,
            centre: deferredCentre,
            weekday: deferredWeekday,
            role: deferredRole,
            userName: user.fullName || "",
          },
        );

        if (isCancelled) return;

        const data = res.data || [];
        const meta = res.meta || {
          total: 0,
          page: 1,
          limit: ITEMS_PER_PAGE,
          totalPages: 1,
        };

        // Tối ưu: Tính toán sẵn dữ liệu để hiển thị UI
        const enriched: EnrichedClassData[] = data.map((cls) => {
          if ((cls as any).computed) {
            return cls as EnrichedClassData;
          }

          const weekdayIndexes = getClassWeekdayIndexes(cls);
          const lecName = getTeacherByRole(cls, "LEC");
          const taName = getTeacherByRole(cls, "TA");
          const timeRange = getClassTimeRange(cls);
          const weekdays = getClassWeekdays(cls);

          // Tạo chuỗi tìm kiếm tổng hợp để search nhanh
          const searchString =
            `${cls.name} ${cls.course?.name || ""} ${cls.course?.shortName || ""} ${lecName} ${taName}`.toLowerCase();

          return {
            ...cls,
            computed: {
              weekdayIndexes,
              lecName,
              taName,
              timeRange,
              weekdays,
              searchString,
            },
          };
        });

        setClasses(data);
        setEnrichedClasses(enriched);
        setPaginationMeta(meta);
      } catch (err) {
        console.error("Failed to fetch classes", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsPendingFilter(false);
        }
      }
    };

    const isTE = user?.appRoles?.includes("TE" as any);
    if ((user?.teacherId || isTE) && token) {
      fetchClasses();
    }

    return () => {
      isCancelled = true;
    };
  }, [
    user?.teacherId,
    token,
    deferredCentre,
    deferredWeekday,
    deferredStatus,
    deferredRole,
    currentPage,
    debouncedSearchQuery,
    availableCentres,
    user?.appRoles,
    user?.fullName,
    user,
  ]);

  // Server đã filter và phân trang, ta chỉ cần alias lại các biến để code cũ hoạt động
  const filteredClasses = enrichedClasses;
  const paginatedClasses = enrichedClasses;
  const totalPages = Math.max(1, paginationMeta.totalPages);

  // Đảm bảo currentPage không vượt quá totalPages khi filter thay đổi
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Lazy load chi tiết (slots và teachers thực tế) của các lớp hiển thị trên trang hiện tại
  useEffect(() => {
    if (paginatedClasses.length === 0 || !token) return;

    const fetchDetailsForCurrentPage = async () => {
      const idsToFetch = paginatedClasses
        .map((cls) => cls.id)
        .filter(
          (id) =>
            !fetchedClassIdsRef.current.has(id) &&
            !fetchingClassIdsRef.current.has(id),
        );

      if (idsToFetch.length === 0) return;

      // Đánh dấu là đang fetch để tránh call trùng
      idsToFetch.forEach((id) => fetchingClassIdsRef.current.add(id));

      setLoadingDetails((prev) => {
        const next = { ...prev };
        idsToFetch.forEach((id) => {
          next[id] = true;
        });
        return next;
      });

      try {
        // Fetch chi tiết hàng loạt các lớp
        const details = await classService.getClassesDetails(token, idsToFetch);

        if (details && Array.isArray(details)) {
          setDetailedClasses((prev) => {
            const next = { ...prev };
            details.forEach((detail) => {
              if (detail && detail.id) {
                next[detail.id] = detail;
                fetchedClassIdsRef.current.add(detail.id);
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error(
          `Failed to fetch details for classes: ${idsToFetch.join(", ")}`,
          err,
        );
      } finally {
        idsToFetch.forEach((id) => {
          fetchingClassIdsRef.current.delete(id);
        });

        // Đảm bảo những ID nào bị lỗi hoặc không trả về sẽ được dùng dữ liệu gốc (tránh kẹt loading vĩnh viễn)
        setDetailedClasses((prev) => {
          const next = { ...prev };
          let changed = false;
          idsToFetch.forEach((id) => {
            if (!next[id]) {
              const originalCls = paginatedClasses.find((c) => c.id === id);
              if (originalCls) {
                next[id] = originalCls;
                fetchedClassIdsRef.current.add(id);
                changed = true;
              }
            }
          });
          return changed ? next : prev;
        });

        setLoadingDetails((prev) => {
          const next = { ...prev };
          idsToFetch.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      }
    };

    fetchDetailsForCurrentPage();
  }, [paginatedClasses, token]);

  // Reset về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchQuery,
    deferredWeekday,
    deferredStatus,
    deferredRole,
    deferredCentre,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setWeekdayFilter("all");
    setStatusFilter("RUNNING");
    setRoleFilter("all");
    const tdmCentre = availableCentres.find((c) =>
      c.name.toLowerCase().includes("thủ dầu một"),
    );
    setCentreFilter(tdmCentre ? tdmCentre.id : "all");
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
                value={centreFilter === "default_tdm" ? "all" : centreFilter}
                onValueChange={setCentreFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả cơ sở</SelectItem>
                  {availableCentres.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
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

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="RUNNING">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Đang diễn ra
                    </div>
                  </SelectItem>
                  <SelectItem value="OPEN">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      Đang mở
                    </div>
                  </SelectItem>
                  <SelectItem value="PRE_OPEN">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      Sắp khai giảng
                    </div>
                  </SelectItem>
                  <SelectItem value="PREPARING">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400" />
                      Đang chuẩn bị
                    </div>
                  </SelectItem>
                  <SelectItem value="NEW">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Mới
                    </div>
                  </SelectItem>
                  <SelectItem value="FINISHED">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-500" />
                      Đã kết thúc
                    </div>
                  </SelectItem>
                  <SelectItem value="PENDING">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Chờ duyệt
                    </div>
                  </SelectItem>
                  <SelectItem value="SUSPENDED">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      Tạm dừng
                    </div>
                  </SelectItem>
                  <SelectItem value="ABANDONED">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Đã hủy
                    </div>
                  </SelectItem>
                  <SelectItem value="REJECTED">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-600" />
                      Bị từ chối
                    </div>
                  </SelectItem>
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
                className="w-full h-full"
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
        <CardContent className="p-0 overflow-x-auto relative min-h-[500px]">
          {/* Overlay Loading giữ nguyên bảng cũ */}
          {showLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px]">
              <CatLoader />
              <p className="text-sm font-medium text-muted-foreground mt-3">
                Đang tải dữ liệu...
              </p>
            </div>
          )}

          <Table className="table-fixed min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] min-w-[200px] md:w-[250px] md:min-w-[250px]">
                  Tên lớp
                </TableHead>
                <TableHead className="w-[120px] min-w-[120px] md:w-[150px] md:min-w-[150px]">
                  Lịch dạy
                </TableHead>
                <TableHead className="w-[100px] min-w-[100px]">
                  Ngày bắt đầu
                </TableHead>
                <TableHead className="w-[100px] min-w-[100px]">
                  Ngày kết thúc
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] md:w-[150px] md:min-w-[150px]">
                  LEC
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] md:w-[150px] md:min-w-[150px]">
                  TA
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px]">
                  Trạng thái
                </TableHead>
                <TableHead className="w-[150px] min-w-[150px]">Lịch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0 relative">
              {filteredClasses.length === 0 && !showLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center">
                    Không tìm thấy lớp học nào.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClasses.map((cls) => {
                  // Lấy thông tin chi tiết (đã tải bất đồng bộ)
                  const isDetailLoaded = !!detailedClasses[cls.id];
                  const currentClassData = detailedClasses[cls.id] || cls;

                  const googleCalendarUrl = buildGoogleCalendarUrl(
                    cls,
                    currentClassData.slots,
                  );

                  // Tính toán Real LEC và TA nếu đã load được slots thực tế, nếu không hiển thị trạng thái đang tải
                  const displayedLecName = isDetailLoaded
                    ? getRealTeacherByRole(currentClassData, "LEC")
                    : "";

                  const displayedTaName = isDetailLoaded
                    ? getRealTeacherByRole(currentClassData, "TA")
                    : "";

                  return (
                    <TableRow
                      key={cls.id}
                      className={`group cursor-pointer border-b transition-all hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:shadow-md relative ${isPendingFilter ? "opacity-50" : ""}`}
                      onClick={() =>
                        router.push(`/dashboard/classes/${cls.id}`)
                      }
                    >
                      <TableCell className="font-medium relative max-w-[200px] min-w-[150px]">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200 ease-in-out" />
                        <div className="flex flex-col">
                          <span className="group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 inline-block font-bold truncate w-full">
                            {cls.name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {cls.course?.shortName || "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {cls.computed.weekdays}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {cls.computed.timeRange}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(cls.startDate)}</TableCell>
                      <TableCell>{formatDate(cls.endDate)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs relative">
                        <div className="flex items-center h-6 gap-1">
                          {!isDetailLoaded ? (
                            <div className="flex items-center gap-1 text-muted-foreground/70 animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              <span>Đang tính toán...</span>
                            </div>
                          ) : (
                            <span className="font-semibold text-primary truncate block">
                              {displayedLecName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">
                        <div className="flex items-center h-6 gap-1">
                          {!isDetailLoaded ? (
                            <div className="flex items-center gap-1 text-muted-foreground/70 animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              <span>Đang tính toán...</span>
                            </div>
                          ) : (
                            <span className="font-semibold text-primary truncate block">
                              {displayedTaName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge type="class" status={cls.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {googleCalendarUrl ? (
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
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div
            className={`border-t transition-opacity duration-200 min-h-[65px] flex flex-col justify-center ${
              showLoading ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {filteredClasses.length > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 gap-4">
                <div className="text-sm text-muted-foreground order-2 md:order-1">
                  Hiển thị{" "}
                  <span className="font-semibold">
                    {Math.min(
                      paginationMeta.total,
                      (paginationMeta.page - 1) * paginationMeta.limit + 1,
                    )}
                    -
                    {Math.min(
                      paginationMeta.total,
                      paginationMeta.page * paginationMeta.limit,
                    )}
                  </span>{" "}
                  trên{" "}
                  <span className="font-semibold">{paginationMeta.total}</span>{" "}
                  lớp học.
                </div>

                <div className="flex items-center space-x-2 order-1 md:order-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }).map(
                      (_, i) => {
                        let pageNum = currentPage;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={
                              currentPage === pageNum ? "default" : "outline"
                            }
                            size="icon"
                            className="h-8 w-8 text-xs"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      },
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
