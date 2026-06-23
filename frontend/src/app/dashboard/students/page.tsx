"use client";

import { useEffect, useState, useDeferredValue } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";
import { Card, CardContent } from "@/components/ui/card";
import { useMinLoading } from "@/hooks/useMinLoading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CatLoader from "@/components/CatLoader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Mail,
  Phone,
  User,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner"; // Hoặc có thể tự handle alert nếu không có sonner. Ta sẽ dùng alert hoặc button state.

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

export default function StudentsPage() {
  const { user, token } = useAuthStore();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showLoading = useMinLoading(loading, 1000);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rawCentres = user?.teacherCentres || [];
  const centres = rawCentres.map((c: any) => {
    if (typeof c === "string") return { id: c, name: c };
    return c;
  });

  // Filters
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

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  const isTE = user?.appRoles?.includes("TE" as any);

  // Set default centre "Thủ Dầu Một" on mount
  useEffect(() => {
    const tdm = centres.find(
      (c: any) =>
        c.name?.toLowerCase().includes("thủ dầu một") ||
        c.id?.toLowerCase().includes("thủ dầu một"),
    );
    if (tdm) {
      setSelectedCentre(tdm.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClassesList = async () => {
    if (!token || (!user?.teacherId && !isTE)) return;
    try {
      let statusIn: string[] | undefined = undefined;
      if (selectedStatus !== "all") {
        statusIn = selectedStatus.split(",");
      }

      const res = await classService.getClasses(
        token,
        user?.teacherId || "",
        centres.map((c: any) => c.id),
        user?.appRoles || [],
        {
          statusIn,
          limit: 500, // Lấy đủ nhiều để đưa vào dropdown
          centre: selectedCentre === "all" ? undefined : selectedCentre,
        },
      );
      if (res.data) {
        setClassesList(res.data.map((c) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      console.error("Failed to fetch classes list:", error);
    }
  };

  const fetchStudents = async () => {
    if (!token || (!user?.teacherId && !isTE)) return;

    setLoading(true);
    try {
      let statusIn: string[] | undefined = undefined;
      if (selectedStatus !== "all") {
        statusIn = selectedStatus.split(",");
      }

      const response = await classService.getStudents(
        token,
        user?.teacherId || "",
        centres.map((c: any) => c.id),
        user?.appRoles || [],
        {
          statusIn,
          page,
          limit,
          search: deferredSearchTerm,
          centre: selectedCentre === "all" ? undefined : selectedCentre,
          classId: selectedClass === "all" ? undefined : selectedClass,
        },
      );

      setStudents(response.data || []);
      setTotalPages(response?.meta?.totalPages || 1);
      setTotalItems(response?.meta?.total || 0);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncStudents = async () => {
    if (!isTE) return;
    try {
      setSyncing(true);
      const res = await classService.syncStudents(user?.appRoles);
      if (res.success) {
        alert(res.message || "Đồng bộ học viên đang chạy ngầm...");
      }
    } catch (error: any) {
      console.error("Sync failed:", error);
      alert(error?.response?.data?.error || "Lỗi đồng bộ");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchClassesList();
    // Reset selectedClass khi centre hoặc status thay đổi
    setSelectedClass("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, selectedCentre, selectedStatus]);

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    user,
    page,
    deferredSearchTerm,
    selectedCentre,
    selectedStatus,
    selectedClass,
  ]);

  // Reset trang về 1 khi đổi bộ lọc
  useEffect(() => {
    setPage(1);
  }, [deferredSearchTerm, selectedCentre, selectedStatus, selectedClass]);

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
          Quản lý Học viên
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Danh sách học viên theo cơ sở và lớp học
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr] lg:grid-cols-[300px_1fr]">
        {/* Filters Sidebar */}
        <div className="space-y-4">
          <Card className="border-gray-200/60 shadow-sm dark:border-gray-800/60 bg-white/50 backdrop-blur-sm dark:bg-gray-950/50">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Tìm kiếm
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Tên, Email, SĐT..."
                    className="pl-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 transition-all focus:ring-2 focus:ring-blue-500/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {centres.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Cơ sở
                  </label>
                  <Select
                    value={selectedCentre}
                    onValueChange={setSelectedCentre}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <SelectValue placeholder="Tất cả cơ sở" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả cơ sở</SelectItem>
                      {centres.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Trạng thái lớp
                </label>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RUNNING,OPEN,PRE_OPEN">
                      Đang hoạt động
                    </SelectItem>
                    <SelectItem value="ENDED,CLOSED">Đã kết thúc</SelectItem>
                    <SelectItem value="all">Tất cả</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Lớp học
                </label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <SelectValue placeholder="Tất cả lớp học" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp học</SelectItem>
                    {classesList.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="w-full justify-center gap-2 mt-2"
                onClick={fetchStudents}
                disabled={loading}
              >
                <RotateCcw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Làm mới
              </Button>

              {isTE && (
                <Button
                  variant="default"
                  className="w-full justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSyncStudents}
                  disabled={syncing}
                >
                  <RotateCcw
                    className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                  />
                  Đồng bộ từ LMS
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <div className="flex flex-col gap-4">
          <Card className="border-gray-200/60 shadow-sm dark:border-gray-800/60 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto rounded-t-xl">
              {!isMobile ? (
                <Table>
                  <TableHeader className="bg-gray-50/80 dark:bg-gray-900/80 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow className="border-gray-200/60 dark:border-gray-800/60">
                      <TableHead className="w-[30%] min-w-[200px] font-semibold text-gray-700 dark:text-gray-300">
                        Học viên
                      </TableHead>
                      <TableHead className="w-[35%] min-w-[220px] font-semibold text-gray-700 dark:text-gray-300">
                        Lớp học
                      </TableHead>
                      <TableHead className="w-[17.5%] min-w-[120px] font-semibold text-gray-700 dark:text-gray-300">
                        Chuyên cần
                      </TableHead>
                      <TableHead className="w-[17.5%] min-w-[120px] font-semibold text-gray-700 dark:text-gray-300">
                        Bài tập
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="relative">
                    {showLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                            <CatLoader />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {!showLoading && students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                            <User className="h-8 w-8 text-gray-400 opacity-50" />
                            <p className="text-sm font-medium">
                              Không tìm thấy học viên nào
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {!showLoading && students.length > 0 && (
                      <AnimatePresence mode="popLayout">
                        {students.map((student, idx) => (
                          <motion.tr
                            key={student.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{
                              duration: 0.2,
                              delay: Math.min(idx * 0.02, 0.2),
                            }}
                            className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 border-gray-200/60 dark:border-gray-800/60 transition-colors"
                          >
                            <TableCell className="align-top py-4">
                              <div className="flex items-center gap-3 pt-2">
                                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                    {student.fullName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                  {student.fullName}
                                </p>
                              </div>
                            </TableCell>

                            {/* Lớp học */}
                            <TableCell className="align-top py-4">
                              <div className="flex flex-col">
                                {student.classes.length > 0 ? (
                                  student.classes.map((cls) => {
                                    const normalizedStatus = cls.status
                                      ? cls.status
                                          .toUpperCase()
                                          .replace(/\s+/g, "_")
                                      : "";
                                    let colorStyle =
                                      "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";

                                    if (
                                      normalizedStatus === "RUNNING" ||
                                      normalizedStatus === "OPEN"
                                    ) {
                                      colorStyle =
                                        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                                    } else if (
                                      ["PRE_OPEN", "PREPARING", "NEW"].includes(
                                        normalizedStatus,
                                      )
                                    ) {
                                      colorStyle =
                                        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
                                    } else if (
                                      ["CLOSED", "ENDED", "FINISHED"].includes(
                                        normalizedStatus,
                                      )
                                    ) {
                                      colorStyle =
                                        "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700";
                                    }

                                    return (
                                      <div
                                        key={cls.id}
                                        className="h-10 flex items-center border-b border-gray-100 dark:border-gray-800/40 last:border-0"
                                      >
                                        <Badge
                                          variant="outline"
                                          className={`font-semibold flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] ${colorStyle}`}
                                          title={cls.status}
                                        >
                                          <GraduationCap className="h-3 w-3 opacity-70" />
                                          <span>{cls.name}</span>
                                        </Badge>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="h-10 flex items-center text-sm text-gray-400 italic">
                                    Không có lớp
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Chuyên cần */}
                            <TableCell className="align-top py-4">
                              <div className="flex flex-col">
                                {student.classes.length > 0 ? (
                                  student.classes.map((cls) => (
                                    <div
                                      key={cls.id}
                                      className="h-10 flex items-center border-b border-gray-100 dark:border-gray-800/40 last:border-0 text-sm font-semibold"
                                    >
                                      <span
                                        className={
                                          cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                            ? cls.attendanceRate >= 0.8
                                              ? "text-green-600 dark:text-green-400"
                                              : "text-amber-600 dark:text-amber-400"
                                            : "text-gray-400"
                                        }
                                      >
                                        {cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                          ? `${(cls.attendanceRate * 100).toFixed(0)}%`
                                          : "N/A"}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="h-10 flex items-center text-sm text-gray-400">
                                    -
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Bài tập */}
                            <TableCell className="align-top py-4">
                              <div className="flex flex-col">
                                {student.classes.length > 0 ? (
                                  student.classes.map((cls) => (
                                    <div
                                      key={cls.id}
                                      className="h-10 flex items-center border-b border-gray-100 dark:border-gray-800/40 last:border-0 text-sm font-semibold"
                                    >
                                      <span
                                        className={
                                          cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                            ? cls.homeworkRate >= 0.8
                                              ? "text-green-600 dark:text-green-400"
                                              : "text-amber-600 dark:text-amber-400"
                                            : "text-gray-400"
                                        }
                                      >
                                        {cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                          ? `${(cls.homeworkRate * 100).toFixed(0)}%`
                                          : "N/A"}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="h-10 flex items-center text-sm text-gray-400">
                                    -
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 space-y-4 bg-slate-50/50 min-h-full">
                  {showLoading && students.length === 0 ? (
                    <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <CatLoader />
                    </div>
                  ) : students.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
                      Không có dữ liệu học viên.
                    </div>
                  ) : (
                    students.map((student) => (
                      <div
                        key={student.id}
                        className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-3.5 transition-all hover:shadow-md"
                      >
                        {/* Student Info Header */}
                        <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
                          <div className="min-w-0">
                            <h4 className="font-bold text-[14px] text-slate-800 flex items-center gap-1.5 leading-tight">
                              <User className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="truncate">{student.fullName}</span>
                            </h4>
                            
                            <div className="flex flex-col gap-1 mt-1 text-[11px] text-slate-500 font-medium">
                              {student.email && (
                                <span className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{student.email}</span>
                                </span>
                              )}
                              {student.phone && (
                                <span className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>{student.phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Classes Roster */}
                        <div className="space-y-2.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Danh sách lớp học ({student.classes?.length || 0})
                          </div>
                          
                          {student.classes?.length === 0 ? (
                            <p className="text-xs italic text-slate-400">Không có lớp học nào</p>
                          ) : (
                            student.classes.map((cls, cIdx) => {
                              const normalizedStatus = cls.status
                                ? cls.status
                                    .toUpperCase()
                                    .replace(/\s+/g, "_")
                                : "";
                              let colorStyle =
                                "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";

                              if (
                                normalizedStatus === "RUNNING" ||
                                normalizedStatus === "OPEN"
                              ) {
                                colorStyle =
                                  "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                              } else if (
                                ["PRE_OPEN", "PREPARING", "NEW"].includes(
                                  normalizedStatus,
                                )
                              ) {
                                colorStyle =
                                  "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
                              } else if (
                                ["CLOSED", "ENDED", "FINISHED"].includes(
                                  normalizedStatus,
                                )
                              ) {
                                colorStyle =
                                  "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700";
                              }

                              return (
                                <div
                                  key={cIdx}
                                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/40 text-xs space-y-2 hover:bg-slate-50 transition-colors"
                                >
                                  <div className="font-bold text-slate-800 flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate" title={cls.name}>{cls.name}</span>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`font-semibold shrink-0 px-2 py-0.5 text-[9.5px] ${colorStyle}`}
                                    >
                                      {cls.status}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                    {/* Chuyên cần Badge */}
                                    <div className="flex items-center gap-1.5 bg-white border border-slate-100 px-2 py-0.5 rounded shadow-sm">
                                      <span className="font-semibold text-slate-500 text-[10px]">C.Cần:</span>
                                      <span className={`text-[10px] font-bold ${
                                        cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                          ? cls.attendanceRate >= 0.8
                                            ? "text-green-600"
                                            : "text-amber-600"
                                          : "text-slate-400"
                                      }`}>
                                        {cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                          ? `${(cls.attendanceRate * 100).toFixed(0)}%`
                                          : "N/A"}
                                      </span>
                                    </div>

                                    {/* Bài tập Badge */}
                                    <div className="flex items-center gap-1.5 bg-white border border-slate-100 px-2 py-0.5 rounded shadow-sm">
                                      <span className="font-semibold text-slate-500 text-[10px]">B.Tập:</span>
                                      <span className={`text-[10px] font-bold ${
                                        cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                          ? cls.homeworkRate >= 0.8
                                            ? "text-green-600"
                                            : "text-amber-600"
                                          : "text-slate-400"
                                      }`}>
                                        {cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                          ? `${(cls.homeworkRate * 100).toFixed(0)}%`
                                          : "N/A"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {!showLoading && students.length > 0 && (
              <div className="border-t border-gray-200/60 dark:border-gray-800/60 p-4 bg-gray-50/30 dark:bg-gray-900/30">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Hiển thị{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {(page - 1) * limit + 1}
                    </span>{" "}
                    đến{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {Math.min(page * limit, totalItems)}
                    </span>{" "}
                    trong tổng số{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {totalItems}
                    </span>{" "}
                    học viên
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center justify-center min-w-[3rem] text-sm font-medium">
                      {page} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
