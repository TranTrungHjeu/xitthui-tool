import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  BriefcaseBusiness,
  CalendarClock,
  Settings,
  TableProperties,
  Clock,
  Bot,
  Search,
  CornerDownLeft,
  GraduationCap,
  LogOut,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { authService } from "@/services/authService";
import { isKhiemAccount } from "@/lib/utils";

interface CommandItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  shortcut?: string[];
  group: string;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isKhiem = isKhiemAccount(user);

  const items: CommandItem[] = React.useMemo(() => {
    const baseItems: CommandItem[] = [
      {
        label: "Tổng quan",
        href: "/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        group: "Điều hướng",
      },
      {
        label: "Lớp học",
        href: "/dashboard/classes",
        icon: <Calendar className="h-4 w-4" />,
        group: "Điều hướng",
      },
      {
        label: "Học viên",
        href: "/dashboard/students",
        icon: <Users className="h-4 w-4" />,
        group: "Điều hướng",
      },
      {
        label: "Nhân sự",
        href: "/dashboard/personnel",
        icon: <BriefcaseBusiness className="h-4 w-4" />,
        group: "Điều hướng",
      },
      {
        label: "Lịch làm việc",
        href: "/dashboard/schedules",
        icon: <CalendarClock className="h-4 w-4" />,
        shortcut: ["G", "S"],
        group: "Điều hướng",
      },
      {
        label: "Book Trial",
        href: "/dashboard/spreadsheet",
        icon: <TableProperties className="h-4 w-4" />,
        group: "Điều hướng",
      },
      {
        label: "Office Hours",
        href: "/dashboard/office-hours",
        icon: <Clock className="h-4 w-4" />,
        group: "Điều hướng",
      },
    ];

    if (isKhiem) {
      baseItems.push({
        label: "Zalo Bot",
        href: "/dashboard/zalo-bot",
        icon: <Bot className="h-4 w-4" />,
        group: "Điều hướng",
      });
    }

    baseItems.push(
      {
        label: "Cài đặt",
        href: "/dashboard/settings",
        icon: <Settings className="h-4 w-4" />,
        shortcut: ["G", ","],
        group: "Tài khoản",
      },
      {
        label: "Đăng xuất",
        icon: <LogOut className="h-4 w-4 text-destructive" />,
        group: "Tài khoản",
        action: () => {
          const sessionId = useAuthStore.getState().sessionId;
          if (sessionId) {
            authService.logout(sessionId).catch(() => {});
          }
          logout();
          router.push("/login");
        },
      },
    );

    return baseItems;
  }, [isKhiem, logout, router]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.group.toLowerCase().includes(q),
    );
  }, [items, query]);

  const grouped = React.useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filtered]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (item: CommandItem) => {
    onOpenChange(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) handleSelect(item);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-[640px] gap-0 overflow-hidden sm:rounded-xl"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center gap-3 px-4 border-b border-border h-12">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trang, lệnh, hoặc gõ để điều hướng..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 text-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả cho "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group} className="mb-1">
                <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const flatIndex = filtered.indexOf(item);
                    const isActive = flatIndex === activeIndex;
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left transition-colors relative",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/80 hover:bg-accent/50",
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[#E31F26]" />
                        )}
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md shrink-0 transition-colors",
                            isActive
                              ? "bg-[#E31F26] text-white shadow-sm"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1 font-medium truncate">
                          {item.label}
                        </span>
                        {item.shortcut && (
                          <span className="hidden sm:flex items-center gap-1">
                            {item.shortcut.map((k) => (
                              <kbd
                                key={k}
                                className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 h-5 min-w-5 text-[10px] font-mono text-muted-foreground"
                              >
                                {k}
                              </kbd>
                            ))}
                          </span>
                        )}
                        {isActive && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-[#E31F26] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">↓</kbd>
              di chuyển
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">↵</kbd>
              chọn
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-semibold text-[#E31F26] dark:text-[#FFD62D]">
            <Sparkles className="h-3 w-3 text-[#FFD62D] animate-pulse" />
            <span>MindX Support Tools</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
