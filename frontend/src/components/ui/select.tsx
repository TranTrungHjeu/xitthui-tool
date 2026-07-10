"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Context ─────────────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  labels: Record<string, string>
  registerLabel: (value: string, label: string) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  labels: {},
  registerLabel: () => {},
})

// ─── Select root ──────────────────────────────────────────────────────────────

interface SelectProps {
  children: React.ReactNode
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  className?: string;
}

function Select({
  children,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  disabled,
  className,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [labels, setLabels] = React.useState<Record<string, string>>({})
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) setInternalValue(newValue)
      onValueChange?.(newValue)
      setOpen(false)
    },
    [isControlled, onValueChange],
  )

  const registerLabel = React.useCallback((val: string, label: string) => {
    setLabels((prev) => {
      if (prev[val] === label) return prev
      return { ...prev, [val]: label }
    })
  }, [])

  // Click outside to close
  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!triggerRef.current?.closest("[data-select-root]")?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen,
        triggerRef,
        labels,
        registerLabel,
      }}
    >
      <div
        data-select-root=""
        className={cn("relative inline-block w-full", open && "z-30", className)}
        aria-disabled={disabled}
      >
        {children}
      </div>
    </SelectContext.Provider>
  )
}

// ─── SelectTrigger ────────────────────────────────────────────────────────────

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "sm"
}

function SelectTrigger({ className, size = "default", children, ...props }: SelectTriggerProps) {
  const { open, setOpen, triggerRef } = React.useContext(SelectContext)

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none select-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[placeholder]:text-muted-foreground",
        size === "default" ? "h-10" : "h-8 rounded-md",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200 shrink-0", open && "rotate-180")} />
    </button>
  )
}

// ─── SelectValue ──────────────────────────────────────────────────────────────

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, labels } = React.useContext(SelectContext)
  const label = labels[value]

  if (!value) {
    return <span className="text-muted-foreground">{placeholder}</span>
  }
  return <span>{label ?? value}</span>
}

// ─── SelectContent ────────────────────────────────────────────────────────────

function SelectContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(SelectContext)

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] w-full",
        "rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
        "overflow-hidden transition-all duration-150 origin-top-left",
        open
          ? "opacity-100 scale-100 pointer-events-auto visible"
          : "opacity-0 scale-95 pointer-events-none invisible h-0 border-0 p-0 overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="max-h-64 overflow-y-auto">{children}</div>
    </div>
  )
}

function getChildrenText(children: React.ReactNode): string {
  if (children === null || children === undefined) return ""
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(getChildrenText).join("")
  }
  if (React.isValidElement(children)) {
    return getChildrenText((children as React.ReactElement<any>).props.children)
  }
  return ""
}

// ─── SelectItem ───────────────────────────────────────────────────────────────

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

function SelectItem({ className, value, disabled, children, ...props }: SelectItemProps) {
  const { value: selectedValue, onValueChange, registerLabel } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  // Register label for SelectValue display on mount/change
  React.useEffect(() => {
    const textLabel = getChildrenText(children).trim()
    if (textLabel) {
      registerLabel(value, textLabel)
    }
  }, [value, children, registerLabel])

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      <span className="flex size-4 items-center justify-center">
        {isSelected && <Check className="size-3.5" />}
      </span>
      {children}
    </div>
  )
}

// ─── SelectGroup / SelectLabel / SelectSeparator ──────────────────────────────

function SelectGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("scroll-my-1 p-1", className)} {...props} />
}

function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2 py-2 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)} {...props} />
}

// Scroll buttons (no-op stubs for API compat)
function SelectScrollUpButton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return null
}
function SelectScrollDownButton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return null
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
