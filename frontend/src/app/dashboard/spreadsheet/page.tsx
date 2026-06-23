"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  TableProperties,
  RefreshCw,
  Loader2,
  Calendar,
  UserCheck,
  UserX,
  Copy,
  Check,
  Search,
  Info,
  User,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import CatLoader from "../../../components/CatLoader";
import api from "../../../services/api";
import { useMinLoading } from "@/hooks/useMinLoading";
import { useAuthStore } from "../../../store/useAuthStore";
import { Input } from "../../../components/ui/input";
import { formatSlotDateTime } from "@/lib/utils";
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
  isSameMonth
} from "date-fns";
import { vi } from "date-fns/locale";

interface SheetData {
  headers: string[];
  data: Record<string, string>[];
  sheetName: string;
  availableSheets?: string[];
}

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
    <div className="p-3 bg-white rounded-xl shadow-xl border border-slate-200/80 w-[280px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-slate-800 capitalize">
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
          <div key={day} className="text-[11px] font-semibold text-slate-400">
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
                ${!isCurrentMonth ? "text-slate-300" : "text-slate-700 hover:bg-slate-100"}
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
  const [activeTab, setActiveTab] = useState<"sheet" | "trials">("trials");

  // --- TAB 1: Google Sheet View ---
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showLoading = useMinLoading(isLoading, 1000);

  const fetchSheetData = async (sheetName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = sheetName
        ? `/spreadsheet/data?range=${encodeURIComponent(sheetName)}`
        : "/spreadsheet/data";
      const response = await api.get(url);
      if (response.data.success) {
        setSheetData(response.data);
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

  // --- TAB 2: Trial Booking Tool ---
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
  const [cardFilters, setCardFilters] = useState<Record<number, "all" | "present" | "absent">>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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

  const getCardFilter = (idx: number) => cardFilters[idx] || "all";
  const setCardFilter = (idx: number, filter: "all" | "present" | "absent") => {
    setCardFilters((prev) => ({ ...prev, [idx]: filter }));
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const fetchTrialAvailabilities = async (silent = false) => {
    if (!token) return;
    if (!silent) setIsTrialsLoading(true);
    setTrialsError(null);
    try {
      const userCentres = user?.teacherCentres
        ?.map((c: any) => (typeof c === "object" ? c.id : c))
        ?.filter(Boolean)
        ?.join(",") || "6443460f94300678908f7974";

      const response = await api.get(
        `/spreadsheet/trial-availabilities?dateStr=${selectedDate}&centreIds=${userCentres}`,
      );
      if (response.data.success) {
        setTrialsData(response.data.trials || []);

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
        await fetchTrialAvailabilities(true);
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
        await fetchTrialAvailabilities(true);
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
    if (activeTab === "trials") {
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

  const renderTrialCard = (trial: any, idx: number) => {
    const filter = getCardFilter(idx);
    const present = trial.availabilities?.presentAtBranch || [];
    const absent = trial.availabilities?.notPresentAtBranch || [];
    
    let displayedTeachers: any[] = [];
    if (filter === "all") {
      displayedTeachers = [...present, ...absent];
    } else if (filter === "present") {
      displayedTeachers = present;
    } else {
      displayedTeachers = absent;
    }

    if (teacherSearch.trim() !== "") {
      const q = teacherSearch.toLowerCase();
      displayedTeachers = displayedTeachers.filter(
        (t: any) => t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
      );
    }

    return (
      <div key={idx} className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-sm space-y-4 hover:border-slate-300 transition-all flex flex-col min-h-[350px]">
        {/* Slot Info header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
              {trial.timeSlot}
            </span>
            <div>
              <h3 className="font-bold text-slate-800 text-[14px] leading-tight">
                {trial.subject === "Trống" ? "Khung giờ trực Trial" : `${trial.subject} (${trial.type})`}
              </h3>
              {trial.rowIndex ? (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Dòng sheet: {trial.rowIndex}
                </p>
              ) : (
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  Khung giờ chuẩn (chưa có lớp)
                </p>
              )}
            </div>
          </div>
          {trial.roomLink && (
            <a
              href={trial.roomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-blue-600 hover:underline shrink-0 max-w-[120px] truncate"
              title={trial.roomLink}
            >
              Link phòng ↗
            </a>
          )}
        </div>

        {/* Students list */}
        <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100/60 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Học viên trải nghiệm ({trial.students.length})
          </span>
          {trial.students.length === 0 ? (
            <span className="text-xs text-slate-500 italic">Chưa điền học viên</span>
          ) : (
            <div className="space-y-1">
              {trial.students.map((student: string, sIdx: number) => (
                <div key={sIdx} className="text-[11px] text-slate-700 font-medium leading-tight">
                  • {student}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Availability tabs inside card */}
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Giáo viên khả dụng ({displayedTeachers.length})
            </span>
          </div>

          {/* Group Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/50 text-[11px] shrink-0 select-none">
            <button
              onClick={() => setCardFilter(idx, "all")}
              className={`flex-1 py-1 rounded-md text-center font-semibold transition-all ${
                filter === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Tất cả ({present.length + absent.length})
            </button>
            <button
              onClick={() => setCardFilter(idx, "present")}
              className={`flex-1 py-1 rounded-md text-center font-semibold transition-all flex items-center justify-center gap-1 ${
                filter === "present"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UserCheck className="h-3 w-3" />
              Có mặt BU ({present.length})
            </button>
            <button
              onClick={() => setCardFilter(idx, "absent")}
              className={`flex-1 py-1 rounded-md text-center font-semibold transition-all flex items-center justify-center gap-1 ${
                filter === "absent"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UserX className="h-3 w-3" />
              Rảnh cả ngày ({absent.length})
            </button>
          </div>

          {/* Teachers list container */}
          <div className="flex-1 overflow-y-auto border border-slate-200/60 rounded-lg divide-y divide-slate-100 bg-white custom-scrollbar min-h-0">
            {displayedTeachers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                {teacherSearch ? "Không tìm thấy giáo viên" : "Không có giáo viên khả dụng"}
              </div>
            ) : (
              displayedTeachers.map((teacher: any) => {
                const isPresent = present.some((t: any) => t.id === teacher.id);
                const hasSchedules = teacher.schedulesToday && teacher.schedulesToday.length > 0;
                
                return (
                  <div key={teacher.id} className="p-2 flex items-center justify-between gap-3 hover:bg-slate-50/50 group/row transition-all text-xs">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 truncate">
                          {teacher.fullName}
                        </span>
                        <code className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-1 py-0.5 rounded font-mono">
                          {teacher.code}
                        </code>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPresent ? "bg-emerald-500" : "bg-blue-500"
                          }`}
                          title={isPresent ? "Có mặt ở BU hôm đó" : "Rảnh cả ngày hôm đó"}
                        />
                      </div>
                      
                      {isPresent && hasSchedules && (
                        <div className="text-[9px] text-slate-500 font-medium leading-normal flex items-start gap-1 flex-wrap mt-0.5">
                          <Info className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                          <span>Lịch BU: {teacher.schedulesToday.map((s: any) => `${s.time} (${s.title})`).join(", ")}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleCopyCode(teacher.code)}
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-md hover:bg-slate-100 shrink-0 opacity-40 group-hover/row:opacity-100 transition-opacity"
                      title="Copy mã giáo viên"
                    >
                      {copiedCode === teacher.code ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-slate-500" />
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen p-6 md:p-8 space-y-4 bg-[#f8fafc]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TableProperties className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Book Trial{" "}
              {activeTab === "sheet" && sheetData?.sheetName ? `- ${sheetData.sheetName}` : ""}
            </h1>
            <p className="text-sm text-slate-500">
              Dữ liệu được đồng bộ từ Google Sheets qua API
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tab selector */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs shrink-0 select-none">
            <button
              onClick={() => setActiveTab("trials")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "trials"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Khảo sát trực Trial
            </button>
            <button
              onClick={() => setActiveTab("sheet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "sheet"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              Bảng tính Google Sheet
            </button>
          </div>

          {activeTab === "sheet" && (
            <Button
              onClick={() => fetchSheetData(activeSheet || undefined)}
              disabled={isLoading}
              variant="outline"
              className="gap-2 bg-white h-9 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          )}

          {activeTab === "trials" && (
            <Button
              onClick={() => fetchTrialAvailabilities()}
              disabled={isTrialsLoading}
              variant="outline"
              className="gap-2 bg-white h-9 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTrialsLoading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          )}
        </div>
      </div>

      {activeTab === "sheet" && error && (
        <div className="p-4 text-sm text-white bg-destructive rounded-lg shrink-0">
          {error}
        </div>
      )}

      {activeTab === "trials" && trialsError && (
        <div className="p-4 text-sm text-white bg-destructive rounded-lg shrink-0">
          {trialsError}
        </div>
      )}

      <div className="flex-1 border border-[#cbd5e1] bg-white shadow-sm overflow-hidden relative flex flex-col rounded-xl">
        {activeTab === "sheet" ? (
          <>
            {showLoading && !sheetData ? (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center min-h-[60vh]">
                <CatLoader />
              </div>
            ) : (
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-max min-w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 z-40 bg-slate-200 shadow-[0_1px_0_#cbd5e1]">
                    <tr>
                      <th className="border-r border-b border-[#cbd5e1] bg-slate-200 w-12 text-center text-slate-600 font-bold py-2 px-2 sticky left-0 z-50">
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
                            className={`border-r border-b border-[#cbd5e1] text-slate-800 font-bold py-2 px-3 whitespace-nowrap min-w-[120px] ${colorClass}`}
                          >
                            {header}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {sheetData?.data?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={visibleHeaders.length + 1}
                          className="text-center py-12 text-slate-500 border-b border-[#cbd5e1]"
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
                                    ? "bg-white hover:bg-slate-200/50"
                                    : "bg-slate-50 hover:bg-slate-200/50"
                              }`}
                            >
                              <td
                                className={`border-r border-b border-[#cbd5e1] text-center font-bold py-1.5 px-2 sticky left-0 z-30 ${
                                  isDayRow
                                    ? "bg-blue-200 text-blue-800"
                                    : "bg-slate-100 text-slate-500"
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
                                let cellClass = `border-r border-b border-[#cbd5e1] py-1.5 px-3 text-slate-900 font-medium break-words ${
                                  isDayRow ? "" : bgColorClass
                                }`;

                                const isDateCell =
                                  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(
                                    cellData.trim(),
                                  );

                                if (isDayRow || isDateCell) {
                                  cellClass +=
                                    " font-extrabold text-[15px] text-blue-900 bg-blue-100/60";
                                } else if (
                                  cellData === "TRUE" ||
                                  cellData === "TRUE " ||
                                  cellData === "true"
                                ) {
                                  displayData = "✓";
                                  cellClass = `border-r border-b border-[#cbd5e1] py-1.5 px-3 text-emerald-600 font-bold text-center bg-emerald-100/60`;
                                } else if (
                                  cellData === "FALSE" ||
                                  cellData === "FALSE " ||
                                  cellData === "false"
                                ) {
                                  displayData = "✗";
                                  cellClass = `border-r border-b border-[#cbd5e1] py-1.5 px-3 text-rose-500 font-bold text-center bg-rose-100/60`;
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
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
            {/* Filter control bar */}
            <div className="p-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700 shrink-0">Chọn ngày trực:</span>
                <div className="relative" ref={datePickerRef}>
                  <button
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none transition-all cursor-pointer shadow-sm min-w-[140px] select-none ${isDatePickerOpen ? "border-indigo-600 ring-4 ring-indigo-600/10" : ""}`}
                  >
                    <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>
                      {selectedDate ? format(new Date(selectedDate), "dd/MM/yyyy") : ""}
                    </span>
                  </button>

                  {isDatePickerOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 z-50">
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
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tìm giáo viên..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="pl-9 h-9 bg-white"
                />
              </div>
            </div>

            {/* Trial grid / list */}
            <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar relative min-h-0">
              {showTrialsLoading ? (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <CatLoader />
                </div>
              ) : trialsData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
                  <User className="h-8 w-8 text-slate-400 opacity-50" />
                  <p className="text-sm font-medium text-slate-700">
                    Không có ca trực Trial nào được ghi nhận trong ngày này
                  </p>
                  <p className="text-xs text-slate-400">
                    Hãy kiểm tra lịch trên Google Sheets hoặc chọn ngày khác
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {!isMobile ? (
                    <div className="bg-white rounded-xl border border-[#cbd5e1] overflow-hidden shadow-sm flex flex-col h-full">
                      <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full min-w-[700px] md:min-w-full border-collapse text-[13px] text-left">
                          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-4 font-bold text-slate-600 w-[15%]">Thời gian</th>
                              <th className="py-3 px-4 font-bold text-slate-600 w-[25%]">Thông tin ca</th>
                              <th className="py-3 px-4 font-bold text-slate-600 w-[30%]">Học viên</th>
                              <th className="py-3 px-4 font-bold text-slate-600 w-[30%]">Giáo viên trực</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
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
                                <tr key={idx} className="hover:bg-slate-50/40 transition-colors group">
                                  {/* 1. Time */}
                                  <td className="py-3 px-4 align-top">
                                    <span className="inline-flex items-center justify-center text-xs font-extrabold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                                      {trial.timeSlot}
                                    </span>
                                  </td>

                                  {/* 2. Info */}
                                  <td className="py-3 px-4 align-top space-y-1.5">
                                    <h4 className="font-bold text-slate-800 text-[13px] leading-tight">
                                      {trial.subject === "Trống" ? (
                                        <span className="text-slate-400 italic font-medium">Khung giờ trống</span>
                                      ) : (
                                        `${trial.subject} (${trial.type})`
                                      )}
                                    </h4>
                                    
                                    {trial.rowIndex ? (
                                      <span className="inline-block text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 rounded">
                                        Sheet dòng {trial.rowIndex}
                                      </span>
                                    ) : (
                                      <span className="inline-block text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded">
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

                                  {/* 3. Students */}
                                  <td className="py-3 px-4 align-top">
                                    {trial.students.length === 0 ? (
                                      <span className="text-xs text-slate-400 italic">Chưa có học viên</span>
                                    ) : (
                                      <div className="space-y-1">
                                        {trial.students.map((student: string, sIdx: number) => (
                                          <div key={sIdx} className="text-xs text-slate-700 font-medium leading-relaxed">
                                            • {student}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>

                                  {/* 4. Teacher Assignment */}
                                  <td className="py-3 px-4 align-top">
                                    {saving ? (
                                      <div className="border border-slate-200 rounded-xl p-2.5 flex items-center justify-center bg-slate-50/50">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          <span>Đang lưu...</span>
                                        </div>
                                      </div>
                                    ) : assigned ? (
                                      <div className="border-2 border-emerald-400 bg-emerald-50/20 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all shadow-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="w-7.5 h-7.5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                            {assigned.fullName.charAt(0)}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="font-semibold text-slate-800 text-[12px] truncate leading-tight">
                                              {assigned.fullName}
                                            </div>
                                          </div>
                                        </div>
                                        <Button
                                          onClick={() => handleUnassignTeacher(trial)}
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md shrink-0 transition-colors"
                                          title="Xóa phân công"
                                        >
                                          <span className="font-bold text-xs">✕</span>
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="relative">
                                        {/* Transparent click overlay to close dropdown */}
                                        {openDropdownId === slotId && (
                                          <div
                                            className="fixed inset-0 z-20 cursor-default"
                                            onClick={() => setOpenDropdownId(null)}
                                          />
                                        )}

                                        <button
                                          onClick={() => setOpenDropdownId(openDropdownId === slotId ? null : slotId)}
                                          className="w-full text-left text-xs border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-2 bg-slate-50 hover:bg-slate-100/60 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all cursor-pointer shadow-sm flex items-center justify-between relative z-10"
                                        >
                                          <span>-- Chọn giáo viên khả dụng ({present.length + absent.length}) --</span>
                                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${openDropdownId === slotId ? "transform rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>

                                        {openDropdownId === slotId && (
                                          <div className="absolute left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs divide-y divide-slate-100 animate-in fade-in-50 slide-in-from-top-1 duration-150 custom-scrollbar">
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
                                                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors flex items-center justify-between"
                                                    >
                                                      <span>{teacher.fullName}</span>
                                                      {busyTimes && (
                                                        <span className="text-[9.5px] text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded font-semibold ml-2 shrink-0">
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
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors"
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
                    <div className="space-y-4 pb-12 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
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
                            className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-4 transition-all hover:shadow-md"
                          >
                            {/* Card Header: time badge and sheet row badge */}
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                              <span className="inline-flex items-center justify-center text-xs font-extrabold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                                {trial.timeSlot}
                              </span>

                              {trial.rowIndex ? (
                                <span className="inline-block text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 rounded">
                                  Sheet dòng {trial.rowIndex}
                                </span>
                              ) : (
                                <span className="inline-block text-[9.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                                  Khung giờ chuẩn
                                </span>
                              )}
                            </div>

                            {/* Card Body: subject details, link */}
                            <div className="space-y-2">
                              <div>
                                <h4 className="font-bold text-slate-800 text-[14px] leading-snug">
                                  {trial.subject === "Trống" ? (
                                    <span className="text-slate-400 italic font-medium">Khung giờ trống</span>
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
                                      className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                      Link phòng ↗
                                    </a>
                                  </div>
                                )}
                              </div>

                              {/* Student Info */}
                              <div className="bg-slate-50/60 rounded-lg p-2.5 border border-slate-100">
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Học viên ({trial.students.length})
                                </div>
                                {trial.students.length === 0 ? (
                                  <span className="text-xs text-slate-400 italic">Chưa có học viên</span>
                                ) : (
                                  <div className="space-y-1">
                                    {trial.students.map((student: string, sIdx: number) => (
                                      <div key={sIdx} className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                                        {student}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Teacher Assignment Sector */}
                              <div className="space-y-1.5 pt-1">
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                  Giáo viên trực
                                </div>
                                {saving ? (
                                  <div className="border border-slate-200 rounded-xl p-2.5 flex items-center justify-center bg-slate-50/50">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Đang lưu...</span>
                                    </div>
                                  </div>
                                ) : assigned ? (
                                  <div className="border-2 border-emerald-400 bg-emerald-50/20 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all shadow-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                                        {assigned.fullName.charAt(0)}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-semibold text-slate-800 text-[13px] truncate leading-tight">
                                          {assigned.fullName}
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      onClick={() => handleUnassignTeacher(trial)}
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md shrink-0 transition-colors"
                                      title="Xóa phân công"
                                    >
                                      <span className="font-bold text-sm">✕</span>
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    {/* Transparent click overlay to close dropdown */}
                                    {openDropdownId === slotId && (
                                      <div
                                        className="fixed inset-0 z-20 cursor-default"
                                        onClick={() => setOpenDropdownId(null)}
                                      />
                                    )}

                                    <button
                                      onClick={() => setOpenDropdownId(openDropdownId === slotId ? null : slotId)}
                                      className="w-full text-left text-xs border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-2 bg-slate-50 hover:bg-slate-100/60 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all cursor-pointer shadow-sm flex items-center justify-between relative z-10"
                                    >
                                      <span>-- Chọn giáo viên khả dụng ({present.length + absent.length}) --</span>
                                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${openDropdownId === slotId ? "transform rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>

                                    {openDropdownId === slotId && (
                                      <div className="absolute left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs divide-y divide-slate-100 animate-in fade-in-50 slide-in-from-top-1 duration-150 custom-scrollbar">
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
                                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors flex items-center justify-between"
                                                >
                                                  <span>{teacher.fullName}</span>
                                                  {busyTimes && (
                                                    <span className="text-[9.5px] text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded font-semibold ml-2 shrink-0">
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
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors"
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
        )}
      </div>
    </div>
  );
}
