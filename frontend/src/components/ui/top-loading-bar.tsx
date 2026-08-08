/**
 * TopLoadingBar
 *
 * A thin (2px) progress bar that animates across the top edge of its
 * parent. Replaces full-screen overlay spinners for actions that should
 * feel lightweight, e.g. refetching a list when a filter changes.
 *
 * Design choices:
 *   - Drawn with a CSS animation (translate-x from -100% to 100%) so it
 *     stays smooth even when the parent is busy.
 *   - The bar keeps animating while `loading` is true, then fades out.
 *   - aria-hidden because it is purely decorative; the underlying
 *     `aria-busy` on the table is the canonical accessibility signal.
 *
 * Note: this is not a real progress bar (we don't know how long the
 * request will take). It's an indeterminate indicator. That's the right
 * tradeoff for filter/refresh UX — determinate progress bars on cached
 * or fast endpoints feel like they lie.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface TopLoadingBarProps {
  loading?: boolean;
  className?: string;
}

export function TopLoadingBar({ loading = false, className }: TopLoadingBarProps) {
  if (!loading) return null;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5 overflow-hidden bg-brand-10/15",
        className,
      )}
    >
      <div className="h-full w-1/4 bg-brand-10 animate-[top-loading-bar_1.2s_ease-in-out_infinite]" />
      <style>{`
        @keyframes top-loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

export default TopLoadingBar;