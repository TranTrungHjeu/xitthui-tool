"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useMinLoading } from "@/hooks/useMinLoading";
import { officeHourService, OfficeHourData } from "@/services/officeHourService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CatLoader from "@/components/CatLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Clock,
  BookOpen,
  User,
  AlertCircle,
  Loader2,
  ExternalLink,
  Phone,
  Mail,
  Link2,
  CheckCircle,
  XCircle,
  FileCheck,
  UserCheck
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

const ITEMS_PER_PAGE = 15;

export default function OfficeHoursPage() {
  const { user } = useAuthStore();
  const [officeHours, setOfficeHours] = useState<OfficeHourData[]>([]);
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    page: 1,
    limit: ITEMS_PER_PAGE,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const showLoading = useMinLoading(isLoading, 800);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // States for details modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const handleOpenDetails = async (id: string) => {
    setSelectedId(id);
    setIsDetailsModalOpen(true);
    setIsDetailLoading(true);
    setDetailData(null);
    try {
      const res = await officeHourService.getOfficeHourById(
        id,
        user?.teacherId || "",
        user?.teacherCentres?.map((c: any) => c.id || c),
        user?.appRoles
      );
      if (res.data) {
        setDetailData(res.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải chi tiết office hour:", err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Debounce search input
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCurrentPage(1);
  };

  const fetchOfficeHours = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const isTE = user.appRoles?.includes("TE" as any);
      let targetCentres = user.teacherCentres?.map((c: any) => c.id || c) || [];

      if (targetCentres.length === 0 || isTE) {
        targetCentres = ["6443460f94300678908f7974"]; // Default TDM
      }

      const res = await officeHourService.getOfficeHours(
        user.teacherId || "",
        targetCentres,
        user.appRoles,
        {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: debouncedSearch,
          status: statusFilter,
          type: typeFilter,
        }
      );

      setOfficeHours(res.data || []);
      setPaginationMeta(res.meta || {
        total: 0,
        page: 1,
        limit: ITEMS_PER_PAGE,
        totalPages: 1,
      });
    } catch (err) {
      console.error("Lỗi tải danh sách office hours:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficeHours();
  }, [currentPage, debouncedSearch, statusFilter, typeFilter, user]);

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return format(d, "dd/MM/yyyy", { locale: vi });
    } catch (e) {
      return dateStr;
    }
  };

  const formatTimeRange = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return "N/A";
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      return `${format(s, "HH:mm")} - ${format(e, "HH:mm")}`;
    } catch (err) {
      return "N/A";
    }
  };

  const getStatusBadge = (status: string) => {
    const normalized = (status || "").trim().toUpperCase();
    switch (normalized) {
      case "COMPLETED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm whitespace-nowrap">
            Hoàn thành
          </span>
        );
      case "ABANDONED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200/50 shadow-sm whitespace-nowrap">
            Đã hủy
          </span>
        );
      case "PENDING":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/50 shadow-sm whitespace-nowrap">
            Chờ trực
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/50 shadow-sm whitespace-nowrap">
            Đã xác nhận
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm whitespace-nowrap">
            Đã duyệt
          </span>
        );
      case "DENIED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm whitespace-nowrap">
            Bị từ chối
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200/50 shadow-sm whitespace-nowrap">
            Từ chối
          </span>
        );
      case "RUNNING":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200/50 shadow-sm whitespace-nowrap">
            Đang diễn ra
          </span>
        );
      case "CANCELED":
      case "CANCELLED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm whitespace-nowrap">
            Đã hủy bỏ
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-50 text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const isTE = user?.appRoles?.includes("TE" as any);

  return (
    <div className="p-3 sm:p-4 space-y-4 max-w-7xl mx-auto h-[calc(100vh-76px)] md:h-[calc(100vh-16px)] overflow-hidden flex flex-col bg-[#f8fafc]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-none">
              Lịch trực Office Hours
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 hidden sm:block">
              {isTE 
                ? "Dữ liệu lịch trực Office Hours của toàn bộ giáo viên tại cơ sở Thủ Dầu Một." 
                : "Danh sách lịch trực Office Hours của bạn."}
            </p>
          </div>
        </div>
        <Button
          onClick={fetchOfficeHours}
          disabled={isLoading}
          variant="outline"
          className="h-8 px-2 text-[11px] font-semibold gap-1 bg-white active:scale-95 transition-all shrink-0"
        >
          <RotateCcw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 border border-slate-200 bg-white shadow-sm overflow-hidden relative flex flex-col rounded-xl">
        {/* Filters Toolbar */}
        <div className="p-1.5 bg-white border-b border-slate-200 flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Tìm giáo viên, lớp, ghi chú..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[11px] placeholder:text-slate-400 border-slate-200 focus-visible:ring-primary/20 bg-white w-full"
            />
          </div>

          {/* Status Selector */}
          <div className="min-w-[120px]">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger size="sm" className="font-semibold text-slate-700 bg-white border-slate-200">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
                <SelectItem value="ABANDONED">Đã hủy</SelectItem>
                <SelectItem value="PENDING">Chờ trực</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Selector */}
          <div className="min-w-[120px]">
            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
              <SelectTrigger size="sm" className="font-semibold text-slate-700 bg-white border-slate-200">
                <SelectValue placeholder="Loại hình" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                <SelectItem value="all">Tất cả loại hình</SelectItem>
                <SelectItem value="Fixed">Cố định (Fixed)</SelectItem>
                <SelectItem value="Trial">Dạy thử (Trial)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          {(searchQuery || statusFilter !== "all" || typeFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 px-2.5 text-[11px] font-bold gap-1 bg-white hover:bg-slate-50 active:scale-95 transition-all shrink-0 ml-auto"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Xóa bộ lọc</span>
            </Button>
          )}
        </div>
        {showLoading && officeHours.length === 0 ? (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <CatLoader />
          </div>
        ) : officeHours.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">Không có dữ liệu</h3>
            <p className="text-slate-400 text-[11px] max-w-xs">
              Không tìm thấy lịch trực Office Hours nào phù hợp với bộ lọc.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_#e2e8f0]">
                  <TableRow>
                    <TableHead className="w-[100px] text-slate-600 font-bold py-2">Ngày</TableHead>
                    <TableHead className="w-[110px] text-slate-600 font-bold py-2">Giờ trực</TableHead>
                    <TableHead className="w-[160px] text-slate-600 font-bold py-2">Giáo viên</TableHead>
                    <TableHead className="w-[90px] text-slate-600 font-bold py-2">Loại hình</TableHead>
                    <TableHead className="w-[180px] text-slate-600 font-bold py-2">Lớp / Học viên</TableHead>
                    <TableHead className="text-slate-600 font-bold py-2">Nội dung ghi chú</TableHead>
                    <TableHead className="w-[100px] text-slate-600 font-bold py-2 text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officeHours.map((item) => (
                    <TableRow 
                      key={item._id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(item._id)}
                    >
                      {/* Date */}
                      <TableCell className="font-semibold text-slate-700 py-2.5">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{formatDateString(item.startTime)}</span>
                        </div>
                      </TableCell>

                      {/* Time Slot */}
                      <TableCell className="py-2.5 font-mono text-slate-600 font-medium">
                        {formatTimeRange(item.startTime, item.endTime)}
                      </TableCell>

                      {/* Teacher */}
                      <TableCell className="py-2.5">
                        {item.teacher ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 leading-tight">
                              {item.teacher.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              @{item.teacher.code}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phân công</span>
                        )}
                      </TableCell>

                      {/* Type */}
                      <TableCell className="py-2.5 font-medium text-slate-600">
                        {item.type || "Fixed"}
                      </TableCell>

                      {/* Class */}
                      <TableCell className="py-2.5">
                        {item.class?.name ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-700 leading-tight">
                              {item.class.name}
                            </span>
                            {item.studentCount !== undefined && (
                              <span className="text-[10px] text-slate-400">
                                Sĩ số: {item.studentCount} học viên
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">-</span>
                        )}
                      </TableCell>

                      {/* Note */}
                      <TableCell className="py-2.5 max-w-[320px]">
                        <div className="truncate text-slate-500 text-[11px]" title={item.note || ""}>
                          {item.note || <span className="text-slate-300 italic">Không có ghi chú</span>}
                        </div>
                        {item.managerNote && (
                          <div className="text-[10px] text-blue-600 font-medium truncate mt-0.5" title={item.managerNote}>
                            QL: {item.managerNote}
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2.5 text-right">
                        {getStatusBadge(item.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer */}
            <div className="p-2 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
              <span className="text-[11px] text-slate-500">
                Hiển thị <span className="font-semibold text-slate-700">{officeHours.length}</span> /{" "}
                <span className="font-semibold text-slate-700">{paginationMeta.total}</span> lịch trực
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 text-slate-500 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 text-slate-500 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center justify-center min-w-[65px] text-[11px] font-bold text-slate-700 select-none">
                  Trang {currentPage} / {paginationMeta.totalPages}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 text-slate-500 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => setCurrentPage((p) => Math.min(paginationMeta.totalPages, p + 1))}
                  disabled={currentPage === paginationMeta.totalPages || isLoading}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 text-slate-500 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => setCurrentPage(paginationMeta.totalPages)}
                  disabled={currentPage === paginationMeta.totalPages || isLoading}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Office Hour Details Dialog */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="w-[95vw] md:max-w-5xl lg:max-w-6xl max-h-[85vh] overflow-y-auto custom-scrollbar p-5">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  <span>Chi tiết ca trực Office Hours</span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400">
                  ID ca trực: {selectedId}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                {detailData && getStatusBadge(detailData.status)}
                {detailData && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-100/60">
                    {detailData.type || "Fixed"}
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs text-slate-500 font-medium">Đang tải dữ liệu chi tiết từ LMS...</span>
            </div>
          ) : !detailData ? (
            <div className="py-10 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Không thể tải dữ liệu</p>
              <p className="text-[11px] text-slate-400">Vui lòng thử lại sau hoặc làm mới trang.</p>
            </div>
          ) : (
            <div className="space-y-5 pt-3 text-xs text-slate-700">
              {/* Grid 1: Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px]">Thông tin chung</h3>
                  <div className="space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-400">Trung tâm:</span><span className="font-semibold text-slate-700">{detailData.centre?.name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Ngày trực:</span><span className="font-mono font-semibold text-slate-700">{formatDateString(detailData.startTime)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Giờ trực:</span><span className="font-mono font-semibold text-slate-700">{formatTimeRange(detailData.startTime, detailData.endTime)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Người tạo:</span><span className="font-semibold text-slate-700">@{detailData.createdBy?.username || "LMS"}</span></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px]">Giáo viên & Lớp học</h3>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Giáo viên:</span>
                      <span className="font-semibold text-slate-700">{detailData.teacher?.fullName || "Chưa phân công"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mã giáo viên:</span>
                      <span className="font-mono font-semibold text-slate-700">{detailData.teacher?.code ? `@${detailData.teacher.code}` : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Liên hệ:</span>
                      <span className="font-semibold text-slate-700">
                        {detailData.teacher?.phoneNumber || detailData.teacher?.email 
                          ? `${detailData.teacher.phoneNumber || ""} ${detailData.teacher.email ? `(${detailData.teacher.email})` : ""}`
                          : "-"
                        }
                      </span>
                    </div>
                    {detailData.class?.name && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Lớp học hỗ trợ:</span>
                        <span className="font-semibold text-slate-700">{detailData.class.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Note and Manager Note */}
              {(detailData.note || detailData.managerNote) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailData.note && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Ghi chú đăng ký</h4>
                      <div className="p-3 bg-amber-50/20 border border-amber-100/50 rounded-lg text-[11px] text-slate-600 leading-relaxed font-sans whitespace-pre-line max-h-[140px] overflow-y-auto">
                        {detailData.note}
                      </div>
                    </div>
                  )}
                  {detailData.managerNote && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5 text-blue-500" /> Ghi chú của quản lý</h4>
                      <div className="p-3 bg-blue-50/20 border border-blue-100/50 rounded-lg text-[11px] text-slate-600 leading-relaxed font-sans max-h-[140px] overflow-y-auto">
                        {detailData.managerNote}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Uplevel Test Students List */}
              {detailData.uplevelTestStudents && detailData.uplevelTestStudents.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    <span>Học viên kiểm tra Uplevel ({detailData.uplevelTestStudents.length})</span>
                  </h3>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                    <Table className="text-[11px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="py-2 text-slate-600 font-bold">Học viên</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Lớp kiểm tra</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Trạng thái</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Ghi chú</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold text-right">File kiểm tra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.uplevelTestStudents.map((st: any) => (
                          <TableRow key={st.id}>
                            <TableCell className="py-2 font-semibold text-slate-800">
                              {st.student?.fullName || "N/A"}
                            </TableCell>
                            <TableCell className="py-2">
                              {st.class?.name || "-"}
                            </TableCell>
                            <TableCell className="py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                st.status === "COMPLETED" 
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {st.status === "COMPLETED" ? "Đạt" : st.status}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 max-w-[200px] truncate" title={st.note}>
                              {st.note || "-"}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              {st.fileUrl ? (
                                <a 
                                  href={st.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                                >
                                  Tải file
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Appointments / Trial Candidates */}
              {detailData.appointments && detailData.appointments.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1.5">
                    <User className="h-4 w-4 text-indigo-600" />
                    <span>Học viên học thử / Test đầu vào ({detailData.appointments.length})</span>
                  </h3>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                    <Table className="text-[11px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="py-2 text-slate-600 font-bold">Học sinh (Ứng viên)</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Liên hệ</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Đề xuất môn</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Bài test</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold">Đơn hàng / Đóng phí</TableHead>
                          <TableHead className="py-2 text-slate-600 font-bold text-right">Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.appointments.map((ap: any) => (
                          <TableRow key={ap.id}>
                            <TableCell className="py-2 font-semibold text-slate-800">
                              {ap.candidate?.fullName || ap.title}
                            </TableCell>
                            <TableCell className="py-2 font-mono">
                              <div className="flex flex-col gap-0.5">
                                {ap.candidate?.phoneNumber && (
                                  <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5 text-slate-400" />{ap.candidate.phoneNumber}</span>
                                )}
                                {ap.candidate?.email && (
                                  <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5 text-slate-400" />{ap.candidate.email}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-wrap gap-0.5">
                                {ap.courses?.map((c: any) => (
                                  <span key={c.id} className="bg-slate-100 px-1 py-0.5 rounded text-[9px] font-bold">
                                    {c.shortName || c.name}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              {ap.entranceTest?.submitUrl || ap.entranceTest?.testFileUrl ? (
                                <div className="flex flex-col gap-1">
                                  {ap.entranceTest.submitUrl && (
                                    <a href={ap.entranceTest.submitUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5 font-semibold">
                                      Link bài làm <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  )}
                                  {ap.entranceTest.testFileUrl && (
                                    <a href={ap.entranceTest.testFileUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline inline-flex items-center gap-0.5 font-semibold">
                                      Đề thi <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  )}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1">
                                  {ap.resultAfterTrial?.isHasOrder ? (
                                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-slate-300 shrink-0" />
                                  )}
                                  Tạo đơn hàng
                                </span>
                                <span className="flex items-center gap-1">
                                  {ap.resultAfterTrial?.isHasPayment ? (
                                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-slate-300 shrink-0" />
                                  )}
                                  Đã thanh toán
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ap.status === "COMPLETED" 
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {ap.status === "COMPLETED" ? "Đã tham gia" : ap.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Classroom Links */}
              {detailData.links && detailData.links.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-slate-400" /> Link phòng học trực tuyến</h4>
                  <div className="flex flex-wrap gap-2">
                    {detailData.links.map((ln: any) => (
                      <a 
                        key={ln._id} 
                        href={ln.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-1 rounded-md text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                      >
                        {ln.title || "Vào học phòng học"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Additional Info */}
              {detailData.confirmAdditionalInfo && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-500">Xác nhận thông tin bổ sung:</span>
                    <span className="text-slate-800">{detailData.confirmAdditionalInfo.confirmAdditionalInfoStatus || "Chưa xác nhận"}</span>
                  </div>
                  {detailData.confirmAdditionalInfo.note && (
                    <p className="mt-1 text-[11px] text-slate-500 leading-normal">{detailData.confirmAdditionalInfo.note}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
