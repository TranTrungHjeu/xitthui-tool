"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { authService } from "../../services/authService";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Loader2 } from "lucide-react";

// The true radical solution: export a component that is only rendered on the client.
// This is Next.js's official way to handle components that are incompatible with SSR
// (like those prone to extension-induced hydration errors).
function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const setTeacherId = useAuthStore((state) => state.setTeacherId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await authService.login({ email, password });
      console.log("[Login] Response from server:", res);

      if (res.success || res.lmsToken || res.data?.lmsToken) {
        // Normalize the response data
        const data =
          res.data && typeof res.data === "object" && !res.mindxUser
            ? res.data
            : res;

        const mindxUser = data.mindxUser || data.user;
        const lmsToken = data.lmsToken || data.token;
        const lmsRefreshToken = data.lmsRefreshToken || data.refreshToken;
        const teacher = data.teacher;
        const profile = data.profile;
        const teacherId = data.teacherId;

        if (!mindxUser || !mindxUser.id) {
          console.error("Login response missing user info:", res);
          throw new Error(
            "Đăng nhập thành công nhưng không lấy được thông tin người dùng.",
          );
        }

        // Use teacher full name from gateway as the canonical display name
        login(
          {
            id: mindxUser.id,
            email: profile?.email || mindxUser.email,
            firstName:
              teacher?.fullName ||
              profile?.firstName ||
              profile?.givenName ||
              mindxUser.firstName,
            lastName: profile?.lastName || mindxUser.lastName,
            fullName: teacher?.fullName || mindxUser.fullName,
            username: profile?.username || mindxUser.username,
          },
          lmsToken,
          lmsRefreshToken,
          teacherId,
        );

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
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 items-center text-center">
          <Image
            src="/logo.png"
            alt="Xitthui logo"
            width={160}
            height={160}
            priority
            className="mx-auto"
          />
          <CardDescription className="text-center">
            Đăng nhập bằng tài khoản MindX LMS của bạn
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-white bg-destructive rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// Force dynamic rendering on client-side only for the entire page
const LoginPage = dynamic(() => Promise.resolve(LoginPageContent), {
  ssr: false,
});

export default LoginPage;
