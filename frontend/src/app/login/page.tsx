"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertModal } from "@/components/ui/alert-modal";
import { MindyMascot } from "@/components/MindyMascot";
import { cn } from "@/lib/utils";
import { mapAuthErrorToAlert, type AuthAlert } from "@/lib/auth-error";
import {
  Loader2,
  ArrowRight,
  Mail,
  Lock,
  Layers,
  MessageSquare,
  GraduationCap,
  BookOpen,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";

const QUICK_LINKS = [
  { href: "/dashboard/tools/trial-report", icon: FileText, label: "Phiếu trải nghiệm" },
  { href: "/dashboard/tools/zalo", icon: MessageSquare, label: "Nhận xét Zalo" },
  { href: "/dashboard/tools/lms", icon: GraduationCap, label: "Nhận xét LMS" },
  { href: "/dashboard/tools/lesson", icon: BookOpen, label: "Nội dung buổi học" },
];

/**
 * Inner component — wrapped in <Suspense/> below because `useSearchParams`
 * requires a Suspense boundary on the page level in Next.js 15+.
 */
function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // `error` is now a structured alert produced by
  // `mapAuthErrorToAlert` so the modal can pick the right title,
  // message, icon and CTA based on the underlying failure mode
  // (network, invalid credentials, disabled user, …).
  const [error, setError] = useState<AuthAlert | null>(null);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);

  // Show the "session expired" modal when we land here via the
  // ?reason=session_expired query param. We do not auto-redirect — the
  // user must explicitly acknowledge, which avoids a flash of an empty
  // login form when the toast and redirect race.
  useEffect(() => {
    if (searchParams?.get("reason") === "session_expired") {
      setShowSessionExpiredModal(true);
    }
  }, [searchParams]);

  const processLoginResult = (res: any) => {
    if (res.success || res.lmsToken || res.data?.lmsToken) {
      const data =
        res.data && typeof res.data === "object" && !res.mindxUser
          ? res.data
          : res;

      const mindxUser = data.mindxUser || data.user;

      if (!mindxUser || !mindxUser.id) {
        console.error("Login response missing user info:", res);
        throw new Error(
          "Đăng nhập thành công nhưng không lấy được thông tin người dùng.",
        );
      }

      // The LMS token now lives in an httpOnly cookie set by the server.
      // We intentionally drop `lmsToken` / `sessionId` from the store so
      // they never reach localStorage / sessionStorage (XSS-safe).
      login(mindxUser);
      router.push("/dashboard");
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
        // Backend returned 200 but the response body doesn't contain
        // any of the expected shapes — surface as a generic internal
        // error so the user gets the structured modal, not a raw
        // string.
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
    <div className="min-h-screen flex">
      {/* ── Left Panel: Brand & Features ─────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-mindx-hero-gradient">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-grid opacity-[0.08] animate-grid-pan" />

          {/* Gradient overlay */}
          <div
            className="absolute inset-0 animate-gradient-breathe animate-hue-soft"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 20% 80%, rgba(227, 31, 38, 0.4) 0%, transparent 50%)",
            }}
          />

          {/* Animated circles (wrappers tách transform để compose float + scale/opacity) */}
          <div className="absolute top-1/4 left-1/4 animate-float-slow">
            <div className="w-96 h-96 rounded-full border border-white/10 animate-scale-breathe" />
          </div>
          <div className="absolute top-1/3 left-1/3 animate-float-medium">
            <div className="w-64 h-64 rounded-full border border-white/5 animate-opacity-flicker" />
          </div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full border border-white/10 animate-float-fast" />

          {/* Floating shapes */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-white/5 rounded-2xl rotate-12 backdrop-blur-sm animate-rotate-drift" />
          <div className="absolute bottom-32 left-20 w-24 h-24 bg-white/5 rounded-full backdrop-blur-sm animate-float-medium" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          {/* Logo */}
          <div>
            <img
              src="/logo.png"
              alt="MindX Support Tools"
              className="h-12 w-auto brightness-0 invert animate-fade-in-down"
            />
          </div>

          {/* Main content */}
          <div className="space-y-8">
            {/* Tagline — góc phải */}
            <div
              className="text-right animate-fade-in-up"
              style={{ "--anim-delay": "150ms" } as React.CSSProperties}
            >
              <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
                Nền tảng hỗ trợ
                <br />
                <span className="text-[#FFD62D]">giáo viên MindX</span>
              </h1>
            </div>

            {/* Mascot */}
            <div
              className="animate-fade-in-up"
              style={{ "--anim-delay": "350ms" } as React.CSSProperties}
            >
              <MindyMascot className="w-full max-w-xl h-auto drop-shadow-[0_10px_30px_rgba(255,214,45,0.25)]" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-white/50">
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-b from-background to-muted/20">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-4 animate-fade-in">
            <img src="/logo.png" alt="MindX" className="h-12 w-auto" />
          </div>

          {/* Login Card */}
          <Card
            className="border-0 shadow-lg shadow-black/5 bg-card animate-page-enter"
            style={{ "--anim-delay": "100ms" } as React.CSSProperties}
          >
            <CardContent className="p-8 space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div
                  className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-icon-pop"
                  style={{ "--anim-delay": "300ms" } as React.CSSProperties}
                >
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Chào mừng trở lại
                </h2>
                <p className="text-sm text-muted-foreground">
                  Đăng nhập để truy cập bảng điều khiển
                </p>
              </div>

              {/* Login form */}
              <form onSubmit={handleSubmit} data-login-form="" className="space-y-5">
                <div
                  className="space-y-2 animate-fade-in-up"
                  style={{ "--anim-dur": "400ms", "--anim-delay": "400ms" } as React.CSSProperties}
                >
                  <Label htmlFor="email" className="text-sm font-medium">
                    Tài khoản
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="text"
                      placeholder="Nhập tài khoản LMS của bạn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-background rounded-lg"
                      required
                      autoComplete="username"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div
                  className="space-y-2 animate-fade-in-up"
                  style={{ "--anim-dur": "400ms", "--anim-delay": "500ms" } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Mật khẩu
                    </Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-background rounded-lg"
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
                  className="w-full h-12 text-base font-medium animate-fade-in-up btn-gradient-sweep"
                  style={{ "--anim-dur": "400ms", "--anim-delay": "600ms" } as React.CSSProperties}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Đăng nhập
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tools Section */}
          <Card
            className="border border-border/60 bg-gradient-to-br from-card to-muted/5 overflow-hidden animate-page-enter"
            style={{ "--anim-delay": "200ms" } as React.CSSProperties}
          >
            <CardContent className="p-6 space-y-4">
              <div
                className="flex items-center gap-2 animate-fade-in-up"
                style={{ "--anim-dur": "400ms", "--anim-delay": "250ms" } as React.CSSProperties}
              >
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Công cụ hỗ trợ</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_LINKS.map((link, i) => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => router.push(link.href)}
                    className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-background/80 hover:bg-background hover:border-border hover:shadow-md transition-all duration-200 text-center animate-fade-in-up"
                    style={{ "--anim-dur": "400ms", "--anim-delay": `${350 + i * 50}ms` } as React.CSSProperties}
                  >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/15 group-hover:to-primary/10 transition-all">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                      {link.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertModal
        variant="error"
        open={!!error}
        onOpenChange={(open) => {
          if (!open) setError(null);
        }}
        title={error?.title}
        message={error?.message}
        icon={error?.icon}
        action={
          error?.retry
            ? {
                label: "Thử lại",
                variant: "default",
                onClick: () => {
                  // Reset then resubmit synchronously so the user
                  // doesn't see a flash of the closed modal before
                  // the request fires.
                  setError(null);
                  // `handleSubmit` expects a React.FormEvent, but the
                  // event payload is only used for `preventDefault`.
                  // We dispatch a synthetic no-op submit instead.
                  const form = document.querySelector<HTMLFormElement>(
                    "form[data-login-form]",
                  );
                  form?.requestSubmit();
                },
              }
            : error?.action
        }
      />

      <AlertModal
        variant="warning"
        open={showSessionExpiredModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowSessionExpiredModal(false);
            // Strip ?reason=… so a manual F5 doesn't replay the modal.
            router.replace("/login");
          }
        }}
        title="Phiên đăng nhập đã hết hạn"
        message="Để bảo mật, bạn đã được đăng xuất. Vui lòng đăng nhập lại để tiếp tục sử dụng."
      />
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary under Next.js 15+.
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
