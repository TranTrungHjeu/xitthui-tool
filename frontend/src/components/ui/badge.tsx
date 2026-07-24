import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20 font-medium",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-medium",
        warning:
          "border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-medium",
        info:
          "border-transparent bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 font-medium",
        outline:
          "text-foreground border-border/80 bg-background",
        soft:
          "border-transparent bg-muted text-muted-foreground",
        ghost:
          "border-transparent bg-transparent text-muted-foreground",
        crimson:
          "border-transparent bg-[#E31F26]/10 text-[#E31F26] font-semibold dark:bg-[#E31F26]/20 dark:text-red-400",
        sunglow:
          "border-transparent bg-[#FFD62D]/20 text-[#856404] font-bold dark:bg-[#FFD62D]/25 dark:text-[#FFD62D]",
        stratos:
          "border-transparent bg-[#000056]/10 text-[#000056] font-semibold dark:bg-[#000056]/40 dark:text-indigo-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
