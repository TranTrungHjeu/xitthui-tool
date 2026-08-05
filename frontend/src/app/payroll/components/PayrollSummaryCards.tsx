"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  GraduationCap,
  Briefcase,
  Building2,
} from "lucide-react";
import type { PayrollSummary } from "@/types/payroll";

interface PayrollSummaryCardsProps {
  summary: PayrollSummary | null;
  loading?: boolean;
  periodLabel?: string;
}

export function PayrollSummaryCards({
  summary,
  loading,
  periodLabel,
}: PayrollSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[110px] rounded-xl border border-border/60 bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu KPI. Chọn một kỳ công để xem tổng hợp.
      </Card>
    );
  }

  const { kpis, byRole, byCentre, byStatus } = summary;

  const checkedStatus = byStatus.find((s) => s.status === "CHECKED")?.count ?? 0;
  const uncheckedStatus =
    byStatus.find((s) => s.status === "UNCHECKED")?.count ?? 0;

  return (
    <div className="space-y-4">
      {periodLabel && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Tổng hợp cho kỳ: {periodLabel}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Tổng buổi"
          value={kpis.totalRecords.toLocaleString("vi-VN")}
          icon={<Calendar className="h-5 w-5" />}
          variant="primary"
          description={`${kpis.totalStudents.toLocaleString("vi-VN")} học viên tham gia`}
        />
        <StatCard
          label="Đã check"
          value={checkedStatus.toLocaleString("vi-VN")}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="success"
          description={`Tỉ lệ hoàn thành ${
            kpis.totalRecords > 0
              ? Math.round((checkedStatus / kpis.totalRecords) * 100)
              : 0
          }%`}
        />
        <StatCard
          label="Chưa check"
          value={uncheckedStatus.toLocaleString("vi-VN")}
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          description="Cần TE/manager duyệt"
        />
        <StatCard
          label="Tổng giờ công"
          value={kpis.totalEffectiveHours.toLocaleString("vi-VN", {
            maximumFractionDigits: 1,
          })}
          icon={<Briefcase className="h-5 w-5" />}
          variant="info"
          description={`${kpis.totalSlots.toLocaleString("vi-VN")} slot`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Theo vai trò
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byRole.length === 0 ? (
              <div className="text-xs text-muted-foreground">Chưa có dữ liệu.</div>
            ) : (
              byRole.map((r) => (
                <div
                  key={r.role || "unknown"}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="soft">{r.role || "(khác)"}</Badge>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span>{r.count} buổi</span>
                    <span className="text-muted-foreground">
                      {r.hours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Top trung tâm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byCentre.length === 0 ? (
              <div className="text-xs text-muted-foreground">Chưa có dữ liệu.</div>
            ) : (
              byCentre.slice(0, 6).map((c) => (
                <div
                  key={c.centre || "unknown"}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-mono">{c.centre || "(khác)"}</span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span>{c.count} buổi</span>
                    <span className="text-muted-foreground">
                      {c.hours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4" />
              Tóm tắt khác
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Số giáo viên tham gia</span>
              <span className="font-medium tabular-nums">
                {kpis.teacherCount.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tổng học viên</span>
              <span className="font-medium tabular-nums">
                {kpis.totalStudents.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tổng slot</span>
              <span className="font-medium tabular-nums">
                {kpis.totalSlots.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trung bình giờ/buổi</span>
              <span className="font-medium tabular-nums">
                {kpis.totalRecords > 0
                  ? (kpis.totalEffectiveHours / kpis.totalRecords).toLocaleString(
                      "vi-VN",
                      { maximumFractionDigits: 2 },
                    )
                  : 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}