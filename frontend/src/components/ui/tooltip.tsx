"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Tooltip (CSS-based hover, no Radix) ─────────────────────────────────────

// TooltipProvider — no-op, kept for API compatibility
function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) {
  return <>{children}</>
}

// Tooltip — wraps content + trigger
interface TooltipProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
  className?: string
}

function Tooltip({ children, className }: TooltipProps) {
  return <div className={cn("group/tooltip relative inline-flex hover:z-[100]", className)}>{children}</div>
}

// TooltipTrigger — the element that shows tooltip on hover
function TooltipTrigger({
  asChild,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return children
  }
  return (
    <span className={cn("inline-flex", className)} {...props}>
      {children}
    </span>
  )
}

// TooltipContent — shows on parent hover
function TooltipContent({
  className,
  side = "top",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}) {
  const positionClasses: Record<string, string> = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-50 hidden group-hover/tooltip:flex",
        "items-center rounded-md border border-border bg-popover px-2.5 py-1.5",
        "text-xs font-medium text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        positionClasses[side] ?? positionClasses.top,
        !className?.includes("whitespace-") && "whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
