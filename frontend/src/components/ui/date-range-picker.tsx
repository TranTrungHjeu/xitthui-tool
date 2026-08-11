"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  fromValue?: string;
  toValue?: string;
  onFromChange?: (date: string) => void;
  onToChange?: (date: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES_VI = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

const DAY_HEADERS_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

function formatDisplay(value?: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export function DateRangePicker({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  placeholder = "Chọn khoảng ngày",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);
  const [viewYear, setViewYear] = React.useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = React.useState(() => new Date().getMonth());
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const fromDate = parseDate(fromValue);
  const toDate = parseDate(toValue);
  const fromDisplay = formatDisplay(fromValue);
  const toDisplay = formatDisplay(toValue);

  const displayText = fromDisplay && toDisplay
    ? `${fromDisplay} - ${toDisplay}`
    : fromDisplay
    ? `Từ ${fromDisplay}`
    : toDisplay
    ? `Đến ${toDisplay}`
    : "";

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDay) {
      cells.push(null);
    } else if (i - firstDay + 1 <= daysInMonth) {
      cells.push(i - firstDay + 1);
    } else {
      cells.push(null);
    }
  }

  const today = new Date();

  const handleOpen = () => {
    // Initialize view to show from/to dates if set
    if (fromValue) {
      const parts = fromValue.split("-").map(Number);
      if (parts.length === 3) {
        setViewYear(parts[0]);
        setViewMonth(parts[1] - 1);
      }
    } else if (toValue) {
      const parts = toValue.split("-").map(Number);
      if (parts.length === 3) {
        setViewYear(parts[0]);
        setViewMonth(parts[1] - 2); // Show previous month
        if (parts[1] - 2 < 0) {
          setViewYear(parts[0] - 1);
          setViewMonth(11);
        }
      }
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    setPosition(rect ? { top: rect.top, left: rect.left } : null);
    setOpen(true);
  };

  const handleDayClick = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (!fromValue || (fromValue && toValue)) {
      // Start new selection
      onFromChange?.(iso);
      onToChange?.("");
      setHoverDate(new Date(viewYear, viewMonth, day));
    } else {
      // Complete selection
      const fromDate = parseDate(fromValue);
      const clickedDate = new Date(viewYear, viewMonth, day);

      if (fromDate && clickedDate < fromDate) {
        // If clicked date is before from, swap them
        onToChange?.(fromValue);
        onFromChange?.(iso);
      } else {
        onToChange?.(iso);
        setOpen(false);
      }
    }
  };

  const handleDayHover = (day: number) => {
    if (fromValue && !toValue) {
      setHoverDate(new Date(viewYear, viewMonth, day));
    }
  };

  const getDayClasses = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    const isFrom = fromDate && isSameDay(date, fromDate);
    const isTo = toDate && isSameDay(date, toDate);
    const isToday =
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear;
    const isHover = hoverDate && date > (fromDate || new Date(0)) && date <= hoverDate;

    if (isFrom || isTo) {
      return "bg-primary text-primary-foreground font-semibold z-10";
    }

    if (isHover) {
      return "bg-primary/20";
    }

    if (isToday) {
      return "bg-accent text-accent-foreground font-semibold";
    }

    return "text-foreground hover:bg-muted";
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          "w-full h-9 px-3 rounded-md border border-input bg-background text-sm",
          "flex items-center gap-2 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:border-primary/50",
          !displayText && "text-muted-foreground"
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 text-left">
          {displayText || <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </button>

      {open && position && createPortal((
        <div
          className="fixed z-[9999] bg-popover border border-border rounded-xl shadow-lg shadow-black/[0.08] w-[292px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${position.top + 40}px`,
            left: `${position.left}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-gradient-to-b from-white to-slate-50/50">
            <button
              type="button"
              onClick={prevMonth}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <span className="text-sm">‹</span>
            </button>
            <span className="text-sm font-semibold text-foreground tracking-tight">
              {MONTH_NAMES_VI[viewMonth]}&nbsp;{viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <span className="text-sm">›</span>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pt-2.5 pb-1">
            {DAY_HEADERS_VI.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "h-8 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide",
                  i === 6 ? "text-red-500" : "text-muted-foreground"
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-9" />;
              }
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => handleDayHover(day)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={cn(
                    "h-9 w-full flex items-center justify-center rounded-lg text-sm transition-all duration-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    getDayClasses(day)
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border bg-gradient-to-t from-slate-50/50 to-white">
            <span className="text-xs text-muted-foreground">
              {fromDisplay && toDisplay && `${fromDisplay} - ${toDisplay}`}
              {fromDisplay && !toDisplay && "Chọn ngày kết thúc"}
              {!fromDisplay && "Click 2 ngày để chọn khoảng"}
            </span>
            <button
              type="button"
              onClick={() => {
                onFromChange?.("");
                onToChange?.("");
                setOpen(false);
              }}
              className="h-7 px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              Xóa
            </button>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
