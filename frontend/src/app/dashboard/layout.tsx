"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { classService } from "@/services/classService";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginModal } from "@/components/LoginModal";
import { cn, isKhiemAccount } from "@/lib/utils";
import { useSessionExpiredGuard } from "@/hooks/useSessionExpiredGuard";
import { toast } from "sonner";
import {
  NAV_ACCESS,
  PUBLIC_TOOLS,
  canAccessNav,
  DEFAULT_FALLBACK_HREF,
  type PublicToolEntry,
} from "@/lib/access";
import {
  LayoutDashboard,
  Calendar,
  Users,
  BriefcaseBusiness,
  CalendarClock,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  TableProperties,
  Clock,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
};

const NAV_ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/classes": Calendar,
  "/dashboard/students": Users,
  "/dashboard/personnel": BriefcaseBusiness,
  "/dashboard/schedules": CalendarClock,
  "/dashboard/spreadsheet": TableProperties,
  "/dashboard/office-hours": Clock,
  "/dashboard/payroll": Wallet,
  "/dashboard/settings": Settings,
};

function buildNavItems(user: {
  appRoles?: string[];
  appPermissions?: string[];
} | null): NavItem[] {
  return NAV_ACCESS.filter((entry) => canAccessNav(user, entry.href)).map(
    (entry) => ({
      label: entry.label,
      href: entry.href,
      icon: NAV_ICON_MAP[entry.href] ?? LayoutDashboard,
      shortcut:
        entry.href === "/dashboard"
          ? "G D"
          : entry.href === "/dashboard/schedules"
            ? "G S"
            : undefined,
    }),
  );
}

/**
 * Build the URL a public tool renders at inside the dashboard shell.
 * All tools share the `/dashboard` shell and switch via `?tool=<key>`.
 */
export function toolHref(toolKey: string): string {
  return `/dashboard/tools/${toolKey}`;
}

/**
 * Returns the public tool entry matching the given query string key,
 * or null when the key is unknown.
 */
export function findPublicTool(
  toolKey: string | null | undefined,
): PublicToolEntry | null {
  if (!toolKey) return null;
  return PUBLIC_TOOLS.find((t) => t.key === toolKey) ?? null;
}

/** True when the pathname targets a dashboard route that requires auth. */
function isProtectedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (!pathname.startsWith("/dashboard")) return false;
  // /dashboard and /dashboard/tools/<key> are public — guests may view them.
  if (pathname === "/dashboard") return false;
  if (/^\/dashboard\/tools\/[^/]+$/.test(pathname)) return false;
  return NAV_ACCESS.some((entry) =>
    pathname === entry.href || pathname.startsWith(`${entry.href}/`),
  );
}

/**
 * Reads `?tool=<key>` from the URL — returns the active public tool key
 * when /dashboard is open with a tool param, otherwise null.
 */
function useActiveToolKey(
  pathname: string | null,
): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/dashboard\/tools\/([^/]+)$/);
  if (!match) return null;
  return PUBLIC_TOOLS.some((t) => t.key === match[1]) ? match[1] : null;
}

function NavSectionLabel({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact: boolean;
}) {
  if (compact) {
    return <div className="my-2 mx-auto h-px w-6 bg-border" aria-hidden />;
  }
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    token,
    isAuthenticated,
    logout,
    classes: storedClasses,
    lastClassesFetch,
    setClasses: setStoredClasses,
  } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const classes = storedClasses || [];

  // When the API layer can't refresh the token, this guard clears the
  // session, shows a toast, and bounces the user to /login.
  useSessionExpiredGuard();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.firstName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const getRoleDisplay = (roles?: string[]) => {
    if (!roles || roles.length === 0) return "Giáo viên";
    if (roles.includes("TE")) return "Quản lý / TE";
    if (roles.includes("TEACHER")) return "Giáo viên";
    return roles.join(", ");
  };

  const roleDisplay = getRoleDisplay(user?.appRoles);

  /* ── Hydration guard ────────────────────────────────────────── */
  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) {
      const timer = setTimeout(() => setHasHydrated(true), 0);
      return () => clearTimeout(timer);
    } else {
      const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
        setHasHydrated(true);
      });
      return () => unsub?.();
    }
  }, []);

  /* ── Auth guard: show login modal for guests on protected routes ── */
  useEffect(() => {
    if (hasHydrated && !isAuthenticated && isProtectedRoute(pathname)) {
      setIsLoginModalOpen(true);
    }
  }, [hasHydrated, isAuthenticated, pathname]);

  /* ── Token validation ──────────────────────────────────────── */
  useEffect(() => {
    let isCancelled = false;
    const validateSession = async () => {
      if (hasHydrated && isAuthenticated && token && user?.id) {
        try {
          await authService.testToken(token, user.id);
        } catch (error: any) {
          if (isCancelled) return;
          const status = error?.response?.status;
          // 401 — JWT truly invalid/expired. Drop the session.
          if (status === 401) {
            toast.warning("Phiên đăng nhập đã hết hạn", {
              description:
                "Vui lòng đăng nhập lại để tiếp tục. Trang sẽ chuyển trong giây lát…",
              duration: 4500,
            });
            logout();
            router.push("/login?reason=session_expired");
            return;
          }
          // 403 — server rejected (e.g. permission glitch or origin policy).
          // Don't destroy the session; log so we can diagnose.
          if (status === 403) {
            console.warn(
              "Session check returned 403 — keeping session.",
              error?.response?.data,
            );
            return;
          }
          if (status === 503) {
            // Network/service glitch — keep the user logged in.
            return;
          }
          console.warn("Token validation failed:", error);
        }
      }
    };
    validateSession();
    return () => {
      isCancelled = true;
    };
  }, [hasHydrated, isAuthenticated, token, user, logout, router]);

  /* ── Sidebar classes cache ─────────────────────────────────── */
  useEffect(() => {
    let isCancelled = false;
    const fetchClasses = async () => {
      const isTE = user?.appRoles?.includes("TE" as any);
      if ((!user?.teacherId && !isTE) || !token || !isAuthenticated) return;

      const CACHE_TIME = 5 * 60 * 1000;
      if (
        storedClasses &&
        lastClassesFetch &&
        Date.now() - lastClassesFetch < CACHE_TIME
      ) {
        return;
      }

      if (pathname === "/dashboard" && !storedClasses) return;

      try {
        const data = await classService.getClasses(
          token || "",
          user?.teacherId || "",
          user?.teacherCentres?.map((c: any) => c.id || c),
          user?.appRoles,
          {
            statusIn: ["RUNNING", "IN_PROGRESS", "ĐANG_DIỄN_RA"],
            limit: 1000,
          },
        );
        if (!isCancelled) {
          setStoredClasses(data?.data || []);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.warn("Could not fetch sidebar classes:", errorMsg);
      }
    };
    fetchClasses();
    return () => {
      isCancelled = true;
    };
  }, [user, token, isAuthenticated, pathname]);

  /* ── Command palette keyboard shortcut ───────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Direct-URL access guard ─────────────────────────────── */
  useEffect(() => {
    if (!hasHydrated) return;
    if (!pathname) return;
    if (pathname === "/dashboard") return;
    if (pathname.startsWith("/dashboard/_")) return;
    if (!pathname.startsWith("/dashboard")) return;

    if (!canAccessNav(user, pathname)) {
      router.replace(DEFAULT_FALLBACK_HREF);
    }
  }, [hasHydrated, pathname, user, router]);

  if (!hasHydrated) return null;

  const navItems: NavItem[] = buildNavItems(user);

  /* Active-tool detection: when /dashboard?tool=<key> is open, highlight
     the matching public tool in the sidebar. */
  const activeToolKey = useActiveToolKey(pathname);

  const handleLogout = () => {
    const sessionId = useAuthStore.getState().sessionId;
    if (sessionId) {
      authService.logout(sessionId).catch((err) => {
        console.error("Backend logout failed:", err);
      });
    }
    logout();
    router.push("/login");
  };

  const renderPublicTool = (tool: PublicToolEntry, compact = false) => {
    const isActive = tool.key === activeToolKey;
    const node = (
      <Link
        href={`/dashboard/tools/${tool.key}`}
        onClick={() => setIsMobileMenuOpen(false)}
        className={cn(
          "group/tool relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
          compact ? "justify-center" : "",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <tool.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive
              ? "text-primary"
              : "text-muted-foreground group-hover/tool:text-foreground",
          )}
        />
        {!compact && (
          <span className="truncate flex-1">{tool.label}</span>
        )}
      </Link>
    );
    if (compact) {
      return (
        <Tooltip key={tool.key} delayDuration={0}>
          <TooltipTrigger asChild>{node}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {tool.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return <div key={tool.key}>{node}</div>;
  };

  const renderSidebarSection = (compact: boolean) => (
    <>
      <NavSectionLabel compact={compact}>Công cụ hỗ trợ</NavSectionLabel>
      {PUBLIC_TOOLS.map((tool) => renderPublicTool(tool, compact))}
      {isAuthenticated && navItems.length > 0 && (
        <>
          <NavSectionLabel compact={compact}>Quản lý</NavSectionLabel>
          {navItems.map((item) => renderNavItem(item, compact))}
        </>
      )}
    </>
  );

  /* ── Sidebar nav renderer ──────────────────────────────────── */
  const renderNavItem = (item: NavItem, compact = false) => {
    const isClassesMenu = item.href === "/dashboard/classes";
    const isParentActive = pathname === item.href;
    const isChildActive =
      isClassesMenu && pathname.startsWith("/dashboard/classes/");
    const isActive = isParentActive || isChildActive;

    const linkNode = (
      <Link
        href={item.href}
        onClick={() => {
          if (!isClassesMenu) setIsMobileMenuOpen(false);
        }}
        className={cn(
          "group/item relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
          compact ? "justify-center" : "",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover/item:text-foreground",
          )}
        />
        {!compact && (
          <span className="truncate flex-1">{item.label}</span>
        )}
      </Link>
    );

    if (compact) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return <div key={item.href}>{linkNode}</div>;
  };

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* ─── MindX Top Brand Accent Line ───────────────────────────── */}
      <div className="h-0.5 w-full bg-mindx-accent-gradient shrink-0 z-50" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ─── Desktop Sidebar ───────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex relative flex-col border-r border-border bg-card transition-[width] duration-200 ease-out z-30",
          isSidebarCollapsed ? "w-[68px]" : "w-[260px]",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-center border-b border-border px-4 shrink-0">
          {!isSidebarCollapsed ? (
            <Link href="/dashboard" className="flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="MindX"
                width={160}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center"
                >
                  <Image
                    src="/logo.png"
                    alt="MindX"
                    width={40}
                    height={40}
                    className="h-9 w-auto object-contain"
                    priority
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                MindX Support Tools
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {renderSidebarSection(isSidebarCollapsed)}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 hidden md:flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent transition-colors"
          aria-label={isSidebarCollapsed ? "Mở rộng" : "Thu nhỏ"}
        >
          {isSidebarCollapsed ? (
            <ChevronsRight className="h-3 w-3" />
          ) : (
            <ChevronsLeft className="h-3 w-3" />
          )}
        </button>

        {/* User menu */}
        <div className="border-t border-border p-2 shrink-0">
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors text-left",
                    isSidebarCollapsed && "justify-center",
                  )}
                >
                  <Avatar className={cn(isSidebarCollapsed ? "h-8 w-8" : "h-9 w-9")}>
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isSidebarCollapsed && (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {roleDisplay}
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{displayName}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Cài đặt
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* ─── Main + Mobile ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md hover:bg-accent"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {isAuthenticated && (
              <div className="hidden xl:flex items-center gap-2 text-sm shrink-0">
                <span className="text-muted-foreground">Xin chào,</span>
                <span className="font-semibold truncate max-w-[160px]">
                  {displayName}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isAuthenticated && (
              <Button variant="default" size="sm" className="h-9" onClick={() => setIsLoginModalOpen(true)}>
                Đăng nhập
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-page-enter">{children}</div>
        </main>
      </div>

      <LoginModal open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen} />

      {/* ─── Mobile drawer ──────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-card border-r border-border p-3 flex flex-col md:hidden animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <Link href="/dashboard" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="MindX"
                  width={120}
                  height={32}
                  className="h-7 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-accent"
                aria-label="Đóng menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User info — only when logged in */}
            {isAuthenticated && (
              <div className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {roleDisplay}
                  </p>
                </div>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
              {renderSidebarSection(false)}
            </nav>

            <Separator className="my-2" />

            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsLoginModalOpen(true);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4 rotate-180" />
                Đăng nhập
              </button>
            )}
          </aside>
        </>
      )}
      </div>
    </div>
  );
}
