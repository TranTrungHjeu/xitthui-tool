"use client"

/**
 * Custom Toast system — drop-in replacement for `sonner`.
 *
 * Source of truth: Toast Component UI Design (Community) Figma file
 *   https://www.figma.com/design/FavZqe4gPw9jAOwyQqQoog
 * Default style is **Style 4** (white card + 10px colored accent bar on
 * the left edge) — the Notion/Linear-style variant, which matches the
 * MindX Support Tools design language. Other styles (1, 2, 3, 5) are
 * also supported via the `style` prop for callers that want a louder
 * variant.
 *
 * Style summary (from Figma):
 *   - Width:  350px     Radius: 16px        Padding: 12px 16px (20px left for default)
 *   - Shadow: 0px 16px 20px -8px rgba(3,5,18,0.1)
 *   - Icon:   32px circle wrapper (variant-tint bg) + 24px glyph, centered
 *   - Message font: General Sans Medium 16px / line-height 22px
 *   - Button font: General Sans Bold 14px, color = variant accent
 *   - Close:  24px X glyph, color = variant accent
 *
 * Style 4 specifics:
 *   - White background, neutral border (#FBFBFB in Figma, mapped to --border)
 *   - 10px wide × 56px tall vertical accent bar absolutely positioned at
 *     left:-1px top:-1px (overlaps the border on the left edge for a
 *     flush, premium feel)
 *
 * API (mirrors sonner exactly so existing call sites don't change):
 *   import { toast } from "@/components/ui/toast"
 *   toast.success("Saved")
 *   toast.error("Failed", { description: "...", duration: 5000 })
 *   toast.info / warning / loading
 *   toast.dismiss(id)
 *
 * Implementation: a global event bus + a React Provider mounted in
 * <body>. Any module can call `toast.error(...)` without being inside
 * the provider's React tree — the bus dispatches the event, the
 * Provider renders it.
 */

import * as React from "react"
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type ToastVariant =
  | "default"
  | "success"
  | "error"
  | "info"
  | "warning"
  | "loading"

export type ToastStyle = "1" | "2" | "3" | "4" | "5"

interface ToastInput {
  title?: React.ReactNode
  description?: React.ReactNode
  /** ms — how long the toast stays. 0 = sticky. Default 4500. */
  duration?: number
  /**
   * Optional CTA button rendered to the right of the message.
   */
  action?: {
    label: string
    onClick: () => void
  }
  /** Optional dismiss button rendered to the right of the message. */
  cancel?: {
    label: string
    onClick?: () => void
  }
  /** Visual style override — see ToastStyle. Defaults to "4". */
  style?: ToastStyle
  /**
   * Stable id — if a toast with the same id is already on screen, the new
   * call replaces it (in-place title/description update) instead of
   * stacking a new card. Mirrors sonner's `id` semantics so call sites
   * migrating from sonner work without changes.
   */
  id?: string
}

interface ToastItem extends Required<Omit<ToastInput, "action" | "cancel" | "description" | "title">> {
  id: string
  variant: ToastVariant
  title: React.ReactNode
  description?: React.ReactNode
  action?: ToastInput["action"]
  cancel?: ToastInput["cancel"]
  createdAt: number
}

/* -------------------------------------------------------------------------- */
/*  Variant styling — pulled from Figma (Style 4 = default).                  */
/*                                                                            */
/*  Tailwind v4 supports arbitrary hsl() values via brackets. We map each     */
/*  variant to its CSS var so theme switches (light/dark) are automatic.      */
/* -------------------------------------------------------------------------- */

interface VariantTokens {
  /** Solid accent for bars, buttons, close icons. */
  accent: string
  /** Soft tint for icon wrappers (low-opacity ring). */
  tint: string
  /** Foreground color for text/icon strokes that sit on tint. */
  onTint: string
}

const VARIANT_TOKENS: Record<ToastVariant, VariantTokens> = {
  default: {
    accent: "var(--toast-neutral)",
    tint: "var(--muted)",
    onTint: "var(--muted-foreground)",
  },
  success: {
    accent: "var(--toast-success)",
    tint: "var(--toast-success-tint)",
    onTint: "var(--toast-success)",
  },
  error: {
    accent: "var(--toast-error)",
    tint: "var(--toast-error-tint)",
    onTint: "var(--toast-error)",
  },
  info: {
    accent: "var(--toast-info)",
    tint: "var(--toast-info-tint)",
    onTint: "var(--toast-info)",
  },
  warning: {
    accent: "var(--toast-warning)",
    tint: "var(--toast-warning-tint)",
    onTint: "var(--toast-warning)",
  },
  loading: {
    accent: "var(--muted-foreground)",
    tint: "var(--muted)",
    onTint: "var(--muted-foreground)",
  },
}

const VARIANT_ICON: Record<
  ToastVariant,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  default: Info,
  success: Check,
  error: X,
  info: Info,
  warning: AlertTriangle,
  loading: Loader2,
}

/* -------------------------------------------------------------------------- */
/*  Event bus (decouples `toast` calls from React tree)                       */
/* -------------------------------------------------------------------------- */

type BusEvent =
  | { type: "push"; variant: ToastVariant; input: ToastInput; id: string }
  | { type: "dismiss"; id: string }
  | { type: "update"; id: string; patch: Partial<ToastInput> & { variant?: ToastVariant } }

const listeners = new Set<(e: BusEvent) => void>()

let _id = 0
const genId = () => `t-${Date.now().toString(36)}-${(++_id).toString(36)}`

function emit(e: BusEvent) {
  listeners.forEach((l) => l(e))
}

/* -------------------------------------------------------------------------- */
/*  Public API — module-level singleton                                        */
/* -------------------------------------------------------------------------- */

function push(variant: ToastVariant, input: ToastInput): string {
  // If a stable id was provided and an existing toast with that id is
  // already on screen, update it in-place instead of stacking a new card.
  if (input.id) {
    emit({ type: "update", id: input.id, patch: { ...input, variant } })
    return input.id
  }

  const id = genId()
  emit({ type: "push", variant, input, id })

  // Auto-dismiss after `duration` (or default per variant)
  const duration = input.duration ?? (variant === "loading" ? 0 : 4500)
  if (duration > 0 && typeof window !== "undefined") {
    window.setTimeout(() => emit({ type: "dismiss", id }), duration)
  }

  return id
}

function update(id: string, patch: Partial<ToastInput> & { variant?: ToastVariant }) {
  emit({ type: "update", id, patch })
}

function dismiss(id: string) {
  emit({ type: "dismiss", id })
}

export const toast = {
  success: (title: React.ReactNode, opts: ToastInput = {}) =>
    push("success", { title, ...opts }),
  error: (title: React.ReactNode, opts: ToastInput = {}) =>
    push("error", { title, ...opts }),
  info: (title: React.ReactNode, opts: ToastInput = {}) =>
    push("info", { title, ...opts }),
  warning: (title: React.ReactNode, opts: ToastInput = {}) =>
    push("warning", { title, ...opts }),
  loading: (title: React.ReactNode, opts: ToastInput = {}) =>
    push("loading", {
      title,
      duration: 0,
      ...opts,
    }),
  message: (title: React.ReactNode, opts: ToastInput = {}) =>
    push("default", { title, ...opts }),
  update,
  dismiss,
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_STYLE: ToastStyle = "4"

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    const handler = (e: BusEvent) => {
      if (e.type === "push") {
        setToasts((prev) => {
          const next = [
            ...prev,
            {
              id: e.id,
              variant: e.variant,
              title: e.input.title ?? "",
              description: e.input.description,
              duration: e.input.duration ?? (e.variant === "loading" ? 0 : 4500),
              style: e.input.style ?? DEFAULT_STYLE,
              action: e.input.action,
              cancel: e.input.cancel,
              createdAt: Date.now(),
            },
          ]
          // Cap at 5 visible (matches Figma Style 4 viewport demo)
          return next.slice(-5)
        })
      } else if (e.type === "dismiss") {
        setToasts((prev) => prev.filter((t) => t.id !== e.id))
      } else if (e.type === "update") {
        setToasts((prev) =>
          prev.map((t) =>
            t.id === e.id
              ? {
                  ...t,
                  variant: e.patch.variant ?? t.variant,
                  title: e.patch.title ?? t.title,
                  description: e.patch.description ?? t.description,
                  duration: e.patch.duration ?? 4500,
                  style: e.patch.style ?? t.style,
                }
              : t,
          ),
        )
      }
    }
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])

  return (
    <>
      {children}
      <ToastViewport toasts={toasts} dismiss={(id) => emit({ type: "dismiss", id })} />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Viewport                                                                  */
/* -------------------------------------------------------------------------- */

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        "pointer-events-none fixed top-4 right-4 z-[100] flex w-[350px] max-w-[calc(100vw-2rem)] flex-col gap-3",
      )}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Single toast card — per-style branches                                    */
/* -------------------------------------------------------------------------- */

const ToastCard = React.memo(function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  // Switch on style — each Figma variant has distinct surface + bar behavior.
  // Branching here is intentional (vs. a giant ternary) so each style's
  // visual intent stays readable. Style 4 is the most polished and is the
  // recommended default; Styles 1/5 are louder and reserved for emphasis.
  switch (toast.style) {
    case "1":
      return <ToastStyle1 toast={toast} onDismiss={onDismiss} />
    case "2":
      return <ToastStyle2 toast={toast} onDismiss={onDismiss} />
    case "3":
      return <ToastStyle3 toast={toast} onDismiss={onDismiss} />
    case "5":
      return <ToastStyle5 toast={toast} onDismiss={onDismiss} />
    case "4":
    default:
      return <ToastStyle4 toast={toast} onDismiss={onDismiss} />
  }
})

/* -------------------------------------------------------------------------- */
/*  Shared bits — used by every style                                         */
/* -------------------------------------------------------------------------- */

function IconBadge({
  variant,
  className,
}: {
  variant: ToastVariant
  className?: string
}) {
  const tokens = VARIANT_TOKENS[variant]
  const Icon = VARIANT_ICON[variant]
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{ backgroundColor: tokens.tint }}
    >
      <Icon
        className={cn("h-6 w-6", variant === "loading" && "animate-spin")}
        style={{ color: tokens.onTint }}
      />
    </span>
  )
}

function CloseButton({
  onClick,
  accentVar,
  className,
}: {
  onClick: () => void
  accentVar: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label="Đóng"
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="h-4 w-4" style={{ color: accentVar }} />
    </button>
  )
}

function ActionButton({
  label,
  onClick,
  accentVar,
}: {
  label: string
  onClick: () => void
  accentVar: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "shrink-0 text-sm font-bold leading-[22px] transition-opacity hover:opacity-80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1",
      )}
      style={{ color: accentVar }}
    >
      {label}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Style 4 — White card, neutral border, 10px accent bar (DEFAULT)           */
/* -------------------------------------------------------------------------- */

function ToastStyle4({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const [hovered, setHovered] = React.useState(false)
  const tokens = VARIANT_TOKENS[toast.variant]
  const hasProgress = toast.duration > 0

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group pointer-events-auto relative isolate overflow-visible",
        "w-[350px] rounded-2xl border bg-card text-card-foreground",
        "shadow-[0px_16px_20px_-8px_rgba(3,5,18,0.10)]",
        "transition-all duration-200",
        hovered && "-translate-y-0.5 shadow-[0px_20px_24px_-8px_rgba(3,5,18,0.14)]",
        "animate-in slide-in-from-right-full fade-in-0 duration-300",
      )}
      style={{ borderColor: "var(--border)" }}
    >
      {/* 10px wide × full-height vertical accent bar, overlapping the left
          border (absolute -1/-1) for a flush, premium look — matches Figma
          Style 4 "Style 4, Property 2=Success" reference exactly. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-px -top-px h-[calc(100%+2px)] w-[10px] rounded-l-2xl"
        style={{ backgroundColor: tokens.accent }}
      />

      <div className="flex items-center gap-3 py-3 pl-5 pr-4">
        <IconBadge variant={toast.variant} />
        <div className="min-w-0 flex-1">
          {toast.title ? (
            <p className="truncate text-base font-medium leading-[22px] text-foreground">
              {toast.title}
            </p>
          ) : null}
          {toast.description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {toast.description}
            </p>
          ) : null}
        </div>
        {toast.action ? (
          <ActionButton
            label={toast.action.label}
            onClick={() => {
              toast.action?.onClick()
              onDismiss()
            }}
            accentVar={tokens.accent}
          />
        ) : null}
        <CloseButton onClick={onDismiss} accentVar={tokens.accent} />
      </div>

      {/* Bottom progress bar — only for timed toasts. Pauses on hover. */}
      {hasProgress ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-b-2xl",
            "opacity-70 animate-toast-progress",
            hovered && "[animation-play-state:paused]",
          )}
          style={{
            backgroundColor: tokens.accent,
            animationDuration: `${toast.duration}ms`,
          }}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Style 1 — Dark surface (#2D3438), white text                              */
/* -------------------------------------------------------------------------- */

function ToastStyle1({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const [hovered, setHovered] = React.useState(false)
  const tokens = VARIANT_TOKENS[toast.variant]
  const hasProgress = toast.duration > 0

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group pointer-events-auto relative isolate overflow-visible",
        "w-[350px] rounded-2xl px-4 py-3 text-white",
        "shadow-[0px_16px_20px_-8px_rgba(3,5,18,0.10)]",
        "transition-all duration-200",
        hovered && "-translate-y-0.5 shadow-[0px_20px_24px_-8px_rgba(3,5,18,0.14)]",
        "animate-in slide-in-from-right-full fade-in-0 duration-300",
      )}
      style={{ backgroundColor: "var(--toast-neutral)" }}
    >
      <div className="flex items-center gap-3">
        <IconBadge variant={toast.variant} />
        <p className="min-w-0 flex-1 truncate text-base font-medium leading-[22px] text-white">
          {toast.title}
        </p>
        {toast.action ? (
          <ActionButton
            label={toast.action.label}
            onClick={() => {
              toast.action?.onClick()
              onDismiss()
            }}
            accentVar="#FFFFFF"
          />
        ) : null}
        <CloseButton onClick={onDismiss} accentVar="#FFFFFF" />
      </div>

      {hasProgress ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-b-2xl bg-white/70 animate-toast-progress",
            hovered && "[animation-play-state:paused]",
          )}
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Style 2 — White card, neutral border, no accent bar (variant in icon only) */
/* -------------------------------------------------------------------------- */

function ToastStyle2({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const [hovered, setHovered] = React.useState(false)
  const tokens = VARIANT_TOKENS[toast.variant]
  const hasProgress = toast.duration > 0

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group pointer-events-auto relative isolate overflow-visible",
        "w-[350px] rounded-2xl border bg-card px-4 py-3 text-card-foreground",
        "shadow-[0px_16px_20px_-8px_rgba(3,5,18,0.10)]",
        "transition-all duration-200",
        hovered && "-translate-y-0.5 shadow-[0px_20px_24px_-8px_rgba(3,5,18,0.14)]",
        "animate-in slide-in-from-right-full fade-in-0 duration-300",
      )}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <IconBadge variant={toast.variant} />
        <p className="min-w-0 flex-1 truncate text-base font-medium leading-[22px] text-foreground">
          {toast.title}
        </p>
        {toast.action ? (
          <ActionButton
            label={toast.action.label}
            onClick={() => {
              toast.action?.onClick()
              onDismiss()
            }}
            accentVar={tokens.accent}
          />
        ) : null}
        <CloseButton onClick={onDismiss} accentVar={tokens.accent} />
      </div>

      {hasProgress ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-b-2xl opacity-70 animate-toast-progress",
            hovered && "[animation-play-state:paused]",
          )}
          style={{
            backgroundColor: tokens.accent,
            animationDuration: `${toast.duration}ms`,
          }}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Style 3 — Tinted surface + tinted border (no accent bar)                  */
/* -------------------------------------------------------------------------- */

function ToastStyle3({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const [hovered, setHovered] = React.useState(false)
  const tokens = VARIANT_TOKENS[toast.variant]
  const hasProgress = toast.duration > 0

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group pointer-events-auto relative isolate overflow-visible",
        "w-[350px] rounded-2xl border px-4 py-3 text-foreground",
        "shadow-[0px_16px_20px_-8px_rgba(3,5,18,0.10)]",
        "transition-all duration-200",
        hovered && "-translate-y-0.5 shadow-[0px_20px_24px_-8px_rgba(3,5,18,0.14)]",
        "animate-in slide-in-from-right-full fade-in-0 duration-300",
      )}
      style={{
        backgroundColor: tokens.tint,
        borderColor: tokens.accent,
      }}
    >
      <div className="flex items-center gap-3">
        <IconBadge variant={toast.variant} />
        <p className="min-w-0 flex-1 truncate text-base font-medium leading-[22px] text-foreground">
          {toast.title}
        </p>
        {toast.action ? (
          <ActionButton
            label={toast.action.label}
            onClick={() => {
              toast.action?.onClick()
              onDismiss()
            }}
            accentVar={tokens.accent}
          />
        ) : null}
        <CloseButton onClick={onDismiss} accentVar={tokens.accent} />
      </div>

      {hasProgress ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-b-2xl opacity-70 animate-toast-progress",
            hovered && "[animation-play-state:paused]",
          )}
          style={{
            backgroundColor: tokens.accent,
            animationDuration: `${toast.duration}ms`,
          }}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Style 5 — Solid color background, white text                              */
/* -------------------------------------------------------------------------- */

function ToastStyle5({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const [hovered, setHovered] = React.useState(false)
  const tokens = VARIANT_TOKENS[toast.variant]
  const hasProgress = toast.duration > 0

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group pointer-events-auto relative isolate overflow-visible",
        "w-[350px] rounded-2xl px-4 py-3 text-white",
        "shadow-[0px_16px_20px_-8px_rgba(3,5,18,0.10)]",
        "transition-all duration-200",
        hovered && "-translate-y-0.5 shadow-[0px_20px_24px_-8px_rgba(3,5,18,0.14)]",
        "animate-in slide-in-from-right-full fade-in-0 duration-300",
      )}
      style={{ backgroundColor: tokens.accent }}
    >
      <div className="flex items-center gap-3">
        <IconBadge variant={toast.variant} className="bg-white/20" />
        <p className="min-w-0 flex-1 truncate text-base font-medium leading-[22px] text-white">
          {toast.title}
        </p>
        {toast.action ? (
          <ActionButton
            label={toast.action.label}
            onClick={() => {
              toast.action?.onClick()
              onDismiss()
            }}
            accentVar="#FFFFFF"
          />
        ) : null}
        <CloseButton onClick={onDismiss} accentVar="#FFFFFF" />
      </div>

      {hasProgress ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-b-2xl bg-white/70 animate-toast-progress",
            hovered && "[animation-play-state:paused]",
          )}
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      ) : null}
    </div>
  )
}
