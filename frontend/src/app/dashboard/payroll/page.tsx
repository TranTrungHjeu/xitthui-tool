"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Card, CardContent } from "@/components/ui/card";
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
  Wallet,
  Upload,
  Archive,
  ArchiveRestore,
  RefreshCw,
  Shield,
  Lock,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { payrollService } from "@/services/payrollService";
import type { PayrollPeriod } from "@/types/payroll";
import { isTE } from "@/lib/utils";
import { UploadPeriodDialog } from "./components/UploadPeriodDialog";
import { toast } from "@/components/ui/toast";

export default function PayrollAdminPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<PayrollPeriod | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");

  const hasAccess = isTE(user);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollService.adminListPeriods();
      if (res.success && Array.isArray(res.data)) {
        setPeriods(res.data);
      } else {
        toast.error("Không thể tải danh sách kỳ công", {
          description: res.error,
        });
      }
    } catch (err: any) {
      toast.error("Lỗi tải kỳ công", {
        description: err?.message ?? String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!hasAccess) return;
    loadPeriods();
  }, [isAuthenticated, hasAccess, loadPeriods]);

  // Auth gate: render a "not authorized" shell instead of redirecting —
  // this matches the behavior of other admin pages and lets the TE
  // button appear in the sidebar for non-TE users without leaking
  // actual data.
  if (isAuthenticated && !hasAccess) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10">
        <Card className="max-w-md mx-auto p-8 text-center">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold mb-1">Không có quyền truy cập</h2>
          <p className="text-sm text-muted-foreground">
            Trang này chỉ dành cho TE/Admin. Vui lòng đăng nhập với tài khoản
            có role phù hợp.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/dashboard")}
          >
            Quay lại dashboard
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

  async function toggleArchive(period: PayrollPeriod) {
    setBusyId(period._id);
    try {
      const res = await payrollService.archivePeriod(period._id);
      if (res.success) {
        const restored = res.data?.status === "active";
        toast.success(
          restored
            ? `Đã khôi phục kỳ ${period.label}`
            : `Đã archive kỳ ${period.label}`,
        );
        await loadPeriods();
      } else {
        toast.error("Thao tác thất bại", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Lỗi", { description: err?.message ?? String(err) });
    } finally {
      setBusyId(null);
    }
  }

  function openPurgeDialog(period: PayrollPeriod) {
    setPurgeTarget(period);
    setPurgeConfirmText("");
  }

  function closePurgeDialog() {
    setPurgeTarget(null);
    setPurgeConfirmText("");
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    if (purgeConfirmText.trim() !== purgeTarget.label) {
      toast.error("Vui lòng gõ chính xác tên kỳ công để xác nhận.");
      return;
    }
    setBusyId(purgeTarget._id);
    try {
      const res = await payrollService.purgePeriod(purgeTarget._id);
      if (res.success) {
        const deleted = res.data?.recordsDeleted ?? 0;
        toast.success(
          `Đã xóa vĩnh viễn kỳ ${purgeTarget.label} (${deleted.toLocaleString(
            "vi-VN",
          )} dòng).`,
        );
        closePurgeDialog();
        await loadPeriods();
      } else {
        toast.error("Xóa thất bại", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Lỗi", { description: err?.message ?? String(err) });
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(s: string | null | undefined): string {
    if (!s) return "—";
    try {
      return format(new Date(s), "dd/MM/yyyy HH:mm");
    } catch {
      return s;
    }
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      <PageHeader
        icon={Wallet}
        title="Quản lý công lương"
        description="Upload bảng công tháng cho giáo viên — chỉ TE/Admin."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadPeriods}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/payroll/reports")}
            >
              <AlertTriangle className="h-4 w-4" />
              Báo cáo công lương
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload kỳ mới
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : periods.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="Chưa có kỳ công nào"
              description="Bấm Upload kỳ mới để bắt đầu."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Upload kỳ đầu tiên
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ công</TableHead>
                  <TableHead>Tháng/Năm</TableHead>
                  <TableHead>Số dòng</TableHead>
                  <TableHead>Upload bởi</TableHead>
                  <TableHead>Upload lúc</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>TTL</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate max-w-[260px]">
                        {p.originalFileName}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      T{p.month}/{p.year}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <Badge variant="soft">
                        {p.recordCount.toLocaleString("vi-VN")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.uploadedByName || "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(p.uploadedAt)}
                    </TableCell>
                    <TableCell>
                      {p.status === "active" ? (
                        <Badge variant="success">Đang hoạt động</Badge>
                      ) : (
                        <Badge variant="outline">Đã archive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(p.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === p._id}
                          onClick={() => toggleArchive(p)}
                        >
                          {p.status === "active" ? (
                            <>
                              <Archive className="h-4 w-4" />
                              Archive
                            </>
                          ) : (
                            <>
                              <ArchiveRestore className="h-4 w-4" />
                              Khôi phục
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={busyId === p._id}
                          onClick={() => openPurgeDialog(p)}
                          title="Xóa vĩnh viễn kỳ công này"
                        >
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UploadPeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUploaded={loadPeriods}
      />

      <Dialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) closePurgeDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Xóa vĩnh viễn kỳ công
            </DialogTitle>
            <DialogDescription>
              Hành động này <span className="font-semibold">không thể hoàn tác</span>.
              Toàn bộ dữ liệu kỳ công sẽ bị xóa khỏi database, bao gồm cả các dòng
              PayrollRecord liên quan.
            </DialogDescription>
          </DialogHeader>

          {purgeTarget && (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <div className="font-medium">{purgeTarget.label}</div>
                <div className="text-xs text-muted-foreground">
                  T{purgeTarget.month}/{purgeTarget.year} ·{" "}
                  {purgeTarget.recordCount.toLocaleString("vi-VN")} dòng
                </div>
              </div>

              <label className="block text-sm">
                <span className="text-muted-foreground">
                  Gõ chính xác{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {purgeTarget.label}
                  </span>{" "}
                  để xác nhận:
                </span>
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder={purgeTarget.label}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={busyId === purgeTarget._id}
                />
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePurgeDialog}
              disabled={busyId !== null}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPurge}
              disabled={
                busyId !== null ||
                !purgeTarget ||
                purgeConfirmText.trim() !== (purgeTarget?.label ?? "")
              }
            >
              <Trash2 className="h-4 w-4" />
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}