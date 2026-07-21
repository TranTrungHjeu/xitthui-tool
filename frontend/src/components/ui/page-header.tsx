import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  )
}
