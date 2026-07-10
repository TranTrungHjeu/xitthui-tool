"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { classService } from "../../services/classService";
import { authService } from "../../services/authService";
import { Button } from "../../components/ui/button";
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
  ChevronRight,
  ChevronLeft,
  TableProperties,
  Bot,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { isKhiemAccount, cn } from "@/lib/utils";

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

  const classes = storedClasses || [];

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.firstName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  const getRoleDisplay = (roles?: string[]) => {
    if (!roles || roles.length === 0) return "Giáo viên";
    if (roles.includes("TE")) return "Quản lý / TE";
    if (roles.includes("TEACHER")) return "Giáo viên";
    return roles.join(", ");
  };

  const roleDisplay = getRoleDisplay(user?.appRoles);

  // Wait for Zustand persist rehydration before accessing auth state
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

  // Explicitly validate token on mount
  useEffect(() => {
    let isCancelled = false;

    const validateSession = async () => {
      if (hasHydrated && isAuthenticated && token && user?.id) {
        try {
          await authService.testToken(token, user.id);
        } catch (error) {
          if (!isCancelled) {
            console.warn("Token validation failed:", error);
            // Interceptor handles logout if refresh fails
          }
        }
      }
    };

    validateSession();

    return () => {
      isCancelled = true;
    };
  }, [hasHydrated, isAuthenticated, token, user]);

  useEffect(() => {
    let isCancelled = false;

    const fetchClasses = async () => {
      const isTE = user?.appRoles?.includes("TE" as any);
      if ((!user?.teacherId && !isTE) || !token || !isAuthenticated) return;

      // Optimize: If we have classes in store and they're less than 5 mins old, don't refetch
      const CACHE_TIME = 5 * 60 * 1000;
      if (
        storedClasses &&
        lastClassesFetch &&
        Date.now() - lastClassesFetch < CACHE_TIME
      ) {
        return;
      }

      // If already on dashboard, let the dashboard component handle the primary fetch
      // to avoid redundant concurrent requests
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
        // Sidebar classes are non-critical. Do not use console.error here because
        // Next.js dev overlay surfaces caught Axios errors as runtime errors.
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.warn("Could not fetch sidebar classes:", errorMsg);
        if (!isCancelled) {
          // Keep old data if fetch fails
        }
      }
    };

    fetchClasses();

    return () => {
      isCancelled = true;
    };
  }, [user, token, isAuthenticated, pathname]);

  if (!isAuthenticated) return null;

  const navItems = [
    { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
    {
      label: "Lớp học",
      href: "/dashboard/classes",
      icon: Calendar,
      hasSubmenu: true,
    },
    { label: "Học viên", href: "/dashboard/students", icon: Users },
    { label: "Nhân sự", href: "/dashboard/personnel", icon: BriefcaseBusiness },
    {
      label: "Lịch làm việc",
      href: "/dashboard/schedules",
      icon: CalendarClock,
    },
    {
      label: "Book Trial",
      href: "/dashboard/spreadsheet",
      icon: TableProperties,
    },
    {
      label: "Office Hours",
      href: "/dashboard/office-hours",
      icon: Clock,
    },
    ...(isKhiemAccount(user)
      ? [{ label: "Cài đặt Zalo Bot", href: "/dashboard/zalo-bot", icon: Bot }]
      : []),
    { label: "Cài đặt", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    const sessionId = useAuthStore.getState().sessionId;
    if (sessionId) {
      // Fire and forget so we don't block the UI if the request hangs or fails
      authService.logout(sessionId).catch((err) => {
        console.error("Backend logout failed:", err);
      });
    }
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-dvh bg-[#f8fafc] overflow-hidden">
      <Toaster position="top-right" expand={true} richColors />
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex relative flex-col transition-all duration-300 bg-white border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30 ${
          isSidebarCollapsed ? "w-20" : "w-72"
        }`}
      >
        {isSidebarCollapsed && (
          <div className="relative pt-4 pb-2 flex items-center justify-center px-4">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 z-50 flex items-center justify-center"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Mở rộng thanh bên"
            >
              <ChevronRight className="size-4 text-slate-500" />
            </Button>
          </div>
        )}

        <nav className={cn(
          "flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar",
          !isSidebarCollapsed ? "pt-6" : "pt-0"
        )}>
          {navItems.map((item) => {
            const isClassesMenu = item.href === "/dashboard/classes";
            const isParentActive = pathname === item.href;
            const isChildActive =
              isClassesMenu && pathname.startsWith("/dashboard/classes/");
            const isActive = isParentActive || isChildActive;

            return (
              <div key={item.href} className="group/item">
                <div
                  className={cn(
                    "relative flex items-center justify-between rounded-xl transition-all duration-150 ease-out",
                    isActive
                      ? "bg-primary/[0.04] text-primary shadow-sm font-semibold"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {isActive && (
                    <div
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full transition-all duration-150 ease-out shadow-[0_0_8px_rgba(227,31,38,0.4)]",
                        isSidebarCollapsed ? "left-1" : "left-0"
                      )}
                    />
                  )}

                  <Link
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "flex-1 flex items-center transition-all duration-150 ease-out",
                      isSidebarCollapsed ? "justify-center px-0" : "px-4",
                      isActive && !isSidebarCollapsed ? "pl-5 text-primary" : "text-inherit",
                      "py-2.5 text-sm font-medium"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-5 transition-all duration-150 ease-out",
                        isActive
                          ? "text-primary scale-105"
                          : "text-slate-400 group-hover/item:text-slate-600 group-hover/item:scale-105"
                      )}
                    />
                    <span
                      className={cn(
                        "transition-all duration-150 ease-out whitespace-nowrap overflow-hidden",
                        isSidebarCollapsed
                          ? "max-w-0 opacity-0 pointer-events-none overflow-hidden ml-0"
                          : "max-w-xs opacity-100 ml-3.5"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>

                  {!isSidebarCollapsed && item.href === "/dashboard" && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsSidebarCollapsed(true);
                      }}
                      className="p-1.5 mr-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-150 ease-out active:scale-95 flex items-center justify-center"
                      title="Thu nhỏ thanh bên"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  )}

                  {!isSidebarCollapsed &&
                    isClassesMenu &&
                    classes.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsClassesExpanded(!isClassesExpanded);
                        }}
                        className={cn(
                          "p-1.5 mr-2 rounded-lg transition-all duration-150 ease-out",
                          isClassesExpanded
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-slate-100 text-slate-400"
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform duration-150 ease-out",
                            isClassesExpanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </button>
                    )}
                </div>

                {/* Submenu with animation */}
                {!isSidebarCollapsed &&
                  isClassesMenu &&
                  isClassesExpanded &&
                  classes.length > 0 && (
                    <div className="mt-1 ml-6 pl-4 space-y-1 border-l-2 border-slate-100/80 animate-in fade-in slide-in-from-top-1 duration-150 ease-out">
                      {classes.slice(0, 8).map((cls) => {
                        const classHref = `/dashboard/classes/${cls.id}`;
                        const isClassActive = pathname === classHref;
                        return (
                          <Link
                            key={cls.id}
                            href={classHref}
                            className={cn(
                              "group/sub flex items-center px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 ease-out truncate",
                              isClassActive
                                ? "text-primary bg-primary/5 font-semibold"
                                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50/80"
                            )}
                            title={cls.name}
                          >
                            <div
                              className={cn(
                                "size-1.5 rounded-full mr-3 transition-all duration-150 ease-out",
                                isClassActive
                                  ? "bg-primary scale-125 shadow-[0_0_8px_rgba(227,31,38,0.5)]"
                                  : "bg-slate-300 group-hover/sub:bg-slate-400 group-hover/sub:scale-110"
                              )}
                            />
                            <span className="truncate">{cls.name}</span>
                          </Link>
                        );
                      })}
                      {classes.length > 8 && (
                        <Link
                          href="/dashboard/classes"
                          className="flex items-center px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-primary transition-colors uppercase tracking-wider"
                        >
                          Xem tất cả {classes.length} lớp...
                        </Link>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </nav>

        <div
          className={`mt-auto transition-all duration-300 ${
            isSidebarCollapsed ? "p-2" : "p-4"
          }`}
        >
          <div
            className={`bg-slate-50/80 rounded-2xl border border-slate-100 transition-all duration-300 ${
              isSidebarCollapsed ? "p-2 flex flex-col items-center" : "p-4"
            }`}
          >
            <div
              className={`flex items-center transition-all duration-300 ${
                isSidebarCollapsed ? "justify-center mb-2 gap-0" : "mb-4 gap-3"
              }`}
            >
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/10 shadow-inner shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div
                className={`transition-all duration-300 ease-in-out flex flex-col justify-center min-w-0 ${
                  isSidebarCollapsed
                    ? "max-w-0 opacity-0 pointer-events-none overflow-hidden"
                    : "max-w-[180px] opacity-100"
                }`}
              >
                <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {user?.email}
                </p>
                <div className="mt-1.5 flex">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    {roleDisplay}
                  </span>
                </div>
              </div>
            </div>
            {isSidebarCollapsed ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-full size-9"
                onClick={handleLogout}
                title="Đăng xuất"
              >
                <LogOut className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl h-9 text-xs font-semibold transition-all duration-200 border border-transparent hover:border-red-100"
                onClick={handleLogout}
              >
                <LogOut className="mr-2.5 size-4" />
                Đăng xuất
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Container (Visible on both Mobile and Desktop) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header Mobile */}
        <header className="md:hidden flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-lg tracking-tight">Xitthui Tool</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl bg-slate-50"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </header>

        {/* Mobile Menu Drawer Overlay */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white z-[60] p-6 flex flex-col overflow-y-auto shadow-2xl animate-in slide-in-from-left duration-250 md:hidden">
              {/* Drawer Header */}
              <div className="flex items-center justify-end pb-4 border-b border-slate-100 mb-6 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl size-9 bg-slate-50 hover:bg-slate-100"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="size-5 text-slate-500" />
                </Button>
              </div>

              {/* Navigation Items */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {navItems.map((item) => {
                  const isClassesMenu = item.href === "/dashboard/classes";
                  const isParentActive = pathname === item.href;
                  const isChildActive =
                    isClassesMenu && pathname.startsWith("/dashboard/classes/");
                  const isActive = isParentActive || isChildActive;

                  return (
                    <div key={item.href} className="space-y-1">
                      <div className="flex items-center justify-between rounded-xl">
                        <Link
                          href={item.href}
                          onClick={() =>
                            !isClassesMenu && setIsMobileMenuOpen(false)
                          }
                          className={`flex-1 flex items-center px-4 py-3 text-base font-semibold rounded-xl transition-all duration-200 ${
                            isActive
                              ? "bg-primary/5 text-primary pl-5 border-l-4 border-primary"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <item.icon
                            className={`mr-3.5 size-5 ${isActive ? "text-primary" : "text-slate-400"}`}
                          />
                          {item.label}
                        </Link>
                        {isClassesMenu && classes.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setIsClassesExpanded(!isClassesExpanded);
                            }}
                            className="p-3 text-slate-500 hover:bg-slate-50 rounded-xl"
                          >
                            {isClassesExpanded ? (
                              <ChevronDown className="size-5" />
                            ) : (
                              <ChevronRight className="size-5" />
                            )}
                          </button>
                        )}
                      </div>

                      {isClassesMenu && isClassesExpanded && classes.length > 0 && (
                        <div className="pl-6 space-y-1.5 border-l ml-7 border-slate-100">
                          {classes.map((cls) => {
                            const classHref = `/dashboard/classes/${cls.id}`;
                            const isClassActive = pathname === classHref;
                            return (
                              <Link
                                key={cls.id}
                                href={classHref}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`group flex items-center px-4 py-2.5 text-[13px] font-semibold rounded-lg transition-colors truncate ${
                                  isClassActive
                                    ? "text-primary bg-primary/5 font-bold"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                              >
                                <span
                                  className={`size-1.5 rounded-full mr-3.5 transition-colors ${
                                    isClassActive
                                      ? "bg-primary scale-110"
                                      : "bg-slate-300 group-hover:bg-slate-400"
                                  }`}
                                />
                                <span className="truncate">{cls.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Drawer Footer */}
              <div className="pt-4 border-t border-slate-100 mt-auto shrink-0">
                <div className="p-4 mb-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[13px] font-bold text-slate-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {user?.email}
                  </p>
                  <div className="mt-2 flex">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      {roleDisplay}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50/50 py-3 rounded-xl text-sm font-semibold transition-colors duration-200"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 size-5" />
                  Đăng xuất
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Single Main Viewport */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
