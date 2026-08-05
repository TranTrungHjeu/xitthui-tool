"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Wallet, RefreshCw, Lock } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { payrollService } from "@/services/payrollService";
import type {
  PayrollMonthlyRollup,
  PayrollPeriod,
  PayrollSearchParams,
  PayrollSearchResponse,
  PayrollSummary,
  PayrollCentreOption,
} from "@/types/payroll";
import { PayrollSearchForm } from "./components/PayrollSearchForm";
import { PayrollSummaryCards } from "./components/PayrollSummaryCards";
import { PayrollMonthlyRollupTable } from "./components/PayrollMonthlyRollup";
import { PayrollDetailTable } from "./components/PayrollDetailTable";

const PAGE_SIZE = 50;

type TabKey = "summary" | "rollup" | "detail";

const DEFAULT_FILTERS: PayrollSearchParams = {
  periodId: "ALL",
  page: 1,
  pageSize: PAGE_SIZE,
};

export default function PayrollPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [centres, setCentres] = useState<PayrollCentreOption[]>([]);
  const [centresLoading, setCentresLoading] = useState(true);

  const [filters, setFilters] = useState<PayrollSearchParams>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [rollup, setRollup] = useState<PayrollMonthlyRollup[]>([]);
  const [rollupLoading, setRollupLoading] = useState(false);

  const [searchResult, setSearchResult] =
    useState<PayrollSearchResponse["data"]>([]);
  const [searchPagination, setSearchPagination] =
    useState<PayrollSearchResponse["pagination"] | undefined>(undefined);
  const [searchLoading, setSearchLoading] = useState(false);

  const activePeriod = useMemo(() => {
    if (!filters.periodId || filters.periodId === "ALL") return null;
    return periods.find((p) => p._id === filters.periodId) ?? null;
  }, [filters.periodId, periods]);

  const loadPeriods = useCallback(async () => {
    setPeriodsLoading(true);
    try {
      const res = await payrollService.getPeriods();
      if (res.success && Array.isArray(res.data)) {
        const list = res.data;
        setPeriods(list);
        if (
          (filters.periodId === "ALL" || !filters.periodId) &&
          list.length > 0
        ) {
          setFilters((f) => ({ ...f, periodId: list[0]._id }));
        }
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
      setPeriodsLoading(false);
    }
  }, [filters.periodId]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const loadCentres = useCallback(async (periodId?: string) => {
    setCentresLoading(true);
    try {
      const res = await payrollService.getCentres(periodId);
      if (res.success && Array.isArray(res.data)) {
        setCentres(res.data);
      } else {
        setCentres([]);
        if (res.error) {
          toast.error("Không thể tải danh sách trung tâm", {
            description: res.error,
          });
        }
      }
    } catch (err: any) {
      setCentres([]);
      toast.error("Lỗi tải trung tâm", {
        description: err?.message ?? String(err),
      });
    } finally {
      setCentresLoading(false);
    }
  }, []);

  // Load distinct centres once on mount (across all periods so the
  // select is populated regardless of the current period filter).
  useEffect(() => {
    loadCentres();
  }, [loadCentres]);

  const loadSummary = useCallback(
    async (periodId: string) => {
      setSummaryLoading(true);
      try {
        const res = await payrollService.getSummary(periodId);
        if (res.success) {
          setSummary(res.data ?? null);
        } else {
          setSummary(null);
          toast.error("Không thể tải KPI", { description: res.error });
        }
      } catch (err: any) {
        setSummary(null);
        toast.error("Lỗi tải KPI", {
          description: err?.message ?? String(err),
        });
      } finally {
        setSummaryLoading(false);
      }
    },
    [],
  );

  const loadRollup = useCallback(async (periodId: string) => {
    setRollupLoading(true);
    try {
      const res = await payrollService.getMonthlyRollup(periodId);
      if (res.success) {
        setRollup(res.data ?? []);
      } else {
        setRollup([]);
        toast.error("Không thể tải bảng kê", { description: res.error });
      }
    } catch (err: any) {
      setRollup([]);
      toast.error("Lỗi tải bảng kê", {
        description: err?.message ?? String(err),
      });
    } finally {
      setRollupLoading(false);
    }
  }, []);

  const runSearch = useCallback(
    async (override?: Partial<PayrollSearchParams>) => {
      const next = { ...filters, ...override, page: 1 };
      setFilters(next);
      setPage(1);
      setSearchLoading(true);
      try {
        const res = await payrollService.searchRecords(next);
        if (res.success) {
          setSearchResult(res.data ?? []);
          setSearchPagination(res.pagination);
        } else {
          setSearchResult([]);
          setSearchPagination(undefined);
          toast.error("Không thể tra cứu", { description: res.error });
        }
      } catch (err: any) {
        setSearchResult([]);
        setSearchPagination(undefined);
        toast.error("Lỗi tra cứu", {
          description: err?.message ?? String(err),
        });
      } finally {
        setSearchLoading(false);
      }
    },
    [filters],
  );

  const changePage = useCallback(
    async (nextPage: number) => {
      const next = { ...filters, page: nextPage };
      setFilters(next);
      setPage(nextPage);
      setSearchLoading(true);
      try {
        const res = await payrollService.searchRecords(next);
        if (res.success) {
          setSearchResult(res.data ?? []);
          setSearchPagination(res.pagination);
        } else {
          toast.error("Không thể tải trang", { description: res.error });
        }
      } catch (err: any) {
        toast.error("Lỗi tải trang", {
          description: err?.message ?? String(err),
        });
      } finally {
        setSearchLoading(false);
      }
    },
    [filters],
  );

  // When user picks a period, automatically refresh summary + rollup.
  useEffect(() => {
    if (filters.periodId && filters.periodId !== "ALL") {
      loadSummary(filters.periodId);
      loadRollup(filters.periodId);
    } else {
      setSummary(null);
      setRollup([]);
    }
  }, [filters.periodId, loadSummary, loadRollup]);

  // Auto-run an initial search once periods are loaded (only if there
  // is an active period and the user hasn't submitted yet).
  useEffect(() => {
    if (
      !periodsLoading &&
      filters.periodId &&
      filters.periodId !== "ALL" &&
      searchResult.length === 0 &&
      !searchLoading
    ) {
      runSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodsLoading, filters.periodId]);

  const handleRefreshAll = useCallback(async () => {
    if (!filters.periodId || filters.periodId === "ALL") {
      await loadPeriods();
      return;
    }
    await Promise.all([
      loadSummary(filters.periodId),
      loadRollup(filters.periodId),
      runSearch({ page: page }),
    ]);
  }, [
    filters.periodId,
    loadPeriods,
    loadSummary,
    loadRollup,
    runSearch,
    page,
  ]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "summary", label: "Tổng hợp" },
    { key: "rollup", label: "Bảng kê tháng" },
    { key: "detail", label: "Chi tiết buổi" },
  ];

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      <PageHeader
        icon={Wallet}
        title="Check công lương"
        description="Tra cứu buổi dạy và office hours theo giáo viên, lớp hoặc trung tâm — không cần đăng nhập."
        actions={
          <button
            onClick={handleRefreshAll}
            disabled={periodsLoading || summaryLoading || rollupLoading || searchLoading}
            className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                periodsLoading || summaryLoading || rollupLoading || searchLoading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Làm mới
          </button>
        }
      />

      <PayrollSearchForm
        periods={periods}
        value={filters}
        onChange={(next) => setFilters({ ...next, page: 1 })}
        onSubmit={() => runSearch({ page: 1 })}
        loading={searchLoading || centresLoading}
        centres={centres}
      />

      {periods.length === 0 && !periodsLoading ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          <Lock className="h-5 w-5 mx-auto mb-2 opacity-70" />
          <p>Chưa có kỳ công nào được upload.</p>
          <p className="text-xs mt-1">
            Liên hệ TE/Admin để upload bảng công tháng.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
                  activeTab === t.key
                    ? "bg-background text-foreground shadow"
                    : ""
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "summary" && (
            <PayrollSummaryCards
              summary={summary}
              loading={summaryLoading}
              periodLabel={activePeriod?.label}
            />
          )}

          {activeTab === "rollup" && (
            <PayrollMonthlyRollupTable
              rows={rollup}
              loading={rollupLoading}
              periodLabel={activePeriod?.label}
            />
          )}

          {activeTab === "detail" && (
            <PayrollDetailTable
              rows={searchResult}
              pagination={searchPagination}
              loading={searchLoading}
              onPageChange={changePage}
            />
          )}
        </div>
      )}
    </main>
  );
}