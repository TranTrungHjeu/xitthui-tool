"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { authService } from "../../services/authService";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

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
      console.log("[Login] Response from server:", res);

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
        setError(res.error || res.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#f8fafc] overflow-hidden p-4">
      {/* Premium background decorative glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-400/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[400px] z-10">
        {/* Center Logo with native browser img tags to prevent loading flickering */}
        <div className="flex justify-center mb-8">
          <img
            src="/logo.png"
            alt="Xitthui logo"
            width="180"
            height="42"
            style={{ width: "180px", height: "42px", minWidth: "180px", minHeight: "42px" }}
            className="object-contain filter drop-shadow-sm"
          />
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-100 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-8">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Chào mừng quay trở lại</h1>
            <p className="text-xs text-slate-500 mt-2">Đăng nhập bằng tài khoản MindX LMS của bạn</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-xs font-medium text-white bg-red-500 rounded-md">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Tài khoản / Email
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  id="email"
                  type="text"
                  placeholder="Tài khoản hoặc Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-slate-50/50 border-slate-200/80 rounded-md focus:bg-white transition-all duration-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Mật khẩu
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 bg-slate-50/50 border-slate-200/80 rounded-md focus:bg-white transition-all duration-200"
                  required
                />
              </div>
            </div>

            <Button 
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-md shadow-md font-medium transition-all duration-200 mt-6 flex items-center justify-center gap-2 hover:scale-[1.01]" 
              type="submit" 
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
        </div>
      </div>
    </div>
  );
}
