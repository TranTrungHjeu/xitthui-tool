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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/CommandPalette";
import { cn, isKhiemAccount } from "@/lib/utils";
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
  Bot,
  Clock,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Search,
  Bell,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
};

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
  const [isClassesExpanded, setIsClassesExpanded] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const classes = storedClasses || [];

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

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  /* ── Token validation ──────────────────────────────────────── */
  useEffect(() => {
    let isCancelled = false;
    const validateSession = async () => {
      if (hasHydrated && isAuthenticated && token && user?.id) {
        try {
          await authService.testToken(token, user.id);
        } catch (error) {
          if (!isCancelled) {
            console.warn("Token validation failed:", error);
          }
        }
      }
    };
    validateSession();
    return () => {
      isCancelled = true;
    };
  }, [hasHydrated, isAuthenticated, token, user]);

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
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isAuthenticated) return null;

  const navItems: NavItem[] = [
    { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard, shortcut: "G D" },
    { label: "Lớp học", href: "/dashboard/classes", icon: Calendar },
    { label: "Học viên", href: "/dashboard/students", icon: Users },
    { label: "Nhân sự", href: "/dashboard/personnel", icon: BriefcaseBusiness },
    { label: "Lịch làm việc", href: "/dashboard/schedules", icon: CalendarClock },
    { label: "Book Trial", href: "/dashboard/spreadsheet", icon: TableProperties },
    { label: "Office Hours", href: "/dashboard/office-hours", icon: Clock },
    ...(isKhiemAccount(user)
      ? [{ label: "Zalo Bot", href: "/dashboard/zalo-bot", icon: Bot }]
      : []),
    { label: "Cài đặt", href: "/dashboard/settings", icon: Settings },
  ];

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
        {!compact && isClassesMenu && classes.length > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsClassesExpanded(!isClassesExpanded);
            }}
            className={cn(
              "rounded p-0.5 hover:bg-accent transition-transform",
              isClassesExpanded ? "rotate-0" : "-rotate-90",
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
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
    <div className="flex h-dvh bg-background overflow-hidden">
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
          {navItems.map((item) => renderNavItem(item, isSidebarCollapsed))}

          {/* Classes submenu (expanded only) */}
          {!isSidebarCollapsed &&
            pathname.startsWith("/dashboard/classes") &&
            isClassesExpanded &&
            classes.length > 0 && (
              <div className="ml-4 mt-1 pl-3 border-l border-border space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {classes.slice(0, 8).map((cls) => {
                  const href = `/dashboard/classes/${cls.id}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={cls.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] truncate transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          isActive ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="truncate">{cls.name}</span>
                    </Link>
                  );
                })}
                {classes.length > 8 && (
                  <Link
                    href="/dashboard/classes"
                    className="block px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-primary"
                  >
                    Xem tất cả {classes.length} lớp →
                  </Link>
                )}
              </div>
            )}
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

            {/* Command palette trigger */}
            <button
              onClick={() => setIsCommandOpen(true)}
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors min-w-0 max-w-md flex-1 group"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate hidden sm:inline">
                Tìm kiếm hoặc nhảy tới trang...
              </span>
              <span className="text-sm truncate sm:hidden">Tìm...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 ml-auto rounded border border-border bg-background px-1.5 h-5 text-[10px] font-mono opacity-70 group-hover:opacity-100">
                <span>⌘</span>K
              </kbd>
            </button>

            <div className="hidden xl:flex items-center gap-2 text-sm shrink-0">
              <span className="text-muted-foreground">Xin chào,</span>
              <span className="font-semibold truncate max-w-[160px]">
                {displayName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 relative"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Thông báo</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-page-enter">{children}</div>
        </main>
      </div>

      <CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} />

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

            {/* User info */}
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

            <nav className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
              {navItems.map((item) => renderNavItem(item))}
            </nav>

            <Separator className="my-2" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </aside>
        </>
      )}
    </div>
  );
}
