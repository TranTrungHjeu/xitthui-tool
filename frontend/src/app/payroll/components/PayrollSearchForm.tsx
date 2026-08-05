"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search,
  RefreshCw,
  X,
  Filter,
  Calendar,
} from "lucide-react";
import type {
  PayrollPeriod,
  PayrollSearchParams,
  PayrollType,
  PayrollStatus,
  PayrollCentreOption,
} from "@/types/payroll";
import { cn } from "@/lib/utils";

interface PayrollSearchFormProps {
  periods: PayrollPeriod[];
  value: PayrollSearchParams;
  onChange: (next: PayrollSearchParams) => void;
  onSubmit: () => void;
  loading?: boolean;
  className?: string;
  /** Optional — distinct centre shortnames loaded by the parent. */
  centres?: PayrollCentreOption[];
}

const TYPE_OPTIONS: { value: PayrollType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "CLASS", label: "Lớp học" },
  { value: "OFFICE_HOURS", label: "Office hours" },
];

const STATUS_OPTIONS: { value: PayrollStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "CHECKED", label: "Đã check" },
  { value: "UNCHECKED", label: "Chưa check" },
];

const ROLE_OPTIONS = [
  { value: "ALL", label: "Tất cả vai trò" },
  { value: "LEC", label: "LEC (Giáo viên chính)" },
  { value: "TA", label: "TA (Trợ giảng)" },
  { value: "FIXED", label: "Fixed OH" },
  { value: "TRIAL", label: "Trial" },
];

export function PayrollSearchForm({
  periods,
  value,
  onChange,
  onSubmit,
  loading,
  className,
  centres,
}: PayrollSearchFormProps) {
  const [draftQ, setDraftQ] = useState(value.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftQ(value.q ?? "");
  }, [value.q]);

  const debouncedSetQ = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ ...value, q: text });
      }, 300);
    },
    [onChange, value],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasFilters =
    (value.q && value.q.length > 0) ||
    value.type ||
    value.status ||
    value.classRole ||
    value.centre ||
    value.month ||
    value.year ||
    (value.periodId && value.periodId !== "ALL");

  function resetFilters() {
    onChange({ periodId: "ALL" });
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tên giáo viên, email, username, hoặc mã lớp..."
              value={draftQ}
              onChange={(e) => {
                setDraftQ(e.target.value);
                debouncedSetQ(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={onSubmit} disabled={loading} size="default">
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Tra cứu
          </Button>
          {hasFilters && (
            <Button
              variant="outline"
              size="default"
              onClick={resetFilters}
              disabled={loading}
            >
              <X className="h-4 w-4" />
              Xóa lọc
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Kỳ công
            </Label>
            <Select
              value={value.periodId || "ALL"}
              onValueChange={(v) =>
                onChange({ ...value, periodId: v === "ALL" ? undefined : v })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn kỳ công" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả kỳ</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.label} ({p.recordCount} dòng)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Loại
            </Label>
            <Select
              value={value.type || "ALL"}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  type: v === "ALL" ? undefined : (v as PayrollType),
                })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Loại" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Trạng thái
            </Label>
            <Select
              value={value.status || "ALL"}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  status: v === "ALL" ? undefined : (v as PayrollStatus),
                })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Vai trò
            </Label>
            <Select
              value={value.classRole || "ALL"}
              onValueChange={(v) =>
                onChange({ ...value, classRole: v === "ALL" ? undefined : v })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Mã trung tâm
            </Label>
            <Select
              value={value.centre || "ALL"}
              onValueChange={(v) =>
                onChange({ ...value, centre: v === "ALL" ? undefined : v })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả trung tâm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả trung tâm</SelectItem>
                {(centres ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label} ({c.count.toLocaleString("vi-VN")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tháng / Năm
            </Label>
            <div className="flex gap-1.5">
              <Select
                value={value.month ? String(value.month) : "ALL"}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    month: v === "ALL" ? undefined : Number(v),
                  })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tháng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      T{m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={value.year ? String(value.year) : "ALL"}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    year: v === "ALL" ? undefined : Number(v),
                  })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Năm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Có thể tra cứu theo tên, email, username, hoặc mã lớp.</span>
          {periods.length === 0 && (
            <Badge variant="warning" className="ml-2">
              <Calendar className="h-3 w-3 mr-1" />
              Chưa có kỳ công nào
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}