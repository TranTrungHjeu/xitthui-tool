import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Variant maps ─────────────────────────────────────────────────────────────

const variantClasses: Record<string, string> = {
  default:
    "bg-primary text-primary-foreground",
  secondary:
    "bg-secondary text-secondary-foreground",
  destructive:
    "bg-destructive/10 text-destructive",
  outline:
    "border border-border text-foreground bg-transparent",
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground",
  link:
    "text-primary underline-offset-4 hover:underline",
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeVariant = keyof typeof variantClasses

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  asChild?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

function Badge({
  className,
  variant = "default",
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const base =
    "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3"

  const classes = cn(
    base,
    variantClasses[variant] ?? variantClasses.default,
    className,
  )

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
      {
        className: cn(
          (children.props as React.HTMLAttributes<HTMLElement>).className,
          classes,
        ),
      },
    )
  }

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  )
}

export { Badge }
