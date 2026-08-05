"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shared full-screen modal used to surface inline `errorMsg` /
 * `successMsg` banners. Every consumer closes the modal manually
 * (no auto-dismiss) so users have time to read long backend error
 * messages — a deliberate change from the previous banner UX, which
 * dismissed success messages after 4 seconds.
 */

export type AlertModalVariant = "error" | "success" | "info" | "warning";

export interface AlertModalAction {
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "outline";
  href?: string;
  onClick?: () => void;
}

const VARIANT_STYLES: Record<
  AlertModalVariant,
  {
    icon: LucideIcon;
    iconWrap: string;
    title: string;
    defaultLabel: string;
    buttonClass: string;
  }
> = {
  error: {
    icon: XCircle,
    iconWrap:
      "bg-destructive/10 text-destructive dark:bg-destructive/20 ring-1 ring-destructive/20",
    title: "Đã xảy ra lỗi",
    defaultLabel: "Đã xảy ra lỗi",
    buttonClass:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  },
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    title: "Thành công",
    defaultLabel: "Thành công",
    buttonClass:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20",
  },
  warning: {
    icon: AlertTriangle,
    iconWrap:
      "bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    title: "Cảnh báo",
    defaultLabel: "Cảnh báo",
    buttonClass:
      "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20",
  },
  info: {
    icon: Info,
    iconWrap: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    title: "Thông báo",
    defaultLabel: "Thông báo",
    buttonClass: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

export interface AlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: AlertModalVariant;
  title?: string;
  /**
   * Body content. Strings render with the default paragraph
   * styling; pass JSX for richer content (lists, links, etc.).
   */
  message?: React.ReactNode;
  /** Optional override for the close button label. */
  closeLabel?: string;
  /** Extra Tailwind classes appended to the dialog content. */
  contentClassName?: string;
  /** Optional primary action rendered alongside the close button.
   *  Used by `mapAuthErrorToAlert` to surface a "Thử lại" CTA on
   *  transient failures or a "Liên hệ quản trị" CTA on permanent
   *  ones. */
  action?: AlertModalAction;
  /**
   * Optional override for the icon shown next to the title. When
   * omitted, we use the variant default.
   */
  icon?: LucideIcon;
}

export function AlertModal({
  open,
  onOpenChange,
  variant = "error",
  title,
  message,
  closeLabel = "Đóng",
  contentClassName,
  action,
  icon,
}: AlertModalProps) {
  const styles = VARIANT_STYLES[variant];
  const resolvedTitle = title ?? styles.title;
  const Icon = icon ?? styles.icon;
  const ActionIcon = action?.icon;
  const isStringMessage = typeof message === "string";

  const actionButton =
    action && (action.onClick || action.href) ? (
      <Button
        type="button"
        variant={action.variant ?? "default"}
        onClick={() => {
          if (action.onClick) action.onClick();
          onOpenChange(false);
        }}
        {...(action.href
          ? {
              asChild: true,
            }
          : {})}
        className={cn(
          "min-w-[120px]",
          action.variant === "outline" && "border-border",
        )}
      >
        {action.href ? (
          <a href={action.href} className="inline-flex items-center">
            {ActionIcon && <ActionIcon className="h-4 w-4 mr-1.5" />}
            {action.label}
          </a>
        ) : (
          <>
            {ActionIcon && <ActionIcon className="h-4 w-4 mr-1.5" />}
            {action.label}
          </>
        )}
      </Button>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-md sm:rounded-2xl", contentClassName)}
      >
        <DialogHeader className="flex-row items-start gap-4 space-y-0 pr-8">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              styles.iconWrap,
            )}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <DialogTitle className="text-base font-semibold leading-snug text-foreground">
              {resolvedTitle}
            </DialogTitle>
            {message != null && (
              <DialogDescription
                className={cn(
                  "whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground",
                  isStringMessage && "font-medium text-foreground/80",
                )}
              >
                {message}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:flex-row sm:justify-end">
            {actionButton}
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn("min-w-[88px]", styles.buttonClass)}
            >
              {closeLabel}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AlertModal;