"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AlertModal } from "@/components/ui/alert-modal";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Search, Users, Eye, EyeOff, Info, RefreshCw, RotateCcw, X } from "lucide-react";
import { useMinLoading } from "@/hooks/useMinLoading";
import { Teacher } from "@/types";
import { toast } from "@/components/ui/toast";

const formatGender = (gender: string) => {
  if (!gender) return "—";
  if (gender === "MALE" || gender === "male") return "Nam";
  if (gender === "FEMALE" || gender === "female") return "Nữ";
  return gender;
};

let cachedTeachers: Teacher[] | null = null;
let globalFetchPromise: Promise<{
  data: Teacher[];
  total: number;
}> | null = null;

const getInitials = (name: string) =>
  (name || "?").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export default function PersonnelPage() {
  const { token, user } = useAuthStore();
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
    if (!token) return;
    if (cachedTeachers) {
      const timer = setTimeout(() => {
        if (cachedTeachers) {
          setTeachers(cachedTeachers);
          setIsLoading(false);
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    let isCancelled = false;
    const fetchTeachers = async () => {
      const timer = setTimeout(() => {
        if (!isCancelled) {
          setIsLoading(true);
          setError(null);
        }
      }, 0);

      try {
        if (!globalFetchPromise) {
          globalFetchPromise = teacherService
            .getTeachers(token)
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
        const message = err instanceof Error ? err.message : "Lỗi kết nối.";
        setError(message);
      } finally {
        clearTimeout(timer);
        if (!isCancelled) setIsLoading(false);
      }
    };
    fetchTeachers();
    return () => {
      isCancelled = true;
    };
  }, [token]);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.fullName?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.phoneNumber?.toLowerCase().includes(q) ||
      t.username?.toLowerCase().includes(q)
    );
  });

  const activeTeachers = filtered.filter((t) => !inactiveTeacherIds.has(t.id));
  const inactiveTeachers = filtered.filter((t) => inactiveTeacherIds.has(t.id));

  let displayedTeachers: Teacher[] = [];
  if (view === "all") displayedTeachers = [...activeTeachers, ...inactiveTeachers];
  else if (view === "active") displayedTeachers = activeTeachers;
  else displayedTeachers = inactiveTeachers;

  if (user && !isTE) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <EyeOff className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Không có quyền truy cập</h1>
        <p className="text-muted-foreground max-w-md">
          Bạn không có quyền truy cập vào trang Quản lý Nhân sự. Chức năng này
          chỉ dành cho tài khoản có quyền Giáo vụ / Quản lý (TE).
        </p>
      </div>
    );
  }

  const handleRefresh = async () => {
    cachedTeachers = null;
    globalFetchPromise = null;
    setIsLoading(true);
    setError(null);
    try {
      const res = await teacherService.getTeachers(token || "");
      if (res.data) {
        cachedTeachers = res.data as Teacher[];
        setTeachers(cachedTeachers);
        setTotalTeachers(res.pagination?.total || 0);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi nạp dữ liệu.");
    } finally {
      setIsLoading(false);
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
      // Reset module-level cache so the next read hits the freshly-updated MongoDB.
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full flex flex-col h-full">
      <PageHeader
        icon={Users}
        title="Nhân sự"
        description={`${filtered.length} / ${totalTeachers} nhân viên trong hệ thống`}
        actions={
          <div className="flex items-center gap-2">
            {isTE && (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSyncPersonnel}
                disabled={syncing || showLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? "Đang đồng bộ..." : "Đồng bộ LMS"}</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold gap-1.5"
              onClick={handleRefresh}
              disabled={showLoading}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${showLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
          </div>
        }
      />

      {/* Errors are surfaced via <AlertModal> below; inline banner removed
          for visual consistency with the rest of the app. */}

      {/* Main card view */}
      <div className="flex-1 border border-border bg-card shadow-xs overflow-hidden relative flex flex-col rounded-xl">
        {/* Filters Toolbar */}
        <div className="p-1.5 bg-card border-b border-border flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="relative flex-1 min-w-[200px] sm:min-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Tìm theo tên, email, mã giáo viên..."
              className="pl-8 h-8 text-xs bg-card w-full border-border focus:ring-4 focus:ring-primary/10 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8 p-0.5 bg-muted/60">
              <TabsTrigger value="active" className="h-7 text-xs font-semibold">
                Đang hiển thị ({activeTeachers.length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="h-7 text-xs font-semibold">
                Đã ẩn ({inactiveTeachers.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="h-7 text-xs font-semibold">
                Tất cả ({filtered.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          {showLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Chưa có dữ liệu nhân sự"
              description="Hệ thống chưa trả về danh sách giáo viên. Nhấn Tải lại để thử lại."
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <TableRow className="h-9">
                  <TableHead className="w-16 text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">#</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">Mã</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">Họ và tên</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">Username</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">Email</TableHead>
                  <TableHead className="hidden md:table-cell text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">SĐT</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">Giới tính</TableHead>
                  <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTeachers.map((teacher, index) => {
                  const isInactive = inactiveTeacherIds.has(teacher.id);
                  return (
                    <TableRow
                      key={teacher.id}
                      className={isInactive ? "opacity-60" : ""}
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
                        <Badge variant={teacher.gender?.toUpperCase() === "MALE" ? "default" : "secondary"}>
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
                            title={isInactive ? "Bật hiển thị" : "Ẩn"}
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
          )}
        </div>

        <div className="border-t border-border px-4 py-2.5 bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
          <div>
            Hiển thị <span className="font-semibold text-foreground">{filtered.length}</span> / {totalTeachers} nhân viên
          </div>
          {totalTeachers > 100 && (
            <div className="text-warning font-medium">
              Hệ thống hiện giới hạn tải 100 nhân viên mới nhất.
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!selectedTeacher}
        onOpenChange={(open) => {
          if (!open) setSelectedTeacher(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                  {getInitials(selectedTeacher?.fullName || "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>{selectedTeacher?.fullName || "Chi tiết nhân sự"}</DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedTeacher?.code && `@${selectedTeacher.code}`} ·{" "}
                  {selectedTeacher?.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedTeacher && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-sm">
              <FieldRow label="Họ và tên" value={selectedTeacher.fullName} />
              <FieldRow label="Mã nhân viên" value={selectedTeacher.code} mono />
              <FieldRow label="Username" value={selectedTeacher.username} />
              <FieldRow label="Giới tính" value={formatGender(selectedTeacher.gender)} />
              <FieldRow label="Điện thoại" value={selectedTeacher.phoneNumber} />
              <FieldRow label="Email công việc" value={selectedTeacher.email} />
              <FieldRow label="Email cá nhân" value={selectedTeacher.personalEmail} />

              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Môn học phụ trách
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTeacher.courses?.length ? (
                    selectedTeacher.courses.map((c) => (
                      <Badge key={c.id} variant="secondary">
                        {c.shortName || c.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Dòng khóa học
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTeacher.courseLines?.length ? (
                    selectedTeacher.courseLines.map((c) => (
                      <Badge key={c.id} variant="outline">
                        {c.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Cơ sở trực thuộc
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTeacher.centres?.length ? (
                    selectedTeacher.centres.map((c) => (
                      <Badge key={c.id}>{c.name}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Ghi chú
                </p>
                <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                  {selectedTeacher.notes || "—"}
                </div>
              </div>

              <div className="md:col-span-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Thông tin hệ thống
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldRow label="User Reference ID" value={selectedTeacher.user} mono />
                  <FieldRow label="Firebase ID" value={selectedTeacher.firebaseId} mono />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </p>
      <p
        className={cn(
          "text-sm break-all",
          mono && "font-mono text-xs bg-muted px-2 py-1 rounded",
        )}
      >
        {value || "—"}
      </p>
    </div>
  );
}

// tiny inline cn helper to avoid pulling another import
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
