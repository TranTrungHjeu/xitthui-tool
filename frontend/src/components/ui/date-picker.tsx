"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;
  onChange?: (date: string) => void;
  label?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
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

export function DatePicker({
  value,
  onChange,
  label,
  id,
  required,
  disabled,
  placeholder = "Chọn ngày",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [viewYear, setViewYear] = React.useState(() => {
    if (value) {
      const [y] = value.split("-").map(Number);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = React.useState(() => {
    if (value) {
      const [, m] = value.split("-").map(Number);
      if (!isNaN(m)) return m - 1;
    }
    return new Date().getMonth();
  });

  const today = new Date();

  let selectedDate: Date | undefined;
  let displayValue = "";
  if (value) {
    const parts = value.split("-").map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      const [y, m, d] = parts;
      selectedDate = new Date(y, m - 1, d);
      if (!isNaN(selectedDate.getTime())) {
        displayValue = selectedDate.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    }
  }

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

  const handleSelect = (day: number) => {
    // Create date in local timezone to avoid off-by-one errors
    const year = viewYear;
    const month = viewMonth;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange?.(iso);
    setOpen(false);
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const [y, m, d] = value!.split("-").map(Number);
    return d === day && m - 1 === viewMonth && y === viewYear;
  };

  const isToday = (day: number) => {
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-foreground leading-none"
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={buttonRef}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              const rect = buttonRef.current?.getBoundingClientRect();
              setPosition(rect ? { top: rect.top, left: rect.left } : null);
              setOpen(true);
            }
          }}
          className={cn(
            "w-full h-9 px-3 rounded-md border border-input bg-background text-sm",
            "flex items-center gap-2 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1 text-left">
            {displayValue || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
        </button>

        {open && createPortal((
          <div
            className="fixed z-[9999] bg-popover border border-border rounded-xl shadow-lg shadow-black/[0.08] w-[292px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: position ? `${position.top + 40}px` : "-9999px",
              left: position ? `${position.left}px` : "-9999px",
              opacity: position ? 1 : 0,
            }}
          >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-gradient-to-b from-white to-slate-50/50">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  {MONTH_NAMES_VI[viewMonth]}&nbsp;{viewYear}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
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
                  const selected = isSelected(day);
                  const todayCell = isToday(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelect(day)}
                      className={cn(
                        "h-9 w-full flex items-center justify-center rounded-lg text-sm transition-all duration-100",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        selected
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : todayCell
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end px-3 py-2.5 border-t border-border bg-gradient-to-t from-slate-50/50 to-white">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                >
                  Đóng
                </button>
              </div>
            </div>
        ), document.body)}
      </div>
    </div>
  );
}
