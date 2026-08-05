"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Table as TableIcon,
  AlertCircle,
} from "lucide-react";
import type {
  PayrollRecord,
  PayrollPagination,
} from "@/types/payroll";
import { useAuthStore } from "@/store/useAuthStore";
import { isTdMTeacher } from "@/lib/payrollReportAccess";
import { ReportPayrollIssueDialog } from "./ReportPayrollIssueDialog";
import { format } from "date-fns";

interface PayrollDetailTableProps {
  rows: PayrollRecord[];
  pagination?: PayrollPagination;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onExport?: () => void;
}
function formatSlotTime(slotTime: string | null): string {
  if (!slotTime) return "—";
  try {
    return format(new Date(slotTime), "dd/MM/yyyy HH:mm");
  } catch {
    return slotTime;
  }
}

function statusBadgeVariant(status: string) {
  return status === "CHECKED" ? "success" : "warning";
}

function safeText(value: string): string {
  if (!value || value === "undefined" || value === "null") return "—";
  return value;
}

export function PayrollDetailTable({
  rows,
  pagination,
  loading,
  onPageChange,
  onExport,
}: PayrollDetailTableProps) {
  const hasRows = rows.length > 0;
  const totalPages = pagination?.totalPages ?? 0;
  const page = pagination?.page ?? 1;
  // Backend endpoint is public — anyone viewing payroll can report an
  // "Uncheck vô lý" row. We still highlight the action for TDM teachers
  // (warn-color) but show the button regardless of auth state.
  const user = useAuthStore((s) => s.user);
  const isTdm = useAuthStore((s) => s.isAuthenticated) && isTdMTeacher(user);

  const [reportTarget, setReportTarget] = useState<PayrollRecord | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  function openReportDialog(record: PayrollRecord) {
    setReportTarget(record);
    setReportDialogOpen(true);
  }

  function handleExport() {
    if (!hasRows) return;
    const headers = [
      "Thời gian",
      "Giáo viên",
      "Email",
      "Username",
      "Lớp",
      "Trung tâm",
      "Loại",
      "Vai trò",
      "Trạng thái",
      "Slot",
      "Giờ",
      "Học viên",
      "Ghi chú",
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          formatSlotTime(r.slotTime),
          csvEscape(r.teacherName),
          csvEscape(r.workEmail),
          csvEscape(r.username),
          csvEscape(r.className),
          csvEscape(r.centreShortname),
          r.type,
          csvEscape(r.classRole),
          r.status,
          r.slotDuration,
          r.effectiveDuration,
          r.studentCount,
          csvEscape(r.note || r.managerNote || ""),
        ].join(","),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-detail-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Chi tiết từng buổi
            </CardTitle>
            <CardDescription>
              {pagination
                ? `${pagination.total.toLocaleString("vi-VN")} dòng — trang ${page}/${totalPages || 1}`
                : "Chọn bộ lọc để bắt đầu tra cứu"}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (onExport ? onExport() : handleExport())}
            disabled={!hasRows}
          >
            <Download className="h-4 w-4" />
            Xuất trang hiện tại
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !hasRows ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            Không có dữ liệu phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Giáo viên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>TT</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead className="text-right">Giờ</TableHead>
                  <TableHead className="text-right">HV</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const showReport =
                    r.status === "UNCHECKED" &&
                    r.centreShortname === "230ĐLBD";
                  return (
                    <TableRow key={r._id}>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {formatSlotTime(r.slotTime)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {safeText(r.teacherName)}
                        </div>
                        {r.username && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {safeText(r.username)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {safeText(r.workEmail)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {safeText(r.className)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {safeText(r.centreShortname)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={
                            r.type === "OFFICE_HOURS" ? "info" : "outline"
                          }
                        >
                          {r.type === "OFFICE_HOURS" ? "OH" : "Lớp"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {safeText(r.classRole)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.effectiveDuration}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.studentCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status)}>
                          {r.status === "CHECKED" ? "Đã check" : "Chưa check"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {showReport ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className={
                              isTdm
                                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                : "text-muted-foreground hover:text-foreground"
                            }
                            onClick={() => openReportDialog(r)}
                          >
                            <AlertCircle className="h-4 w-4" />
                            Report
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-muted-foreground">
                  Trang {page} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ReportPayrollIssueDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        record={reportTarget}
      />
    </Card>
  );
}

function csvEscape(value: string): string {
  if (!value) return "";
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}