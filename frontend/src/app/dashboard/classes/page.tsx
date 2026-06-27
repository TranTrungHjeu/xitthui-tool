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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Bot,
  Code2,
  Palette,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnrichedClassData extends ClassData {
  computed: {
    weekdayIndexes: number[];
    lecName: string;
    taName: string;
    timeRange: string;
    weekdays: string;
    searchString: string;
    category?: "coding" | "robotics" | "art" | "unknown";
    currentSessionIndex?: number;
  };
}

function getFrontCourseCategory(
  clsName: string,
  courseName?: string,
): "coding" | "robotics" | "art" | "unknown" {
  const name = `${clsName || ""} ${courseName || ""}`.toUpperCase();
  if (name.includes("XART")) return "art";
  if (name.includes("ROB") || name.includes("RBT")) return "robotics";

  const codingPrefixes = [
    "SB",
    "SA",
    "SI",
    "GB",
    "GA",
    "GI",
    "PTB",
    "PTA",
    "PTI",
    "JSB",
    "JSA",
    "JSI",
    "CSB",
    "CSA",
    "CSI",
    "NG",
    "NEXT GEN",
    "NEXTGEN",
  ];
  const roboticsPrefixes = [
    "KIROB",
    "PREB",
    "PREA",
    "PREI",
    "ARMB",
    "ARMA",
    "ARMI",
    "SEMIB",
    "SEMIA",
    "SEMII",
    "AUTOA",
  ];
  const artPrefixes = [
    "KAB",
    "KAA",
    "KAI",
    "VAB",
    "VAA",
    "VAI",
    "VCB",
    "VCA",
    "VCI",
    "GDB",
    "GDA",
    "GDI",
    "MDB",
    "MDA",
    "MDI",
    "DAB",
    "DAA",
    "DAI",
    "IDB",
    "IDA",
    "IDI",
  ];

  for (const prefix of roboticsPrefixes) {
    const regex = new RegExp(`(^|[-_ .])${prefix}([-_ .\\d]|$)`);
    if (regex.test(name)) return "robotics";
  }
  for (const prefix of artPrefixes) {
    const regex = new RegExp(`(^|[-_ .])${prefix}([-_ .\\d]|$)`);
    if (regex.test(name)) return "art";
  }
  for (const prefix of codingPrefixes) {
    const regex = new RegExp(`(^|[-_ .])${prefix}([-_ .\\d]|$)`);
    if (regex.test(name)) return "coding";
  }

  return "unknown";
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

function getFrontCurrentSessionIndex(slots?: any[]): number {
  if (!slots || slots.length === 0) return 0;
  const now = new Date().getTime();

  let pastCount = 0;
  slots.forEach((slot: any) => {
    if (!slot.date || !slot.endTime) return;
    const endDateTime = parseDateTime(slot.date, slot.endTime);
    if (endDateTime && endDateTime.getTime() <= now) {
      pastCount++;
    }
  });

  return pastCount;
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const deferredCategory = useDeferredValue(categoryFilter);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 1000;

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
      const isTE = user?.appRoles?.includes("TE" as any);
      if (!user?.teacherId && !isTE) {
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

        // Ưu tiên dùng statusFilter để quyết định statusIn gửi lên MindX
        if (deferredStatus !== "all") {
          statusIn = [deferredStatus];
        }

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
            category: deferredCategory,
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
            const comp = (cls as any).computed;
            if (!comp.category) {
              comp.category = getFrontCourseCategory(cls.name || "", cls.course?.name || "");
            }
            if (comp.currentSessionIndex === undefined) {
              comp.currentSessionIndex = getFrontCurrentSessionIndex(cls.slots);
            }
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

          const category = getFrontCourseCategory(cls.name || "", cls.course?.name || "");
          const currentSessionIndex = getFrontCurrentSessionIndex(cls.slots);

          return {
            ...cls,
            computed: {
              weekdayIndexes,
              lecName,
              taName,
              timeRange,
              weekdays,
              searchString,
              category,
              currentSessionIndex,
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
    deferredCategory,
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



  // Reset về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchQuery,
    deferredWeekday,
    deferredStatus,
    deferredRole,
    deferredCentre,
    deferredCategory,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setWeekdayFilter("all");
    setStatusFilter("RUNNING");
    setRoleFilter("all");
    setCategoryFilter("all");
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
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

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Bộ môn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả bộ môn</SelectItem>
                  <SelectItem value="coding">Lập trình (Coding)</SelectItem>
                  <SelectItem value="robotics">Robotics</SelectItem>
                  <SelectItem value="art">Mỹ thuật (Art)</SelectItem>
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
        <CardContent className={`p-0 overflow-x-auto relative ${showLoading && classes.length === 0 ? "min-h-[400px]" : ""}`}>
          {/* Overlay Loading giữ nguyên bảng cũ */}
          {showLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px]">
              <CatLoader />
            </div>
          )}

          <Table className="table-fixed min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] min-w-[200px] md:w-[250px] md:min-w-[250px]">
                  Tên lớp
                </TableHead>
                <TableHead className="w-[90px] min-w-[90px]">
                  Buổi
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
                  const displayedLecName = cls.computed.lecName || "-";
                  const displayedTaName = cls.computed.taName || "-";

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
                      <TableCell className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Buổi {cls.computed.currentSessionIndex || 0}
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
                          <span className="font-semibold text-primary truncate block">
                            {displayedLecName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">
                        <div className="flex items-center h-6 gap-1">
                          <span className="font-semibold text-primary truncate block">
                            {displayedTaName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="relative overflow-hidden pr-10">
                        <StatusBadge type="class" status={cls.status} />

                        {cls.computed.category && cls.computed.category !== "unknown" && (
                          <Tooltip delayDuration={150}>
                            <TooltipTrigger asChild>
                              <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-auto cursor-pointer z-10 group/ribbon">
                                <div
                                  className={`absolute top-[-4px] right-[-24px] w-16 h-5 rotate-45 flex items-center justify-center shadow-sm transition-all duration-300 group-hover/ribbon:scale-110 group-hover/ribbon:brightness-110 ${
                                    cls.computed.category === "robotics"
                                      ? "bg-[#F97316]"
                                      : cls.computed.category === "art"
                                      ? "bg-[#8B5CF6]"
                                      : "bg-[#2563EB]"
                                  }`}
                                >
                                  {cls.computed.category === "robotics" && (
                                    <Bot className="h-3 w-3 text-white -rotate-45" />
                                  )}
                                  {cls.computed.category === "art" && (
                                    <Palette className="h-3 w-3 text-white -rotate-45" />
                                  )}
                                  {cls.computed.category === "coding" && (
                                    <Code2 className="h-3 w-3 text-white -rotate-45" />
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-md border-0">
                              {cls.computed.category === "robotics"
                                ? "Robotics Class"
                                : cls.computed.category === "art"
                                ? "Art Class"
                                : "Coding Class"}
                            </TooltipContent>
                          </Tooltip>
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
                <div className="text-sm text-muted-foreground">
                  Hiển thị tất cả <span className="font-semibold">{paginationMeta.total}</span> lớp học.
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
