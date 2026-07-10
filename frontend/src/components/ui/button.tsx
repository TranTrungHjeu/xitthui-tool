import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Variant maps (thay CVA bằng object đơn giản) ───────────────────────────

const variantClasses: Record<string, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:scale-[0.98]",
  outline:
    "border border-border bg-background hover:bg-muted hover:text-foreground",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost:
    "hover:bg-muted hover:text-foreground",
  destructive:
    "bg-destructive/10 text-destructive hover:bg-destructive/20",
  link: "text-primary underline-offset-4 hover:underline",
}

const sizeClasses: Record<string, string> = {
  default: "h-9 px-3.5 gap-2 text-sm",
  xs:      "h-7 px-2.5 gap-1 text-xs rounded-md",
  sm:      "h-8 px-3 gap-1.5 text-sm rounded-md",
  lg:      "h-10 px-4 gap-2 text-sm rounded-lg",
  icon:    "size-9 rounded-md",
  "icon-xs":  "size-7 rounded-md",
  "icon-sm":  "size-8 rounded-md",
  "icon-lg":  "size-10 rounded-lg",
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ButtonVariant = keyof typeof variantClasses
type ButtonSize    = keyof typeof sizeClasses

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const base =
      "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

    const classes = cn(
      base,
      variantClasses[variant] ?? variantClasses.default,
      sizeClasses[size] ?? sizeClasses.default,
      className,
    )

    // asChild: clone child element với className + onClick merged
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
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  },
)

Button.displayName = "Button"

export { Button }
