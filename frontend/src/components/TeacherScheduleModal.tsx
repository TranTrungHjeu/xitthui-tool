"use client";

import React, { useMemo, useState, useEffect } from "react";
import { format, addDays, startOfWeek, parseISO, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import { extractHHMM, extractDatePart } from "@/lib/date";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, Clock, MapPin, List, LayoutGrid, Info, X } from "lucide-react";

interface Schedule {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  teacherRole?: string;
  classSite?: {
    class?: { name: string; numberOfSessions?: number };
    centre?: { id?: string; name: string };
  };
  officeHour?: {
    type: string;
    centre?: { id?: string; name: string };
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
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);

  const days = useMemo(() => {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekStart]);

  // Responsive default mode: on mobile (<768px), default to Day view
  useEffect(() => {
    if (!isOpen) return;
    const isMobile = window.innerWidth < 768;
    setViewMode(isMobile ? "day" : "week");

    // Try to highlight today if inside the week range
    const todayIndex = days.findIndex((d) => isSameDay(d, new Date()));
    if (todayIndex !== -1) {
      setSelectedDayIndex(todayIndex);
    } else {
      setSelectedDayIndex(0);
    }
  }, [isOpen, days]);

  const getLocalTimeParts = (timeStr: string) => {
    if (!timeStr) return null;
    const hhmm = extractHHMM(timeStr);
    if (hhmm) return { hours: hhmm.hours, minutes: hhmm.minutes };
    return null;
  };

  const getLocalDate = (sch: Schedule) => {
    try {
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

        const topPercent = ((startHour - START_HOUR) / TOTAL_HOURS) * 100;
        const heightPercent = ((endHour - startHour) / TOTAL_HOURS) * 100;

        const top = Math.max(0, Math.min(100, topPercent));
        const height = Math.max(2, Math.min(100 - top, heightPercent));

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
    info = info.replace(/buổi\s*(\d+)(?:\/\d+)?/i, "Buổi $1");
    return info;
  };

  const getScheduleStyle = (type: string) => {
    switch (type) {
      case "CLASS_SESSION":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25";
      case "OFFICE_HOURS":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/25";
      case "AVAILABLE":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25";
      default:
        return "bg-muted text-foreground border-border hover:bg-muted/80";
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case "CLASS_SESSION":
        return "bg-amber-500 text-white";
      case "OFFICE_HOURS":
        return "bg-blue-500 text-white";
      case "AVAILABLE":
        return "bg-emerald-500 text-white";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const formatTimeStr = (h: number, m: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    const min = m.toString().padStart(2, "0");
    return `${hr}:${min} ${period}`;
  };

  const formatHHMM = (timeStr: string) => {
    const parts = getLocalTimeParts(timeStr);
    if (!parts) return "—";
    const h = parts.hours.toString().padStart(2, "0");
    const m = parts.minutes.toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const getDayShortName = (day: Date, index: number) => {
    const names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    return names[index] || format(day, "EEE");
  };

  const selectedDaySchedules = useMemo(() => {
    if (selectedDayIndex < 0 || selectedDayIndex >= days.length) return [];
    return processSchedules(days[selectedDayIndex]).sort((a, b) => a.startHour - b.startHour);
  }, [selectedDayIndex, days, schedules]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[95vw] md:max-w-6xl lg:max-w-7xl p-0 gap-0 overflow-hidden bg-background flex flex-col h-[92vh] md:h-[85vh] rounded-2xl border border-border shadow-2xl">
          {/* Header Block */}
          <DialogHeader className="px-4 py-3 md:px-6 md:py-4 border-b bg-card shrink-0 shadow-sm z-10">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base md:text-lg font-bold text-foreground truncate flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                  <span>
                    Lịch làm việc: <span className="text-primary">{teacher?.fullName}</span>{" "}
                    {teacher?.code ? `(${teacher.code})` : ""}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Tuần từ {format(days[0], "dd/MM/yyyy")} đến {format(days[6], "dd/MM/yyyy")}
                </DialogDescription>
              </div>

              {/* Controls & Legend */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
                {/* View Switcher */}
                <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
                  <button
                    onClick={() => setViewMode("day")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      viewMode === "day"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    Theo ngày
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      viewMode === "week"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Cả tuần
                  </button>
                </div>

                {/* Legend badges (desktop) */}
                <div className="hidden lg:flex gap-3 text-[11px] font-medium text-foreground items-center bg-muted/50 px-3 py-1 rounded-lg border border-border/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div>
                    <span>Lớp học</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>
                    <span>Office Hours</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div>
                    <span>Available</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* DAY AGENDA VIEW (Mobile/Tablet Friendly) */}
          {viewMode === "day" && (
            <div className="flex-1 flex flex-col min-h-0 bg-card overflow-hidden">
              {/* Day Selector Tabs */}
              <div className="px-3 py-2 border-b bg-muted/30 shrink-0 overflow-x-auto custom-scrollbar flex gap-1.5">
                {days.map((day, idx) => {
                  const isSelected = selectedDayIndex === idx;
                  const isToday = isSameDay(day, new Date());
                  const daySchedCount = processSchedules(day).length;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`flex-1 min-w-[68px] py-2 px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-medium border ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-md border-primary scale-[1.02]"
                          : isToday
                          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                          : "bg-card text-foreground hover:bg-muted border-border/70"
                      }`}
                    >
                      <span className={`text-[10px] tracking-wider uppercase opacity-80 ${isSelected ? "text-primary-foreground" : ""}`}>
                        {getDayShortName(day, idx)}
                      </span>
                      <span className="text-sm font-bold leading-tight">{format(day, "dd/MM")}</span>
                      {daySchedCount > 0 && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold mt-0.5 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {daySchedCount} ca
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Agenda Content */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Lịch ngày {format(days[selectedDayIndex], "EEEE, dd/MM/yyyy", { locale: vi })}
                    </h3>
                    <span className="text-xs text-muted-foreground font-medium">
                      Tổng số: {selectedDaySchedules.length} ca dạy/trực
                    </span>
                  </div>

                  {selectedDaySchedules.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2 bg-muted/20 rounded-2xl border border-dashed border-border/80">
                      <Clock className="h-8 w-8 text-muted-foreground/50 stroke-1" />
                      <p className="text-xs font-medium">Không có ca dạy hoặc lịch trực nào trong ngày này.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {selectedDaySchedules.map((sch) => {
                        const startParts = getLocalTimeParts(sch.startTime);
                        const endParts = getLocalTimeParts(sch.endTime);
                        const startStr = startParts ? formatTimeStr(startParts.hours, startParts.minutes) : "";
                        const endStr = endParts ? formatTimeStr(endParts.hours, endParts.minutes) : "";

                        return (
                          <div
                            key={sch.id}
                            onClick={() => setViewingSchedule(sch)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${getScheduleStyle(sch.type)}`}
                          >
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTypeBadgeStyle(sch.type)}`}>
                                  {sch.type === "CLASS_SESSION" ? "Lớp học" : sch.type === "OFFICE_HOURS" ? "Office Hours" : sch.type}
                                </span>
                                {sch.teacherRole && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-card/80 text-foreground border border-border/80">
                                    {sch.teacherRole === "MAIN_TEACHER" ? "GV chính" : sch.teacherRole === "TUTOR" ? "Trợ giảng" : sch.teacherRole}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-bold text-foreground leading-snug">
                                {sch.classSite?.class?.name || (sch.type === "OFFICE_HOURS" ? "Lịch trực văn phòng" : sch.title || sch.type)}
                              </h4>

                              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-foreground/80 font-medium">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>{formatHHMM(sch.startTime)} - {formatHHMM(sch.endTime)} ({startStr} - {endStr})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>{sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "—"}</span>
                                </div>
                              </div>

                              {sch.type === "CLASS_SESSION" && getSessionLabel(sch) && (
                                <p className="text-xs font-semibold text-primary">
                                  {getSessionLabel(sch)}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center justify-end">
                              <span className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                                <Info className="h-3.5 w-3.5" /> Chi tiết
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* WEEK GRID VIEW (Desktop/Tablet Timetable) */}
          {viewMode === "week" && (
            <div className="flex-1 overflow-x-auto overflow-y-auto flex flex-col min-w-0 bg-card custom-scrollbar">
              <div className="min-w-[850px] flex-1 flex flex-col min-h-[550px]">
                {/* Header row with Days */}
                <div className="flex border-b bg-muted/40 shrink-0 select-none sticky top-0 z-20 shadow-xs">
                  <div className="w-16 shrink-0 border-r border-border bg-muted/60"></div>
                  <div className="flex-1 grid grid-cols-7">
                    {days.map((day, i) => (
                      <div
                        key={i}
                        className={`text-center py-2 border-r border-border last:border-r-0 ${
                          isSameDay(day, new Date()) ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                          {getDayShortName(day, i)}
                        </div>
                        <div className={`text-sm font-bold ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"}`}>
                          {format(day, "dd/MM")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grid Body */}
                <div className="flex-1 flex relative min-h-[500px]">
                  {/* Time column */}
                  <div className="w-16 shrink-0 border-r border-border bg-muted/30 flex flex-col justify-between py-1 relative select-none z-10">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="relative text-[10px] text-muted-foreground font-medium text-right pr-2 flex-1 flex items-start justify-end"
                      >
                        <span className="absolute -top-2.5 right-2">
                          {hour % 12 === 0 ? 12 : hour % 12} {hour >= 12 ? "PM" : "AM"}
                        </span>
                      </div>
                    ))}
                    <div className="relative text-[10px] text-muted-foreground font-medium text-right pr-2 h-0 flex items-start justify-end">
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
                          className="border-t border-border/50 w-full flex-1 first:border-t-0"
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
                            className={`border-r border-border last:border-r-0 relative h-full ${
                              isSameDay(day, new Date()) ? "bg-primary/[0.02]" : ""
                            }`}
                          >
                            {daySchedules.map((sch, i) => {
                              const startParts = getLocalTimeParts(sch.startTime);
                              const endParts = getLocalTimeParts(sch.endTime);
                              const startStr = startParts
                                ? formatTimeStr(startParts.hours, startParts.minutes)
                                : "";
                              const endStr = endParts
                                ? formatTimeStr(endParts.hours, endParts.minutes)
                                : "";

                              return (
                                <div
                                  key={sch.id || i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingSchedule(sch);
                                  }}
                                  className={`absolute w-[94%] left-[3%] rounded-lg border px-2 py-1.5 shadow-xs overflow-hidden flex flex-col gap-0.5 transition-all hover:scale-[1.02] hover:z-30 hover:shadow-md cursor-pointer ${getScheduleStyle(
                                    sch.type
                                  )}`}
                                  style={{
                                    top: `${sch.top}%`,
                                    height: `${sch.height}%`,
                                  }}
                                >
                                  <div className="text-[9px] font-bold leading-none truncate opacity-90">
                                    {formatHHMM(sch.startTime)} - {formatHHMM(sch.endTime)}
                                  </div>
                                  <div className="text-[10px] font-extrabold leading-tight line-clamp-2 mt-0.5">
                                    {sch.classSite?.class?.name ||
                                      (sch.type === "OFFICE_HOURS"
                                        ? "Office Hours"
                                        : sch.title || sch.type)}
                                  </div>
                                  {sch.type === "CLASS_SESSION" && getSessionLabel(sch) && (
                                    <div className="text-[9px] font-semibold leading-none truncate opacity-90">
                                      {getSessionLabel(sch)}
                                    </div>
                                  )}
                                  <div className="text-[8.5px] leading-none opacity-80 mt-auto truncate font-medium">
                                    {sch.classSite?.centre?.name ||
                                      sch.officeHour?.centre?.name ||
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
          )}

          {/* Modal Sticky Bottom Footer with Close Button */}
          <div className="px-4 py-3 bg-card border-t border-border/80 flex items-center justify-between gap-3 shrink-0 shadow-xs z-10">
            {/* Legend summary for small screens */}
            <div className="flex lg:hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span>Lớp học</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Office Hours</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span>Available</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="ml-auto w-full sm:w-auto font-bold hover:bg-muted text-foreground flex items-center justify-center gap-1.5 px-5 shadow-xs"
            >
              <X className="h-4 w-4" />
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAIL MODAL FOR CLICKED SCHEDULE ITEM */}
      <Dialog
        open={!!viewingSchedule}
        onOpenChange={(open) => {
          if (!open) setViewingSchedule(null);
        }}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Chi tiết lịch dạy / trực
            </DialogTitle>
          </DialogHeader>

          {viewingSchedule && (
            <div className="space-y-4 pt-2 text-xs">
              <div className={`p-3.5 rounded-xl border ${getScheduleStyle(viewingSchedule.type)} space-y-1`}>
                <p className="font-extrabold text-sm">
                  {viewingSchedule.classSite?.class?.name ||
                    (viewingSchedule.type === "OFFICE_HOURS" ? "Lịch trực văn phòng" : viewingSchedule.type)}
                </p>
                <p className="text-[11px] font-bold opacity-90">
                  {viewingSchedule.type === "OFFICE_HOURS"
                    ? viewingSchedule.officeHour?.type || "OFFICE"
                    : getSessionLabel(viewingSchedule) || viewingSchedule.title}
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground font-medium">Giáo viên:</span>
                  <span className="text-foreground font-bold text-right">
                    {teacher?.fullName} {teacher?.code ? `(${teacher.code})` : ""}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Thời gian:</span>
                  <span className="text-foreground font-bold font-mono">
                    {formatHHMM(viewingSchedule.startTime)} - {formatHHMM(viewingSchedule.endTime)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Cơ sở:</span>
                  <span className="text-foreground font-semibold text-right">
                    {viewingSchedule.classSite?.centre?.name || viewingSchedule.officeHour?.centre?.name || "—"}
                  </span>
                </div>

                {viewingSchedule.teacherRole && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Vai trò:</span>
                    <span className="text-foreground font-semibold">
                      {viewingSchedule.teacherRole === "MAIN_TEACHER" ? "Giáo viên chính" : viewingSchedule.teacherRole === "TUTOR" ? "Trợ giảng" : viewingSchedule.teacherRole}
                    </span>
                  </div>
                )}

                {viewingSchedule.description && (
                  <div className="space-y-1 pt-2 border-t border-border/40">
                    <p className="text-muted-foreground font-medium">Ghi chú / Nội dung:</p>
                    <p className="text-foreground bg-muted/50 p-2.5 rounded-lg border border-border/60 whitespace-pre-wrap leading-normal">
                      {viewingSchedule.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingSchedule(null)}
                  className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
