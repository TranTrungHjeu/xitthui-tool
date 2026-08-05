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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Download,
  Search as SearchIcon,
  ArrowUpDown,
  Users,
} from "lucide-react";
import type { PayrollMonthlyRollup } from "@/types/payroll";
import { cn } from "@/lib/utils";

interface PayrollMonthlyRollupTableProps {
  rows: PayrollMonthlyRollup[];
  loading?: boolean;
  periodLabel?: string;
  onExport?: () => void;
}

type SortKey =
  | "teacherName"
  | "username"
  | "totalSessions"
  | "checkedSessions"
  | "lecCount"
  | "taCount"
  | "ohCount"
  | "totalEffectiveHours"
  | "totalStudents";

export function PayrollMonthlyRollupTable({
  rows,
  loading,
  periodLabel,
  onExport,
}: PayrollMonthlyRollupTableProps) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("teacherName");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter(
        (r) =>
          r.teacherName?.toLowerCase().includes(q) ||
          r.username?.toLowerCase().includes(q) ||
          r.workEmail?.toLowerCase().includes(q),
      );
    }
    const sorted = [...out].sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number | string;
      const bv = (b[sortKey] ?? 0) as number | string;
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv), "vi")
        : String(bv).localeCompare(String(av), "vi");
    });
    return sorted;
  }, [rows, filter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function exportCSV() {
    if (!filtered.length) return;
    const headers = [
      "Giáo viên",
      "Username",
      "Email",
      "Tổng buổi",
      "Đã check",
      "LEC",
      "TA",
      "OH",
      "Tổng giờ",
      "Tổng HV",
      "Trung tâm",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      lines.push(
        [
          csvEscape(r.teacherName),
          csvEscape(r.username),
          csvEscape(r.workEmail),
          r.totalSessions,
          r.checkedSessions,
          r.lecCount,
          r.taCount,
          r.ohCount,
          r.totalEffectiveHours,
          r.totalStudents,
          csvEscape((r.centres || []).join("| ")),
        ].join(","),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-rollup-${periodLabel || "month"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Bảng kê tháng
            </CardTitle>
            <CardDescription>
              Tổng hợp theo giáo viên — {filtered.length}/{rows.length} GV
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Lọc GV..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            {(onExport || filtered.length > 0) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (onExport) onExport();
                  else exportCSV();
                }}
                disabled={!filtered.length}
              >
                <Download className="h-4 w-4" />
                Xuất CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Chưa có dữ liệu"
            description="Chọn kỳ công để xem bảng kê."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader
                  label="Giáo viên"
                  active={sortKey === "teacherName"}
                  asc={sortAsc}
                  onClick={() => toggleSort("teacherName")}
                />
                <SortHeader
                  label="Username"
                  active={sortKey === "username"}
                  asc={sortAsc}
                  onClick={() => toggleSort("username")}
                />
                <TableHead>Email</TableHead>
                <SortHeader
                  label="Tổng"
                  active={sortKey === "totalSessions"}
                  asc={sortAsc}
                  onClick={() => toggleSort("totalSessions")}
                  align="right"
                />
                <SortHeader
                  label="Đã check"
                  active={sortKey === "checkedSessions"}
                  asc={sortAsc}
                  onClick={() => toggleSort("checkedSessions")}
                  align="right"
                />
                <SortHeader
                  label="LEC"
                  active={sortKey === "lecCount"}
                  asc={sortAsc}
                  onClick={() => toggleSort("lecCount")}
                  align="right"
                />
                <SortHeader
                  label="TA"
                  active={sortKey === "taCount"}
                  asc={sortAsc}
                  onClick={() => toggleSort("taCount")}
                  align="right"
                />
                <SortHeader
                  label="OH"
                  active={sortKey === "ohCount"}
                  asc={sortAsc}
                  onClick={() => toggleSort("ohCount")}
                  align="right"
                />
                <SortHeader
                  label="Giờ"
                  active={sortKey === "totalEffectiveHours"}
                  asc={sortAsc}
                  onClick={() => toggleSort("totalEffectiveHours")}
                  align="right"
                />
                <SortHead>
                  <span>Trung tâm</span>
                </SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.username || r.teacherName}>
                  <TableCell className="font-medium">
                    {r.teacherName || "(không tên)"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.username || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.workEmail || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.totalSessions}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge
                      variant={
                        r.checkedSessions === r.totalSessions ? "success" : "soft"
                      }
                      className="tabular-nums"
                    >
                      {r.checkedSessions}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.lecCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.taCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.ohCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.totalEffectiveHours.toLocaleString("vi-VN", {
                      maximumFractionDigits: 1,
                    })}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {(r.centres || []).slice(0, 3).map((c) => (
                        <Badge key={c} variant="outline" className="font-mono">
                          {c}
                        </Badge>
                      ))}
                      {(r.centres || []).length > 3 && (
                        <Badge variant="ghost">
                          +{r.centres.length - 3}
                        </Badge>
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
  );
}

function csvEscape(value: string): string {
  if (!value) return "";
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function SortHead({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <TableHead className={cn("text-right", className)}>{children}</TableHead>;
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
  align?: "right";
}) {
  return (
    <TableHead className={cn(align === "right" && "text-right")}>
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition-opacity",
            active ? "opacity-100" : "opacity-30",
          )}
        />
        {active && <span className="text-[10px]">{asc ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}