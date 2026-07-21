"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, Mail, Lock, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await authService.login({ email, password });

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
          console.error("Login response missing user info:", res);
          throw new Error(
            "Đăng nhập thành công nhưng không lấy được thông tin người dùng."
          );
        }

        login(mindxUser, lmsToken, sessionId);
        router.push("/dashboard");
      } else {
        setError(res.error || res.message || "Đăng nhập thất bại");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối máy chủ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background p-4">
      {/* Soft brand gradient background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-radial pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-grid opacity-[0.35] mask-image-radial pointer-events-none"
        style={{
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <img
            src="/logo.png"
            alt="MindX Support Tools"
            width={160}
            height={36}
            className="h-9 w-auto object-contain"
          />
        </div>

        <Card className="p-8 shadow-xl shadow-black/5">
          <div className="space-y-1.5 mb-6">
            <h1 className="text-xl font-semibold tracking-tight">
              Chào mừng quay trở lại
            </h1>
            <p className="text-sm text-muted-foreground">
              Đăng nhập bằng tài khoản MindX LMS của bạn
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">
                Tài khoản hoặc Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="text"
                  placeholder="ten.giao.vien"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">
                Mật khẩu
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-10"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} MindX · MindX Support Tools
        </p>
      </div>
    </div>
  );
}
