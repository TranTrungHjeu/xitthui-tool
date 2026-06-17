"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

export default function ZaloBotSettingsPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();

  const [config, setConfig] = useState<ZaloConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);

  const isKhiem =
    user?.username === "lekhiem2002" ||
    user?.email === "lekhiem2002@mindx.net.vn" ||
    user?.email === "lethekhiem2002@mindx.net.vn";

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <AlertCircle className="w-16 h-16 text-red-500 animate-pulse" />
        <h1 className="text-2xl font-bold text-slate-800">
          Không có quyền truy cập
        </h1>
        <p className="text-slate-500">
          Trang này chỉ dành cho tài khoản quản trị hệ thống.
        </p>
      </div>
    );
  }

  const handleAddTime = () => {
    if (!newTime) return;
    if (reminderTimes.includes(newTime)) {
      toast.warning("Giờ nhắc nhở này đã tồn tại.");
      return;
    }
    const sorted = [...reminderTimes, newTime].sort();
    setReminderTimes(sorted);
    setNewTime("");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
          <Bot className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Cấu hình Zalo Bot
          </h1>
          <p className="text-slate-500">
            Quản lý lịch thông báo và tài khoản LMS liên kết cho Zalo Group
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Bot status */}
        <div className="md:col-span-1 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b pb-2">
              Trạng thái Bot
            </h2>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">
                  Nhóm Chat Zalo
                </p>
                {config?.targetChatId ? (
                  <div className="flex items-center gap-1.5 mt-1 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Đã liên kết</span>
                  </div>
                ) : (
                  <p className="text-sm text-amber-500 mt-1 font-medium">
                    Chưa liên kết nhóm (Gõ 'bind_group' trong Zalo)
                  </p>
                )}
                {config?.targetChatId && (
                  <code className="block mt-1 text-[11px] bg-slate-100 dark:bg-slate-800 p-1 rounded text-slate-600 dark:text-slate-400 font-mono truncate">
                    ID: {config.targetChatId}
                  </code>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">
                  Tài khoản LMS liên kết
                </p>
                {config?.isLmsConfigured ? (
                  <div className="mt-1 space-y-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Đã cấu hình
                    </span>
                    {config.mindxUsername && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        👤 {config.mindxUsername}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Chưa cấu hình
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b pb-2">
              Hành động nhanh
            </h2>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={handleLinkAccount}
                disabled={saving}
              >
                <RefreshCw
                  className={`w-4 h-4 ${saving ? "animate-spin" : ""}`}
                />
                Đồng bộ tài khoản của tôi
              </Button>
              <p className="text-xs text-slate-400 text-center">
                Lấy Token hiện tại của bạn làm Token hệ thống để Bot gọi LMS
                thay cho cấu hình cũ.
              </p>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

              <Button
                onClick={handleTriggerNow}
                disabled={
                  triggering ||
                  !config?.targetChatId ||
                  !config?.isLmsConfigured
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Gửi nhắc nhở ngay
              </Button>
            </div>
          </Card>
        </div>

        {/* Right column: Scheduler Configuration */}
        <div className="md:col-span-2">
          <Card className="p-6 space-y-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 border-b pb-3">
              Giờ nhắc nhở tự động
            </h2>
            <p className="text-sm text-slate-500">
              Bot sẽ tự động thu thập thông tin nhận xét chưa hoàn thành vào các
              mốc giờ cấu hình bên dưới và gửi tới Group Zalo của bạn.
            </p>

            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="max-w-[200px]"
              />
              <Button
                onClick={handleAddTime}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Thêm giờ
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {reminderTimes.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic">
                  Chưa có mốc giờ nhắc nhở tự động nào được thêm.
                </div>
              ) : (
                reminderTimes.map((time, idx) => (
                  <div
                    key={time}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200/50 transition-colors"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-350 text-lg">
                      {time}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTime(idx)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleSaveTimes}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Lưu cấu hình giờ nhắc
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
