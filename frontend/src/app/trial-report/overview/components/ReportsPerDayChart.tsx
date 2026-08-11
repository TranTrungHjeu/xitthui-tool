"use client";

import { useMemo } from "react";
import { BarChart3, Inbox } from "lucide-react";

export interface DailyBucket {
  /** ISO date string YYYY-MM-DD. */
  date: string;
  /** Short label, e.g. "09/08". */
  label: string;
  count: number;
}

interface ReportsPerDayChartProps {
  buckets: DailyBucket[];
  isLoading?: boolean;
}

const CHART_HEIGHT = 160;
const CHART_WIDTH = 640;
const PADDING_X = 24;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;

function formatVietnamDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Build a 14-day rolling window (oldest → newest). The caller supplies
 * the counts; days with no data are filled with 0.
 */
export function buildDailyBuckets(
  start: Date,
  days: number,
  counts: Record<string, number>,
): DailyBucket[] {
  const out: DailyBucket[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({
      date: key,
      label: formatVietnamDate(d),
      count: counts[key] ?? 0,
    });
  }
  return out;
}

/**
 * Convert a `TrialReport[]` (or anything with `createdAt` / `classDate`)
 * into a YYYY-MM-DD → count map, using local time.
 */
export function bucketReportsByDay<
  T extends { createdAt?: string; classDate?: string | null }
>(reports: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reports) {
    const raw = r.createdAt ?? r.classDate ?? null;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function ReportsPerDayChart({
  buckets,
  isLoading = false,
}: ReportsPerDayChartProps) {
  const { bars, max, hasData } = useMemo(() => {
    const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
    const hasData = buckets.some((b) => b.count > 0);
    const innerWidth = CHART_WIDTH - PADDING_X * 2;
    const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const barWidth = innerWidth / Math.max(buckets.length, 1);
    const bars = buckets.map((b, idx) => {
      const h =
        max > 0 ? (b.count / max) * innerHeight : 0;
      const x = PADDING_X + idx * barWidth + barWidth * 0.15;
      const w = barWidth * 0.7;
      const y = PADDING_TOP + (innerHeight - h);
      return { ...b, x, y, w, h };
    });
    return { bars, max, hasData };
  }, [buckets]);

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-black/[0.02]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-sky-100 text-sky-700 ring-1 ring-sky-200 flex items-center justify-center">
            <BarChart3 className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Phiếu/ngày trong 14 ngày gần nhất
            </h3>
            <p className="text-xs text-slate-500">
              Đếm theo <code className="font-mono text-[10px]">createdAt</code>{" "}
              của phiếu (fallback <code className="font-mono text-[10px]">classDate</code>).
            </p>
          </div>
        </div>
        {max > 0 && (
          <span className="text-xs font-medium text-slate-500">
            Đỉnh: <span className="font-semibold text-slate-700">{max}</span>{" "}
            phiếu/ngày
          </span>
        )}
      </div>

      {hasData ? (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-[180px]"
            role="img"
            aria-label="Biểu đồ số phiếu theo ngày"
          >
            {/* baseline */}
            <line
              x1={PADDING_X}
              x2={CHART_WIDTH - PADDING_X}
              y1={CHART_HEIGHT - PADDING_BOTTOM}
              y2={CHART_HEIGHT - PADDING_BOTTOM}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            {bars.map((b) => (
              <g key={b.date}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={Math.max(b.h, 0)}
                  rx={3}
                  fill="#0ea5e9"
                  fillOpacity={b.count === 0 ? 0.18 : 0.85}
                >
                  <title>{`${b.label}: ${b.count} phiếu`}</title>
                </rect>
                {b.count > 0 && (
                  <text
                    x={b.x + b.w / 2}
                    y={b.y - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="#0369a1"
                  >
                    {b.count}
                  </text>
                )}
                <text
                  x={b.x + b.w / 2}
                  y={CHART_HEIGHT - PADDING_BOTTOM + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#64748b"
                >
                  {b.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/30">
          <span className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center mb-2">
            <Inbox className="h-5 w-5 text-slate-400" />
          </span>
          <p className="text-sm font-medium text-slate-600">
            {isLoading ? "Đang tải..." : "Chưa có dữ liệu"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Chưa có phiếu nào trong 14 ngày gần nhất.
          </p>
        </div>
      )}
    </div>
  );
}