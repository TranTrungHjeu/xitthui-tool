"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  TableProperties,
  RefreshCw,
  Loader2,
  Calendar,
  Copy,
  Check,
  Search,
  User,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Gavel,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import CatLoader from "../../../components/CatLoader";
import api from "../../../services/api";
import { useMinLoading } from "@/hooks/useMinLoading";
import { useAuthStore } from "../../../store/useAuthStore";
import { Input } from "../../../components/ui/input";
import { formatSlotDateTime, isActualKhiemAccount } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { SubstituteTab } from "../../../components/SubstituteTab";
import { ExaminerTab } from "../../../components/ExaminerTab";
import { AlertModal } from "../../../components/ui/alert-modal";
import {
  startOfMonth,
  subMonths,
  addMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { vi } from "date-fns/locale";

interface SheetData {
  headers: string[];
  data: Record<string, string>[];
  sheetName: string;
  availableSheets?: string[];
}

export type SpreadsheetTabKey = "sheet" | "trial" | "substitute" | "examiner";

function CustomDatePicker({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const monthName = format(currentMonth, "MMMM, yyyy", { locale: vi });

  return (
    <div className="p-3 bg-card rounded-xl shadow-xl border border-border/80 w-[280px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground capitalize">
          {monthName}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-[11px] font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(day);
                onClose();
              }}
              className={`h-8 w-8 rounded-md flex items-center justify-center text-xs transition-colors
                ${!isCurrentMonth ? "text-muted-foreground/70" : "text-foreground hover:bg-muted"}
                ${isSelected ? "bg-primary text-white hover:bg-primary/90 font-bold shadow-sm" : ""}
                ${isToday && !isSelected ? "text-primary font-bold bg-primary/10" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SpreadsheetPage() {
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SpreadsheetTabKey>("trial");

  // --- TAB: Google Sheet View ---
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sheetDataCache = useRef<Map<string, SheetData>>(new Map());
  const sheetFetchedKeys = useRef<Set<string>>(new Set());

  const showLoading = useMinLoading(isLoading, 1000);

  const sheetContainerRef = useRef<HTMLDivElement>(null);
  const isSheetDragging = useRef(false);
  const isSheetDraggingActive = useRef(false);
  const sheetStartX = useRef(0);
  const sheetScrollLeftStart = useRef(0);

  const handleSheetDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("[role='menuitem']")
    ) {
      return;
    }
    isSheetDragging.current = true;
    isSheetDraggingActive.current = false;
    if (sheetContainerRef.current) {
      sheetContainerRef.current.style.cursor = "grabbing";
      sheetContainerRef.current.style.userSelect = "none";
    }
    sheetStartX.current = e.pageX - (sheetContainerRef.current?.offsetLeft || 0);
    sheetScrollLeftStart.current = sheetContainerRef.current?.scrollLeft || 0;
  };

  const handleSheetDragMouseUpOrLeave = () => {
    if (!isSheetDragging.current) return;
    isSheetDragging.current = false;
    if (sheetContainerRef.current) {
      sheetContainerRef.current.style.cursor = "grab";
      sheetContainerRef.current.style.userSelect = "";
    }
    setTimeout(() => {
      isSheetDraggingActive.current = false;
    }, 50);
  };

  const handleSheetDragMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSheetDragging.current) return;
    const x = e.pageX - (sheetContainerRef.current?.offsetLeft || 0);
    const walk = (x - sheetStartX.current) * 1.5;

    if (Math.abs(x - sheetStartX.current) > 5) {
      isSheetDraggingActive.current = true;
    }

    e.preventDefault();
    if (sheetContainerRef.current) {
      sheetContainerRef.current.scrollLeft = sheetScrollLeftStart.current - walk;
    }
  };

  const handleSheetClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSheetDraggingActive.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const trialsContainerRef = useRef<HTMLDivElement>(null);
  const isTrialsDragging = useRef(false);
  const isTrialsDraggingActive = useRef(false);
  const trialsStartX = useRef(0);
  const trialsScrollLeftStart = useRef(0);

  const handleTrialsDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("[role='menuitem']")
    ) {
      return;
    }
    isTrialsDragging.current = true;
    isTrialsDraggingActive.current = false;
    if (trialsContainerRef.current) {
      trialsContainerRef.current.style.cursor = "grabbing";
      trialsContainerRef.current.style.userSelect = "none";
    }
    trialsStartX.current = e.pageX - (trialsContainerRef.current?.offsetLeft || 0);
    trialsScrollLeftStart.current = trialsContainerRef.current?.scrollLeft || 0;
  };

  const handleTrialsDragMouseUpOrLeave = () => {
    if (!isTrialsDragging.current) return;
    isTrialsDragging.current = false;
    if (trialsContainerRef.current) {
      trialsContainerRef.current.style.cursor = "grab";
      trialsContainerRef.current.style.userSelect = "";
    }
    setTimeout(() => {
      isTrialsDraggingActive.current = false;
    }, 50);
  };

  const handleTrialsDragMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTrialsDragging.current) return;
    const x = e.pageX - (trialsContainerRef.current?.offsetLeft || 0);
    const walk = (x - trialsStartX.current) * 1.5;

    if (Math.abs(x - trialsStartX.current) > 5) {
      isTrialsDraggingActive.current = true;
    }

    e.preventDefault();
    if (trialsContainerRef.current) {
      trialsContainerRef.current.scrollLeft = trialsScrollLeftStart.current - walk;
    }
  };

  const handleTrialsClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTrialsDraggingActive.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const fetchSheetData = async (sheetName?: string, force = false) => {
    const key = sheetName || "";
    if (!force && sheetFetchedKeys.current.has(key)) {
      const cached = sheetDataCache.current.get(key);
      if (cached) {
        setSheetData(cached);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    try {
      const url = sheetName
        ? `/spreadsheet/data?range=${encodeURIComponent(sheetName)}`
        : "/spreadsheet/data";
      const response = await api.get(url);
      if (response.data.success) {
        setSheetData(response.data);
        sheetDataCache.current.set(key, response.data);
        sheetFetchedKeys.current.add(key);
      } else {
        throw new Error(response.data.error || "Không thể tải dữ liệu.");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Lỗi kết nối máy chủ.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "sheet") {
      fetchSheetData(activeSheet || undefined);
    }
  }, [activeSheet, activeTab]);

  // --- TAB: Trial Booking Tool ---
  const getTodayDateStr = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const findNearestDate = (dates: string[], targetDateStr: string): string => {
    if (dates.length === 0) return targetDateStr;
    if (dates.includes(targetDateStr)) return targetDateStr;

    const targetTime = new Date(targetDateStr).getTime();
    let nearestDate = dates[0];
    let minDiff = Math.abs(new Date(nearestDate).getTime() - targetTime);

    for (let i = 1; i < dates.length; i++) {
      const diff = Math.abs(new Date(dates[i]).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        nearestDate = dates[i];
      }
    }
    return nearestDate;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [lastDefaultedSheet, setLastDefaultedSheet] = useState<string>("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [trialsData, setTrialsData] = useState<any[]>([]);
  const [isTrialsLoading, setIsTrialsLoading] = useState(false);
  const [trialsError, setTrialsError] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const trialsDataCache = useRef<
    Map<string, { trials: any[]; sheetName: string; datesWithTrials: any[] }>
  >(new Map());
  const trialsFetchedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(e.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const showTrialsLoading = useMinLoading(isTrialsLoading, 1000);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const fetchTrialAvailabilities = async (silent = false, force = false) => {
    if (!token) return;
    let centres: any[] = user?.teacherCentres || [];
    if (isActualKhiemAccount(user)) {
      const tdmCentre = centres.find((c: any) => {
        const name = typeof c === "object" ? c?.name || c?.shortName : String(c);
        return (name || "").toLowerCase().includes("thủ dầu một");
      });
      if (tdmCentre) {
        centres = [tdmCentre];
      }
    }

    const userCentres = centres
      .map((c: any) => (typeof c === "object" ? c.id : c))
      .filter(Boolean)
      .join(",") || "6443460f94300678908f7974";

    const cacheKey = `${selectedDate}|${userCentres}`;
    if (!force && trialsFetchedKeys.current.has(cacheKey)) {
      const cached = trialsDataCache.current.get(cacheKey);
      if (cached) {
        setTrialsData(cached.trials || []);
        return;
      }
    }

    if (!silent) setIsTrialsLoading(true);
    setTrialsError(null);
    try {
      const response = await api.get(
        `/spreadsheet/trial-availabilities?dateStr=${selectedDate}&centreIds=${userCentres}`,
      );
      if (response.data.success) {
        const trials = response.data.trials || [];
        setTrialsData(trials);

        trialsDataCache.current.set(cacheKey, {
          trials,
          sheetName: response.data.sheetName || "",
          datesWithTrials: response.data.datesWithTrials || [],
        });
        trialsFetchedKeys.current.add(cacheKey);

        const sheetName = response.data.sheetName || "";
        if (sheetName && sheetName !== lastDefaultedSheet) {
          setLastDefaultedSheet(sheetName);
          const dates = response.data.datesWithTrials || [];
          if (dates.length > 0) {
            const baseDate = lastDefaultedSheet === "" ? getTodayDateStr() : selectedDate;
            const nearest = findNearestDate(dates, baseDate);
            if (nearest !== selectedDate) {
              setSelectedDate(nearest);
            }
          }
        }
      } else {
        throw new Error(response.data.error || "Không thể tải danh sách trial.");
      }
    } catch (err: any) {
      setTrialsError(err.response?.data?.error || err.message || "Lỗi kết nối.");
    } finally {
      if (!silent) setIsTrialsLoading(false);
    }
  };

  const handlePrevDay = () => {
    const parts = selectedDate.split("-");
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() - 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    const parts = selectedDate.split("-");
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const handleToday = () => {
    setSelectedDate(getTodayDateStr());
  };

  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

  const handleAssignTeacher = async (trial: any, teacher: any) => {
    const slotId = trial.slotId;
    setIsSaving((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await api.post("/spreadsheet/trial-bookings/assign", {
        dateStr: selectedDate,
        slotId,
        teacherId: teacher.id,
        teacherCode: teacher.code,
        teacherName: teacher.fullName,
        timeSlot: trial.timeSlot,
        normalizedTime: trial.normalizedTime,
        subject: trial.subject,
        type: trial.type,
        roomLink: trial.roomLink,
        students: trial.students,
        rowIndex: trial.rowIndex,
      });

      if (response.data.success) {
        await fetchTrialAvailabilities(true, true);
      } else {
        throw new Error(response.data.error || "Lỗi khi lưu phân công.");
      }
    } catch (err: any) {
      alert(err.message || "Lỗi kết nối máy chủ khi lưu.");
    } finally {
      setIsSaving((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const handleUnassignTeacher = async (trial: any) => {
    const slotId = trial.slotId;
    setIsSaving((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await api.post("/spreadsheet/trial-bookings/unassign", {
        dateStr: selectedDate,
        slotId,
      });

      if (response.data.success) {
        await fetchTrialAvailabilities(true, true);
      } else {
        throw new Error(response.data.error || "Lỗi khi xóa phân công.");
      }
    } catch (err: any) {
      alert(err.message || "Lỗi kết nối máy chủ khi xóa.");
    } finally {
      setIsSaving((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  useEffect(() => {
    if (activeTab === "trial") {
      fetchTrialAvailabilities();
    }
  }, [selectedDate, activeTab]);

  // Google Sheet columns filter logic
  const HIDDEN_COLUMNS = [
    "Link phòng",
    "Column_12",
    "Tình trạng FILL",
    "FILL sheet",
    "Hủy",
    "Approved",
  ];
  const visibleHeaders =
    sheetData?.headers
      ?.slice(1)
      .filter(
        (header) => !HIDDEN_COLUMNS.some((hidden) => header.includes(hidden)),
      ) || [];

  const userCentres = (() => {
    let centres: any[] = user?.teacherCentres || [];
    if (isActualKhiemAccount(user)) {
      const tdmCentre = centres.find((c: any) => {
        const name = typeof c === "object" ? c?.name || c?.shortName : String(c);
        return (name || "").toLowerCase().includes("thủ dầu một");
      });
      if (tdmCentre) centres = [tdmCentre];
    }
    return (
      centres
        .map((c: any) => (typeof c === "object" ? c.id : c))
        .filter(Boolean)
        .join(",") || "6443460f94300678908f7974"
    );
  })();

  const handleSubstituteError = (msg: string | null) => {
    if (activeTab === "substitute") setTrialsError(msg);
  };

  const handleExaminerError = (msg: string | null) => {
    if (activeTab === "examiner") setTrialsError(msg);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 h-[calc(100vh-76px)] md:h-screen overflow-hidden flex flex-col bg-background">
      {/* Errors and successes are surfaced via <AlertModal>; the
          inline banner was removed in favour of a consistent modal. */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as SpreadsheetTabKey)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <TabsList className="self-start shrink-0">
            <TabsTrigger value="trial" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Book Trial</span>
              <span className="sm:hidden">Trial</span>
            </TabsTrigger>
            <TabsTrigger value="substitute" className="gap-1.5">
              <UserCog className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Book dạy thay</span>
              <span className="sm:hidden">Dạy thay</span>
            </TabsTrigger>
            <TabsTrigger value="examiner" className="gap-1.5">
              <Gavel className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Book giám khảo</span>
              <span className="sm:hidden">GK</span>
            </TabsTrigger>
            <TabsTrigger value="sheet" className="gap-1.5">
              <TableProperties className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bảng tính</span>
              <span className="sm:hidden">Sheet</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {activeTab === "sheet" && (
              <Button
                onClick={() => fetchSheetData(activeSheet || undefined, true)}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
            )}

            {activeTab === "trial" && (
              <Button
                onClick={() => fetchTrialAvailabilities(false, true)}
                disabled={isTrialsLoading}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTrialsLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="sheet" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="flex-1 border border-border bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
            {showLoading && !sheetData ? (
              <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center min-h-[60vh]">
                <CatLoader />
              </div>
            ) : (
              <div
                ref={sheetContainerRef}
                className="overflow-auto flex-1 custom-scrollbar no-vertical-scrollbar cursor-grab"
                onMouseDown={handleSheetDragMouseDown}
                onMouseMove={handleSheetDragMouseMove}
                onMouseUp={handleSheetDragMouseUpOrLeave}
                onMouseLeave={handleSheetDragMouseUpOrLeave}
                onClickCapture={handleSheetClickCapture}
              >
                <table className="w-max min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-40 bg-muted shadow-[0_1px_0_#e2e8f0]">
                    <tr>
                      <th className="border-r border-b border-border bg-muted w-10 text-center text-foreground font-bold py-1 px-1.5 sticky left-0 z-50">
                        #
                      </th>
                      {visibleHeaders.map((header, idx) => {
                        const headerColors = [
                          "bg-blue-100",
                          "bg-indigo-100",
                          "bg-purple-100",
                          "bg-fuchsia-100",
                          "bg-pink-100",
                          "bg-rose-100",
                          "bg-orange-100",
                          "bg-amber-100",
                          "bg-yellow-100",
                          "bg-lime-100",
                          "bg-green-100",
                          "bg-emerald-100",
                          "bg-teal-100",
                          "bg-cyan-100",
                          "bg-sky-100",
                        ];
                        const colorClass = headerColors[idx % headerColors.length];
                        return (
                          <th
                            key={idx}
                            className={`border-r border-b border-border text-foreground font-bold py-1 px-2 whitespace-nowrap min-w-[120px] ${colorClass}`}
                          >
                            {header}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-card">
                    {sheetData?.data?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={visibleHeaders.length + 1}
                          className="text-center py-8 text-muted-foreground border-b border-border"
                        >
                          Không có dữ liệu trong bảng tính này.
                        </td>
                      </tr>
                    ) : (
                      sheetData?.data
                        ?.filter((row) =>
                          visibleHeaders.some(
                            (h) => row[h] && row[h].trim() !== "",
                          ),
                        )
                        .map((row, rowIdx) => {
                          const firstColData = row[visibleHeaders[0]] || "";
                          const secondColData = row[visibleHeaders[1]] || "";
                          const thirdColData = row[visibleHeaders[2]] || "";
                          const isDayRow =
                              (/\d{1,2}\/\d{1,2}/.test(firstColData) ||
                                firstColData.trim().length > 0) &&
                              secondColData.trim() === "" &&
                              thirdColData.trim() === "";

                          return (
                            <tr
                              key={rowIdx}
                              className={`transition-colors ${
                                isDayRow
                                  ? "bg-blue-100/50"
                                  : rowIdx % 2 === 0
                                    ? "bg-card hover:bg-muted/50"
                                    : "bg-muted/50 hover:bg-muted/50"
                              }`}
                            >
                              <td
                                className={`border-r border-b border-border text-center font-bold py-1 px-1.5 sticky left-0 z-30 ${
                                  isDayRow
                                    ? "bg-blue-200 text-blue-800"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {rowIdx + 1}
                              </td>
                              {visibleHeaders.map((header, colIdx) => {
                                const cellData = row[header] || "";
                                const cellColors = [
                                  "bg-blue-50/50",
                                  "bg-indigo-50/50",
                                  "bg-purple-50/50",
                                  "bg-fuchsia-50/50",
                                  "bg-pink-50/50",
                                  "bg-rose-50/50",
                                  "bg-orange-50/50",
                                  "bg-amber-50/50",
                                  "bg-yellow-50/50",
                                  "bg-lime-50/50",
                                  "bg-green-50/50",
                                  "bg-emerald-50/50",
                                  "bg-teal-50/50",
                                  "bg-cyan-50/50",
                                  "bg-sky-50/50",
                                ];
                                const bgColorClass =
                                  cellColors[colIdx % cellColors.length];

                                let displayData = cellData;
                                let cellClass = `border-r border-b border-border py-1 px-2 text-foreground font-medium break-words ${
                                  isDayRow ? "" : bgColorClass
                                }`;

                                const isDateCell =
                                  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(
                                    cellData.trim(),
                                  );

                                if (isDayRow || isDateCell) {
                                  cellClass +=
                                    " font-extrabold text-xs text-blue-900 bg-blue-100/60";
                                } else if (
                                  cellData === "TRUE" ||
                                  cellData === "TRUE " ||
                                  cellData === "true"
                                ) {
                                  displayData = "✓";
                                  cellClass = `border-r border-b border-border py-1 px-2 text-emerald-600 font-bold text-center bg-emerald-100/60`;
                                } else if (
                                  cellData === "FALSE" ||
                                  cellData === "FALSE " ||
                                  cellData === "false"
                                ) {
                                  displayData = "✗";
                                  cellClass = `border-r border-b border-border py-1 px-2 text-rose-500 font-bold text-center bg-rose-100/60`;
                                }

                                return (
                                  <td
                                    key={colIdx}
                                    className={cellClass}
                                    title={cellData}
                                  >
                                    {displayData}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trial" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="flex-1 border border-border bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
              <div className="p-1 sm:p-1.5 bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden sm:inline">Ngày trực:</span>
                  <div className="flex items-center bg-card border border-border rounded-lg shadow-sm h-8 transition-all hover:border-border justify-between flex-1 sm:flex-none">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-full w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-none rounded-l-lg"
                      onClick={handlePrevDay}
                      title="Ngày trước"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>

                    <div
                      className="relative h-full border-x border-border flex-1 sm:flex-none"
                      ref={datePickerRef}
                    >
                      <div
                        onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                        className={`flex items-center justify-center gap-1.5 px-3 h-full hover:bg-muted/50 transition-colors cursor-pointer min-w-[110px] sm:min-w-[125px] select-none text-[11px] font-bold text-foreground ${isDatePickerOpen ? "bg-muted/50 ring-1 ring-primary/20" : ""}`}
                      >
                        <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{selectedDate ? format(new Date(selectedDate), "dd/MM/yyyy") : ""}</span>
                      </div>

                      {isDatePickerOpen && (
                        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50">
                          <CustomDatePicker
                            selectedDate={new Date(selectedDate)}
                            onSelect={(date) => {
                              const offset = date.getTimezoneOffset();
                              const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                              setSelectedDate(localDate.toISOString().split('T')[0]);
                            }}
                            onClose={() => setIsDatePickerOpen(false)}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-full w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-none"
                      onClick={handleNextDay}
                      title="Ngày tiếp theo"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>

                    <div className="h-full border-l border-border">
                      <Button
                        variant="ghost"
                        className="h-full px-2 text-[10px] font-extrabold text-primary hover:bg-primary/10 rounded-none rounded-r-lg"
                        onClick={handleToday}
                      >
                        H.Nay
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Tìm giáo viên..."
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    className="pl-8 h-8 text-[11px] bg-card w-full"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-1.5 sm:p-2.5 relative min-h-0 flex flex-col">
                {showTrialsLoading ? (
                  <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center">
                    <CatLoader />
                  </div>
                ) : trialsData.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-card rounded-xl border border-border/60 p-6 shadow-sm">
                    <User className="h-8 w-8 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium text-foreground">
                      Không có ca trực Trial nào được ghi nhận trong ngày này
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hãy kiểm tra lịch trên Google Sheets hoặc chọn ngày khác
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    {!isMobile ? (
                      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex flex-col h-full">
                        <div
                          ref={trialsContainerRef}
                          className="overflow-auto flex-1 custom-scrollbar no-vertical-scrollbar cursor-grab"
                          onMouseDown={handleTrialsDragMouseDown}
                          onMouseMove={handleTrialsDragMouseMove}
                          onMouseUp={handleTrialsDragMouseUpOrLeave}
                          onMouseLeave={handleTrialsDragMouseUpOrLeave}
                          onClickCapture={handleTrialsClickCapture}
                        >
                          <table className="w-full min-w-[700px] md:min-w-full border-collapse text-xs text-left">
                            <thead className="bg-muted sticky top-0 z-10 border-b border-border">
                              <tr>
                                <th className="py-2 px-3 font-bold text-foreground w-[15%] text-[11px]">Thời gian</th>
                                <th className="py-2 px-3 font-bold text-foreground w-[25%] text-[11px]">Thông tin ca</th>
                                <th className="py-2 px-3 font-bold text-foreground w-[30%] text-[11px]">Học viên</th>
                                <th className="py-2 px-3 font-bold text-foreground w-[30%] text-[11px]">Giáo viên trực</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {trialsData.map((trial, idx) => {
                                let present = trial.availabilities?.presentAtBranch || [];
                                let absent = trial.availabilities?.notPresentAtBranch || [];
                                const assigned = trial.assignedTeacher;
                                const slotId = trial.slotId;
                                const saving = isSaving[slotId];

                                if (teacherSearch.trim() !== "") {
                                  const q = teacherSearch.toLowerCase();
                                  present = present.filter(
                                    (t: any) => t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
                                  );
                                  absent = absent.filter(
                                    (t: any) => t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
                                  );
                                }

                                return (
                                  <tr key={idx} className="hover:bg-muted/50/40 transition-colors group">
                                    <td className="py-2 px-3 align-top">
                                      <span className="inline-flex items-center justify-center text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                        {trial.timeSlot}
                                      </span>
                                    </td>

                                    <td className="py-2 px-3 align-top space-y-1">
                                      <h4 className="font-bold text-foreground text-xs leading-tight">
                                        {trial.subject === "Trống" ? (
                                          <span className="text-muted-foreground italic font-medium">Khung giờ trống</span>
                                        ) : (
                                          `${trial.subject} (${trial.type})`
                                        )}
                                      </h4>

                                      {trial.rowIndex ? (
                                        <span className="inline-block text-[8.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-1 py-0.25 rounded">
                                          Sheet dòng {trial.rowIndex}
                                        </span>
                                      ) : (
                                        <span className="inline-block text-[8.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1 py-0.25 rounded">
                                          Khung giờ chuẩn
                                        </span>
                                      )}

                                      {trial.roomLink && (
                                        <div className="pt-0.5">
                                          <a
                                            href={trial.roomLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-[10px] font-semibold text-blue-600 hover:underline"
                                          >
                                            Link phòng ↗
                                          </a>
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-2 px-3 align-top">
                                      {trial.students.length === 0 ? (
                                        <span className="text-xs text-muted-foreground italic">Chưa có học viên</span>
                                      ) : (
                                        <div className="space-y-0.5">
                                          {trial.students.map((student: string, sIdx: number) => (
                                            <div key={sIdx} className="text-xs text-foreground font-medium leading-relaxed">
                                              • {student}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    <td className={`py-2 px-3 align-top ${openDropdownId === slotId ? "relative z-30" : ""}`}>
                                      {saving ? (
                                        <div className="border border-border rounded-lg p-1.5 flex items-center justify-center bg-muted/50/50">
                                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Đang lưu...</span>
                                          </div>
                                        </div>
                                      ) : assigned ? (
                                        <div className="border border-emerald-300 bg-emerald-50/20 rounded-lg p-1.5 flex items-center justify-between gap-2 transition-all shadow-sm">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <div className="w-6.5 h-6.5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                              {assigned.fullName.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="font-semibold text-foreground text-[11.5px] truncate leading-tight">
                                                {assigned.fullName}
                                              </div>
                                            </div>
                                          </div>
                                          <Button
                                            onClick={() => handleUnassignTeacher(trial)}
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md shrink-0 transition-colors"
                                            title="Xóa phân công"
                                          >
                                            <span className="font-bold text-xs">✕</span>
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="relative">
                                          {openDropdownId === slotId && (
                                            <div
                                              className="fixed inset-0 z-20 cursor-default"
                                              onClick={() => setOpenDropdownId(null)}
                                            />
                                          )}

                                          <button
                                            onClick={() => setOpenDropdownId(openDropdownId === slotId ? null : slotId)}
                                            className="w-full text-left text-xs border border-border hover:border-border rounded-lg px-2.5 py-1.5 bg-muted/50 hover:bg-muted/60 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all cursor-pointer shadow-sm flex items-center justify-between relative z-10"
                                          >
                                            <span>-- Chọn giáo viên khả dụng ({present.length + absent.length}) --</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${openDropdownId === slotId ? "transform rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </button>

                                          {openDropdownId === slotId && (
                                            <div className="absolute left-0 right-0 z-30 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1 text-xs divide-y divide-border/60 duration-150 custom-scrollbar animate-in fade-in-50 top-full mt-1 slide-in-from-top-1">
                                              {present.length > 0 && (
                                                <div>
                                                  <div className="px-3 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50/50 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                                                    Có mặt ở BU hôm đó ({present.length})
                                                  </div>
                                                  {present.map((teacher: any) => {
                                                    const busyTimes = teacher.schedulesToday && teacher.schedulesToday.length > 0
                                                      ? `Bận: ${teacher.schedulesToday.map((s: any) => s.time).join(", ")}`
                                                      : "";
                                                    return (
                                                      <button
                                                        key={teacher.id}
                                                        onClick={() => {
                                                          handleAssignTeacher(trial, teacher);
                                                          setOpenDropdownId(null);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 hover:bg-muted/50 text-foreground hover:text-foreground font-medium transition-colors flex items-center justify-between"
                                                      >
                                                        <span>{teacher.fullName}</span>
                                                        {busyTimes && (
                                                          <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded font-semibold ml-2 shrink-0">
                                                            {busyTimes}
                                                          </span>
                                                        )}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              )}

                                              {absent.length > 0 && (
                                                <div>
                                                  <div className="px-3 py-1 text-[10px] font-bold text-blue-700 bg-blue-50/50 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                                                    Rảnh cả ngày hôm đó ({absent.length})
                                                  </div>
                                                  {absent.map((teacher: any) => (
                                                    <button
                                                      key={teacher.id}
                                                      onClick={() => {
                                                        handleAssignTeacher(trial, teacher);
                                                        setOpenDropdownId(null);
                                                      }}
                                                      className="w-full text-left px-3 py-1.5 hover:bg-muted/50 text-foreground hover:text-foreground font-medium transition-colors"
                                                    >
                                                      {teacher.fullName}
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pb-8 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar no-vertical-scrollbar">
                        {trialsData.map((trial, idx) => {
                          let present = trial.availabilities?.presentAtBranch || [];
                          let absent = trial.availabilities?.notPresentAtBranch || [];
                          const assigned = trial.assignedTeacher;
                          const slotId = trial.slotId;
                          const saving = isSaving[slotId];

                          if (teacherSearch.trim() !== "") {
                            const q = teacherSearch.toLowerCase();
                            present = present.filter(
                              (t: any) => t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
                            );
                            absent = absent.filter(
                              (t: any) => t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
                            );
                          }

                          return (
                            <div
                              key={idx}
                              className={`bg-card rounded-lg border border-border shadow-sm p-2.5 space-y-2.5 transition-all hover:shadow-md ${openDropdownId === slotId ? "relative z-20" : ""}`}
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                                <span className="inline-flex items-center justify-center text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                  {trial.timeSlot}
                                </span>

                                {trial.rowIndex ? (
                                  <span className="inline-block text-[8.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-1 py-0.25 rounded">
                                    Sheet dòng {trial.rowIndex}
                                  </span>
                                ) : (
                                  <span className="inline-block text-[8.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1 py-0.25 rounded">
                                    Khung giờ chuẩn
                                  </span>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <h4 className="font-bold text-foreground text-xs leading-snug">
                                    {trial.subject === "Trống" ? (
                                      <span className="text-muted-foreground italic font-medium">Khung giờ trống</span>
                                    ) : (
                                      `${trial.subject} (${trial.type})`
                                    )}
                                  </h4>
                                  {trial.roomLink && (
                                    <div className="mt-1">
                                      <a
                                        href={trial.roomLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-[10.5px] font-semibold text-blue-600 hover:underline"
                                      >
                                        Link phòng ↗
                                      </a>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-muted/50/60 rounded-md p-2 border border-border/60">
                                  <div className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                                    Học viên ({trial.students.length})
                                  </div>
                                  {trial.students.length === 0 ? (
                                    <span className="text-[11px] text-muted-foreground italic">Chưa có học viên</span>
                                  ) : (
                                    <div className="space-y-0.5">
                                      {trial.students.map((student: string, sIdx: number) => (
                                        <div key={sIdx} className="text-[11px] text-foreground font-semibold flex items-center gap-1">
                                          <span className="h-1.5 w-1.5 rounded-full bg-muted shrink-0" />
                                          {student}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-1 pt-0.5">
                                  <div className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Giáo viên trực
                                  </div>
                                  {saving ? (
                                    <div className="border border-border rounded-lg p-1.5 flex items-center justify-center bg-muted/50/50">
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>Đang lưu...</span>
                                      </div>
                                    </div>
                                  ) : assigned ? (
                                    <div className="border border-emerald-300 bg-emerald-50/20 rounded-lg p-1.5 flex items-center justify-between gap-2 transition-all shadow-sm">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-6.5 h-6.5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                          {assigned.fullName.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold text-foreground text-[11.5px] truncate leading-tight">
                                            {assigned.fullName}
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        onClick={() => handleUnassignTeacher(trial)}
                                        size="icon"
                                        variant="ghost"
                                        className="h-6.5 w-6.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md shrink-0 transition-colors"
                                        title="Xóa phân công"
                                      >
                                        <span className="font-bold text-xs">✕</span>
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      {openDropdownId === slotId && (
                                        <div
                                          className="fixed inset-0 z-20 cursor-default"
                                          onClick={() => setOpenDropdownId(null)}
                                        />
                                      )}

                                      <button
                                        onClick={() => setOpenDropdownId(openDropdownId === slotId ? null : slotId)}
                                        className="w-full text-left text-[11px] border border-border hover:border-border rounded-lg px-2.5 py-1.5 bg-muted/50 hover:bg-muted/60 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all cursor-pointer shadow-sm flex items-center justify-between relative z-10"
                                      >
                                        <span>-- Chọn giáo viên khả dụng ({present.length + absent.length}) --</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${openDropdownId === slotId ? "transform rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>

                                      {openDropdownId === slotId && (
                                        <div className="absolute left-0 right-0 z-30 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1 text-xs divide-y divide-border/60 duration-150 custom-scrollbar animate-in fade-in-50 top-full mt-1 slide-in-from-top-1">
                                          {present.length > 0 && (
                                            <div>
                                              <div className="px-3 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50/50 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                                                Có mặt ở BU hôm đó ({present.length})
                                              </div>
                                              {present.map((teacher: any) => {
                                                const busyTimes = teacher.schedulesToday && teacher.schedulesToday.length > 0
                                                  ? `Bận: ${teacher.schedulesToday.map((s: any) => s.time).join(", ")}`
                                                  : "";
                                                return (
                                                  <button
                                                    key={teacher.id}
                                                    onClick={() => {
                                                      handleAssignTeacher(trial, teacher);
                                                      setOpenDropdownId(null);
                                                    }}
                                                    className="w-full text-left px-2.5 py-1.5 hover:bg-muted/50 text-foreground hover:text-foreground font-medium transition-colors flex items-center justify-between text-[11px]"
                                                  >
                                                    <span>{teacher.fullName}</span>
                                                    {busyTimes && (
                                                      <span className="text-[8.5px] text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded font-semibold ml-2 shrink-0">
                                                        {busyTimes}
                                                      </span>
                                                    )}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {absent.length > 0 && (
                                            <div>
                                              <div className="px-3 py-1 text-[10px] font-bold text-blue-700 bg-blue-50/50 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                                                Rảnh cả ngày hôm đó ({absent.length})
                                              </div>
                                              {absent.map((teacher: any) => (
                                                <button
                                                  key={teacher.id}
                                                  onClick={() => {
                                                    handleAssignTeacher(trial, teacher);
                                                    setOpenDropdownId(null);
                                                  }}
                                                  className="w-full text-left px-2.5 py-1.5 hover:bg-muted/50 text-foreground hover:text-foreground font-medium transition-colors text-[11px]"
                                                >
                                                  {teacher.fullName}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="substitute" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="flex-1 border border-border bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
            <SubstituteTab
              selectedDate={selectedDate}
              userCentres={userCentres}
              onError={handleSubstituteError}
              performedBy={user?.id}
              performedByName={user?.fullName}
            />
          </div>
        </TabsContent>

        <TabsContent value="examiner" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="flex-1 border border-border bg-card shadow-sm overflow-hidden relative flex flex-col rounded-xl">
            <ExaminerTab
              selectedDate={selectedDate}
              userCentres={userCentres}
              onError={handleExaminerError}
              performedBy={user?.id}
              performedByName={user?.fullName}
            />
          </div>
        </TabsContent>
      </Tabs>

      <AlertModal
        variant="error"
        open={!!error}
        onOpenChange={(open) => {
          if (!open) setError(null);
        }}
        message={error ?? ""}
      />

      <AlertModal
        variant="error"
        open={!!trialsError}
        onOpenChange={(open) => {
          if (!open) setTrialsError(null);
        }}
        message={trialsError ?? ""}
      />
    </div>
  );
}
