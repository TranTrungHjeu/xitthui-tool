"use client";

import React, { useMemo } from "react";
import { format, addDays, startOfWeek, parseISO, isSameDay } from "date-fns";
import { extractHHMM, extractDatePart } from "@/lib/date";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Schedule {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  classSite?: {
    class?: { name: string; numberOfSessions?: number };
    centre?: { name: string };
  };
  officeHour?: {
    type: string;
    centre?: { name: string };
  };
}

interface Teacher {
  id: string;
  fullName: string;
  code: string;
}

interface TeacherScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  schedules: Schedule[];
  weekStart: Date;
}

const START_HOUR = 8; // 8 AM
const END_HOUR = 22; // 10 PM
const TOTAL_HOURS = END_HOUR - START_HOUR; // 14 hours
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

export function TeacherScheduleModal({
  isOpen,
  onClose,
  teacher,
  schedules,
  weekStart,
}: TeacherScheduleModalProps) {
  const days = useMemo(() => {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekStart]);

  const getLocalTimeParts = (timeStr: string) => {
    if (!timeStr) return null;
    // Extract HH:mm directly — avoids timezone offset issues (+08:00 vs +07:00 from MindX)
    const hhmm = extractHHMM(timeStr);
    if (hhmm) return { hours: hhmm.hours, minutes: hhmm.minutes };
    return null;
  };

  const getLocalDate = (sch: Schedule) => {
    try {
      // Extract date part directly from string to avoid timezone date-shift issues
      if (sch.startTime && sch.startTime.includes("T")) {
        const dateStr = extractDatePart(sch.startTime);
        if (dateStr) return parseISO(dateStr);
      }
      if (sch.date) {
        const dateStr = extractDatePart(sch.date);
        if (dateStr) return parseISO(dateStr);
      }
      return null;
    } catch {
      return null;
    }
  };

  const processSchedules = (dayDate: Date) => {
    return schedules
      .filter((sch) => {
        const d = getLocalDate(sch);
        return d && isSameDay(d, dayDate);
      })
      .map((sch) => {
        const start = getLocalTimeParts(sch.startTime);
        const end = getLocalTimeParts(sch.endTime);

        if (!start || !end) return null;

        const startHour = start.hours + start.minutes / 60;
        const endHour = end.hours + end.minutes / 60;

        // Offset relative to START_HOUR as percentage
        const topPercent = ((startHour - START_HOUR) / TOTAL_HOURS) * 100;
        const heightPercent = ((endHour - startHour) / TOTAL_HOURS) * 100;

        const top = Math.max(0, Math.min(100, topPercent));
        const height = Math.max(1.5, Math.min(100 - top, heightPercent));

        return { ...sch, top, height, startHour, endHour };
      })
      .filter(Boolean) as (Schedule & {
      top: number;
      height: number;
      startHour: number;
      endHour: number;
    })[];
  };

  const getSessionLabel = (sch: Schedule): string => {
    if (!sch.title) return "";
    let info = sch.title;
    if (sch.classSite?.class?.name) {
      info = info.replace(sch.classSite.class.name, "");
    }
    info = info.replace(/^[\s-:]+|[\s-:]+$/g, "");
    // Standardize "buổi X/Y" to "Buổi X"
    info = info.replace(/buổi\s*(\d+)(?:\/\d+)?/i, "Buổi $1");
    return info;
  };

  const getScheduleStyle = (type: string) => {
    switch (type) {
      case "CLASS_SESSION":
        return "bg-orange-500 text-white border-orange-600";
      case "OFFICE_HOURS":
        return "bg-yellow-400 text-slate-900 border-yellow-500";
      case "AVAILABLE":
        return "bg-green-100 text-green-900 border-green-300";
      default:
        return "bg-slate-200 text-slate-800 border-slate-300";
    }
  };

  const formatTimeStr = (h: number, m: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    const min = m.toString().padStart(2, "0");
    return `${hr}:${min} ${period}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl lg:max-w-7xl p-0 gap-0 overflow-hidden bg-slate-50 flex flex-col h-[90vh] md:h-[85vh]">
        {/* Header Block */}
        <DialogHeader className="px-6 py-3 border-b bg-white shrink-0 shadow-sm z-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <DialogTitle className="text-base md:text-lg font-bold text-slate-800">
                Lịch làm việc: {teacher?.fullName}{" "}
                {teacher?.code ? `(${teacher.code})` : ""}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tuần: {format(days[0], "dd/MM/yyyy")} -{" "}
                {format(days[6], "dd/MM/yyyy")}
              </DialogDescription>
            </div>
            <div className="flex gap-3 text-[11px] font-medium text-slate-600 items-center">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-orange-500 border border-orange-600"></div>
                Lớp học
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400 border border-yellow-500"></div>
                Office Hours
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300"></div>
                Available
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Calendar Grid Container - No vertical scroll, full height */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col min-w-0">
          <div className="min-w-[850px] flex-1 flex flex-col bg-white">
            {/* Header row with Days */}
            <div className="flex border-b bg-slate-50/80 shrink-0 select-none">
              <div className="w-16 shrink-0 border-r border-slate-200"></div>
              <div className="flex-1 grid grid-cols-7">
                {days.map((day, i) => (
                  <div
                    key={i}
                    className="text-center py-2 border-r border-slate-200 last:border-r-0"
                  >
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {format(day, "EEE")}
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {format(day, "dd")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Body: fits the remaining space of the modal completely */}
            <div className="flex-1 flex relative min-h-0">
              {/* Time column */}
              <div className="w-16 shrink-0 border-r border-slate-200 bg-slate-50/30 flex flex-col justify-between py-1 relative select-none">
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className="relative text-[10px] text-slate-400 text-right pr-2 flex-1 flex items-start justify-end"
                  >
                    <span className="absolute -top-2.5 right-2">
                      {hour % 12 === 0 ? 12 : hour % 12}{" "}
                      {hour >= 12 ? "PM" : "AM"}
                    </span>
                  </div>
                ))}
                {/* Visual marker for the end boundary */}
                <div className="relative text-[10px] text-slate-400 text-right pr-2 h-0 flex items-start justify-end">
                  <span className="absolute -top-2 right-2">10 PM</span>
                </div>
              </div>

              {/* Days Columns & Background Lines */}
              <div className="flex-1 relative min-h-0 h-full">
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
                  {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="border-t border-slate-100 w-full flex-1 first:border-t-0"
                    />
                  ))}
                </div>

                {/* Day Columns wrapper */}
                <div className="grid grid-cols-7 h-full absolute inset-0">
                  {days.map((day, dayIndex) => {
                    const daySchedules = processSchedules(day);

                    return (
                      <div
                        key={dayIndex}
                        className="border-r border-slate-200 last:border-r-0 relative h-full"
                      >
                        {/* Render schedules for this day */}
                        {daySchedules.map((sch, i) => {
                          const startParts = getLocalTimeParts(sch.startTime);
                          const endParts = getLocalTimeParts(sch.endTime);
                          const startStr = startParts
                            ? formatTimeStr(
                                startParts.hours,
                                startParts.minutes,
                              )
                            : "";
                          const endStr = endParts
                            ? formatTimeStr(endParts.hours, endParts.minutes)
                            : "";

                          return (
                            <div
                              key={sch.id || i}
                              className={`absolute w-[94%] left-[3%] rounded border px-1.5 py-1 shadow-sm overflow-hidden flex flex-col gap-0.5 transition-all hover:scale-[1.02] hover:z-50 hover:shadow-md cursor-default ${getScheduleStyle(sch.type)}`}
                              style={{
                                top: `${sch.top}%`,
                                height: `${sch.height}%`,
                              }}
                              title={`${startStr} - ${endStr}\n${sch.title || sch.type}\nCơ sở: ${sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "—"}`}
                            >
                              <div className="text-[9px] opacity-90 font-medium leading-none truncate">
                                {startStr} - {endStr}
                              </div>
                              <div className="text-[10px] font-bold leading-tight line-clamp-2">
                                {sch.classSite?.class?.name ||
                                  (sch.type === "OFFICE_HOURS"
                                    ? "Office Hours"
                                    : sch.title || sch.type)}
                              </div>
                              {sch.type === "CLASS_SESSION" &&
                                getSessionLabel(sch) && (
                                  <div className="text-[9px] font-medium leading-none truncate opacity-90">
                                    {getSessionLabel(sch)}
                                  </div>
                                )}
                              <div className="text-[9px] leading-none opacity-80 mt-auto truncate">
                                {sch.classSite?.centre?.name ||
                                  sch.officeHour?.centre?.name ||
                                  sch.description ||
                                  ""}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
