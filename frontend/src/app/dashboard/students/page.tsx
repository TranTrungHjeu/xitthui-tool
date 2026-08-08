"use client";

import { useEffect, useState, useDeferredValue, useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";
import { useMinLoading } from "@/hooks/useMinLoading";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataPagination } from "@/components/ui/data-pagination";
import { TopLoadingBar } from "@/components/ui/top-loading-bar";
import { FilterChip } from "@/components/ui/filter-chip";
import { TableStateView } from "@/components/ui/table-state-view";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  Search,
  RotateCcw,
  RefreshCw,
  GraduationCap,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  User,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

interface StudentData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  classes: {
    id: string;
    name: string;
    status: string;
    attendanceRate?: number | null;
    homeworkRate?: number | null;
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  all: "Tất cả trạng thái",
  "RUNNING,OPEN,PRE_OPEN": "Đang hoạt động",
  "ENDED,CLOSED": "Đã kết thúc",
};
const CENTRE_LABELS: Record<string, string> = {
  all: "Tất cả cơ sở",
};

const getInitials = (name: string) =>
  (name || "?").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export default function StudentsPage() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showLoading = useMinLoading(loading, 600);
  const isTE = user?.appRoles?.includes("TE" as any);

  const rawCentres = user?.teacherCentres || [];
  const centres = useMemo(
    () => rawCentres.map((c: any) => (typeof c === "string" ? { id: c, name: c } : c)),
    [rawCentres],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedCentre, setSelectedCentre] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>(
    "RUNNING,OPEN,PRE_OPEN",
  );
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [classesList, setClassesList] = useState<
    { id: string; name: string }[]
  >([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const limit = 20;

  /*
   * Centre is locked to TDM (matching the Classes page behavior).
   * The lock silently degrades to "all" if the user isn't assigned to
   * TDM so the page still works for users at other centres.
   */
  const lockedCentreId = useMemo(() => {
    if (centres.length === 0) return "all";
    const tdm = centres.find(
      (c: any) =>
        (c.name || "").toLowerCase().includes("thủ dầu một") ||
        (c.id || "").toLowerCase().includes("thủ dầu một"),
    );
    return tdm ? tdm.id : "all";
  }, [centres]);
  const centreFilter = lockedCentreId;

  const fetchClassesList = useCallback(async () => {
    if (!user?.teacherId && !isTE) return;
    try {
      let statusIn: string[] | undefined;
      if (selectedStatus !== "all") statusIn = selectedStatus.split(",");
      const res = await classService.getClasses(
        user?.teacherId || "",
        centres.map((c: any) => c.id),
        user?.appRoles || [],
        {
          statusIn,
          limit: 500,
          centre: centreFilter === "all" ? undefined : centreFilter,
        },
      );
      if (res.data) {
        setClassesList(res.data.map((c) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      console.error("Failed to fetch classes list:", error);
    }
  }, [user, isTE, centres, selectedStatus, centreFilter]);

  const fetchStudents = useCallback(async () => {
    if (!user?.teacherId && !isTE) return;
    setLoading(true);
    setError(null);
    try {
      let statusIn: string[] | undefined;
      if (selectedStatus !== "all") statusIn = selectedStatus.split(",");
      const teacherId = user?.teacherId || "";
      const appRoles = user?.appRoles || [];
      const centreIds = centres.map((c: any) => c.id);
      const response = await classService.getStudents(
        teacherId,
        centreIds,
        appRoles,
        {
          statusIn,
          page,
          limit,
          search: deferredSearchTerm,
          centre: centreFilter === "all" ? undefined : centreFilter,
          classId: selectedClass === "all" ? undefined : selectedClass,
        },
      );
      setStudents(response.data || []);
      setTotalPages(response?.meta?.totalPages || 1);
      setTotalItems(response?.meta?.total || 0);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể tải danh sách học viên. Vui lòng thử lại.";
      setError(msg);
      setStudents([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [
    user,
    isTE,
    centres,
    page,
    deferredSearchTerm,
    centreFilter,
    selectedStatus,
    selectedClass,
  ]);

  const handleSyncStudents = async () => {
    if (!isTE) return;
    try {
      setSyncing(true);
      const res = await classService.syncStudents(user?.appRoles);
      if (res.success) toast.success(res.message || "Đã đồng bộ LMS");
    } catch (error: any) {
      toast.error("Lỗi đồng bộ", {
        description: error?.response?.data?.error || "Không thể đồng bộ",
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchClassesList();
    setSelectedClass("all");
  }, [fetchClassesList]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearchTerm, centreFilter, selectedStatus, selectedClass]);

  const isFiltersDefault =
    searchTerm === "" &&
    centreFilter === "all" &&
    selectedStatus === "RUNNING,OPEN,PRE_OPEN" &&
    selectedClass === "all";

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedClass("all");
    if (centres.length > 0) {
      const tdm = centres.find(
        (c: any) =>
          (c.name || "").toLowerCase().includes("thủ dầu một") ||
          (c.id || "").toLowerCase().includes("thủ dầu một"),
      );
      setSelectedCentre(tdm ? tdm.id : "all");
    }
    setSelectedStatus("RUNNING,OPEN,PRE_OPEN");
  };

  const renderRateCell = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined)
      return <span className="text-muted-foreground">N/A</span>;
    const pct = (rate * 100).toFixed(0);
    const good = rate >= 0.8;
    return (
      <span
        className={
          good
            ? "text-success font-semibold flex items-center justify-center gap-1"
            : "text-warning font-semibold flex items-center justify-center gap-1"
        }
      >
        {good ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <AlertTriangle className="h-3 w-3" />
        )}
        {pct}%
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-background via-background to-brand-60-soft/30">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Main card view — same chrome as Classes page: brand-60 border,
            soft wash, white card for the table itself. */}
        <div className="flex-1 border border-brand-60/10 bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
          <TopLoadingBar
            loading={showLoading && students.length > 0}
          />

          {/* Toolbar */}
          <div className="p-1.5 bg-card border-b border-brand-60/10 flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="relative flex-1 min-w-[200px] sm:min-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Tìm tên, email, số điện thoại học viên..."
                className="pl-8 h-8 text-xs bg-card w-full border-border focus:ring-4 focus:ring-primary/10 focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status filter */}
            <div className="flex-1 min-w-[120px] sm:min-w-[150px]">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="RUNNING,OPEN,PRE_OPEN">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      Đang hoạt động
                    </div>
                  </SelectItem>
                  <SelectItem value="ENDED,CLOSED">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      Đã kết thúc
                    </div>
                  </SelectItem>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Class filter (kept per user request) */}
            <div className="flex-1 min-w-[140px] sm:min-w-[180px]">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                  <SelectValue placeholder="Lớp học" />
                </SelectTrigger>
                <SelectContent className="max-h-72 text-xs">
                  <SelectItem value="all">Tất cả lớp học</SelectItem>
                  {classesList.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync LMS (admin only) — same brand-10 primary as Classes */}
            {isTE && (
              <Button
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
                onClick={handleSyncStudents}
                disabled={syncing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {syncing ? "Đang đồng bộ" : "Đồng bộ LMS"}
                </span>
              </Button>
            )}

            {/* Reset filters (only when something is active) */}
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

            {/* Refresh — brand-10 outline, sits in toolbar not page header */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchStudents()}
              disabled={showLoading}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 border-brand-10/30 text-brand-10 hover:bg-brand-10-soft hover:text-brand-10 hover:border-brand-10/50 active:scale-95 transition-all"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${showLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>

          {/* Active filter chips — Stratos wash like Classes page */}
          {!isFiltersDefault && (
            <div className="px-2.5 py-1.5 border-b border-brand-60/10 bg-brand-60-soft/60 flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-brand-60/70 font-semibold mr-1 uppercase tracking-wider">
                Đang lọc:
              </span>
              {searchTerm && (
                <FilterChip
                  label={`"${searchTerm}"`}
                  tone="muted"
                  onRemove={() => setSearchTerm("")}
                />
              )}
              {selectedStatus !== "RUNNING,OPEN,PRE_OPEN" && (
                <FilterChip
                  label={STATUS_LABELS[selectedStatus] || selectedStatus}
                  tone={
                    selectedStatus === "all" ? "default" : "muted"
                  }
                  onRemove={() => setSelectedStatus("RUNNING,OPEN,PRE_OPEN")}
                />
              )}
              {selectedClass !== "all" && (
                <FilterChip
                  label={
                    classesList.find((c) => c.id === selectedClass)?.name ||
                    "Lớp học"
                  }
                  tone="default"
                  onRemove={() => setSelectedClass("all")}
                />
              )}
            </div>
          )}

          {/* Table Container */}
          <div
            className="flex-1 overflow-auto custom-scrollbar relative"
            aria-busy={showLoading}
          >
            {/* Empty / Error state — same composition as Classes */}
            {students.length === 0 && !showLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
                <TableStateView
                  loading={showLoading && isInitialLoad}
                  initialLoad={isInitialLoad}
                  skeletonRows={8}
                  skeletonColumns={4}
                  error={error}
                  empty={!error}
                  emptyTitle="Không tìm thấy học viên"
                  emptyDescription={
                    isFiltersDefault
                      ? "Bạn chưa có học viên nào trong danh sách."
                      : "Không có học viên nào khớp với bộ lọc hiện tại. Hãy thử bỏ một số bộ lọc."
                  }
                  onRetry={() => fetchStudents()}
                />
              </div>
            )}

            {/* Initial load skeleton */}
            {showLoading && students.length === 0 && (
              <TableSkeleton rows={8} columns={4} />
            )}

            <Table
              className={`table-fixed min-w-[820px] ${
                showLoading && students.length > 0 ? "opacity-60" : ""
              }`}
            >
              <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--brand-60)/0.08)]">
                <TableRow className="h-9">
                  <TableHead className="w-[30%] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Học viên
                  </TableHead>
                  <TableHead className="w-[35%] bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Lớp học
                  </TableHead>
                  <TableHead className="w-[17.5%] text-center bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Chuyên cần
                  </TableHead>
                  <TableHead className="w-[17.5%] text-center bg-card text-[11px] font-bold text-brand-60/70 uppercase tracking-wider">
                    Bài tập
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {students.map((student) => (
                  <TableRow key={student.id} className="group">
                    <TableCell>
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar className="h-9 w-9 mt-0.5">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(student.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {student.fullName}
                          </p>
                          <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                            {student.email && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{student.email}</span>
                              </span>
                            )}
                            {student.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{student.phone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {student.classes.length > 0 ? (
                          student.classes.map((cls) => (
                            <Badge
                              key={cls.id}
                              variant="secondary"
                              className="gap-1.5 w-fit font-medium"
                            >
                              <GraduationCap className="h-3 w-3 opacity-70" />
                              {cls.name}
                              <StatusBadge
                                type="class"
                                status={cls.status}
                                className="ml-1"
                              />
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Không có lớp
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1.5 items-center">
                        {student.classes.length > 0 ? (
                          student.classes.map((cls) => (
                            <div key={cls.id} className="text-xs">
                              {renderRateCell(cls.attendanceRate)}
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1.5 items-center">
                        {student.classes.length > 0 ? (
                          student.classes.map((cls) => (
                            <div key={cls.id} className="text-xs">
                              {renderRateCell(cls.homeworkRate)}
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            page={page}
            totalPages={totalPages}
            total={totalItems}
            limit={limit}
            onPageChange={setPage}
            className="border-t border-brand-60/10 bg-brand-60-soft/40"
          />
        </div>
      </div>
    </div>
  );
}
