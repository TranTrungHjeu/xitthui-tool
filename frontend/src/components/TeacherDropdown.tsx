"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Search, User } from "lucide-react";
import { Input } from "./ui/input";
import { BookableTeacher } from "../services/spreadsheetService";

interface TeacherDropdownProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: BookableTeacher[];
  isLoading: boolean;
  onSelect: (teacher: BookableTeacher) => void;
  emptyHint?: string;
}

export const TeacherDropdown: React.FC<TeacherDropdownProps> = ({
  isOpen,
  onOpenChange,
  teachers,
  isLoading,
  onSelect,
  emptyHint = "Chưa có giáo viên khả dụng",
}) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? teachers.filter(
        (t) =>
          (t.fullName || "").toLowerCase().includes(q) ||
          (t.code || "").toLowerCase().includes(q),
      )
    : teachers;

  return (
    <div className="absolute left-0 right-0 z-30 max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1 text-xs divide-y divide-border/60 custom-scrollbar animate-in fade-in-50 slide-in-from-top-1">
      <div className="px-2 py-1.5 sticky top-0 z-10 bg-card border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm giáo viên..."
            className="pl-7 h-7 text-[11px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 py-4 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Đang tải giáo viên...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4 text-muted-foreground">
          <User className="h-4 w-4 opacity-50" />
          <span className="text-[11px]">{emptyHint}</span>
        </div>
      ) : (
        filtered.map((teacher) => (
          <button
            key={teacher.id}
            onClick={() => {
              onSelect(teacher);
              onOpenChange(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-muted/50 text-foreground font-medium transition-colors"
          >
            <span>{teacher.fullName}</span>
            {teacher.code && (
              <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
                ({teacher.code})
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
};
