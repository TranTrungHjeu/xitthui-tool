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
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "info"
}

const variantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-card",
  primary: "bg-primary/[0.04] border-primary/20",
  success: "bg-success/[0.06] border-success/20",
  warning: "bg-warning/[0.06] border-warning/20",
  destructive: "bg-destructive/[0.06] border-destructive/20",
  info: "bg-info/[0.06] border-info/20",
}

const iconVariantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
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
