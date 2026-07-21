import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
  withText?: boolean;
}

const sizeMap: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export function Spinner({
  size = "md",
  label,
  withText,
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className,
      )}
      {...props}
    >
      <Loader2 className={cn(sizeMap[size], "animate-spin text-primary")} />
      {(label || withText) && (
        <p className="text-sm text-muted-foreground">{label ?? "Đang tải..."}</p>
      )}
    </div>
  );
}

/* Backwards-compatible default export for existing imports.
   Maps the old CatLoader usage to a Spinner with a tiny paw-style cat mark. */
export default function CatLoader({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
      <p className="text-xs">Đang tải dữ liệu...</p>
    </div>
  );
}
