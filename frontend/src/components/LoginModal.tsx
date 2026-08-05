"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertModal } from "@/components/ui/alert-modal";
import { mapAuthErrorToAlert, type AuthAlert } from "@/lib/auth-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // `error` carries a structured alert payload so the modal can pick
  // the right title / message / icon / CTA per failure mode.
  const [error, setError] = useState<AuthAlert | null>(null);

  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const processLoginResult = (res: any) => {
    if (res.success || res.lmsToken || res.data?.lmsToken) {
      const data =
        res.data && typeof res.data === "object" && !res.mindxUser
          ? res.data
          : res;

      const mindxUser = data.mindxUser || data.user;
      const lmsToken = data.lmsToken || data.token;
      const sessionId =
        data.sessionId || data.lmsRefreshToken || data.refreshToken;

      if (!mindxUser || !mindxUser.id) {
        throw new Error(
          "Đăng nhập thành công nhưng không lấy được thông tin người dùng.",
        );
      }

      login(mindxUser, lmsToken, sessionId);
      onOpenChange(false);
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.login({ email, password });
      if (!processLoginResult(res)) {
        // 200 OK but body shape is unexpected — surface as a generic
        // structured alert rather than a raw string.
        setError(
          mapAuthErrorToAlert(
            new Error(res.error || res.message || "Đăng nhập thất bại"),
          ),
        );
      }
    } catch (err: any) {
      setError(mapAuthErrorToAlert(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Đăng nhập</DialogTitle>
          <DialogDescription>
            Đăng nhập để truy cập bảng điều khiển MindX Support Tools
          </DialogDescription>
        </DialogHeader>

        <Card className="border-0 shadow-none p-0">
          <CardContent className="p-0 space-y-5">
            {/* Header */}
            <div className="text-center space-y-1.5">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                Chào mừng trở lại
              </h2>
              <p className="text-sm text-muted-foreground">
                Đăng nhập để truy cập bảng điều khiển
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="modal-email" className="text-sm font-medium">
                  Tài khoản
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="modal-email"
                    type="text"
                    placeholder="Nhập tài khoản LMS của bạn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-background rounded-lg"
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modal-password" className="text-sm font-medium">
                  Mật khẩu
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="modal-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 bg-background rounded-lg"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/login");
                }}
                className="text-primary font-medium hover:underline"
              >
                Liên hệ quản lý
              </button>
            </p>
          </CardContent>
        </Card>

        <AlertModal
          variant="error"
          open={!!error}
          onOpenChange={(open) => {
            if (!open) setError(null);
          }}
          title={error?.title}
          message={error?.message}
          icon={error?.icon}
          action={error?.retry ? { label: "Thử lại", variant: "default" } : error?.action}
        />
      </DialogContent>
    </Dialog>
  );
}
