"use client";

import {
  memo,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

interface ShimmerProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  duration?: number;
}

/**
 * Animated text-sweep effect.
 * Use for streaming / loading text states.
 * See globals.css `.shimmer-text` and `--shimmer-duration` for animation.
 */
function ShimmerImpl({
  children,
  as: Tag = "span",
  className = "",
  duration = 2,
}: ShimmerProps) {
  const style: CSSProperties = {
    ["--shimmer-duration" as string]: `${duration}s`,
  };

  return (
    <Tag className={`shimmer-text ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export const Shimmer = memo(ShimmerImpl);
export default Shimmer;
