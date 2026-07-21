"use client";

import React, { useMemo, forwardRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import { EventContentArg } from "@fullcalendar/core";
import viLocale from "@fullcalendar/core/locales/vi";
import {
  getSessionExamType,
  getSessionExamLabel,
} from "@/lib/courseConfig";
import {
  Users,
  GraduationCap,
  Award,
  Sparkles,
  Ban,
  CheckCircle2,
  Clock,
} from "lucide-react";
import "../app/calendar.css";

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

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  classNames: string[];
  extendedProps: {
    aggregatedSlots: RawSlotItem[];
    status?: string;
  };
}

interface WeeklyScheduleCalendarProps {
  slots: RawSlotItem[];
  onDatesSet?: (dateInfo: { view: any }) => void;
  onEventClick?: (aggregatedSlots: RawSlotItem[]) => void;
  slotDuration?: string;
}

type EventStatus =
  | "teaching-class"
  | "demo-class"
  | "checkpoint-class"
  | "cancelled"
  | "completed";

const getEventStatus = (
  examType: string | null,
  classStatus: string,
): EventStatus => {
  if (classStatus === "CANCELLED") return "cancelled";
  if (classStatus === "COMPLETED" || classStatus === "FINISHED")
    return "completed";
  if (examType === "demo") return "demo-class";
  if (examType === "checkpoint1" || examType === "checkpoint2")
    return "checkpoint-class";
  return "teaching-class";
};

const STATUS_META: Record<
  EventStatus,
  {
    badge: string | null;
    icon: React.ComponentType<{ className?: string }>;
    accentVar: string;
  }
> = {
  "teaching-class": {
    badge: null,
    icon: GraduationCap,
    accentVar: "--primary",
  },
  "demo-class": {
    badge: "DEMO",
    icon: Sparkles,
    accentVar: "--success",
  },
  "checkpoint-class": {
    badge: "CHECKPOINT",
    icon: Award,
    accentVar: "--info",
  },
  cancelled: {
    badge: "ĐÃ HỦY",
    icon: Ban,
    accentVar: "--muted-foreground",
  },
  completed: {
    badge: "HOÀN THÀNH",
    icon: CheckCircle2,
    accentVar: "--muted-foreground",
  },
};

const WeeklyScheduleCalendar = forwardRef<
  FullCalendar,
  WeeklyScheduleCalendarProps
>(({ slots, onDatesSet, slotDuration = "01:00:00" }, ref) => {
  const events = useMemo(() => {
    const groupedEvents = new Map<string, RawSlotItem[]>();

    slots.forEach((item) => {
      let shiftedStartTime = item.startTime;
      try {
        const startHour = parseInt(item.startTime.split(":")[0], 10);
        if (startHour >= 14) {
          shiftedStartTime = `${String(startHour - 2).padStart(2, "0")}:${
            item.startTime.split(":")[1] || "00"
          }:${item.startTime.split(":")[2] || "00"}`;
        }
      } catch (e) {
        console.warn("Error shifting slot time:", e);
      }

      const startDateTime = new Date(`${item.date}T${shiftedStartTime}`);
      const year = startDateTime.getFullYear();
      const month = String(startDateTime.getMonth() + 1).padStart(2, "0");
      const day = String(startDateTime.getDate()).padStart(2, "0");
      const dayKey = `${year}-${month}-${day}`;
      const startHour = startDateTime.getHours();
      const slotHour = Math.floor(startHour / 2) * 2;
      const slotKey = `${dayKey}_${String(slotHour).padStart(2, "0")}`;

      if (!groupedEvents.has(slotKey)) {
        groupedEvents.set(slotKey, []);
      }
      groupedEvents.get(slotKey)?.push(item);
    });

    const calendarEvents: CalendarEvent[] = [];
    groupedEvents.forEach((aggregatedSlots, slotKey) => {
      const [day, hour] = slotKey.split("_");
      const startDate = new Date(`${day}T${hour}:00:00`);
      if (isNaN(startDate.getTime())) return;
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      let overallStatus: EventStatus = "teaching-class";
      if (aggregatedSlots.some((s) => s.classItem?.status === "CANCELLED"))
        overallStatus = "cancelled";
      else if (
        aggregatedSlots.some(
          (s) =>
            s.classItem?.status === "COMPLETED" ||
            s.classItem?.status === "FINISHED",
        )
      )
        overallStatus = "completed";
      else if (
        aggregatedSlots.some(
          (s) =>
            getEventStatus(
              getSessionExamType(s.className, (s.sessionIndex ?? 0) + 1),
              s.classItem?.status,
            ) === "demo-class",
        )
      )
        overallStatus = "demo-class";
      else if (
        aggregatedSlots.some(
          (s) =>
            getEventStatus(
              getSessionExamType(s.className, (s.sessionIndex ?? 0) + 1),
              s.classItem?.status,
            ) === "checkpoint-class",
        )
      )
        overallStatus = "checkpoint-class";

      calendarEvents.push({
        id: slotKey,
        title: "",
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        classNames: [overallStatus],
        extendedProps: { aggregatedSlots, status: overallStatus },
      });
    });

    return calendarEvents;
  }, [slots]);

  const CustomEventContent = (eventInfo: EventContentArg) => {
    const { aggregatedSlots, status } = eventInfo.event.extendedProps as {
      aggregatedSlots: RawSlotItem[];
      status: EventStatus;
    };
    if (!aggregatedSlots || aggregatedSlots.length === 0) return null;

    const visibleSlots = aggregatedSlots;
    const meta = STATUS_META[status] ?? STATUS_META["teaching-class"];
    const StatusIcon = meta.icon;

    return (
      <div
        data-event-id={eventInfo.event.id}
        className="event-content-wrapper w-full h-full cursor-pointer"
      >
        {visibleSlots.map((slot: RawSlotItem, index: number) => {
          const sessionNum =
            slot.sessionIndex !== undefined ? slot.sessionIndex + 1 : 1;
          const examType = getSessionExamType(slot.className, sessionNum);
          const slotStatus = getEventStatus(examType, slot.classItem?.status);
          const slotMeta = STATUS_META[slotStatus] ?? meta;
          const SlotIcon = slotMeta.icon;
          const examLabel = getSessionExamLabel(slot.className, sessionNum);
          const isSpecial = slotStatus !== "teaching-class";

          const lec = slot.classItem?.teachers?.find(
            (t: any) => t.role?.shortName === "LEC",
          );
          const ta = slot.classItem?.teachers?.find(
            (t: any) => t.role?.shortName === "TA",
          );
          const lecName = lec?.teacher?.fullName;
          const taName = ta?.teacher?.fullName;
          const studentCount =
            slot.classItem?.students?.length ?? slot.studentCount;

          const slotKey = `${slot.classId}-${index}`;

          return (
            <div
              key={slotKey}
              className={`event-card ${slotStatus}`}
              style={
                {
                  "--accent": `hsl(${slotMeta.accentVar})`,
                } as React.CSSProperties
              }
            >
              {isSpecial && slotMeta.badge && (
                <div className="event-badge">
                  <SlotIcon className="event-badge-icon" />
                  <span>{slotMeta.badge}</span>
                </div>
              )}

              <div className="event-title">
                <span className="event-title-text">{slot.className}</span>
              </div>

              <div className="event-meta">
                <div className="event-meta-row">
                  <Clock className="event-meta-icon" />
                  <span>
                    {slot.startTime?.slice(0, 5)} – {slot.endTime?.slice(0, 5)}
                  </span>
                </div>

                {examLabel && (
                  <div className="event-meta-row event-meta-session">
                    <SlotIcon className="event-meta-icon" />
                    <span className="truncate">{examLabel}</span>
                  </div>
                )}

                {(lecName || taName) && (
                  <div className="event-meta-row">
                    <GraduationCap className="event-meta-icon" />
                    <span className="truncate">
                      {lecName && (
                        <span className="event-teacher-lec">
                          {shortName(lecName)}
                        </span>
                      )}
                      {lecName && taName && (
                        <span className="event-teacher-sep"> · </span>
                      )}
                      {taName && (
                        <span className="event-teacher-ta">
                          {shortName(taName)}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {studentCount !== undefined && studentCount !== null && (
                  <div className="event-meta-row">
                    <Users className="event-meta-icon" />
                    <span>{studentCount} HV</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-[800px] w-full calendar-container">
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={viLocale}
        headerToolbar={false}
        datesSet={onDatesSet}
        firstDay={1}
        allDaySlot={false}
        height="100%"
        slotMinTime="08:00:00"
        slotMaxTime="18:00:00"
        slotDuration={slotDuration}
        slotLabelInterval={{ hours: 1 }}
        slotLabelContent={(args: any) => {
          const hour = args.date.getHours();
          if (hour >= 12) return `${hour + 2}:00`;
          return `${String(hour).padStart(2, "0")}:00`;
        }}
        expandRows={true}
        events={events}
        eventContent={CustomEventContent}
        eventOverlap={false}
        nowIndicator={false}
      />
    </div>
  );
});

WeeklyScheduleCalendar.displayName = "WeeklyScheduleCalendar";

function shortName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0)}.`;
}

WeeklyScheduleCalendar.displayName = "WeeklyScheduleCalendar";
export default WeeklyScheduleCalendar;
