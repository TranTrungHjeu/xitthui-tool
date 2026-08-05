"use client";

import { cn } from "@/lib/utils";

interface MindyMascotProps {
  className?: string;
}

/**
 * Mindy — MindX mascot (SVG asset từ /public).
 * Dùng loading="eager" vì luôn xuất hiện trên hero login page.
 */
export function MindyMascot({ className }: MindyMascotProps) {
  return (
    <img
      src="/mascot/mindy.svg"
      alt="MindX mascot"
      loading="eager"
      decoding="async"
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}