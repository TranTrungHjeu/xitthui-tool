"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/store/useAuthStore";
import { SESSION_EXPIRED_EVENT } from "@/services/api";

/**
 * Listens for `auth:session-expired` events dispatched by `api.ts` when a
 * refresh attempt fails, then:
 *
 *   - clears the auth store (`logout()`),
 *   - shows a friendly toast so the user understands what happened,
 *   - redirects to `/login?reason=session_expired` for re-authentication.
 *
 * The login page reads that query param and shows a one-time informational
 * modal so the user sees the same message whether they were bounced from
 * the dashboard itself or from a background API call.
 *
 * Mount this once near the root of the authenticated subtree (currently
 * the dashboard layout).
 */
export function useSessionExpiredGuard(): void {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const handler = () => {
      logout();
      toast.warning("Phiên đăng nhập đã hết hạn", {
        description:
          "Vui lòng đăng nhập lại để tiếp tục. Trang sẽ chuyển trong giây lát…",
        duration: 4500,
      });
      // Defer the redirect slightly so the toast is visible before the
      // page transitions to /login.
      setTimeout(() => {
        router.push("/login?reason=session_expired");
      }, 600);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
    };
  }, [router, logout]);
}
