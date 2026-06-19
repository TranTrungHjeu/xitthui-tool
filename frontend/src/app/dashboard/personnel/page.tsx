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
import { Badge } from "../../../components/ui/badge";
import { Loader2, Search, Users, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/ui/button";
import CatLoader from "../../../components/CatLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Teacher } from "../../../types";

interface TeacherWithStatus extends Teacher {
  isActive: boolean;
}

function formatGender(gender: string) {
  if (!gender) return "—";
  if (gender === "MALE" || gender === "male") return "Nam";
  if (gender === "FEMALE" || gender === "female") return "Nữ";
  return gender;
}

let cachedTeachers: Teacher[] | null = null;
let globalFetchPromise: Promise<{
  data: Teacher[];
  total: number;
}> | null = null;

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

  const showLoading = useMinLoading(isLoading, 1000);

  // Load inactive personnel preferences on mount
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

    // Persist to backend
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

    // Nếu đã có cache, dùng luôn, không gọi API nữa
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
      // Defer loading state to avoid synchronous state update in Strict Mode
      const timer = setTimeout(() => {
        if (!isCancelled) {
          setIsLoading(true);
          setError(null);
        }
      }, 0);

      try {
        // Tránh gọi API nhiều lần nếu promise đang chạy dở
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
        globalFetchPromise = null; // Reset nếu lỗi
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

  // Separate active and inactive, with inactive at bottom
  const activeTeachers = filtered.filter((t) => !inactiveTeacherIds.has(t.id));
  const inactiveTeachers = filtered.filter((t) => inactiveTeacherIds.has(t.id));
  const displayedTeachers = [...activeTeachers, ...inactiveTeachers];

  if (user && !user.appRoles?.includes("TE" as any)) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 border border-red-200 dark:border-red-800">
          <EyeOff className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Không có quyền truy cập
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          Bạn không có quyền truy cập vào trang Quản lý Nhân sự. Chức năng này
          chỉ dành cho tài khoản có quyền Giáo vụ / Quản lý (TE).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Nhân sự</h1>
            <p className="text-sm text-slate-500">
              {isLoading
                ? "Đang tải..."
                : `${filtered.length} / ${totalTeachers} nhân viên`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Tìm theo tên, email, mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 text-sm text-white bg-destructive rounded-lg">
          {error}
        </div>
      )}

      {/* Loading */}
      {showLoading && (
        <div className="flex items-center justify-center py-20 min-h-[60vh]">
          <CatLoader />
        </div>
      )}

      {/* Search client side filter warning */}
      {totalTeachers > 100 && (
        <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-lg border border-amber-200">
          Hệ thống hiện đang giới hạn tải 100 nhân viên mới nhất. Kết quả tìm
          kiếm có thể không đầy đủ.
        </div>
      )}

      {/* Table */}
      {!showLoading && !error && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700 w-10">
                    #
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 w-24">
                    Mã
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[150px]">
                    Họ và Tên
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 w-32">
                    Username
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[180px]">
                    Email
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[180px] hidden lg:table-cell">
                    Email cá nhân
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 w-32 hidden md:table-cell">
                    Điện thoại
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 w-24">
                    Giới tính
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 w-16 text-center">
                    Chi tiết
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-slate-400"
                    >
                      {search
                        ? "Không tìm thấy nhân sự nào phù hợp."
                        : "Chưa có dữ liệu nhân sự."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedTeachers.map((teacher, index) => {
                    const isInactive = inactiveTeacherIds.has(teacher.id);
                    return (
                      <TableRow
                        key={teacher.id}
                        className={`transition-colors ${
                          isInactive
                            ? "hover:bg-slate-100/60 bg-slate-50/40 opacity-60"
                            : "hover:bg-slate-50/60"
                        }`}
                      >
                        <TableCell className="text-slate-400 text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell className="max-w-[96px]">
                          <span
                            className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 block truncate"
                            title={teacher.code}
                          >
                            {teacher.code || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 max-w-[200px]">
                          <span
                            className="truncate block"
                            title={teacher.fullName}
                          >
                            {teacher.fullName || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm max-w-[128px]">
                          <span
                            className="truncate block"
                            title={teacher.username}
                          >
                            {teacher.username || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm max-w-[200px]">
                          <span
                            className="truncate block"
                            title={teacher.email}
                          >
                            {teacher.email || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm max-w-[200px] hidden lg:table-cell">
                          <span
                            className="truncate block"
                            title={teacher.personalEmail}
                          >
                            {teacher.personalEmail || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm hidden md:table-cell">
                          {teacher.phoneNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              teacher.gender === "MALE" ||
                              teacher.gender === "male"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {formatGender(teacher.gender)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center flex items-center gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTeacherActive(teacher.id)}
                            className={`transition-colors ${
                              isInactive
                                ? "text-slate-300 hover:text-slate-500"
                                : "text-slate-400 hover:text-green-600"
                            }`}
                            title={isInactive ? "Bật hiển thị" : "Tắt hiển thị"}
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
                            onClick={() => setSelectedTeacher(teacher)}
                            className="text-slate-400 hover:text-primary"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedTeacher}
        onOpenChange={(open) => {
          if (!open) setSelectedTeacher(null);
        }}
      >
        <DialogContent className="max-w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Chi tiết nhân sự</DialogTitle>
            <DialogDescription>
              Toàn bộ thông tin trả về từ hệ thống cho nhân viên này.
            </DialogDescription>
          </DialogHeader>

          {selectedTeacher && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Mã hệ thống (ID)
                  </p>
                  <p className="text-sm font-mono bg-slate-50 p-2 rounded border break-all">
                    {selectedTeacher.id || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Mã nhân viên (Code)
                  </p>
                  <p className="text-sm font-mono bg-slate-50 p-2 rounded border break-all">
                    {selectedTeacher.code || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Họ và tên
                  </p>
                  <p className="text-sm font-medium p-2 border rounded border-transparent break-all">
                    {selectedTeacher.fullName || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Giới tính
                  </p>
                  <p className="text-sm p-2 border rounded border-transparent">
                    {formatGender(selectedTeacher.gender)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Username
                  </p>
                  <p className="text-sm p-2 border rounded border-transparent break-all">
                    {selectedTeacher.username || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Điện thoại
                  </p>
                  <p className="text-sm p-2 border rounded border-transparent">
                    {selectedTeacher.phoneNumber || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Email công việc
                  </p>
                  <p className="text-sm p-2 border rounded border-transparent break-all">
                    {selectedTeacher.email || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Email cá nhân
                  </p>
                  <p className="text-sm p-2 border rounded border-transparent break-all">
                    {selectedTeacher.personalEmail || "—"}
                  </p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Môn học phụ trách
                  </p>
                  <div className="text-sm p-2 border rounded border-transparent flex flex-wrap gap-1">
                    {selectedTeacher.courses &&
                    selectedTeacher.courses.length > 0 ? (
                      selectedTeacher.courses.map((c) => (
                        <Badge
                          key={c.id}
                          variant="secondary"
                          className="font-normal"
                        >
                          {c.shortName || c.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Dòng khóa học
                  </p>
                  <div className="text-sm p-2 border rounded border-transparent flex flex-wrap gap-1">
                    {selectedTeacher.courseLines &&
                    selectedTeacher.courseLines.length > 0 ? (
                      selectedTeacher.courseLines.map((c) => (
                        <Badge
                          key={c.id}
                          variant="outline"
                          className="font-normal"
                        >
                          {c.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Cơ sở trực thuộc
                  </p>
                  <div className="text-sm p-2 border rounded border-transparent flex flex-wrap gap-1">
                    {selectedTeacher.centres &&
                    selectedTeacher.centres.length > 0 ? (
                      selectedTeacher.centres.map((c) => (
                        <Badge
                          key={c.id}
                          variant="default"
                          className="font-normal bg-indigo-100 text-indigo-800 hover:bg-indigo-100"
                        >
                          {c.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-500 font-medium uppercase">
                    Ghi chú
                  </p>
                  <p className="text-sm p-2 bg-slate-50 rounded border border-slate-100 min-h-[60px] whitespace-pre-wrap">
                    {selectedTeacher.notes || "—"}
                  </p>
                </div>

                <div className="space-y-1 md:col-span-2 mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium uppercase mb-2">
                    Thông tin hệ thống
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">
                        User Reference ID (user)
                      </p>
                      <p className="text-xs font-mono bg-slate-50 p-1.5 rounded border break-all text-slate-600">
                        {selectedTeacher.user || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Firebase ID
                      </p>
                      <p className="text-xs font-mono bg-slate-50 p-1.5 rounded border break-all text-slate-600">
                        {selectedTeacher.firebaseId || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
