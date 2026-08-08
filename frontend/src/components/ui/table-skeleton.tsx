/**
 * TableSkeleton
 *
 * Renders table-shaped placeholder rows during the very first load of a
 * data-heavy page. Goal: stop the page from flashing between "empty
 * table" and "data table" — instead the user sees a stable shape so
 * the layout doesn't shift when the real data arrives.
 *
 * Why a separate skeleton vs the existing CatLoader overlay:
 *   - Showing a full-screen spinner on first load (F5 / tab switch)
 *     feels heavy and the empty table underneath can flicker for a
 *     frame.
 *   - Showing the empty table + "Không tìm thấy..." message is also
 *     wrong: we don't know yet if the list is empty or still loading.
 *   - Skeleton rows are the most honest option: they match the final
 *     layout and degrade gracefully while data is in-flight.
 *
 * Once the user has at least one row of real data, subsequent loads
 * (filter changes, pagination) keep using the lighter CatLoader
 * overlay so the user feels the existing table is being refreshed, not
 * blown away.
 */
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 8,
  columns = 8,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full", className)} role="status" aria-label="Loading data">
      <table className="w-full table-fixed min-w-[1000px]">
        <thead className="bg-card">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th
                key={i}
                className="h-10 px-3 text-left bg-card"
                aria-hidden="true"
              >
                <div className="h-2.5 w-3/4 max-w-[120px] rounded bg-muted/60 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-t border-border/40">
              {Array.from({ length: columns }).map((_, colIdx) => {
                // Stable width pattern so the cell widths line up with the
                // real table once data arrives.
                const widths = [
                  "w-3/4",
                  "w-2/3",
                  "w-1/2",
                  "w-5/6",
                  "w-2/3",
                  "w-1/3",
                  "w-1/2",
                  "w-3/4",
                ];
                const width = widths[colIdx % widths.length];
                return (
                  <td key={colIdx} className="px-3 py-3" aria-hidden="true">
                    <div
                      className={cn(
                        "h-3 rounded bg-muted/60 animate-pulse",
                        width,
                      )}
                      // Slight stagger so the shimmer feels organic
                      style={{ animationDelay: `${(rowIdx + colIdx) * 40}ms` }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TableSkeleton;
