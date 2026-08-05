"use client";

import { useEffect, useState, useDeferredValue } from "react";
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
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  RefreshCw,
  RotateCcw,
  User,
  Mail,
  Phone,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  AlertTriangle,
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

const statusColor = (status: string) => {
  const s = status?.toUpperCase().replace(/\s+/g, "_") || "";
  if (s === "RUNNING" || s === "OPEN")
    return { variant: "success" as const, dot: "bg-success" };
  if (["PRE_OPEN", "PREPARING", "NEW"].includes(s))
    return { variant: "info" as const, dot: "bg-info" };
  if (["CLOSED", "ENDED", "FINISHED"].includes(s))
    return { variant: "secondary" as const, dot: "bg-muted-foreground" };
  return { variant: "secondary" as const, dot: "bg-muted-foreground" };
};

const getInitials = (name: string) =>
  (name || "?").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export default function StudentsPage() {
  const { user, token } = useAuthStore();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showLoading = useMinLoading(loading, 600);
  const isTE = user?.appRoles?.includes("TE" as any);

  const rawCentres = user?.teacherCentres || [];
  const centres = rawCentres.map((c: any) =>
    typeof c === "string" ? { id: c, name: c } : c,
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
  const limit = 20;

  useEffect(() => {
    const tdm = centres.find(
      (c: any) =>
        c.name?.toLowerCase().includes("thủ dầu một") ||
        c.id?.toLowerCase().includes("thủ dầu một"),
    );
    if (tdm) setSelectedCentre(tdm.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClassesList = async () => {
    if (!token || (!user?.teacherId && !isTE)) return;
    try {
      let statusIn: string[] | undefined;
      if (selectedStatus !== "all") statusIn = selectedStatus.split(",");
      const res = await classService.getClasses(
        token,
        user?.teacherId || "",
        centres.map((c: any) => c.id),
        user?.appRoles || [],
        {
          statusIn,
          limit: 500,
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
      let statusIn: string[] | undefined;
      if (selectedStatus !== "all") statusIn = selectedStatus.split(",");
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

  useEffect(() => {
    setPage(1);
  }, [deferredSearchTerm, selectedCentre, selectedStatus, selectedClass]);

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full flex flex-col h-full">
      <PageHeader
        icon={GraduationCap}
        title="Học viên"
        description={`Quản lý thông tin ${totalItems} học viên đang theo học tại các cơ sở của bạn`}
        actions={
          <div className="flex items-center gap-2">
            {isTE && (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSyncStudents}
                disabled={syncing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? "Đang đồng bộ..." : "Đồng bộ LMS"}</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold gap-1.5"
              onClick={fetchStudents}
              disabled={showLoading}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${showLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
          </div>
        }
      />

      {/* Main card view */}
      <div className="flex-1 border border-border bg-card shadow-xs overflow-hidden relative flex flex-col rounded-xl">
        {/* Filters Toolbar */}
        <div className="p-1.5 bg-card border-b border-border flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="relative flex-[2] min-w-[200px] sm:min-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Tìm tên, email, số điện thoại học viên..."
              className="pl-8 h-8 text-xs bg-card w-full border-border focus:ring-4 focus:ring-primary/10 focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {centres.length > 0 && (
            <div className="flex-1 min-w-[130px] sm:min-w-[160px]">
              <Select value={selectedCentre} onValueChange={setSelectedCentre}>
                <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                  <SelectValue placeholder="Cơ sở" />
                </SelectTrigger>
                <SelectContent className="text-xs">
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
          <div className="flex-1 min-w-[120px] sm:min-w-[150px]">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-8 text-xs font-semibold text-foreground">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="RUNNING,OPEN,PRE_OPEN">
                  Đang hoạt động
                </SelectItem>
                <SelectItem value="ENDED,CLOSED">Đã kết thúc</SelectItem>
                <SelectItem value="all">Tất cả</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          {showLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              icon={<User className="h-8 w-8" />}
              title="Không tìm thấy học viên"
              description="Thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm khác."
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <TableRow className="h-9">
                  <TableHead className="w-[30%] text-xs font-bold text-muted-foreground uppercase tracking-wider">Học viên</TableHead>
                  <TableHead className="w-[35%] text-xs font-bold text-muted-foreground uppercase tracking-wider">Lớp học</TableHead>
                  <TableHead className="w-[17.5%] text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Chuyên cần
                  </TableHead>
                  <TableHead className="w-[17.5%] text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Bài tập
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                          student.classes.map((cls) => {
                            const sc = statusColor(cls.status);
                            return (
                              <Badge
                                key={cls.id}
                                variant={sc.variant}
                                className="gap-1.5 w-fit font-medium"
                              >
                                <GraduationCap className="h-3 w-3 opacity-70" />
                                {cls.name}
                              </Badge>
                            );
                          })
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
          )}
        </div>

        {!showLoading && students.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/30">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Hiển thị{" "}
                <span className="font-semibold text-foreground">
                  {(page - 1) * limit + 1}
                </span>{" "}
                –{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(page * limit, totalItems)}
                </span>{" "}
                /{" "}
                <span className="font-semibold text-foreground">{totalItems}</span>{" "}
                học viên
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center min-w-[3rem] text-xs font-semibold px-2">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
