"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { classService } from "../../services/classService";
import { Button } from "../../components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";

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
  const [hasHydrated, setHasHydrated] = useState(false);

  const classes = storedClasses || [];

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.firstName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  // Wait for Zustand persist rehydration before accessing auth state
  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) {
      setHasHydrated(true);
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

  useEffect(() => {
    let isCancelled = false;

    const fetchClasses = async () => {
      if (!user?.teacherId || !token || !isAuthenticated) return;

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
        const data = await classService.getClasses(token || "", user.teacherId);
        if (!isCancelled) {
          setStoredClasses(data || []);
        }
      } catch (err: any) {
        // Sidebar classes are non-critical. Do not use console.error here because
        // Next.js dev overlay surfaces caught Axios errors as runtime errors.
        console.warn(
          "Could not fetch sidebar classes:",
          err.response?.data?.error || err.message,
        );
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
    { label: "Cài đặt", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Toaster position="top-right" expand={true} richColors />
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30">
        <div className="pt-10 pb-6 px-6 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Xitthui logo"
            width={200}
            height={200}
            className="hover:scale-105 transition-transform duration-300 w-full h-auto max-w-[180px]"
            priority
          />
        </div>

        <div className="px-4 mb-4">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-50" />
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isClassesMenu = item.href === "/dashboard/classes";
            const isParentActive = pathname === item.href;
            const isChildActive =
              isClassesMenu && pathname.startsWith("/dashboard/classes/");
            const isActive = isParentActive || isChildActive;

            return (
              <div key={item.href} className="group/item">
                <div
                  className={`relative flex items-center justify-between rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-primary/5 text-primary shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}

                  <Link
                    href={item.href}
                    className={`flex-1 flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive ? "pl-5" : ""
                    }`}
                  >
                    <item.icon
                      className={`mr-3.5 h-5 w-5 transition-colors duration-300 ${
                        isActive
                          ? "text-primary"
                          : "text-slate-400 group-hover/item:text-slate-600"
                      }`}
                    />
                    {item.label}
                  </Link>

                  {isClassesMenu && classes.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsClassesExpanded(!isClassesExpanded);
                      }}
                      className={`p-1.5 mr-2 rounded-lg transition-all duration-200 ${
                        isClassesExpanded
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-slate-100 text-slate-400"
                      }`}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-300 ${
                          isClassesExpanded ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Submenu with animation-like behavior */}
                {isClassesMenu && isClassesExpanded && classes.length > 0 && (
                  <div className="mt-1 ml-6 pl-4 space-y-1 border-l-2 border-slate-100/80 animate-in fade-in slide-in-from-left-2 duration-300">
                    {classes.slice(0, 8).map((cls) => {
                      const classHref = `/dashboard/classes/${cls.id}`;
                      const isClassActive = pathname === classHref;
                      return (
                        <Link
                          key={cls.id}
                          href={classHref}
                          className={`group/sub flex items-center px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 truncate ${
                            isClassActive
                              ? "text-primary bg-primary/5 font-semibold"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-50/80"
                          }`}
                          title={cls.name}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full mr-3 transition-all duration-300 ${
                              isClassActive
                                ? "bg-primary scale-110 shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                                : "bg-slate-300 group-hover/sub:bg-slate-400"
                            }`}
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

        <div className="p-4 mt-auto">
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/10 shadow-inner">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl h-9 text-xs font-semibold transition-all duration-200 border border-transparent hover:border-red-100"
              onClick={handleLogout}
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu */}
      <div className="md:hidden flex flex-col w-full relative">
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100 shadow-sm sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Xitthui logo"
              width={100}
              height={100}
              style={{ width: "auto", height: "40px" }}
              priority
            />
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

        {isMobileMenuOpen && (
          <div className="fixed inset-0 top-[73px] bg-white z-[60] p-6 space-y-3 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {navItems.map((item) => {
              const isClassesMenu = item.href === "/dashboard/classes";
              const isParentActive = pathname === item.href;
              const isChildActive =
                isClassesMenu && pathname.startsWith("/dashboard/classes/");
              const isActive = isParentActive || isChildActive;

              return (
                <div key={item.href} className="space-y-1">
                  <div className="flex items-center justify-between rounded-md">
                    <Link
                      href={item.href}
                      onClick={() =>
                        !isClassesMenu && setIsMobileMenuOpen(false)
                      }
                      className={`flex-1 flex items-center px-4 py-3 text-base font-medium rounded-md ${
                        isActive
                          ? "bg-slate-50 text-primary border-l-2 border-primary pl-2"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <item.icon
                        className={`mr-3 h-6 w-6 ${isActive ? "text-primary" : "text-slate-400"}`}
                      />
                      {item.label}
                    </Link>
                    {isClassesMenu && classes.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setIsClassesExpanded(!isClassesExpanded);
                        }}
                        className="p-3 text-slate-500"
                      >
                        {isClassesExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                    )}
                  </div>

                  {isClassesMenu && isClassesExpanded && classes.length > 0 && (
                    <div className="pl-12 space-y-1 border-l ml-7 border-slate-200">
                      {classes.map((cls) => {
                        const classHref = `/dashboard/classes/${cls.id}`;
                        const isClassActive = pathname === classHref;
                        return (
                          <Link
                            key={cls.id}
                            href={classHref}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                              isClassActive
                                ? "text-primary bg-primary/5 font-semibold"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors ${
                                isClassActive
                                  ? "bg-primary"
                                  : "bg-slate-300 group-hover:bg-slate-400"
                              }`}
                            />
                            {cls.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 py-3"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-6 w-6" />
              Đăng xuất
            </Button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Main Content Desktop */}
      <main className="hidden md:block flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
