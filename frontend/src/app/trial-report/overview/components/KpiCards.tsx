"use client";

import { Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  /** Short label, e.g. "Phiếu tuần này". */
  label: string;
  /** Numeric value (already formatted). */
  value: number | string;
  /** Optional trend string e.g. "+12% so với tuần trước". */
  hint?: string;
  /**
   * Tailwind palette tokens used for the icon-chip background and accent.
   * Pick from the existing palette (slate / amber / emerald / sky / violet)
   * so cards stay visually consistent with AllFilesList.
   */
  tone: "slate" | "amber" | "emerald" | "sky" | "violet";
}

interface KpiCardsProps {
  items: KpiItem[];
  isLoading?: boolean;
}

const TONE_STYLES: Record<
  KpiItem["tone"],
  { chip: string; ring: string; accent: string }
> = {
  slate: {
    chip: "bg-slate-100 text-slate-600",
    ring: "ring-slate-200",
    accent: "text-slate-600",
  },
  amber: {
    chip: "bg-amber-100 text-amber-700",
    ring: "ring-amber-200",
    accent: "text-amber-700",
  },
  emerald: {
    chip: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-200",
    accent: "text-emerald-700",
  },
  sky: {
    chip: "bg-sky-100 text-sky-700",
    ring: "ring-sky-200",
    accent: "text-sky-700",
  },
  violet: {
    chip: "bg-violet-100 text-violet-700",
    ring: "ring-violet-200",
    accent: "text-violet-700",
  },
};

export function KpiCards({ items, isLoading = false }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item, idx) => {
        const tone = TONE_STYLES[item.tone] ?? TONE_STYLES.slate;
        return (
          <div
            key={`${item.label}-${idx}`}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-black/[0.02]",
              "transition-all hover:shadow-md hover:border-slate-300",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
              <span
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center ring-1",
                  tone.chip,
                  tone.ring,
                )}
                aria-hidden
              >
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                <span className="text-2xl font-semibold tracking-tight text-slate-800 tabular-nums">
                  {item.value}
                </span>
              )}
              {!isLoading && item.hint && (
                <span
                  className={cn("text-xs font-medium", tone.accent)}
                  title={item.hint}
                >
                  {item.hint}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}