"use client";

import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, Gavel } from "lucide-react";
import { Button } from "./ui/button";
import CatLoader from "./CatLoader";
import { TeacherDropdown } from "./TeacherDropdown";
import { useMinLoading } from "@/hooks/useMinLoading";
import {
  BOOKING_TYPES,
  BookableTeacher,
  ExaminerSlot,
  spreadsheetService,
} from "../services/spreadsheetService";

// Module-level cache so the cache survives remounts when the user switches tabs.
const slotsCache = new Map<string, ExaminerSlot[]>();
const fetchedKeys = new Set<string>();

interface ExaminerTabProps {
  selectedDate: string;
  userCentres: string;
  onError: (msg: string | null) => void;
  performedBy?: string;
  performedByName?: string;
}

export const ExaminerTab: React.FC<ExaminerTabProps> = ({
  selectedDate,
  userCentres,
  onError,
  performedBy,
  performedByName,
}) => {
  const [slots, setSlots] = useState<ExaminerSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openDropdownSlotId, setOpenDropdownSlotId] = useState<string | null>(null);
  const [teacherCache, setTeacherCache] = useState<Record<string, BookableTeacher[]>>({});
  const [loadingTeachersSlotId, setLoadingTeachersSlotId] = useState<string | null>(null);
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);

  const showLoading = useMinLoading(isLoading, 800);

  const cacheKey = `${selectedDate}|${userCentres}`;

  const loadSlots = async (force = false) => {
    if (!force && fetchedKeys.has(cacheKey)) {
      const cached = slotsCache.get(cacheKey);
      if (cached) {
        setSlots(cached);
        return;
      }
    }
    setIsLoading(true);
    onError(null);
    try {
      const res = await spreadsheetService.getExaminerSlots(selectedDate, userCentres);
      if (res.success) {
        const list = res.slots || [];
        setSlots(list);
        slotsCache.set(cacheKey, list);
        fetchedKeys.add(cacheKey);
      } else {
        throw new Error(res.error || "Không thể tải danh sách slot giám khảo.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi kết nối máy chủ.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, userCentres]);

  const ensureTeachersLoaded = async (slot: ExaminerSlot) => {
    if (teacherCache[slot.slotId] || !slot.startTime || !slot.endTime) return;
    setLoadingTeachersSlotId(slot.slotId);
    try {
      const res = await spreadsheetService.getBookableTeachers(
        selectedDate,
        slot.startTime,
        slot.endTime,
        userCentres,
      );
      if (res.success) {
        setTeacherCache((prev) => ({ ...prev, [slot.slotId]: res.teachers || [] }));
      } else {
        throw new Error(res.error || "Lỗi tải giáo viên.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi tải giáo viên.");
    } finally {
      setLoadingTeachersSlotId(null);
    }
  };

  const handleOpenDropdown = (slot: ExaminerSlot) => {
    const nextOpen = openDropdownSlotId === slot.slotId ? null : slot.slotId;
    setOpenDropdownSlotId(nextOpen);
    if (nextOpen) {
      ensureTeachersLoaded(slot);
    }
  };

  const handleAssign = async (slot: ExaminerSlot, teacher: BookableTeacher) => {
    setSavingSlotId(slot.slotId);
    try {
      const res = await spreadsheetService.assignBookTeacher({
        bookingType: BOOKING_TYPES.EXAMINER,
        dateStr: selectedDate,
        slotId: slot.slotId,
        role: "GK",
        teacherId: teacher.id,
        teacherCode: teacher.code,
        teacherName: teacher.fullName,
        classId: slot.classId,
        className: slot.className,
        sessionIndex: slot.sessionIndex,
        sessionDate: slot.sessionDate,
        timeSlot: slot.timeSlot || "",
        normalizedTime: (slot.timeSlot || "00:00").replace(/[^\d:]/g, "").slice(0, 5) || "00:00",
        performedBy: performedBy || "",
        performedByName: performedByName || "",
      });
      if (res.success) {
        await loadSlots(true);
      } else {
        throw new Error(res.error || "Lỗi lưu phân công.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi lưu phân công.");
    } finally {
      setSavingSlotId(null);
    }
  };

  const handleUnassign = async (slot: ExaminerSlot) => {
    setSavingSlotId(slot.slotId);
    try {
      const res = await spreadsheetService.unassignBookTeacher({
        bookingType: BOOKING_TYPES.EXAMINER,
        dateStr: selectedDate,
        slotId: slot.slotId,
        role: "GK",
        performedBy: performedBy || "",
        performedByName: performedByName || "",
      });
      if (res.success) {
        await loadSlots(true);
      } else {
        throw new Error(res.error || "Lỗi huỷ phân công.");
      }
    } catch (err: any) {
      onError(err.response?.data?.error || err.message || "Lỗi huỷ phân công.");
    } finally {
      setSavingSlotId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
      <div className="p-1.5 bg-card border-b border-border flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <Gavel className="inline h-3 w-3 mr-1" /> Book giám khảo
        </span>
        <Button
          onClick={() => loadSlots(true)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          <span className="text-[11px]">Làm mới</span>
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2.5 relative custom-scrollbar">
        {showLoading ? (
          <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center">
            <CatLoader />
          </div>
        ) : slots.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-card rounded-xl border border-border/60 p-6 shadow-sm">
            <Gavel className="h-8 w-8 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium text-foreground">
              Không có buổi Demo nào cần gán giám khảo
            </p>
            <p className="text-xs text-muted-foreground">
              Hệ thống chỉ liệt kê buổi có examType=DEMO và chưa có GK.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-xs text-left">
              <thead className="bg-muted border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-3 font-bold text-foreground w-[15%] text-[11px]">Thời gian</th>
                  <th className="py-2 px-3 font-bold text-foreground w-[35%] text-[11px]">Lớp</th>
                  <th className="py-2 px-3 font-bold text-foreground w-[10%] text-[11px]">Buổi #</th>
                  <th className="py-2 px-3 font-bold text-foreground w-[15%] text-[11px]">Loại</th>
                  <th className="py-2 px-3 font-bold text-foreground w-[25%] text-[11px]">Giám khảo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {slots.map((slot) => {
                  const saving = savingSlotId === slot.slotId;
                  const loadingTeachers = loadingTeachersSlotId === slot.slotId;
                  const open = openDropdownSlotId === slot.slotId;
                  const teachers = teacherCache[slot.slotId] || [];

                  return (
                    <tr key={slot.slotId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 align-top">
                        <span className="inline-flex items-center justify-center text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                          {slot.timeSlot || "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <div className="font-bold text-foreground text-xs leading-tight">
                          {slot.className || "—"}
                        </div>
                        {slot.centre && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{slot.centre}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 align-top">
                        <span className="text-xs font-semibold text-foreground">
                          {slot.sessionIndex ? `#${slot.sessionIndex}` : "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <span className="inline-flex items-center text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                          Demo
                        </span>
                      </td>
                      <td className={`py-2 px-3 align-top ${open ? "relative z-30" : ""}`}>
                        {saving ? (
                          <div className="border border-border rounded-lg p-1.5 flex items-center justify-center bg-muted/50">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Đang lưu...</span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <button
                              onClick={() => handleOpenDropdown(slot)}
                              className="w-full text-left text-[11px] border border-border rounded-md px-2 py-1 bg-card hover:bg-muted/60 text-foreground font-semibold transition-colors flex items-center justify-between"
                            >
                              <span>-- Chọn giám khảo --</span>
                              <span className="text-[10px] text-muted-foreground">
                                {teachers.length} GV
                              </span>
                            </button>

                            {open && (
                              <>
                                <div
                                  className="fixed inset-0 z-20 cursor-default"
                                  onClick={() => setOpenDropdownSlotId(null)}
                                />
                                <TeacherDropdown
                                  isOpen={open}
                                  onOpenChange={(o) => setOpenDropdownSlotId(o ? slot.slotId : null)}
                                  teachers={teachers}
                                  isLoading={loadingTeachers}
                                  onSelect={(t) => handleAssign(slot, t)}
                                  emptyHint="Tất cả giáo viên đều bận khung giờ này"
                                />
                              </>
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
        )}
      </div>
    </div>
  );
};
