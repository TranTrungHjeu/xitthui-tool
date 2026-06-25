"use client";

import { useEffect, useState, useDeferredValue } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";
import { useMinLoading } from "@/hooks/useMinLoading";
import CatLoader from "@/components/CatLoader";
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
    <div className="p-1.5 sm:p-3 space-y-1.5 h-[calc(100vh-76px)] md:h-[calc(100vh-16px)] overflow-hidden flex flex-col animate-in fade-in duration-500">
      {/* Title Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-none">
              Học viên
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isTE && (
            <Button
              variant="default"
              className="h-8 px-2.5 text-[11px] font-bold gap-1 bg-primary hover:bg-primary/95 text-white active:scale-95 transition-all shrink-0 shadow-sm"
              onClick={handleSyncStudents}
              disabled={syncing}
            >
              <RotateCcw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              <span>Đồng bộ LMS</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main card view */}
      <div className="flex-1 border border-slate-200 bg-white shadow-sm overflow-hidden relative flex flex-col rounded-xl">
        {/* Filters Toolbar */}
        <div className="p-1.5 bg-white border-b border-slate-200 flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Search bar */}
          <div className="relative flex-[2] min-w-[200px] sm:min-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Tìm tên, email, sđt học viên..."
              className="pl-8 h-8 text-[11px] bg-white w-full border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Select Centre */}
          {centres.length > 0 && (
            <div className="flex-1 min-w-[150px] sm:min-w-[220px]">
              <Select value={selectedCentre} onValueChange={setSelectedCentre}>
                <SelectTrigger className="w-full h-8 text-[11px] bg-white border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-slate-700">
                  <SelectValue placeholder="Tất cả cơ sở" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
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

          {/* Select Status */}
          <div className="flex-1 min-w-[120px] sm:min-w-[150px]">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full h-8 text-[11px] bg-white border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-slate-700">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                <SelectItem value="RUNNING,OPEN,PRE_OPEN">Đang hoạt động</SelectItem>
                <SelectItem value="ENDED,CLOSED">Đã kết thúc</SelectItem>
                <SelectItem value="all">Tất cả</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select Class */}
          <div className="flex-1 min-w-[130px] sm:min-w-[180px]">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full h-8 text-[11px] bg-white border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-slate-700">
                <SelectValue placeholder="Tất cả lớp học" />
              </SelectTrigger>
              <SelectContent className="text-[11px] max-h-60 overflow-y-auto custom-scrollbar">
                <SelectItem value="all">Tất cả lớp học</SelectItem>
                {classesList.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-auto flex-1 custom-scrollbar no-vertical-scrollbar">
          {!isMobile ? (
            <table className="w-full min-w-[700px] md:min-w-full border-collapse text-xs text-left">
              <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3.5 font-bold text-slate-600 w-[30%] text-[11px]">Học viên</th>
                  <th className="py-2 px-3.5 font-bold text-slate-600 w-[35%] text-[11px]">Lớp học</th>
                  <th className="py-2 px-3.5 font-bold text-slate-600 w-[17.5%] text-[11px] text-center">Chuyên cần</th>
                  <th className="py-2 px-3.5 font-bold text-slate-600 w-[17.5%] text-[11px] text-center">Bài tập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {showLoading && (
                  <tr>
                    <td colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                        <CatLoader />
                      </div>
                    </td>
                  </tr>
                )}

                {!showLoading && students.length === 0 && (
                  <tr>
                    <td colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                        <User className="h-8 w-8 text-slate-400 opacity-50" />
                        <p className="text-sm font-semibold text-slate-700">Không tìm thấy học viên nào</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!showLoading && students.length > 0 && (
                  students.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/40 transition-colors"
                    >
                      <td className="py-2 px-3.5 align-top">
                        <div className="flex items-start gap-2.5 min-w-0 pt-1">
                          <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0 border border-slate-200">
                            {student.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-[11.5px] leading-snug truncate">
                              {student.fullName}
                            </p>
                            <div className="flex flex-col gap-0.5 mt-0.5 text-[10px] text-slate-400 font-medium">
                              {student.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{student.email}</span>
                                </span>
                              )}
                              {student.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span>{student.phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2 px-3.5 align-top">
                        <div className="flex flex-col gap-1">
                          {student.classes.length > 0 ? (
                            student.classes.map((cls) => {
                              const normalizedStatus = cls.status
                                ? cls.status.toUpperCase().replace(/\s+/g, "_")
                                : "";
                              let colorStyle =
                                "bg-slate-50 text-slate-600 border-slate-200";

                              if (normalizedStatus === "RUNNING" || normalizedStatus === "OPEN") {
                                colorStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                              } else if (["PRE_OPEN", "PREPARING", "NEW"].includes(normalizedStatus)) {
                                colorStyle = "bg-blue-50 text-blue-700 border-blue-200/60";
                              } else if (["CLOSED", "ENDED", "FINISHED"].includes(normalizedStatus)) {
                                colorStyle = "bg-slate-100 text-slate-400 border-slate-200/60";
                              }

                              return (
                                <div
                                  key={cls.id}
                                  className="h-7 flex items-center"
                                >
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-semibold text-[10.5px] leading-none ${colorStyle}`}
                                    title={cls.status}
                                  >
                                    <GraduationCap className="h-3 w-3 opacity-70" />
                                    <span>{cls.name}</span>
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="h-7 flex items-center text-[10.5px] text-slate-400 italic">
                              Không có lớp
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-3.5 align-top text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {student.classes.length > 0 ? (
                            student.classes.map((cls) => (
                              <div
                                key={cls.id}
                                className="h-7 flex items-center text-[11px] font-extrabold"
                              >
                                <span
                                  className={
                                    cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                      ? cls.attendanceRate >= 0.8
                                        ? "text-emerald-600"
                                        : "text-amber-600"
                                      : "text-slate-400 font-medium"
                                  }
                                >
                                  {cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                    ? `${(cls.attendanceRate * 100).toFixed(0)}%`
                                    : "N/A"}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="h-7 flex items-center text-[11px] text-slate-400 font-medium">-</div>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-3.5 align-top text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {student.classes.length > 0 ? (
                            student.classes.map((cls) => (
                              <div
                                key={cls.id}
                                className="h-7 flex items-center text-[11px] font-extrabold"
                              >
                                <span
                                  className={
                                    cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                      ? cls.homeworkRate >= 0.8
                                        ? "text-emerald-600"
                                        : "text-amber-600"
                                      : "text-slate-400 font-medium"
                                  }
                                >
                                  {cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                    ? `${(cls.homeworkRate * 100).toFixed(0)}%`
                                    : "N/A"}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="h-7 flex items-center text-[11px] text-slate-400 font-medium">-</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* Mobile card list */
            <div className="p-1.5 bg-slate-50/50 space-y-1.5 min-h-full">
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
                    className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5 space-y-2 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3 pb-1.5 border-b border-slate-100">
                      <div className="min-w-0">
                        <h4 className="font-bold text-[12px] text-slate-800 flex items-center gap-1 leading-tight">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{student.fullName}</span>
                        </h4>
                        
                        <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-slate-400 font-medium">
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

                    <div className="space-y-1.5">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Danh sách lớp học ({student.classes?.length || 0})
                      </div>
                      
                      {student.classes?.length === 0 ? (
                        <p className="text-[10px] italic text-slate-400">Không có lớp học nào</p>
                      ) : (
                        student.classes.map((cls, cIdx) => {
                          const normalizedStatus = cls.status
                            ? cls.status.toUpperCase().replace(/\s+/g, "_")
                            : "";
                          let colorStyle =
                            "bg-slate-50 text-slate-600 border-slate-200";

                          if (normalizedStatus === "RUNNING" || normalizedStatus === "OPEN") {
                            colorStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                          } else if (["PRE_OPEN", "PREPARING", "NEW"].includes(normalizedStatus)) {
                            colorStyle = "bg-blue-50 text-blue-700 border-blue-200/60";
                          } else if (["CLOSED", "ENDED", "FINISHED"].includes(normalizedStatus)) {
                            colorStyle = "bg-slate-100 text-slate-400 border-slate-200/60";
                          }

                          return (
                            <div
                              key={cIdx}
                              className="p-2 rounded-lg border border-slate-100 bg-slate-50/40 text-[10.5px] space-y-1 hover:bg-slate-50 transition-colors"
                            >
                              <div className="font-bold text-slate-800 flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate font-bold" title={cls.name}>{cls.name}</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`font-semibold shrink-0 px-1.5 py-0 text-[8.5px] leading-none ${colorStyle}`}
                                >
                                  {cls.status}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <div className="flex items-center gap-1 bg-white border border-slate-100 px-1.5 py-0.5 rounded shadow-sm">
                                  <span className="font-semibold text-slate-400 text-[9px]">C.Cần:</span>
                                  <span className={`text-[9px] font-extrabold ${
                                    cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                      ? cls.attendanceRate >= 0.8
                                        ? "text-emerald-600"
                                        : "text-amber-600"
                                      : "text-slate-400"
                                  }`}>
                                    {cls.attendanceRate !== null && cls.attendanceRate !== undefined
                                      ? `${(cls.attendanceRate * 100).toFixed(0)}%`
                                      : "N/A"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 bg-white border border-slate-100 px-1.5 py-0.5 rounded shadow-sm">
                                  <span className="font-semibold text-slate-400 text-[9px]">B.Tập:</span>
                                  <span className={`text-[9px] font-extrabold ${
                                    cls.homeworkRate !== null && cls.homeworkRate !== undefined
                                      ? cls.homeworkRate >= 0.8
                                        ? "text-emerald-600"
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

        {/* Footer pagination */}
        {!showLoading && students.length > 0 && (
          <div className="border-t border-slate-200 p-2 bg-slate-50 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="text-[11px] text-slate-500 font-medium">
                Hiển thị{" "}
                <span className="font-bold text-slate-800">
                  {(page - 1) * limit + 1}
                </span>{" "}
                đến{" "}
                <span className="font-bold text-slate-800">
                  {Math.min(page * limit, totalItems)}
                </span>{" "}
                trong tổng số{" "}
                <span className="font-bold text-slate-800">
                  {totalItems}
                </span>{" "}
                học viên
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md bg-white border-slate-200 text-slate-600 active:scale-95 transition-all"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md bg-white border-slate-200 text-slate-600 active:scale-95 transition-all"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <div className="flex items-center justify-center min-w-[2.5rem] text-[11px] font-bold text-slate-700">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md bg-white border-slate-200 text-slate-600 active:scale-95 transition-all"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md bg-white border-slate-200 text-slate-600 active:scale-95 transition-all"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
