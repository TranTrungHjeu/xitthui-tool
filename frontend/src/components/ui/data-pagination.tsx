/**
 * DataPagination
 *
 * A compact "Goto page" pagination bar used as the footer for data tables.
 * Pattern: Linear / Notion / Vercel style — page selector + prev/next, not
 * numbered buttons only.
 *
 * Why this exists separately:
 *   - The old inline pagination text ("Hiển thị tất cả X lớp học") gave the
 *     false impression that everything was on one page, while currentPage
 *     / totalPages were still being tracked by the parent and sent to the
 *     server. That mismatch is a real UX bug.
 *   - This component keeps the page navigation visible and accessible,
 *     with proper aria labels and disabled states.
 *
 * Behavior:
 *   - Shows "Trang X / Y" + "Hiển thị A-B của N".
 *   - Buttons disabled when at boundary.
 *   - Hidden entirely when totalPages <= 1 (no need to clutter).
 */
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageRangeText(page: number, totalPages: number): string {
  return `Trang ${page} / ${totalPages}`;
}

function rangeText(page: number, limit: number, total: number): string {
  if (total === 0) return "Không có kết quả";
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return `Hiển thị ${start}-${end} của ${total}`;
}

export function DataPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className,
}: DataPaginationProps) {
  // Don't render at all when there's no pagination to show.
  if (total === 0 || totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-2 text-xs",
        className,
      )}
    >
      <span className="text-muted-foreground tabular-nums">
        {rangeText(page, limit, total)}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground tabular-nums px-2">
          {pageRangeText(page, totalPages)}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Trang sau"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </nav>
  );
}

export default DataPagination;