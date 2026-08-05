"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { format } from "date-fns";
import { toast } from "@/components/ui/toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertTriangle,
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  Shield,
  AlertCircle,
  History,
  Inbox,
  ExternalLink,
} from "lucide-react";
import { payrollService } from "@/services/payrollService";
import type {
  PayrollIssueReport,
  PayrollIssueStatus,
  PayrollPeriod,
  PayrollPagination,
} from "@/types/payroll";
import { isActualKhiemAccount } from "@/lib/utils";

const STATUS_OPTIONS: { value: PayrollIssueStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "pending", label: "Pending" },
  { value: "notified", label: "Notified" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function statusBadgeVariant(status: PayrollIssueStatus) {
  switch (status) {
    case "pending":
      return "warning";
    case "notified":
      return "info";
    case "resolved":
      return "success";
    case "dismissed":
      return "outline";
    default:
      return "outline";
  }
}

function statusLabel(status: PayrollIssueStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return format(new Date(s), "dd/MM/yyyy HH:mm");
  } catch {
    return s;
  }
}

function defaultIntro(total: number) {
  return (
    `<p>Dear team,</p>` +
    `<p>Tổng hợp công lương trung tâm <strong>Thủ Dầu Một</strong> bị sai. ` +
    `Vui lòng xem chi tiết các dòng công Uncheck vô lý dưới đây.</p>` +
    `<p>Số dòng cần xử lý: <strong style="color:#d32f2f;">${total} dòng</strong>.</p>`
  );
}

function defaultConclusion(total: number) {
  return (
    `<p>Với lần này công sai sót lên tới <strong>${total} dòng</strong>. ` +
    `Mong team xem xét và xử lý trong thời gian sớm nhất.</p>` +
    `<p>Trân trọng,</p>` +
    `<p><strong>MindX Support Tools</strong></p>`
  );
}

export default function PayrollReportsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  const hasAccess = isActualKhiemAccount(user);

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<PayrollIssueStatus | "ALL">(
    "pending",
  );

  const [issues, setIssues] = useState<PayrollIssueReport[]>([]);
  const [pagination, setPagination] = useState<PayrollPagination | undefined>();
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMode, setNotifyMode] = useState<"smtp" | "outlook">("smtp");
  const [customIntro, setCustomIntro] = useState("");
  const [customConclusion, setCustomConclusion] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<PayrollIssueReport | null>(
    null,
  );

  const [resolveTarget, setResolveTarget] = useState<PayrollIssueReport | null>(
    null,
  );
  const [resolveAction, setResolveAction] = useState<"resolved" | "dismissed">(
    "resolved",
  );
  const [resolveNote, setResolveNote] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);

  const loadPeriods = useCallback(async () => {
    try {
      const res = await payrollService.getPeriods();
      if (res.success && Array.isArray(res.data)) {
        setPeriods(res.data);
      }
    } catch {
      // ignored — period dropdown is optional
    }
  }, []);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        periodId?: string;
        status?: PayrollIssueStatus;
        page?: number;
        pageSize?: number;
      } = { pageSize: 100 };
      if (periodId !== "ALL") params.periodId = periodId;
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await payrollService.listIssues(params);
      if (res.success) {
        setIssues(res.data ?? []);
        setPagination(res.pagination);
      } else {
        toast.error("Không thể tải báo cáo", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Lỗi", { description: err?.message ?? String(err) });
    } finally {
      setLoading(false);
    }
  }, [periodId, statusFilter]);

  useEffect(() => {
    if (isAuthenticated && hasAccess) {
      loadPeriods();
    }
  }, [isAuthenticated, hasAccess, loadPeriods]);

  useEffect(() => {
    if (isAuthenticated && hasAccess) {
      loadIssues();
      setSelected(new Set());
    }
  }, [isAuthenticated, hasAccess, loadIssues]);

  if (isAuthenticated && !hasAccess) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10">
        <Card className="max-w-md mx-auto p-8 text-center">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold mb-1">Không có quyền truy cập</h2>
          <p className="text-sm text-muted-foreground">
            Trang này chỉ dành cho TE quản lý centre TDM (thekhiem).
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/dashboard/payroll")}
          >
            Quay lại Quản lý công lương
          </Button>
        </Card>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10">
        <Card className="max-w-md mx-auto p-8 text-center">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </Card>
      </main>
    );
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === issues.length) return new Set();
      return new Set(issues.map((i) => i._id));
    });
  }

  function openNotifyDialog(mode: "smtp" | "outlook" = "smtp") {
    if (selected.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 báo cáo.");
      return;
    }
    setNotifyMode(mode);
    setCustomIntro(defaultIntro(selected.size));
    setCustomConclusion(defaultConclusion(selected.size));
    setNotifyOpen(true);
  }

  async function sendNotify() {
    if (selected.size === 0) return;
    setNotifyBusy(true);
    try {
      const res = await payrollService.notifyIssue({
        issueIds: Array.from(selected),
        customIntro,
        customConclusion,
        mode: notifyMode,
      });
      if (!res.success) {
        toast.error("Thao tác thất bại", {
          description: res.data?.error || res.error,
        });
        return;
      }
      if (res.data?.error) {
        // Server-side failure (e.g. SMTP error from gmail) — surface the
        // real reason in the toast so TE can act on it.
        toast.error("Email chưa gửi được", {
          description:
            res.data.error +
            (res.detail ? ` — ${res.detail}` : ""),
        });
        setNotifyOpen(false);
        return;
      }
      const url = res.data?.outlookComposeUrl;
      if (notifyMode === "outlook" && url) {
        window.open(url, "_blank", "noopener,noreferrer");
        toast.success(
          `Đã mở Outlook compose với ${res.data.sent} báo cáo. ` +
            `Bấm Send trong Outlook để hoàn tất.`,
        );
      } else {
        toast.success(
          `Đã gửi email tới Tech team (${res.data.sent} báo cáo).`,
        );
      }
      setNotifyOpen(false);
      setSelected(new Set());
      await loadIssues();
    } catch (err: any) {
      // axios error carries the server response — surface the real
      // diagnostic so TE can see e.g. SMTP/auth failures without
      // having to grep the server log.
      const serverDetail = err?.response?.data?.detail;
      const serverError = err?.response?.data?.error;
      const description =
        (serverError ? `${serverError}` : "") +
        (serverDetail ? ` — ${serverDetail}` : "") ||
        err?.message ||
        String(err);
      toast.error("Lỗi", { description });
    } finally {
      setNotifyBusy(false);
    }
  }

  function openResolve(issue: PayrollIssueReport, action: "resolved" | "dismissed") {
    setResolveTarget(issue);
    setResolveAction(action);
    setResolveNote("");
  }

  async function confirmResolve() {
    if (!resolveTarget) return;
    setResolveBusy(true);
    try {
      const res = await payrollService.resolveIssue(resolveTarget._id, {
        action: resolveAction,
        note: resolveNote,
      });
      if (res.success) {
        toast.success(
          resolveAction === "resolved"
            ? "Đã đánh dấu Resolved."
            : "Đã đánh dấu Dismissed.",
        );
        setResolveTarget(null);
        setResolveNote("");
        await loadIssues();
      } else {
        toast.error("Lỗi", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Lỗi", { description: err?.message ?? String(err) });
    } finally {
      setResolveBusy(false);
    }
  }

  const selectedPending = useMemo(
    () => issues.filter((i) => selected.has(i._id) && i.status === "pending"),
    [issues, selected],
  );

  return (
    <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      <PageHeader
        icon={AlertTriangle}
        title="Báo cáo công lương TDM"
        description="GV TDM báo cáo công lương Uncheck vô lý · Tổng hợp gửi Tech team."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={loadIssues}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button
              variant="outline"
              onClick={() => openNotifyDialog("outlook")}
              disabled={selectedPending.length === 0}
              title="Mở Outlook Web Compose với nội dung prefilled"
            >
              <ExternalLink className="h-4 w-4" />
              Mở Outlook soạn mail
            </Button>
            <Button
              onClick={() => openNotifyDialog("smtp")}
              disabled={selectedPending.length === 0}
            >
              <Mail className="h-4 w-4" />
              Gửi email ({selectedPending.length})
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Kỳ công:</span>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Trạng thái:</span>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as PayrollIssueStatus | "ALL")
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="Chưa có báo cáo công lương nào"
              description="GV TDM chưa gửi báo cáo nào trong kỳ này."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        selected.size === issues.length && issues.length > 0
                      }
                      onChange={toggleSelectAll}
                      aria-label="Chọn tất cả"
                    />
                  </TableHead>
                  <TableHead>Giáo viên</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Người báo cáo</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i) => (
                  <TableRow key={i._id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(i._id)}
                        onChange={() => toggleSelect(i._id)}
                        disabled={i.status !== "pending"}
                        aria-label={`Chọn báo cáo ${i._id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{i.teacherName || "—"}</div>
                      {i.teacherUsername && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {i.teacherUsername}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {i.teacherClassName || "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(i.teacherSlotTime)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{i.reporterFullName || i.reporterUsername}</div>
                      <div className="text-muted-foreground font-mono">
                        {i.reporterUsername}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px]">
                      <div className="line-clamp-2">{i.reason}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(i.status)}>
                        {statusLabel(i.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(i.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryTarget(i)}
                          title="Lịch sử email"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {i.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                              onClick={() => openResolve(i, "resolved")}
                              title="Đánh dấu Resolved"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => openResolve(i, "dismissed")}
                              title="Bỏ qua"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination && issues.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          Hiển thị {issues.length}/{pagination.total.toLocaleString("vi-VN")} báo cáo
        </div>
      )}

      {/* Notify Dialog */}
      <Dialog
        open={notifyOpen}
        onOpenChange={(open) => {
          if (!open && !notifyBusy) setNotifyOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {notifyMode === "outlook" ? (
                <ExternalLink className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              {notifyMode === "outlook"
                ? "Mở Outlook soạn mail"
                : "Gửi email Tech team"}
            </DialogTitle>
            <DialogDescription>
              {notifyMode === "outlook"
                ? "Outlook Web Compose sẽ mở trong tab mới với to/cc/subject/body prefilled. Bấm Send trong Outlook để hoàn tất."
                : "Sẽ gửi 1 email tổng hợp tới Tech team. Nội dung có thể chỉnh sửa trước khi gửi."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Số dòng:</span>{" "}
              <strong>{selectedPending.length}</strong>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Mở đầu (HTML)</label>
              <textarea
                value={customIntro}
                onChange={(e) => setCustomIntro(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono"
                disabled={notifyBusy}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Kết thúc (HTML)</label>
              <textarea
                value={customConclusion}
                onChange={(e) => setCustomConclusion(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono"
                disabled={notifyBusy}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotifyOpen(false)}
              disabled={notifyBusy}
            >
              Hủy
            </Button>
            <Button onClick={sendNotify} disabled={notifyBusy}>
              {notifyBusy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : notifyMode === "outlook" ? (
                <ExternalLink className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {notifyMode === "outlook"
                ? `Mở Outlook với ${selectedPending.length} báo cáo`
                : `Gửi ${selectedPending.length} báo cáo`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Lịch sử email
            </DialogTitle>
            <DialogDescription>
              {historyTarget &&
                `Báo cáo công lương từ ${historyTarget.reporterFullName || historyTarget.reporterUsername}`}
            </DialogDescription>
          </DialogHeader>
          {historyTarget && (
            <div className="space-y-3">
              {historyTarget.emailHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Chưa gửi email cho báo cáo này.
                </div>
              ) : (
                historyTarget.emailHistory.map((h, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-border px-3 py-2 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                    <Badge
                      variant={
                        h.success === null
                          ? "info"
                          : h.success
                            ? "success"
                            : "destructive"
                      }
                    >
                      {h.success === null
                        ? "Outlook compose"
                        : h.success
                          ? "Thành công"
                          : "Thất bại"}
                    </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(h.sentAt)}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Người gửi:</span>{" "}
                      {h.sentByName || "—"}
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">To:</span>{" "}
                      {h.to.join(", ")}
                      {h.cc.length > 0 && (
                        <>
                          {" "}
                          <span className="text-muted-foreground">CC:</span>{" "}
                          {h.cc.join(", ")}
                        </>
                      )}
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Subject:</span>{" "}
                      {h.subject}
                    </div>
                    {h.messageId && (
                      <div className="text-xs text-muted-foreground truncate">
                        messageId: {h.messageId}
                      </div>
                    )}
                    {h.error && (
                      <div className="text-xs text-destructive">Lỗi: {h.error}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryTarget(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog
        open={resolveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !resolveBusy) setResolveTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {resolveAction === "resolved" ? "Đánh dấu Resolved" : "Bỏ qua báo cáo"}
            </DialogTitle>
            <DialogDescription>
              {resolveAction === "resolved"
                ? "Đã xử lý với Tech team — đóng báo cáo này."
                : "Báo cáo không hợp lệ — bỏ qua."}
            </DialogDescription>
          </DialogHeader>
          {resolveTarget && (
            <div className="space-y-2">
              <div className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="font-medium">{resolveTarget.teacherName}</div>
                <div className="text-xs text-muted-foreground">
                  {resolveTarget.teacherClassName || "—"}
                </div>
              </div>
              <label className="text-sm font-medium">Ghi chú (tuỳ chọn)</label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value.slice(0, 1000))}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                disabled={resolveBusy}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveTarget(null)}
              disabled={resolveBusy}
            >
              Hủy
            </Button>
            <Button onClick={confirmResolve} disabled={resolveBusy}>
              {resolveBusy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : null}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
