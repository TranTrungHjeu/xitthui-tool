"use client";

import { useEffect, useMemo, useState, useDeferredValue, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { ClassData } from "@/types";
import { classService } from "@/services/classService";
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
import { Button } from "@/components/ui/button";
import ClassDetailDrawer from "@/components/ClassDetailDrawer";
import { useMinLoading } from "@/hooks/useMinLoading";
import { DataPagination } from "@/components/ui/data-pagination";
import { TopLoadingBar } from "@/components/ui/top-loading-bar";
import { FilterChip } from "@/components/ui/filter-chip";
import { TableStateView } from "@/components/ui/table-state-view";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  Search,
  RotateCcw,
  Bot,
  Code2,
  Palette,
} from "lucide-react";
import { formatDate, formatTime } from "@/lib/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const { user } = useAuthStore();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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
  const [error, setError] = useState<string | null>(null);
  const showLoading = useMinLoading(isLoading, 1000);
  const [isPendingFilter, setIsPendingFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [weekdayFilter, setWeekdayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("RUNNING");
  const [roleFilter, setRoleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const deferredCategory = useDeferredValue(categoryFilter);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Lấy danh sách các cơ sở từ profile user
  const availableCentres = useMemo(() => {
    if (!user?.teacherCentres) return [];
    return user.teacherCentres.map((c: any) => ({
      id: c.id || c,
      name: c.name || c.shortName || c.id || c,
    }));
  }, [user?.teacherCentres]);

  /*
   * Centre is locked to TDM for this page. We compute the resolved TDM
   * centre id once, with a fallback to "all" if the user happens to not
   * be assigned to TDM. The dropdown UI is intentionally removed so the
   * user can never change it from this view.
   *
   * If TDM isn't found, the lock silently degrades to "all" so the page
   * still works for users who only teach at other centres.
   */
  const lockedCentreId = useMemo(() => {
    if (availableCentres.length === 0) return "all";
    const tdmCentre = availableCentres.find((c: any) =>
      (c.name || "").toLowerCase().includes("thủ dầu một"),
    );
    return tdmCentre ? tdmCentre.id : "all";
  }, [availableCentres]);
  const centreFilter = lockedCentreId;

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

  const fetchClasses = useCallback(async (forceLoading = false) => {
    const isTE = user?.appRoles?.includes("TE" as any);
    if (!user?.teacherId && !isTE) {
      setIsLoading(false);
      return;
    }

    setIsPendingFilter(true);
    if (enrichedClasses.length === 0 || forceLoading) {
      setIsLoading(true);
    }
    try {
      if (!user) return;

      const targetCentres =
        centreFilter === "all"
          ? availableCentres.map((c) => c.id)
          : [centreFilter];

      let statusIn: string[] | undefined = undefined;

      if (deferredStatus !== "all") {
        statusIn = [deferredStatus];
      }

      const res = await classService.getClasses(
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

      const data = res.data || [];
      const meta = res.meta || {
        total: 0,
        page: 1,
        limit: ITEMS_PER_PAGE,
        totalPages: 1,
      };

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
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch classes", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Không thể tải danh sách lớp học. Vui lòng thử lại.";
      setError(msg);
      setClasses([]);
      setEnrichedClasses([]);
      setPaginationMeta({ total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 1 });
    } finally {
      setIsLoading(false);
      setIsPendingFilter(false);
    }
  }, [
    user,
    centreFilter,
    availableCentres,
    deferredStatus,
    currentPage,
    debouncedSearchQuery,
    deferredCentre,
    deferredWeekday,
    deferredRole,
    deferredCategory,
    enrichedClasses.length,
  ]);

  useEffect(() => {
    const isTE = user?.appRoles?.includes("TE" as any);
    if (user?.teacherId || isTE) {
      fetchClasses();
    }
  }, [fetchClasses, user]);

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
    setError(null);
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
  };

  /*
   * Display labels for each filter, used both in dropdowns and in the
   * active-filter chips below the toolbar. Centralizing these keeps the
   * Vietnamese copy in one place instead of scattered in <SelectItem>s.
   */
  const STATUS_LABELS: Record<string, string> = {
    all: "Tất cả trạng thái",
    RUNNING: "Đang diễn ra",
    OPEN: "Đang mở",
    PRE_OPEN: "Sắp khai giảng",
    PREPARING: "Đang chuẩn bị",
    NEW: "Mới",
    FINISHED: "Đã kết thúc",
    PENDING: "Chờ duyệt",
    SUSPENDED: "Tạm dừng",
    ABANDONED: "Đã hủy",
    REJECTED: "Bị từ chối",
  };
  const CATEGORY_LABELS: Record<string, string> = {
    all: "Tất cả bộ môn",
    coding: "Lập trình",
    robotics: "Robotics",
    art: "Mỹ thuật",
  };
  const ROLE_LABELS: Record<string, string> = {
    all: "Tất cả vai trò",
    LEC: "Giảng viên (LEC)",
    TA: "Trợ giảng (TA)",
  };
  const WEEKDAY_LABELS: Record<string, string> = {
    all: "Tất cả các thứ",
    "1": "Thứ 2",
    "2": "Thứ 3",
    "3": "Thứ 4",
    "4": "Thứ 5",
    "5": "Thứ 6",
    "6": "Thứ 7",
    "0": "Chủ nhật",
  };
  const isFiltersDefault =
    searchQuery === "" &&
    weekdayFilter === "all" &&
    statusFilter === "RUNNING" &&
    roleFilter === "all" &&
    categoryFilter === "all";

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-background via-background to-brand-60-soft/30">
      {/*
       * Two-row layout:
       *   1. Toolbar (filters + refresh)
       *   2. Table card
       * No page header — the sidebar selection and toolbar are enough
       * context. Keeps focus on the data.
       */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Main card view — soft Stratos tint around the page, white
            card for the table itself. The Stratos wash is subtle (~5%
            alpha) so it never fights with the data. */}
        <div className="flex-1 border border-brand-60/10 bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
        {/* Top loading bar — animates across the very top edge of the card
            whenever a refetch is in-flight. Uses brand-10 (Crimson) so it
            reads as an action, not a passive indicator. */}
        <TopLoadingBar loading={showLoading && enrichedClasses.length > 0} />

        {/* Filters Toolbar */}
        <div className="px-2.5 py-2 bg-card border-b border-border flex flex-wrap items-center gap-2 shrink-0">
          {/* Search Box */}
          <div className="relative flex-[2] min-w-[200px] sm:min-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Tìm tên lớp, khóa học..."
              className="pl-8 h-8 text-xs bg-card w-full border-border focus-visible:ring-brand-10/30 focus-visible:border-brand-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="flex-1 min-w-[110px] sm:min-w-[130px]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                <SelectValue placeholder="Bộ môn" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">Tất cả bộ môn</SelectItem>
                <SelectItem value="coding">Lập trình (Coding)</SelectItem>
                <SelectItem value="robotics">Robotics</SelectItem>
                <SelectItem value="art">Mỹ thuật (Art)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weekday Filter */}
          <div className="flex-1 min-w-[120px] sm:min-w-[140px]">
            <Select value={weekdayFilter} onValueChange={setWeekdayFilter}>
              <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                <SelectValue placeholder="Thứ tự học" />
              </SelectTrigger>
              <SelectContent className="text-xs">
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
          </div>

          {/* Status Filter */}
          <div className="flex-1 min-w-[120px] sm:min-w-[150px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="RUNNING">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Đang diễn ra
                  </div>
                </SelectItem>
                <SelectItem value="OPEN">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-info/150" />
                    Đang mở
                  </div>
                </SelectItem>
                <SelectItem value="PRE_OPEN">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-info/150" />
                    Sắp khai giảng
                  </div>
                </SelectItem>
                <SelectItem value="PREPARING">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-info" />
                    Đang chuẩn bị
                  </div>
                </SelectItem>
                <SelectItem value="NEW">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    Mới
                  </div>
                </SelectItem>
                <SelectItem value="FINISHED">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    Đã kết thúc
                  </div>
                </SelectItem>
                <SelectItem value="PENDING">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    Chờ duyệt
                  </div>
                </SelectItem>
                <SelectItem value="SUSPENDED">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    Tạm dừng
                  </div>
                </SelectItem>
                <SelectItem value="ABANDONED">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    Đã hủy
                  </div>
                </SelectItem>
                <SelectItem value="REJECTED">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    Bị từ chối
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Filter */}
          <div className="flex-1 min-w-[120px] sm:min-w-[130px]">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                <SelectItem value="LEC">Tôi là LEC</SelectItem>
                <SelectItem value="TA">Tôi là TA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters (only when something is active) */}
          {!isFiltersDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
              onClick={resetFilters}
            >
              <RotateCcw className="h-3 w-3" />
              <span>Đặt lại</span>
            </Button>
          )}

          {/* Refresh — always visible. Lives in the toolbar instead of a
              page header so the page header itself can stay hidden. */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchClasses(true)}
            disabled={showLoading}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 border-brand-10/30 text-brand-10 hover:bg-brand-10-soft hover:text-brand-10 hover:border-brand-10/50 active:scale-95 transition-all"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${showLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>

        {/*
         * Active filter chips — second row showing the currently applied
         * filters with a quick X to remove each one. The chips double as
         * a status indicator: if the user sees RUNNING + Robotics chips,
         * they know the list is scoped without having to re-open the
         * dropdowns. Hidden when filters are at their defaults.
         *
         * Background uses a Stratos (brand-60) tint at very low alpha so
         * the active-filter row reads as a "scope banner" — distinct from
         * the toolbar above and the table below.
         */}
        {!isFiltersDefault && (
          <div className="px-2.5 py-1.5 border-b border-brand-60/10 bg-brand-60-soft/60 flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-brand-60/70 font-semibold mr-1 uppercase tracking-wider">
              Đang lọc:
            </span>
            {searchQuery && (
              <FilterChip
                label={`"${searchQuery}"`}
                tone="muted"
                onRemove={() => setSearchQuery("")}
              />
            )}
            {statusFilter !== "all" && (
              <FilterChip
                label={STATUS_LABELS[statusFilter] || statusFilter}
                tone={
                  statusFilter === "RUNNING"
                    ? "success"
                    : statusFilter === "FINISHED" ||
                      statusFilter === "ABANDONED" ||
                      statusFilter === "REJECTED"
                    ? "muted"
                    : "info"
                }
                onRemove={() => setStatusFilter("all")}
              />
            )}
            {categoryFilter !== "all" && (
              <FilterChip
                label={CATEGORY_LABELS[categoryFilter] || categoryFilter}
                tone="default"
                onRemove={() => setCategoryFilter("all")}
              />
            )}
            {weekdayFilter !== "all" && (
              <FilterChip
                label={WEEKDAY_LABELS[weekdayFilter] || weekdayFilter}
                tone="default"
                onRemove={() => setWeekdayFilter("all")}
              />
            )}
            {roleFilter !== "all" && (
              <FilterChip
                label={ROLE_LABELS[roleFilter] || roleFilter}
                tone="default"
                onRemove={() => setRoleFilter("all")}
              />
            )}
          </div>
        )}

        {/* Table Container */}
        <div className="flex-1 overflow-auto custom-scrollbar relative" aria-busy={isLoading}>
          {/* Empty / Error state. Rendered above the table; the table
              itself stays mounted so its column widths don't collapse
              when the state changes. */}
          {filteredClasses.length === 0 && !showLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
              <TableStateView
                error={error}
                empty={!error}
                onRetry={() => fetchClasses(true)}
                emptyTitle="Không tìm thấy lớp học"
                emptyDescription={
                  isFiltersDefault
                    ? "Bạn chưa có lớp học nào được phân công."
                    : "Không có lớp học nào khớp với bộ lọc hiện tại. Hãy thử bỏ một số bộ lọc."
                }
              />
            </div>
          )}

          {/* Initial load skeleton — matches the table layout so the page
              doesn't shift when real rows arrive. */}
          {showLoading && enrichedClasses.length === 0 && (
            <div className="p-0">
              <div className="h-9 border-b bg-muted/40" />
              <TableSkeleton rows={8} columns={8} />
            </div>
          )}

          <Table
            className={`table-fixed min-w-[1000px] ${
              showLoading && enrichedClasses.length > 0 ? "opacity-60" : ""
            }`}
          >
            <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--brand-60)/0.08)]">
              <TableRow className="h-9">
                <TableHead className="w-[200px] min-w-[200px] md:w-[250px] md:min-w-[250px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  Tên lớp
                </TableHead>
                <TableHead className="w-[90px] min-w-[90px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  Buổi
                </TableHead>
                <TableHead className="w-[120px] min-w-[120px] md:w-[150px] md:min-w-[150px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  Lịch dạy
                </TableHead>
                <TableHead className="w-[100px] min-w-[100px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  Bắt đầu
                </TableHead>
                <TableHead className="w-[100px] min-w-[100px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  Kết thúc
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] md:w-[150px] md:min-w-[150px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  LEC
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] md:w-[150px] md:min-w-[150px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  TA
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                  Trạng thái
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0">
              {filteredClasses.map((cls) => {
                const displayedLecName = cls.computed.lecName || "-";
                const displayedTaName = cls.computed.taName || "-";
                const category = cls.computed.category;
                const CategoryIcon =
                  category === "robotics"
                    ? Bot
                    : category === "art"
                    ? Palette
                    : category === "coding"
                    ? Code2
                    : null;
                const categoryLabel =
                  category === "robotics"
                    ? "Robotics"
                    : category === "art"
                    ? "Mỹ thuật"
                    : category === "coding"
                    ? "Lập trình"
                    : null;

                return (
                  <TableRow
                    key={cls.id}
                    className={`group cursor-pointer border-b border-brand-60/5 transition-colors hover:bg-brand-10-soft/50 relative ${
                      isPendingFilter ? "opacity-50" : ""
                    }`}
                    onClick={() => setSelectedClassId(cls.id)}
                  >
                    <TableCell className="font-medium relative max-w-[200px] min-w-[150px]">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-10 scale-y-0 group-hover:scale-y-100 transition-transform duration-200 ease-in-out origin-center" />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {CategoryIcon && (
                            <Tooltip delayDuration={150}>
                              <TooltipTrigger asChild>
                                <CategoryIcon
                                  className={`h-3 w-3 shrink-0 ${
                                    category === "robotics"
                                      ? "text-[#F97316]"
                                      : category === "art"
                                      ? "text-[#8B5CF6]"
                                      : "text-[#2563EB]"
                                  }`}
                                  aria-label={categoryLabel || undefined}
                                />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-brand-60 text-white text-xs px-2 py-1 rounded shadow-md border-0"
                              >
                                {categoryLabel}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <span className="group-hover:text-brand-10 group-hover:translate-x-1 transition-all duration-200 inline-block text-xs font-bold truncate text-foreground">
                            {cls.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {cls.course?.shortName || "N/A"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-brand-10 dark:text-brand-10">
                      Buổi {cls.computed.currentSessionIndex || 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          {cls.computed.weekdays}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {cls.computed.timeRange}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-normal text-foreground/90">{formatDate(cls.startDate)}</TableCell>
                    <TableCell className="text-xs font-normal text-foreground/90">{formatDate(cls.endDate)}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs relative">
                      <div className="flex items-center h-6 gap-1">
                        <span className="font-semibold text-brand-60 truncate block">
                          {displayedLecName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs">
                      <div className="flex items-center h-6 gap-1">
                        <span className="font-semibold text-brand-60 truncate block">
                          {displayedTaName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <StatusBadge type="class" status={cls.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Footer / Pagination */}
        <DataPagination
          page={currentPage}
          totalPages={totalPages}
          total={paginationMeta.total}
          limit={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          className="border-t border-brand-60/10 bg-brand-60-soft/40"
        />
        </div>
      </div>

      {/* Class Detail Drawer */}
      <ClassDetailDrawer
        classId={selectedClassId}
        open={!!selectedClassId}
        onClose={() => setSelectedClassId(null)}
      />
    </div>
  );
}
