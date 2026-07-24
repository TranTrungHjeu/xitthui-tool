"use client";

import React, { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  getSessionExamType,
  getSessionExamLabel,
  getTeacherNameFromSlot,
} from "@/lib/courseConfig";
import {
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./schedule-grid.css";

interface RawSlotItem {
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionIndex?: number;
  slot: any;
  classItem: any;
  studentCount?: number;
}

type EventStatus =
  | "teaching-class"
  | "demo-class"
  | "checkpoint1-class"
  | "checkpoint2-class"
  | "cancelled"
  | "completed";

interface PositionedSlot {
  slot: RawSlotItem;
  status: EventStatus;
}

interface WeeklyScheduleListProps {
  slots: RawSlotItem[];
  weekStart?: Date;
}

function getEventStatus(
  examType: string | null,
  classStatus: string,
): EventStatus {
  if (classStatus === "CANCELLED") return "cancelled";
  if (classStatus === "COMPLETED" || classStatus === "FINISHED")
    return "completed";
  if (examType === "demo") return "demo-class";
  if (examType === "checkpoint1") return "checkpoint1-class";
  if (examType === "checkpoint2") return "checkpoint2-class";
  return "teaching-class";
}

function toMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function parseDateKey(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayDiff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shortName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0)}.`;
}

export default function WeeklyScheduleList({
  slots,
  weekStart,
}: WeeklyScheduleListProps) {
  const monday = useMemo(() => {
    if (weekStart) return getMondayOf(weekStart);
    return getMondayOf(new Date());
  }, [weekStart]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [monday],
  );

  const slotsByDay = useMemo(() => {
    const byDay: Record<number, PositionedSlot[]> = {};
    slots.forEach((slot) => {
      const slotDate = parseDateKey(slot.date);
      if (!slotDate) return;
      const mondayTime = monday.getTime();
      const slotTime = slotDate.getTime();
      const dayDiff = Math.round((slotTime - mondayTime) / (24 * 3600 * 1000));
      if (dayDiff < 0 || dayDiff > 6) return;

      const sessionNum =
        slot.sessionIndex !== undefined ? slot.sessionIndex + 1 : 1;
      const examType = getSessionExamType(slot.className, sessionNum);
      const status = getEventStatus(examType, slot.classItem?.status);

      if (!byDay[dayDiff]) byDay[dayDiff] = [];
      byDay[dayDiff].push({ slot, status });
    });

    Object.values(byDay).forEach((arr) => {
      arr.sort((a, b) => toMinutes(a.slot.startTime) - toMinutes(b.slot.startTime));
    });

    return byDay;
  }, [slots, monday]);

  const totalEvents = Object.values(slotsByDay).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );

  if (totalEvents === 0) {
    return (
      <div className="schedule-empty">
        <div className="schedule-empty-icon">
          <CalendarDays className="h-7 w-7" />
        </div>
        <p className="schedule-empty-title">Chưa có lịch trong tuần này</p>
        <p className="schedule-empty-desc">
          Các buổi học sẽ hiển thị tại đây khi lịch được đồng bộ.
        </p>
      </div>
    );
  }

  return (
    <div className="schedule-list-wrapper">
      {weekDates
        .map((date, dayIdx) => {
          const isToday = date.getTime() === today.getTime();
          const dayEvents = slotsByDay[dayIdx] ?? [];
          if (dayEvents.length === 0) return null;

          const dayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

          return (
            <section
              key={dayIdx}
              className={cn(
                "schedule-list-day",
                isToday && "schedule-list-day-today",
              )}
            >
              <header className="schedule-list-day-header">
                <div className="schedule-list-day-info">
                  <span className="schedule-list-day-label">
                    {dayLabels[dayIdx]}
                  </span>
                  <span className="schedule-list-day-date">
                    {date.getDate()}/{date.getMonth() + 1}
                  </span>
                  {isToday && (
                    <span className="schedule-list-day-today-badge">Hôm nay</span>
                  )}
                </div>
                <span className="schedule-list-day-count">
                  {dayEvents.length} buổi
                </span>
              </header>

              <div className="schedule-list-day-items">
                {(() => {
                  // Nhóm theo startTime, giữ thứ tự
                  const groups = new Map<
                    string,
                    { items: PositionedSlot[]; endTime?: string }
                  >();
                  for (const item of dayEvents) {
                    const key = item.slot.startTime ?? "";
                    if (!groups.has(key)) {
                      groups.set(key, { items: [], endTime: item.slot.endTime });
                    }
                    groups.get(key)!.items.push(item);
                  }

                  return Array.from(groups.entries()).map(
                    ([startTime, group]) => {
                      const hasActiveSlot = group.items.some((item) => {
                        const slotDate = new Date(item.slot.date);
                        slotDate.setHours(0, 0, 0, 0);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        if (
                          slotDate.getTime() !== todayDate.getTime()
                        )
                          return false;
                        const nowMin =
                          todayDate.getHours() * 60 + todayDate.getMinutes();
                        return (
                          nowMin >= toMinutes(startTime) &&
                          nowMin < toMinutes(group.endTime ?? startTime)
                        );
                      });

                      return (
                        <div
                          key={startTime}
                          className="schedule-list-time-group"
                        >
                          <div
                            className={cn(
                              "schedule-list-time-header",
                              hasActiveSlot &&
                                "schedule-list-time-header-active",
                            )}
                          >
                            <span className="schedule-list-time-header-range">
                              <span className="schedule-list-time-header-start">
                                {startTime?.slice(0, 5)}
                              </span>
                              <span className="schedule-list-time-header-dash">
                                –
                              </span>
                              <span className="schedule-list-time-header-end">
                                {group.endTime?.slice(0, 5)}
                              </span>
                            </span>
                            {hasActiveSlot && (
                              <span
                                className="schedule-list-time-header-pulse"
                                aria-label="Đang diễn ra"
                              />
                            )}
                          </div>
                          <div className="schedule-list-time-group-items">
                            {group.items.map((item) => (
                              <ScheduleRow
                                key={`${item.slot.classId}-${item.slot.startTime}`}
                                item={item}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    },
                  );
                })()}
              </div>
            </section>
          );
        })
        .filter(Boolean)}
    </div>
  );
}

function ScheduleRow({ item }: { item: PositionedSlot }) {
  const { slot, status } = item;
  const rowRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<
    | {
        anchorTop: number;
        anchorBottom: number;
        left: number;
        placement: "top" | "bottom";
      }
    | null
  >(null);

  const sessionNum =
    slot.sessionIndex !== undefined ? slot.sessionIndex + 1 : 1;
  const examType = getSessionExamType(slot.className, sessionNum);
  const examLabel = getSessionExamLabel(slot.className, sessionNum);

  const lecName = getTeacherNameFromSlot(slot, "LEC");
  const taName = getTeacherNameFromSlot(slot, "TA");
  const studentCount = slot.classItem?.students?.length ?? slot.studentCount;
  const centreName =
    slot.classItem?.centre?.shortName || slot.classItem?.centre?.name;

  const handleMouseEnter = () => {
    if (!rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    setTooltipPos({
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      left: rect.left + rect.width / 2,
      placement: rect.top < 200 ? "bottom" : "top",
    });
  };
  const handleMouseLeave = () => setTooltipPos(null);

  const tooltipNode =
    tooltipPos &&
    createPortal(
      <div
        className={cn(
          "schedule-list-tooltip",
          `schedule-list-tooltip-${status}`,
          tooltipPos.placement === "bottom" && "schedule-list-tooltip-below",
        )}
        role="tooltip"
        style={
          tooltipPos.placement === "bottom"
            ? {
                position: "fixed",
                top: tooltipPos.anchorBottom + 6,
                left: tooltipPos.left,
                transform: "translateX(-50%)",
              }
            : {
                position: "fixed",
                top: tooltipPos.anchorTop,
                left: tooltipPos.left,
                transform: "translate(-50%, -100%)",
              }
        }
      >
        <div className="schedule-list-tooltip-title">{slot.className}</div>

        <div className="schedule-list-tooltip-row">
          <span className="schedule-list-tooltip-label">Thời gian</span>
          <span className="schedule-list-tooltip-value">
            {slot.startTime?.slice(0, 5)} – {slot.endTime?.slice(0, 5)}
          </span>
        </div>

        <div className="schedule-list-tooltip-row">
          <span className="schedule-list-tooltip-label">Buổi</span>
          <span className="schedule-list-tooltip-value">
            {sessionNum}
            {examType && (
              <span className="schedule-list-tooltip-muted"> ({examLabel})</span>
            )}
          </span>
        </div>

        <div className="schedule-list-tooltip-row">
          <span className="schedule-list-tooltip-label">LEC</span>
          <span className="schedule-list-tooltip-value">
            {lecName || "—"}
          </span>
        </div>

        {taName && (
          <div className="schedule-list-tooltip-row">
            <span className="schedule-list-tooltip-label">TA</span>
            <span className="schedule-list-tooltip-value">{taName}</span>
          </div>
        )}

        {studentCount !== undefined && studentCount !== null && (
          <div className="schedule-list-tooltip-row">
            <span className="schedule-list-tooltip-label">Sĩ số</span>
            <span className="schedule-list-tooltip-value">
              {studentCount} học viên
            </span>
          </div>
        )}

        {centreName && (
          <div className="schedule-list-tooltip-row schedule-list-tooltip-row-meta">
            <span className="schedule-list-tooltip-muted">{centreName}</span>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <div
      ref={rowRef}
      className={cn("schedule-row", `schedule-row-${status}`)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="schedule-row-class-name">{slot.className}</span>
      <span
        className={cn("schedule-row-session", `schedule-row-session-${status}`)}
      >
        Buổi {sessionNum}
      </span>

      {tooltipNode}
    </div>
  );
}
