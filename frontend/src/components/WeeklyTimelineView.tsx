"use client";

import React, { useMemo } from "react";
import {
  getSessionExamType,
  getSessionExamLabel,
  getTeacherNameFromSlot,
} from "@/lib/courseConfig";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface WeeklyTimelineViewProps {
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

// Hour range 7h - 21h
const HOUR_START = 7;
const HOUR_END = 21;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, i) => HOUR_START + i,
);
const PX_PER_HOUR = 36;
const PX_PER_MIN = PX_PER_HOUR / 60;
const MIN_EVENT_HEIGHT = 26;

export default function WeeklyTimelineView({
  slots,
  weekStart,
}: WeeklyTimelineViewProps) {
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
    const byDay: Record<
      number,
      Array<{
        slot: RawSlotItem;
        status: EventStatus;
        startMin: number;
        endMin: number;
      }>
    > = {};
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
      byDay[dayDiff].push({
        slot,
        status,
        startMin: toMinutes(slot.startTime),
        endMin: toMinutes(slot.endTime),
      });
    });
    Object.values(byDay).forEach((arr) => {
      arr.sort((a, b) => a.startMin - b.startMin);
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

  const totalHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR;
  const dayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div className="timeline-wrapper">
      {/* Day header */}
      <div className="timeline-day-header">
        <div className="timeline-time-spacer" />
        {weekDates.map((date, idx) => {
          const isToday = date.getTime() === today.getTime();
          const dayEvents = slotsByDay[idx] ?? [];
          const isEmpty = dayEvents.length === 0;
          return (
            <div
              key={idx}
              className={cn(
                "timeline-day-header-cell",
                isToday && "timeline-day-header-today",
                isEmpty && "timeline-day-header-empty",
              )}
            >
              <div className="timeline-day-header-label">
                {dayLabels[idx]}
              </div>
              <div className="timeline-day-header-date">
                {date.getDate()}/{date.getMonth() + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="timeline-body-scroll">
        <div
          className="timeline-body"
          style={{ height: `${totalHeight}px` }}
        >
          {/* Time column */}
          <div className="timeline-time-col">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="timeline-time-cell"
                style={{ height: `${PX_PER_HOUR}px` }}
              >
                <span className="timeline-time-text">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIdx) => {
            const isToday = date.getTime() === today.getTime();
            const dayEvents = slotsByDay[dayIdx] ?? [];

            // Ngày không có buổi — vẫn giữ col để grid ổn định nhưng làm mờ
            if (dayEvents.length === 0) {
              return (
                <div
                  key={dayIdx}
                  className="timeline-day-col timeline-day-col-empty"
                  style={{ height: `${totalHeight}px` }}
                  aria-hidden="true"
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="timeline-hour-cell"
                      style={{ height: `${PX_PER_HOUR}px` }}
                    />
                  ))}
                </div>
              );
            }

            return (
              <div
                key={dayIdx}
                className={cn(
                  "timeline-day-col",
                  isToday && "timeline-day-col-today",
                )}
                style={{ height: `${totalHeight}px` }}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="timeline-hour-cell"
                    style={{ height: `${PX_PER_HOUR}px` }}
                  />
                ))}

                {dayEvents.map((ev, idx) => (
                  <TimelineEvent
                    key={`${ev.slot.classId}-${idx}-${ev.slot.startTime}`}
                    event={ev}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({
  event,
}: {
  event: {
    slot: RawSlotItem;
    status: EventStatus;
    startMin: number;
    endMin: number;
  };
}) {
  const { slot, status, startMin, endMin } = event;

  const windowStart = HOUR_START * 60;
  const windowEnd = HOUR_END * 60;

  const clampedStart = Math.max(startMin, windowStart);
  const clampedEnd = Math.min(endMin, windowEnd);
  if (clampedEnd <= windowStart || clampedStart >= windowEnd) return null;

  const topPx = (clampedStart - windowStart) * PX_PER_MIN;
  const heightPx = Math.max(
    (clampedEnd - clampedStart) * PX_PER_MIN,
    MIN_EVENT_HEIGHT,
  );

  const sessionNum =
    slot.sessionIndex !== undefined ? slot.sessionIndex + 1 : 1;
  const examLabel = getSessionExamLabel(slot.className, sessionNum);

  const lecName = getTeacherNameFromSlot(slot, "LEC");
  const taName = getTeacherNameFromSlot(slot, "TA");
  const studentCount = slot.classItem?.students?.length ?? slot.studentCount;
  const centreName =
    slot.classItem?.centre?.shortName || slot.classItem?.centre?.name;

  return (
    <div
      className={cn("timeline-event", `timeline-event-${status}`)}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
      }}
    >
      <span className="timeline-event-name">{slot.className}</span>
      <span className="timeline-event-session">Buổi {sessionNum}</span>

      {/* Hover tooltip */}
      <div className="timeline-event-tooltip" role="tooltip">
        <div className="timeline-event-tooltip-title">{slot.className}</div>

        <div className="timeline-event-tooltip-row">
          <span className="timeline-event-tooltip-label">Thời gian</span>
          <span className="timeline-event-tooltip-value">
            {slot.startTime?.slice(0, 5)} – {slot.endTime?.slice(0, 5)}
          </span>
        </div>

        <div className="timeline-event-tooltip-row">
          <span className="timeline-event-tooltip-label">Buổi</span>
          <span className="timeline-event-tooltip-value">
            {sessionNum}
            {examLabel && (
              <span className="timeline-event-tooltip-muted">
                {" "}
                — {examLabel}
              </span>
            )}
          </span>
        </div>

        <div className="timeline-event-tooltip-row">
          <span className="timeline-event-tooltip-label">LEC</span>
          <span className="timeline-event-tooltip-value">
            {lecName || "—"}
          </span>
        </div>

        {taName && (
          <div className="timeline-event-tooltip-row">
            <span className="timeline-event-tooltip-label">TA</span>
            <span className="timeline-event-tooltip-value">{taName}</span>
          </div>
        )}

        {studentCount !== undefined && studentCount !== null && (
          <div className="timeline-event-tooltip-row">
            <span className="timeline-event-tooltip-label">Sĩ số</span>
            <span className="timeline-event-tooltip-value">
              {studentCount} học viên
            </span>
          </div>
        )}

        {centreName && (
          <div className="timeline-event-tooltip-row timeline-event-tooltip-row-meta">
            <span className="timeline-event-tooltip-muted">{centreName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
