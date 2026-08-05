"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useMinLoading } from "@/hooks/useMinLoading";
import { officeHourService, OfficeHourData } from "@/services/officeHourService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/CatLoader";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Calendar,
  User,
  AlertCircle,
  ExternalLink,
  Phone,
  Mail,
  Link2,
  CheckCircle2,
  XCircle,
  FileCheck,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "@/components/ui/toast";

const ITEMS_PER_PAGE = 15;

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "outline";

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  COMPLETED: { label: "Hoàn thành", variant: "success" },
  APPROVED: { label: "Đã duyệt", variant: "success" },
  RUNNING: { label: "Đang diễn ra", variant: "info" },
  CONFIRMED: { label: "Đã xác nhận", variant: "info" },
  PENDING: { label: "Chờ trực", variant: "warning" },
  DENIED: { label: "Bị từ chối", variant: "destructive" },
  REJECTED: { label: "Từ chối", variant: "destructive" },
  ABANDONED: { label: "Đã hủy", variant: "secondary" },
  CANCELED: { label: "Đã hủy bỏ", variant: "destructive" },
  CANCELLED: { label: "Đã hủy bỏ", variant: "destructive" },
};

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
  const showLoading = useMinLoading(isLoading, 500);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const isTE = user?.appRoles?.includes("TE" as any);

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
        user?.appRoles,
      );
      if (res.data) setDetailData(res.data);
    } catch (err) {
      console.error("Lỗi khi tải chi tiết office hour:", err);
      toast.error("Không thể tải chi tiết ca trực");
    } finally {
      setIsDetailLoading(false);
    }
  };

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
      let targetCentres = user.teacherCentres?.map((c: any) => c.id || c) || [];
      if (targetCentres.length === 0 || isTE) {
        targetCentres = ["6443460f94300678908f7974"];
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
        },
      );
      setOfficeHours(res.data || []);
      setPaginationMeta(
        res.meta || {
          total: 0,
          page: 1,
          limit: ITEMS_PER_PAGE,
          totalPages: 1,
        },
      );
    } catch (err) {
      console.error("Lỗi tải danh sách office hours:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficeHours();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, statusFilter, typeFilter, user]);

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: vi });
    } catch {
      return dateStr;
    }
  };

  const formatTimeRange = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return "N/A";
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      return `${format(s, "HH:mm")} - ${format(e, "HH:mm")}`;
    } catch {
      return "N/A";
    }
  };

  const statusInfo = (status: string) =>
    STATUS_MAP[status?.trim().toUpperCase()] ?? {
      label: status,
      variant: "outline" as BadgeVariant,
    };

  const isFilterActive =
    searchQuery || statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full flex flex-col h-full">
      <PageHeader
        icon={Clock}
        title="Lịch trực Office Hours"
        description={
          isTE
            ? "Dữ liệu lịch trực của toàn bộ giáo viên tại cơ sở Thủ Dầu Một."
            : "Danh sách lịch trực Office Hours của bạn."
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOfficeHours}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        }
      />

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-[2] min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Tìm giáo viên, lớp, ghi chú..."
                className="pl-9 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-10">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
                <SelectItem value="ABANDONED">Đã hủy</SelectItem>
                <SelectItem value="PENDING">Chờ trực</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-10">
                <SelectValue placeholder="Loại hình" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại hình</SelectItem>
                <SelectItem value="Fixed">Cố định (Fixed)</SelectItem>
                <SelectItem value="Trial">Dạy thử (Trial)</SelectItem>
              </SelectContent>
            </Select>
            {isFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
              >
                <RefreshCw className="h-4 w-4" />
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </CardContent>

        <div className="overflow-auto custom-scrollbar flex-1">
          {showLoading && officeHours.length === 0 ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : officeHours.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-8 w-8" />}
              title="Không có dữ liệu"
              description="Không tìm thấy lịch trực Office Hours nào phù hợp với bộ lọc hiện tại."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Ngày</TableHead>
                  <TableHead className="w-[110px]">Giờ trực</TableHead>
                  <TableHead className="w-[180px]">Giáo viên</TableHead>
                  <TableHead className="w-[100px]">Loại</TableHead>
                  <TableHead className="w-[200px]">Lớp / Học viên</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="text-right w-[120px]">
                    Trạng thái
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officeHours.map((item) => {
                  const st = statusInfo(item.status);
                  return (
                    <TableRow
                      key={item._id}
                      className="cursor-pointer"
                      onClick={() => handleOpenDetails(item._id)}
                    >
                      <TableCell className="font-mono text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDateString(item.startTime)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTimeRange(item.startTime, item.endTime)}
                      </TableCell>
                      <TableCell>
                        {item.teacher ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">
                              {item.teacher.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              @{item.teacher.code}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">
                            Chưa phân công
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.type || "Fixed"}
                      </TableCell>
                      <TableCell>
                        {item.class?.name ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">
                              {item.class.name}
                            </span>
                            {item.studentCount !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                Sĩ số: {item.studentCount} HV
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate text-sm text-muted-foreground">
                              {item.note || (
                                <span className="italic">Không có ghi chú</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          {item.note && (
                            <TooltipContent>{item.note}</TooltipContent>
                          )}
                        </Tooltip>
                        {item.managerNote && (
                          <div className="text-xs text-primary font-medium truncate mt-0.5">
                            QL: {item.managerNote}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {!showLoading && officeHours.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Hiển thị{" "}
                <span className="font-semibold text-foreground">
                  {officeHours.length}
                </span>{" "}
                / {paginationMeta.total} lịch trực
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center min-w-[5rem] text-xs font-medium px-2">
                  Trang {currentPage} / {paginationMeta.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(paginationMeta.totalPages, p + 1),
                    )
                  }
                  disabled={currentPage === paginationMeta.totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(paginationMeta.totalPages)}
                  disabled={currentPage === paginationMeta.totalPages || isLoading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Chi tiết ca trực Office Hours
                </DialogTitle>
                <DialogDescription className="text-xs">
                  ID ca trực: {selectedId}
                </DialogDescription>
              </div>
              {detailData && (
                <div className="flex items-center gap-2">
                  <Badge variant={statusInfo(detailData.status).variant}>
                    {statusInfo(detailData.status).label}
                  </Badge>
                  <Badge variant="info">{detailData.type || "Fixed"}</Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <Spinner size="lg" label="Đang tải dữ liệu chi tiết từ LMS..." />
            </div>
          ) : !detailData ? (
            <EmptyState
              icon={<AlertCircle className="h-8 w-8 text-destructive" />}
              title="Không thể tải dữ liệu"
              description="Vui lòng thử lại sau hoặc làm mới trang."
            />
          ) : (
            <div className="space-y-5 pt-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 border border-border">
                <div className="space-y-2">
                  <h3 className="font-semibold uppercase tracking-wider text-xs text-muted-foreground border-b border-border pb-1.5">
                    Thông tin chung
                  </h3>
                  <DetailRow label="Trung tâm" value={detailData.centre?.name} />
                  <DetailRow
                    label="Ngày trực"
                    value={formatDateString(detailData.startTime)}
                    mono
                  />
                  <DetailRow
                    label="Giờ trực"
                    value={formatTimeRange(detailData.startTime, detailData.endTime)}
                    mono
                  />
                  <DetailRow
                    label="Người tạo"
                    value={
                      detailData.createdBy?.username
                        ? `@${detailData.createdBy.username}`
                        : "LMS"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold uppercase tracking-wider text-xs text-muted-foreground border-b border-border pb-1.5">
                    Giáo viên & Lớp học
                  </h3>
                  <DetailRow
                    label="Giáo viên"
                    value={detailData.teacher?.fullName || "Chưa phân công"}
                  />
                  <DetailRow
                    label="Mã"
                    value={
                      detailData.teacher?.code ? `@${detailData.teacher.code}` : "-"
                    }
                    mono
                  />
                  <DetailRow
                    label="Liên hệ"
                    value={
                      detailData.teacher?.phoneNumber ||
                      detailData.teacher?.email
                    }
                    mono
                  />
                  {detailData.class?.name && (
                    <DetailRow label="Lớp hỗ trợ" value={detailData.class.name} />
                  )}
                </div>
              </div>

              {(detailData.note || detailData.managerNote) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailData.note && (
                    <NoteBlock
                      title="Ghi chú đăng ký"
                      icon={<AlertCircle className="h-4 w-4 text-warning" />}
                    >
                      {detailData.note}
                    </NoteBlock>
                  )}
                  {detailData.managerNote && (
                    <NoteBlock
                      title="Ghi chú quản lý"
                      icon={<FileCheck className="h-4 w-4 text-info" />}
                    >
                      {detailData.managerNote}
                    </NoteBlock>
                  )}
                </div>
              )}

              {detailData.uplevelTestStudents?.length > 0 && (
                <SubTable
                  title={`Học viên kiểm tra Uplevel (${detailData.uplevelTestStudents.length})`}
                  icon={<UserCheck className="h-4 w-4 text-success" />}
                  headers={["Học viên", "Lớp", "Trạng thái", "Ghi chú", "File"]}
                  rows={detailData.uplevelTestStudents.map((st: any) => ({
                    cells: [
                      st.student?.fullName || "N/A",
                      st.class?.name || "-",
                      st.status === "COMPLETED" ? (
                        <Badge variant="success" key={st.id}>Đạt</Badge>
                      ) : (
                        <Badge variant="warning" key={st.id}>{st.status}</Badge>
                      ),
                      <span className="truncate max-w-[180px] inline-block" key="note">
                        {st.note || "-"}
                      </span>,
                      st.fileUrl ? (
                        <a
                          key="file"
                          href={st.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          Tải file
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span key="file-empty">-</span>
                      ),
                    ],
                  }))}
                />
              )}

              {detailData.appointments?.length > 0 && (
                <SubTable
                  title={`Học viên học thử / Test đầu vào (${detailData.appointments.length})`}
                  icon={<User className="h-4 w-4 text-primary" />}
                  headers={[
                    "Học sinh",
                    "Liên hệ",
                    "Môn",
                    "Bài test",
                    "Đơn hàng",
                    "Trạng thái",
                  ]}
                  rows={detailData.appointments.map((ap: any) => ({
                    cells: [
                      ap.candidate?.fullName || ap.title,
                      <div key="contact" className="flex flex-col gap-0.5 font-mono text-xs">
                        {ap.candidate?.phoneNumber && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {ap.candidate.phoneNumber}
                          </span>
                        )}
                        {ap.candidate?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {ap.candidate.email}
                          </span>
                        )}
                      </div>,
                      <div key="courses" className="flex flex-wrap gap-1">
                        {ap.courses?.map((c: any) => (
                          <Badge key={c.id} variant="secondary" className="text-[10px]">
                            {c.shortName || c.name}
                          </Badge>
                        ))}
                      </div>,
                      <div key="test" className="flex flex-col gap-0.5">
                        {ap.entranceTest?.submitUrl && (
                          <a
                            href={ap.entranceTest.submitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-0.5 text-xs font-medium"
                          >
                            Bài làm <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {ap.entranceTest?.testFileUrl && (
                          <a
                            href={ap.entranceTest.testFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-success hover:underline inline-flex items-center gap-0.5 text-xs font-medium"
                          >
                            Đề thi <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>,
                      <div key="order" className="flex flex-col gap-0.5 text-xs">
                        <span className="flex items-center gap-1">
                          {ap.resultAfterTrial?.isHasOrder ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : (
                            <XCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                          Tạo đơn hàng
                        </span>
                        <span className="flex items-center gap-1">
                          {ap.resultAfterTrial?.isHasPayment ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : (
                            <XCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                          Đã thanh toán
                        </span>
                      </div>,
                      ap.status === "COMPLETED" ? (
                        <Badge variant="success" key="st">Đã tham gia</Badge>
                      ) : (
                        <Badge variant="outline" key="st">{ap.status}</Badge>
                      ),
                    ],
                  }))}
                />
              )}

              {detailData.links?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Link phòng học trực tuyến
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detailData.links.map((ln: any) => (
                      <a
                        key={ln._id}
                        href={ln.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-info/10 text-info border border-info/20 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-info/15 transition-colors"
                      >
                        {ln.title || "Vào phòng học"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>
        {value || "—"}
      </span>
    </div>
  );
}

function NoteBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="font-semibold text-sm flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      <div className="rounded-md bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-line max-h-[140px] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function SubTable({
  title,
  icon,
  headers,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  headers: string[];
  rows: { cells: React.ReactNode[] }[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold flex items-center gap-1.5 uppercase tracking-wider text-xs border-b border-border pb-1.5">
        {icon}
        {title}
      </h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <Table className="text-xs">
          <TableHeader className="bg-muted/40">
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {row.cells.map((cell, j) => (
                  <TableCell key={j} className="py-2">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
