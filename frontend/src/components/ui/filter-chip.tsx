/**
 * FilterChip
 *
 * A small badge representing one active filter, with an inline X to
 * remove just that filter. Lets the user see (and clear) the active
 * filter set without opening dropdowns.
 *
 * Why a custom chip vs Badge:
 *   - `Badge` is presentation-only; the user needs a real button target
 *     so they can remove the filter with one click.
 *   - We reuse the badge visual language (rounded, small, semibold) but
 *     wrap it in an interactive button.
 */
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  tone?: "default" | "info" | "warning" | "success" | "muted";
  className?: string;
}

const toneMap: Record<NonNullable<FilterChipProps["tone"]>, string> = {
  default: "bg-brand-10-soft text-brand-10 border-brand-10/25 hover:bg-brand-10-soft/70",
  info: "bg-info/10 text-info border-info/20 hover:bg-info/15",
  warning: "bg-brand-30-soft text-[hsl(40_80%_30%)] border-brand-30/40 hover:bg-brand-30-soft/70",
  success: "bg-success/10 text-success border-success/20 hover:bg-success/15",
  muted: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

export function FilterChip({
  label,
  onRemove,
  tone = "default",
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
        toneMap[tone],
        className,
      )}
      aria-label={`Xóa bộ lọc ${label}`}
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <X className="h-3 w-3 shrink-0 opacity-70" />
    </button>
  );
}

export default FilterChip;