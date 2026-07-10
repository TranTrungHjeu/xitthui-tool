"use client"

import * as React from "react"
import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── DropdownMenu Context ───────────────────────────────────────────────────

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
})

// ─── DropdownMenu Root ───────────────────────────────────────────────────────

interface DropdownMenuProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) setInternalOpen(newOpen)
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  // Close on click outside
  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-dropdown-content]")
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={cn("relative inline-block text-left", open && "z-30")} data-dropdown-root="">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

// ─── DropdownMenuTrigger ────────────────────────────────────────────────────

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function DropdownMenuTrigger({
  className,
  asChild,
  children,
  ...props
}: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext)

  const onClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(!open)
      props.onClick?.(e)
    },
    [open, setOpen, props]
  )

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>
    return React.cloneElement(child, {
      ref: triggerRef,
      onClick: onClick,
      className: cn(child.props.className, className),
    } as any)
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── DropdownMenuPortal (Stub compatibility) ────────────────────────────────

function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// ─── DropdownMenuContent ────────────────────────────────────────────────────

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center"
  sideOffset?: number
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  children,
  ...props
}: DropdownMenuContentProps) {
  const { open } = React.useContext(DropdownMenuContext)

  if (!open) return null

  const alignClass =
    align === "end"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0"

  return (
    <div
      data-dropdown-content=""
      style={{ marginTop: `${sideOffset}px` }}
      className={cn(
        "absolute z-50 min-w-[8rem] w-max max-w-xs rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-100",
        alignClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── DropdownMenuGroup ──────────────────────────────────────────────────────

function DropdownMenuGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-0.5", className)} {...props} />
}

// ─── DropdownMenuItem ───────────────────────────────────────────────────────

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean
  disabled?: boolean
  variant?: "default" | "destructive"
}

function DropdownMenuItem({
  className,
  inset,
  disabled,
  variant = "default",
  children,
  onClick,
  ...props
}: DropdownMenuItemProps) {
  const { setOpen } = React.useContext(DropdownMenuContext)

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    onClick?.(e)
    setOpen(false)
  }

  return (
    <div
      role="menuitem"
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        inset && "pl-8",
        variant === "destructive" && "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── DropdownMenuCheckboxItem ────────────────────────────────────────────────

interface DropdownMenuCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  inset?: boolean
  disabled?: boolean
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  inset,
  disabled,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const { setOpen } = React.useContext(DropdownMenuContext)

  const handleClick = () => {
    if (disabled) return
    onCheckedChange?.(!checked)
    setOpen(false)
  }

  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        inset && "pl-8",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        {checked && <Check className="size-3.5" />}
      </span>
      {children}
    </div>
  )
}

// ─── DropdownMenuRadioGroup ──────────────────────────────────────────────────

interface DropdownMenuRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
}

const DropdownMenuRadioContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: DropdownMenuRadioGroupProps) {
  return (
    <DropdownMenuRadioContext.Provider value={{ value, onValueChange }}>
      <div className="space-y-0.5" {...props}>
        {children}
      </div>
    </DropdownMenuRadioContext.Provider>
  )
}

// ─── DropdownMenuRadioItem ───────────────────────────────────────────────────

interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  inset?: boolean
  disabled?: boolean
}

function DropdownMenuRadioItem({
  className,
  value,
  inset,
  disabled,
  children,
  ...props
}: DropdownMenuRadioItemProps) {
  const { setOpen } = React.useContext(DropdownMenuContext)
  const { value: selectedValue, onValueChange } = React.useContext(DropdownMenuRadioContext)
  const isChecked = selectedValue === value

  const handleClick = () => {
    if (disabled) return
    onValueChange?.(value)
    setOpen(false)
  }

  return (
    <div
      role="menuitemradio"
      aria-checked={isChecked}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        inset && "pl-8",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        {isChecked && <Check className="size-3.5" />}
      </span>
      {children}
    </div>
  )
}

// ─── DropdownMenuLabel ────────────────────────────────────────────────────────

interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean
}

function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}

// ─── DropdownMenuSeparator ────────────────────────────────────────────────────

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  )
}

// ─── DropdownMenuShortcut ─────────────────────────────────────────────────────

function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  )
}

// ─── Submenu (CSS-based simplicity) ──────────────────────────────────────────

interface DropdownMenuSubProps {
  children: React.ReactNode
}

function DropdownMenuSub({ children }: DropdownMenuSubProps) {
  return <div className="group/sub relative">{children}</div>
}

interface DropdownMenuSubTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <div
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground group-hover/sub:bg-accent group-hover/sub:text-accent-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4" />
    </div>
  )
}

function DropdownMenuSubContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "absolute top-0 left-full z-50 ml-1 min-w-[8rem] w-max rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md hidden group-hover/sub:block",
        "animate-in fade-in-0 duration-100",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
