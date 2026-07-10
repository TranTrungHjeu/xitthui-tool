"use client";

import React, { useState, useMemo, forwardRef, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import { EventContentArg, EventClickArg } from "@fullcalendar/core";
import viLocale from "@fullcalendar/core/locales/vi";
import { getSessionExamType, getSessionExamLabel } from "@/lib/courseConfig";
import "../app/calendar.css";

// --- TYPES ---
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
}

// --- HELPER FUNCTIONS ---
const getEventStatus = (
  examType: string | null,
  classStatus: string,
): string => {
  if (classStatus === "CANCELLED") return "cancelled";
  if (classStatus === "COMPLETED" || classStatus === "FINISHED")
    return "completed";
  if (examType === "demo") return "demo-class";
  if (examType === "checkpoint1" || examType === "checkpoint2")
    return "checkpoint-class";
  return "teaching-class";
};

// --- PORTAL TOOLTIP COMPONENT ---
const PortalTooltip: React.FC<{
  content: React.ReactNode;
  rect: DOMRect;
  side: "top" | "bottom";
}> = ({ content, rect, side }) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tooltipRef.current) return;

    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const tooltipWidth = tooltipRef.current.offsetWidth || 320;
    const tooltipHeight = tooltipRef.current.offsetHeight || 120;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2 + scrollX;

    // Adjust side dynamically if it clips the top of the viewport
    const spaceOnTop = rect.top - tooltipHeight - 8;
    const computedSide = spaceOnTop < 10 ? "bottom" : side;

    let top = 0;
    if (computedSide === "top") {
      top = rect.top - tooltipHeight - 8 + scrollY;
    } else {
      top = rect.bottom + 8 + scrollY;
    }

    // Boundary check
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }

    setCoords({ top, left });
  }, [rect, side]);

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: "absolute",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 99999, // Render on top of everything including headers and modals
      }}
      className="bg-gray-900 text-white rounded-lg p-2.5 text-xs shadow-xl w-[280px] sm:w-[320px] whitespace-normal animate-in fade-in zoom-in-95 duration-100 border border-gray-800 pointer-events-none"
    >
      {content}
    </div>,
    document.body,
  );
};

// --- RENDER TOOLTIP CONTENT ---
const renderTooltipContent = (aggregatedSlots: RawSlotItem[]) => {
  return (
    <div className="text-xs space-y-2">
      {aggregatedSlots.map((slot: RawSlotItem, index: number) => {
        const sessionNum =
          slot.sessionIndex !== undefined ? slot.sessionIndex + 1 : 1;
        const examLabel = getSessionExamLabel(slot.className, sessionNum);
        const teacherNames = [
          slot.classItem?.teachers?.find((t: any) => t.role?.shortName === "LEC")
            ?.teacher?.fullName,
          slot.classItem?.teachers?.find((t: any) => t.role?.shortName === "TA")
            ?.teacher?.fullName,
        ]
          .filter(Boolean)
          .join(", ");

        const studentsCount = slot.classItem?.students?.length || slot.studentCount;

        return (
          <div
            key={`${slot.classId}-${index}`}
            className="border-t border-gray-700 pt-1.5 mt-1.5 first:border-t-0 first:pt-0 first:mt-0"
          >
            <p className="font-semibold text-white">{slot.className}</p>
            {examLabel && <p className="text-[11px] text-gray-300 font-medium">{examLabel}</p>}
            <p className="text-[11px] text-gray-400">
              Thời gian: {slot.startTime?.slice(0, 5)} -{" "}
              {slot.endTime?.slice(0, 5)}
            </p>
            {teacherNames && (
              <p className="text-[11px] text-gray-400">GV: {teacherNames}</p>
            )}
            {studentsCount !== undefined && (
              <p className="text-[11px] text-gray-400">HV: {studentsCount}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- MAIN COMPONENT ---
const WeeklyScheduleCalendar = forwardRef<
  FullCalendar,
  WeeklyScheduleCalendarProps
>((({ slots, onDatesSet, onEventClick }, ref) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tooltipState, setTooltipState] = useState<{
    eventId: string;
    content: React.ReactNode;
    rect: DOMRect;
    side: "top" | "bottom";
  } | null>(null);

  const events = useMemo(() => {
    const groupedEvents = new Map<string, RawSlotItem[]>();

    slots.forEach((item) => {
      let shiftedStartTime = item.startTime;
      try {
        const startHour = parseInt(item.startTime.split(":")[0], 10);
        if (startHour >= 14) {
          shiftedStartTime = `${String(startHour - 2).padStart(2, "0")}:${item.startTime.split(":")[1] || "00"}:${item.startTime.split(":")[2] || "00"}`;
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
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      let overallStatus = "teaching-class";
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
        classNames: [
          overallStatus,
          selectedEventId === slotKey ? "fc-event-selected" : "",
        ],
        extendedProps: { aggregatedSlots, status: overallStatus },
      });
    });

    return calendarEvents;
  }, [slots, selectedEventId]);

  const showTooltipForEvent = (eventId: string, aggregatedSlots: RawSlotItem[], startHour: number) => {
    const el = document.querySelector(`[data-event-id="${eventId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTooltipState({
        eventId,
        content: renderTooltipContent(aggregatedSlots),
        rect,
        side: startHour <= 10 ? "bottom" : "top",
      });
    }
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const clickedId = clickInfo.event.id;
    const newSelectedId = clickedId === selectedEventId ? null : clickedId;
    setSelectedEventId(newSelectedId);

    const { aggregatedSlots } = clickInfo.event.extendedProps;
    if (onEventClick && aggregatedSlots) {
      onEventClick(aggregatedSlots);
    }

    if (newSelectedId) {
      const firstSlot = aggregatedSlots[0];
      const startHour = firstSlot ? parseInt(firstSlot.startTime.split(":")[0], 10) : 8;
      // Wait a tick for classes to render/apply classNames if needed
      setTimeout(() => {
        showTooltipForEvent(clickedId, aggregatedSlots, startHour);
      }, 0);
    } else {
      setTooltipState(null);
    }
  };

  // CustomEventContent callback closures inside the component
  const CustomEventContent = (eventInfo: EventContentArg) => {
    const { aggregatedSlots } = eventInfo.event.extendedProps;
    if (!aggregatedSlots || aggregatedSlots.length === 0) return null;

    const firstSlot = aggregatedSlots[0];
    const startHour = firstSlot ? parseInt(firstSlot.startTime.split(":")[0], 10) : 8;

    const handleMouseEnter = (e: React.MouseEvent) => {
      // If there is any selected event, ignore hover on other events completely
      if (selectedEventId) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipState({
        eventId: eventInfo.event.id,
        content: renderTooltipContent(aggregatedSlots),
        rect,
        side: startHour <= 10 ? "bottom" : "top",
      });
    };

    const handleMouseLeave = () => {
      // If there is any selected event, ignore mouse leave events completely to lock the tooltip
      if (selectedEventId) {
        return;
      }
      setTooltipState(null);
    };

    const maxToShow = 4;
    const totalSlots = aggregatedSlots.length;
    const shouldTruncate = totalSlots > maxToShow;
    const visibleSlots = shouldTruncate
      ? aggregatedSlots.slice(0, maxToShow - 1)
      : aggregatedSlots;
    const remainingCount = totalSlots - visibleSlots.length;

    return (
      <div
        data-event-id={eventInfo.event.id}
        className="event-content-wrapper w-full h-full p-0.5 space-y-0.5 overflow-hidden flex flex-col justify-start"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {visibleSlots.map((slot: RawSlotItem, index: number) => {
          const sessionNum = slot.sessionIndex !== undefined ? slot.sessionIndex + 1 : 1;
          const examType = getSessionExamType(slot.className, sessionNum);
          const classStatus = slot.classItem?.status;
          const itemStatus = getEventStatus(examType, classStatus);
          const examLabel = getSessionExamLabel(slot.className, sessionNum);

          return (
            <div
              key={`${slot.classId}-${index}`}
              className={`event-list-item ${itemStatus}`}
            >
              <span className="text-[10px] font-bold block truncate leading-none">
                {slot.className}
              </span>
              <span className="text-[8px] opacity-75 font-semibold block mt-0.5 leading-none">
                {examLabel}
              </span>
            </div>
          );
        })}
        {shouldTruncate && (
          <div className="event-list-item bg-slate-200 text-slate-700 border border-slate-300 font-bold text-center py-1 text-[9px] rounded-md shadow-sm flex items-center justify-center">
            +{remainingCount} lớp khác
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[780px] w-full calendar-container">
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
        slotDuration="01:00:00"
        slotLabelInterval={{ hours: 1 }}
        slotLabelContent={(args: any) => {
          const hour = args.date.getHours();
          if (hour >= 12) {
            return `${hour + 2}:00`;
          }
          return `${String(hour).padStart(2, "0")}:00`;
        }}
        expandRows={true}
        events={events}
        eventContent={CustomEventContent}
        eventClick={handleEventClick}
        eventOverlap={false}
        nowIndicator={false}
      />

      {tooltipState && (
        <PortalTooltip
          content={tooltipState.content}
          rect={tooltipState.rect}
          side={tooltipState.side}
        />
      )}
    </div>
  );
}));

WeeklyScheduleCalendar.displayName = "WeeklyScheduleCalendar";
export default WeeklyScheduleCalendar;
