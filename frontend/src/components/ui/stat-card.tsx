import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  description?: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  trend?: {
    value: number
    label?: string
    positive?: boolean
  }
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "info" | "crimson" | "sunglow" | "stratos"
}

const variantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-card border-border/60 hover:border-border/90",
  primary: "bg-card border-border/60 hover:border-[#E31F26]/30",
  crimson: "bg-card border-border/60 hover:border-[#E31F26]/30",
  success: "bg-card border-border/60 hover:border-emerald-500/30",
  warning: "bg-card border-border/60 hover:border-[#FFD62D]/40",
  sunglow: "bg-card border-border/60 hover:border-[#FFD62D]/40",
  destructive: "bg-card border-border/60 hover:border-red-500/30",
  info: "bg-card border-border/60 hover:border-sky-500/30",
  stratos: "bg-card border-border/60 hover:border-[#000056]/30",
}

const iconVariantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-muted text-foreground",
  primary: "bg-[#E31F26]/10 text-[#E31F26]",
  crimson: "bg-[#E31F26]/10 text-[#E31F26]",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-[#FFD62D]/20 text-[#856404] dark:text-[#FFD62D] font-bold",
  sunglow: "bg-[#FFD62D]/20 text-[#856404] dark:text-[#FFD62D] font-bold",
  destructive: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  stratos: "bg-[#000056]/10 text-[#000056] dark:bg-[#000056]/40 dark:text-indigo-300",
}

export function StatCard({
  label,
  value,
  hint,
  description,
  icon,
  trend,
  variant = "default",
  className,
  ...props
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 transition-shadow hover:shadow-md",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {hint && (
            <p className="text-xs text-muted-foreground">{hint}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-1 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  trend.positive ? "text-success" : "text-destructive",
                )}
              >
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              {trend.label && (
                <span className="text-muted-foreground">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
              iconVariantClasses[variant],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
