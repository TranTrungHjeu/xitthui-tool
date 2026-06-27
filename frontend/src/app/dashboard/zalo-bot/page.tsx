"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../store/useAuthStore";
import { zaloService, ZaloConfig } from "../../../services/zaloService";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card } from "../../../components/ui/card";
import {
  Bot,
  Plus,
  Trash2,
  Send,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  User,
  Clock,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import CatLoader from "@/components/CatLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { isKhiemAccount } from "@/lib/utils";

export default function ZaloBotSettingsPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();

  const [config, setConfig] = useState<ZaloConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showLoading = useMinLoading(loading, 500);
  const [triggering, setTriggering] = useState(false);
  const [hour, setHour] = useState("08");
  const [minute, setMinute] = useState("00");
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);

  const hoursArray = useMemo(() => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")), []);
  const minutesArray = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")), []);

  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const hoursScrollRef = useRef<HTMLDivElement>(null);
  const minutesScrollRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        timePickerRef.current &&
        !timePickerRef.current.contains(e.target as Node)
      ) {
        setIsTimePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll to selected values when open
  useEffect(() => {
    if (isTimePickerOpen) {
      setTimeout(() => {
        if (hoursScrollRef.current) {
          const selected = hoursScrollRef.current.querySelector('[data-selected="true"]');
          if (selected) {
            selected.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }
        if (minutesScrollRef.current) {
          const selected = minutesScrollRef.current.querySelector('[data-selected="true"]');
          if (selected) {
            selected.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }
      }, 50);
    }
  }, [isTimePickerOpen]);

  const isKhiem = isKhiemAccount(user);

  // Guard access
  useEffect(() => {
    if (user && !isKhiem) {
      router.push("/dashboard");
    }
  }, [user, isKhiem, router]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await zaloService.getConfig();
      if (res.success) {
        setConfig(res.data);
        setReminderTimes(res.data.reminderTimes || []);
      }
    } catch (err: any) {
      toast.error(
        "Không thể tải cấu hình Zalo Bot: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isKhiem) {
      fetchConfig();
    }
  }, [user, isKhiem]);

  if (user && !isKhiem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 animate-in fade-in duration-500">
        <AlertCircle className="w-12 h-12 text-red-500 animate-pulse" />
        <h1 className="text-base font-bold text-slate-800">
          Không có quyền truy cập
        </h1>
        <p className="text-xs text-slate-500">
          Trang này chỉ dành cho tài khoản quản trị hệ thống.
        </p>
      </div>
    );
  }

  const handleAddTime = () => {
    const timeStr = `${hour}:${minute}`;
    if (reminderTimes.includes(timeStr)) {
      toast.warning("Giờ nhắc nhở này đã tồn tại.");
      return;
    }
    const sorted = [...reminderTimes, timeStr].sort();
    setReminderTimes(sorted);
  };

  const handleRemoveTime = (index: number) => {
    const updated = reminderTimes.filter((_, i) => i !== index);
    setReminderTimes(updated);
  };

  const handleSaveTimes = async () => {
    try {
      setSaving(true);
      const res = await zaloService.updateConfig({ reminderTimes });
      if (res.success) {
        toast.success("Đã cập nhật giờ nhắc nhở.");
        fetchConfig();
      }
    } catch (err: any) {
      toast.error(
        "Không thể lưu giờ nhắc nhở: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!token) return;
    try {
      setSaving(true);
      const res = await zaloService.updateConfig({
        linkCurrentUser: true,
        lmsToken: token,
        mindxUser: user,
      });
      if (res.success) {
        toast.success(
          "Đã liên kết tài khoản LMS của bạn làm tài khoản Bot chung.",
        );
        fetchConfig();
      }
    } catch (err: any) {
      toast.error(
        "Không thể liên kết tài khoản: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerNow = async () => {
    try {
      setTriggering(true);
      const res = await zaloService.triggerReminder();
      if (res.success) {
        toast.success("Đã gửi lệnh kích hoạt gửi nhắc nhở ngay lập tức.");
      }
    } catch (err: any) {
      toast.error(
        "Gửi nhắc nhở thất bại: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setTriggering(false);
    }
  };

  if (showLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CatLoader />
      </div>
    );
  }

  return (
    <div className="p-1.5 sm:p-3 space-y-1.5 h-[calc(100vh-76px)] md:h-[calc(100vh-16px)] overflow-hidden flex flex-col animate-in fade-in duration-500">
      {/* Title Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-none">
              Cấu hình Zalo Bot
            </h1>
          </div>
        </div>
      </div>

      {/* Main card view */}
      <div className="flex-1 border border-slate-200 bg-slate-50/40 shadow-sm overflow-auto rounded-xl p-3 sm:p-5 flex flex-col gap-4 sm:gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
          {/* Left column: Bot status & actions */}
          <div className="space-y-4 sm:space-y-6 md:col-span-1">
            {/* Status Card */}
            <Card className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Trạng thái Bot
                </h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Nhóm Chat Zalo
                  </span>
                  {config?.targetChatId ? (
                    <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-bold text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Đã liên kết</span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-500 font-bold mt-1 leading-normal">
                      Chưa liên kết nhóm (Gõ 'bind_group' trong Zalo)
                    </p>
                  )}
                  {config?.targetChatId && (
                    <code className="block mt-1 text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-slate-600 font-mono truncate select-all">
                      ID: {config.targetChatId}
                    </code>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Tài khoản LMS liên kết
                  </span>
                  {config?.isLmsConfigured ? (
                    <div className="mt-1 space-y-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Đã cấu hình
                      </span>
                      {config.mindxUsername && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2 rounded-lg">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{config.mindxUsername}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 mt-1">
                      Chưa cấu hình
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Actions Card */}
            <Card className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                  <Send className="h-3 w-3 text-primary" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Hành động nhanh
                </h2>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-9 text-[11px] font-bold gap-1.5 bg-white hover:bg-slate-50 text-slate-700 active:scale-95 transition-all shadow-sm border-slate-200"
                  onClick={handleLinkAccount}
                  disabled={saving}
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${saving ? "animate-spin" : ""}`}
                  />
                  Đồng bộ tài khoản của tôi
                </Button>
                <p className="text-[10px] text-slate-400 leading-relaxed text-center px-1">
                  Đồng bộ Token hiện tại của bạn làm Token hệ thống để Bot gọi LMS thay cho tài khoản cấu hình cũ.
                </p>

                <div className="h-px bg-slate-100 my-2" />

                <Button
                  onClick={handleTriggerNow}
                  disabled={
                    triggering ||
                    !config?.targetChatId ||
                    !config?.isLmsConfigured
                  }
                  className="w-full h-9 text-[11px] font-bold gap-1.5 bg-primary hover:bg-primary/95 text-white active:scale-95 transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gửi nhắc nhở ngay
                </Button>
                <p className="text-[10px] text-slate-400 leading-relaxed text-center px-1">
                  Kích hoạt lệnh quét điểm danh & bài tập và gửi ngay một tin nhắn nhắc nhở tới nhóm Zalo liên kết.
                </p>
              </div>
            </Card>
          </div>

          {/* Right column: Scheduler Configuration */}
          <div className="md:col-span-2">
            <Card className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                  <Save className="h-3 w-3 text-primary" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Giờ nhắc nhở tự động
                </h2>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Hệ thống sẽ tự động quét trạng thái điểm danh và nhận xét bài tập chưa hoàn thành vào các mốc thời gian bên dưới, sau đó tự động gửi cảnh báo và tag tên TE/giáo viên trực tiếp vào nhóm Zalo chat.
              </p>

              <div className="flex items-center gap-2 relative">
                {/* Unified Time Picker Dropdown */}
                <div className="relative" ref={timePickerRef}>
                  <div
                    onClick={() => setIsTimePickerOpen(!isTimePickerOpen)}
                    className={`flex items-center justify-between gap-2 px-3 h-9 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors cursor-pointer w-[120px] select-none text-xs font-bold text-slate-700 ${
                      isTimePickerOpen ? "ring-2 ring-primary/20 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-450" />
                      <span className="font-mono text-sm tracking-wide">
                        {hour}:{minute}
                      </span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </div>

                  {isTimePickerOpen && (
                    <div className="absolute top-[calc(100%+6px)] left-0 z-50 p-3 bg-white rounded-xl shadow-xl border border-slate-200 w-[180px] animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <div>Giờ</div>
                        <div>Phút</div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 h-40">
                        {/* Hours list */}
                        <div className="overflow-y-auto pr-0.5 custom-scrollbar scroll-smooth flex flex-col gap-1 border-r border-slate-100" ref={hoursScrollRef}>
                          {hoursArray.map((h) => {
                            const isSelected = h === hour;
                            return (
                              <button
                                key={h}
                                data-selected={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHour(h);
                                }}
                                className={`py-1 text-xs font-mono font-bold rounded transition-colors ${
                                  isSelected
                                    ? "bg-primary text-white"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>

                        {/* Minutes list */}
                        <div className="overflow-y-auto pr-0.5 custom-scrollbar scroll-smooth flex flex-col gap-1" ref={minutesScrollRef}>
                          {minutesArray.map((m) => {
                            const isSelected = m === minute;
                            return (
                              <button
                                key={m}
                                data-selected={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMinute(m);
                                }}
                                className={`py-1 text-xs font-mono font-bold rounded transition-colors ${
                                  isSelected
                                    ? "bg-primary text-white"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end border-t border-slate-100 pt-2 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTimePickerOpen(false);
                          }}
                          className="h-7 text-[10px] font-bold px-2.5 text-slate-500 hover:text-slate-800"
                        >
                          Đóng
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAddTime}
                  className="h-9 text-[11px] font-bold gap-1.5 bg-slate-900 hover:bg-slate-850 text-white active:scale-95 transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm mốc giờ
                </Button>
              </div>

              <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1.5 custom-scrollbar no-vertical-scrollbar border border-slate-100 p-2 rounded-xl bg-slate-50/50">
                {reminderTimes.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 italic bg-white rounded-lg border border-dashed border-slate-200">
                    Chưa có mốc giờ tự động nào được đăng ký.
                  </div>
                ) : (
                  reminderTimes.map((time, idx) => (
                    <div
                      key={time}
                      className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 rounded-lg border border-slate-200/60 shadow-sm transition-all"
                    >
                      <span className="font-bold text-slate-800 text-sm font-mono tracking-wide">
                        {time}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTime(idx)}
                        className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button
                  onClick={handleSaveTimes}
                  disabled={saving}
                  className="h-9 px-4 text-[11px] font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu cấu hình giờ nhắc
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
