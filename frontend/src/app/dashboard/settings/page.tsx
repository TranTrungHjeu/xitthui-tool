"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  Palette,
  Database,
  LogOut,
  Mail,
  Building2,
  Key,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { authService } from "@/services/authService";
import { useRouter } from "next/navigation";
import { isKhiemAccount } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.firstName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const sessionId = useAuthStore.getState().sessionId;
      if (sessionId) {
        await authService.logout(sessionId);
      }
      logout();
      toast.success("Đã đăng xuất");
      router.push("/login");
    } catch (err) {
      toast.error("Đăng xuất thất bại");
      setIsLoggingOut(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  if (!user) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        icon={SettingsIcon}
        title="Cài đặt"
        description="Quản lý tài khoản và tùy chọn hệ thống"
      />

      {/* Profile section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Thông tin cá nhân</CardTitle>
              <CardDescription>
                Thông tin tài khoản MindX LMS của bạn
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold truncate">{displayName}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {user.appRoles?.map((role) => (
                  <Badge
                    key={role}
                    variant={role === "TE" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {role}
                  </Badge>
                ))}
                {isKhiemAccount(user) && (
                  <Badge variant="destructive" className="text-[10px]">
                    MASTER
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Mail className="h-3 w-3" />
                Email
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate flex-1">
                  {user.email || "—"}
                </span>
                {user.email && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(user.email!, "email")}
                  >
                    <Key className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <User className="h-3 w-3" />
                Username
              </div>
              <span className="text-sm font-medium">
                {user.username || "—"}
              </span>
            </div>

            {user.teacherId && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Shield className="h-3 w-3" />
                  Mã giáo viên
                </div>
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {user.teacherId}
                </code>
              </div>
            )}

            {user.teacherCentres && user.teacherCentres.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Building2 className="h-3 w-3" />
                  Cơ sở
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.teacherCentres.map((c: any) => (
                    <Badge
                      key={c.id || c}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {c.name || c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Giao diện</CardTitle>
              <CardDescription>Tùy chỉnh giao diện hệ thống</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">Chủ đề</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                  theme === "light"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs font-medium">Sáng</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                  theme === "dark"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Moon className="h-5 w-5" />
                <span className="text-xs font-medium">Tối</span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                  theme === "system"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Monitor className="h-5 w-5" />
                <span className="text-xs font-medium">Hệ thống</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Thông báo</CardTitle>
              <CardDescription>
                Tùy chọn nhận thông báo từ hệ thống
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            label="Thông báo Zalo"
            description="Nhận thông báo nhắc nhở qua Zalo Bot"
          />
          <SettingRow
            label="Nhắc lịch dạy"
            description="Thông báo trước buổi học 30 phút"
          />
          <SettingRow
            label="Cập nhật lịch"
            description="Thông báo khi có thay đổi về lịch làm việc"
          />
        </CardContent>
      </Card>

      {/* Cache & Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Dữ liệu & Bộ nhớ đệm</CardTitle>
              <CardDescription>
                Quản lý cache và dữ liệu đã lưu trên thiết bị
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
            <div className="min-w-0">
              <p className="text-sm font-medium">Xóa cache trình duyệt</p>
              <p className="text-xs text-muted-foreground">
                Xóa toàn bộ dữ liệu cache đã lưu (lớp học, lịch, học viên)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Bạn có chắc chắn muốn xóa cache? Dữ liệu sẽ được tải lại từ server.",
                  )
                ) {
                  if (typeof window !== "undefined") {
                    localStorage.clear();
                    sessionStorage.clear();
                    toast.success("Đã xóa cache");
                  }
                }
              }}
            >
              Xóa cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <LogOut className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Phiên đăng nhập</CardTitle>
              <CardDescription>Đăng xuất khỏi hệ thống</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </Button>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground py-4">
        MindX Support Tools · Phiên bản 2.0 · Build {new Date().getFullYear()}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-not-allowed opacity-70">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Badge variant="outline" className="text-[10px]">
        Sắp ra mắt
      </Badge>
    </div>
  );
}
