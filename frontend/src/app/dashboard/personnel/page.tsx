"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { teacherService } from "@/services/teacherService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DataPagination } from "@/components/ui/data-pagination";
import { TopLoadingBar } from "@/components/ui/top-loading-bar";
import { FilterChip } from "@/components/ui/filter-chip";
import { TableStateView } from "@/components/ui/table-state-view";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { AlertModal } from "@/components/ui/alert-modal";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import PersonnelDetailDrawer from "@/components/PersonnelDetailDrawer";
import {
  Search,
  Users,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useMinLoading } from "@/hooks/useMinLoading";
import { Teacher } from "@/types";
import { toast } from "@/components/ui/toast";

const formatGender = (gender?: string) => {
  if (!gender) return "—";
  const g = gender.toUpperCase();
  if (g === "MALE") return "Nam";
  if (g === "FEMALE") return "Nữ";
  return gender;
};

const getInitials = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

let cachedTeachers: Teacher[] | null = null;
let globalFetchPromise: Promise<{
  data: Teacher[];
  total: number;
}> | null = null;

const VIEW_LABELS: Record<string, string> = {
  active: "Đang hiển thị",
  inactive: "Đã ẩn",
  all: "Tất cả",
};

export default function PersonnelPage() {
  const { user } = useAuthStore();
  const [teachers, setTeachers] = useState<Teacher[]>(cachedTeachers || []);
  const [isLoading, setIsLoading] = useState(!cachedTeachers);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [inactiveTeacherIds, setInactiveTeacherIds] = useState<Set<string>>(
    new Set(),
  );
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [view, setView] = useState<"all" | "active" | "inactive">("active");
  const [syncing, setSyncing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(!cachedTeachers);

  const showLoading = useMinLoading(isLoading, 600);
  const isTE = user?.appRoles?.includes("TE" as any);

  useEffect(() => {
    const loadInactivePrefs = async () => {
      if (!user?.id) return;
      try {
        const res = await teacherService.getTeacherVisibility(user.id);
        if (res.success && res.preferences?.hiddenTeacherIds) {
          setInactiveTeacherIds(new Set(res.preferences.hiddenTeacherIds));
        }
      } catch (err) {
        console.warn("Failed to load inactive personnel preferences:", err);
      }
    };
    loadInactivePrefs();
  }, [user?.id]);

  const toggleTeacherActive = async (teacherId: string) => {
    const newInactive = new Set(inactiveTeacherIds);
    if (newInactive.has(teacherId)) {
      newInactive.delete(teacherId);
    } else {
      newInactive.add(teacherId);
    }
    setInactiveTeacherIds(newInactive);
    if (user?.id) {
      try {
        await teacherService.saveTeacherVisibility(
          user.id,
          Array.from(newInactive),
        );
      } catch (err) {
        console.error("Failed to save personnel activity preference:", err);
      }
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    if (cachedTeachers) {
      const timer = setTimeout(() => {
        if (cachedTeachers) {
          setTeachers(cachedTeachers);
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    let isCancelled = false;
    const fetchTeachers = async () => {
      try {
        if (!globalFetchPromise) {
          globalFetchPromise = teacherService
            .getTeachers()
            .then((res) => ({
              data: res.data as Teacher[],
              total: res.pagination?.total || 0,
            }));
        }
        const res = await globalFetchPromise;
        if (isCancelled) return;
        if (res) {
          cachedTeachers = res.data || [];
          setTeachers(cachedTeachers!);
          setTotalTeachers(res.total || 0);
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        globalFetchPromise = null;
        const message =
          err instanceof Error ? err.message : "Lỗi kết nối.";
        setError(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      }
    };
    fetchTeachers();
    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.fullName?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.phoneNumber?.toLowerCase().includes(q) ||
        t.username?.toLowerCase().includes(q),
    );
  }, [teachers, search]);

  const activeTeachers = useMemo(
    () => filtered.filter((t) => !inactiveTeacherIds.has(t.id)),
    [filtered, inactiveTeacherIds],
  );
  const inactiveTeachers = useMemo(
    () => filtered.filter((t) => inactiveTeacherIds.has(t.id)),
    [filtered, inactiveTeacherIds],
  );

  const displayedTeachers = useMemo(() => {
    if (view === "all") return [...activeTeachers, ...inactiveTeachers];
    if (view === "active") return activeTeachers;
    return inactiveTeachers;
  }, [view, activeTeachers, inactiveTeachers]);

  const resetFilters = () => {
    setSearch("");
    setView("active");
  };

  const isFiltersDefault = search === "" && view === "active";

  if (user && !isTE) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <EyeOff className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Không có quyền truy cập</h1>
        <p className="text-muted-foreground max-w-md">
          Bạn không có quyền truy cập vào trang Quản lý Nhân sự. Chức năng
          này chỉ dành cho tài khoản có quyền Giáo vụ / Quản lý (TE).
        </p>
      </div>
    );
  }

  const handleRefresh = async () => {
    cachedTeachers = null;
    globalFetchPromise = null;
    setIsLoading(true);
    setError(null);
    setIsInitialLoad(true);
    try {
      const res = await teacherService.getTeachers();
      if (res.data) {
        cachedTeachers = res.data as Teacher[];
        setTeachers(cachedTeachers);
        setTotalTeachers(res.pagination?.total || 0);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi nạp dữ liệu.");
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleSyncPersonnel = async () => {
    setSyncing(true);
    try {
      const res = await teacherService.syncPersonnel(user?.appRoles);
      if (res?.success) {
        toast.success(res.message || "Đang đồng bộ nhân sự từ LMS...");
      } else {
        toast.error("Không thể đồng bộ. Vui lòng thử lại.");
      }
      cachedTeachers = null;
      globalFetchPromise = null;
      await handleRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Lỗi khi đồng bộ LMS.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-background via-background to-brand-60-soft/30">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 border border-brand-60/10 bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
          <TopLoadingBar
            loading={showLoading && teachers.length > 0}
          />

          {/* Toolbar */}
          <div className="p-1.5 bg-card border-b border-brand-60/10 flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="relative flex-1 min-w-[200px] sm:min-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Tìm theo tên, email, mã giáo viên..."
                className="pl-8 h-8 text-xs bg-card w-full border-border focus:ring-4 focus:ring-primary/10 focus:border-primary"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* View tabs (active/inactive/all) — same role as a filter */}
            <Tabs
              value={view}
              onValueChange={(v) => setView(v as any)}
            >
              <TabsList className="h-8 p-0.5 bg-muted/60 border border-border/60">
                <TabsTrigger
                  value="active"
                  className="h-7 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                >
                  Đang hiển thị ({activeTeachers.length})
                </TabsTrigger>
                <TabsTrigger
                  value="inactive"
                  className="h-7 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                >
                  Đã ẩn ({inactiveTeachers.length})
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="h-7 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                >
                  Tất cả ({filtered.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Sync LMS (admin only) — same brand-10 primary as Classes */}
            {isTE && (
              <Button
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
                onClick={handleSyncPersonnel}
                disabled={syncing || showLoading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {syncing ? "Đang đồng bộ" : "Đồng bộ LMS"}
                </span>
              </Button>
            )}

            {/* Reset filters */}
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

            {/* Refresh */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={showLoading}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 border-brand-10/30 text-brand-10 hover:bg-brand-10-soft hover:text-brand-10 hover:border-brand-10/50 active:scale-95 transition-all"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${showLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>

          {/* Active filter chips */}
          {!isFiltersDefault && (
            <div className="px-2.5 py-1.5 border-b border-brand-60/10 bg-brand-60-soft/60 flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-brand-60/70 font-semibold mr-1 uppercase tracking-wider">
                Đang lọc:
              </span>
              {search && (
                <FilterChip
                  label={`"${search}"`}
                  tone="muted"
                  onRemove={() => setSearch("")}
                />
              )}
              {view !== "active" && (
                <FilterChip
                  label={VIEW_LABELS[view] || view}
                  tone="default"
                  onRemove={() => setView("active")}
                />
              )}
            </div>
          )}

          {/* Table Container */}
          <div
            className="flex-1 overflow-auto custom-scrollbar relative"
            aria-busy={showLoading}
          >
            {displayedTeachers.length === 0 && !showLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
                <TableStateView
                  loading={showLoading && isInitialLoad}
                  initialLoad={isInitialLoad}
                  skeletonRows={8}
                  skeletonColumns={8}
                  error={error}
                  empty={!error}
                  emptyTitle={
                    search
                      ? "Không tìm thấy nhân sự"
                      : view === "inactive"
                      ? "Chưa có nhân sự bị ẩn"
                      : "Chưa có dữ liệu nhân sự"
                  }
                  emptyDescription={
                    search
                      ? "Thử bỏ bộ lọc hoặc đổi từ khoá khác."
                      : "Hệ thống chưa trả về danh sách giáo viên. Nhấn Làm mới để thử lại."
                  }
                  onRetry={handleRefresh}
                />
              </div>
            )}

            {showLoading && teachers.length === 0 && (
              <TableSkeleton rows={8} columns={8} />
            )}

            <Table
              className={`table-fixed min-w-[1000px] ${
                showLoading && teachers.length > 0 ? "opacity-60" : ""
              }`}
            >
              <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--brand-60)/0.08)]">
                <TableRow className="h-9">
                  <TableHead className="w-16 bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    #
                  </TableHead>
                  <TableHead className="bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Mã
                  </TableHead>
                  <TableHead className="bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Họ và tên
                  </TableHead>
                  <TableHead className="bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Username
                  </TableHead>
                  <TableHead className="bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Email
                  </TableHead>
                  <TableHead className="hidden md:table-cell bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    SĐT
                  </TableHead>
                  <TableHead className="bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Giới tính
                  </TableHead>
                  <TableHead className="text-right bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Thao tác
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {displayedTeachers.map((teacher, index) => {
                  const isInactive = inactiveTeacherIds.has(teacher.id);
                  return (
                    <TableRow
                      key={teacher.id}
                      className={`group ${isInactive ? "opacity-60" : ""}`}
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          {teacher.code || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {getInitials(teacher.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">
                            {teacher.fullName || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {teacher.username || "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {teacher.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden md:table-cell">
                        {teacher.phoneNumber || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            teacher.gender?.toUpperCase() === "MALE"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {formatGender(teacher.gender)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleTeacherActive(teacher.id)}
                            title={
                              isInactive ? "Bật hiển thị" : "Ẩn"
                            }
                          >
                            {isInactive ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedTeacher(teacher)}
                            title="Xem chi tiết"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer — total + soft Stratos wash + warning if truncated */}
          <div className="border-t border-brand-60/10 px-4 py-2 bg-brand-60-soft/40 text-[11px] text-muted-foreground flex items-center justify-between">
            <div>
              Hiển thị{" "}
              <span className="font-semibold text-foreground">
                {filtered.length}
              </span>{" "}
              / {totalTeachers} nhân viên
            </div>
            {totalTeachers > 100 && (
              <div className="text-warning font-medium">
                Hệ thống hiện giới hạn tải 100 nhân viên mới nhất.
              </div>
            )}
          </div>
        </div>
      </div>

      <PersonnelDetailDrawer
        teacher={selectedTeacher}
        open={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
      />

      <AlertModal
        variant="error"
        open={!!error}
        onOpenChange={(open) => {
          if (!open) setError(null);
        }}
        message={error ?? ""}
      />
    </div>
  );
}
