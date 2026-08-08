/**
 * TableStateView
 *
 * Renders the right state inside a data table:
 *   - loading=true with no prior data: skeleton
 *   - loading=true with prior data: nothing (parent renders TopLoadingBar)
 *   - error: error EmptyState with retry action
 *   - empty (no data, no error): empty EmptyState with contextual copy
 *
 * Why this exists:
 *   - Earlier the page used a TableCell colSpan=8 with custom markup for
 *     both empty and error states. That tied state visuals to a specific
 *     column count, which broke if columns ever changed.
 *   - Putting the state in a sibling element rendered ABOVE the table
 *     (or via absolute positioning when the table is empty) keeps the
 *     page composable and the design-system consistent.
 *
 * Usage:
 *   <Table>
 *     <TableBody>
 *       {!isInitialLoading && !error && data.length === 0 ? null : data.map(...)}
 *     </TableBody>
 *   </Table>
 *   <TableStateView
 *     loading={isInitialLoading && !data.length}
 *     error={error}
 *     empty={!error && !isInitialLoading && data.length === 0}
 *     onRetry={() => fetch()}
 *   />
 */
import * as React from "react";
import { AlertCircle, Inbox, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/table-skeleton";

interface TableStateViewProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  /** Shown only when this is the very first load (no prior data to keep visible). */
  initialLoad?: boolean;
  skeletonRows?: number;
  skeletonColumns?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
}

export function TableStateView({
  loading,
  error,
  empty,
  initialLoad,
  skeletonRows = 8,
  skeletonColumns = 8,
  emptyTitle = "Không có dữ liệu",
  emptyDescription = "Không tìm thấy lớp học nào phù hợp với bộ lọc hiện tại.",
  onRetry,
}: TableStateViewProps) {
  // 1. Initial load: skeleton matches table layout to avoid layout shift.
  if (loading && initialLoad) {
    return <TableSkeleton rows={skeletonRows} columns={skeletonColumns} />;
  }

  // 2. Error takes precedence over empty — user needs to know what failed.
  if (error) {
    return (
      <EmptyState
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-10-soft text-brand-10">
            <AlertCircle className="h-5 w-5" />
          </div>
        }
        title="Không thể tải danh sách lớp học"
        description={error}
        action={
          onRetry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="border-brand-10/30 text-brand-10 hover:bg-brand-10-soft hover:text-brand-10 hover:border-brand-10/50"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Thử lại
            </Button>
          ) : undefined
        }
      />
    );
  }

  // 3. Empty (no error, not loading, but no rows).
  if (empty) {
    return (
      <EmptyState
        icon={<Inbox className="h-5 w-5" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return null;
}

export default TableStateView;