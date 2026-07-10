"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Context ─────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  orientation: "horizontal" | "vertical"
}

const TabsContext = React.createContext<TabsContextValue>({
  value: "",
  onValueChange: () => {},
  orientation: "horizontal",
})

// ─── Tabs root ────────────────────────────────────────────────────────────────

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
  className?: string
  children: React.ReactNode
}

function Tabs({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) setInternalValue(newValue)
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange],
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, orientation }}>
      <div
        className={cn(
          "flex gap-2",
          orientation === "horizontal" ? "flex-col" : "flex-row",
          className,
        )}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// ─── TabsList ─────────────────────────────────────────────────────────────────

interface TabsListProps {
  className?: string
  children: React.ReactNode
  variant?: "default" | "line"
}

function TabsList({ className, children, variant = "default" }: TabsListProps) {
  const { orientation } = React.useContext(TabsContext)
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground",
        orientation === "horizontal" ? "h-10 flex-row" : "h-fit w-fit flex-col",
        variant === "default" && "bg-muted",
        variant === "line" && "bg-transparent gap-1",
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── TabsTrigger ──────────────────────────────────────────────────────────────

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = React.useContext(TabsContext)
  const isActive = activeValue === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => onValueChange(value)}
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-foreground/60 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── TabsContent ──────────────────────────────────────────────────────────────

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const { value: activeValue } = React.useContext(TabsContext)
  if (activeValue !== value) return null

  return (
    <div
      role="tabpanel"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Tabs, TabsList, TabsTrigger, TabsContent }

// backward compat: tabsListVariants (was used in some imports)
export const tabsListVariants = () => ""
