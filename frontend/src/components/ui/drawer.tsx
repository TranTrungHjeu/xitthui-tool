"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DrawerContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

function useDrawerContext() {
  const context = React.useContext(DrawerContext)
  if (!context) {
    throw new Error("Drawer components must be used within a Drawer")
  }
  return context
}

const Drawer: React.FC<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}> = ({ open = false, onOpenChange, children }) => {
  // ESC closes the drawer, matching Radix Dialog / native <dialog>.
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onOpenChange?.(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  // Lock body scroll while a drawer is open so the page underneath
  // doesn't scroll when the user scrolls inside the drawer on mobile.
  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [open])

  return (
    <DrawerContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </DrawerContext.Provider>
  )
}

const DrawerTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, ...props }, ref) => {
  const { onOpenChange } = useDrawerContext()
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </button>
  )
})
DrawerTrigger.displayName = "DrawerTrigger"

const DrawerPortal = ({ children }: { children: React.ReactNode }) => {
  return typeof document !== "undefined"
    ? ReactDOM.createPortal(children, document.body)
    : null
}

import ReactDOM from "react-dom"

const DrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open, onOpenChange } = useDrawerContext()
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      data-state={open ? "open" : "closed"}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  )
})
DrawerOverlay.displayName = "DrawerOverlay"

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "left" | "right" | "top" | "bottom"
    width?: string | number
    height?: string | number
  }
>(({ className, children, side = "right", width = 500, height, ...props }, ref) => {
  const { open, onOpenChange } = useDrawerContext()

  const isHorizontal = side === "left" || side === "right"
  const sizeClass = isHorizontal
    ? cn(
        side === "right" && "inset-y-0 right-0 h-full",
        side === "left" && "inset-y-0 left-0 h-full",
      )
    : cn(
        side === "bottom" && "inset-x-0 bottom-0 w-full",
        side === "top" && "inset-x-0 top-0 w-full",
      )

  const dimensionStyle = isHorizontal
    ? { width: typeof width === "number" ? `${width}px` : width }
    : { height: typeof height === "number" ? `${height}px` : height }

  if (!open) return null

  return (
    <DrawerPortal>
      <DrawerOverlay onClick={() => onOpenChange(false)} data-state={open ? "open" : "closed"} />
      <div
        ref={ref}
        className={cn(
          "fixed z-50 bg-background shadow-xl",
          "flex flex-col",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          sizeClass,
          side === "right" && "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-400 ease-out",
          side === "left" && "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left duration-400 ease-out",
          side === "bottom" && "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-400 ease-out",
          side === "top" && "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top duration-400 ease-out",
          className,
        )}
        style={dimensionStyle}
        data-state={open ? "open" : "closed"}
        {...props}
      >
        {children}
      </div>
    </DrawerPortal>
  )
})
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 p-4 border-b", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = "DrawerDescription"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse gap-2 p-4 border-t mt-auto", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = useDrawerContext()
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "absolute right-4 top-4 rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
        className,
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Đóng</span>
    </button>
  )
})
DrawerClose.displayName = "DrawerClose"

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
}
