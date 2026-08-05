"use client";

import { Search, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { LESSON_SUBJECTS, LessonSubject } from "@/types/lesson";

export const LESSON_LEVELS = ["basic", "advance", "intensive"] as const;
export type LessonLevel = (typeof LESSON_LEVELS)[number];

export const LESSON_LEVEL_LABELS: Record<LessonLevel, string> = {
  basic: "Basic",
  advance: "Advance",
  intensive: "Intensive"
};

interface LessonFilterPanelProps {
  subject: LessonSubject | "";
  level: LessonLevel | "";
  query: string;
  onSubjectChange: (value: LessonSubject | "") => void;
  onLevelChange: (value: LessonLevel | "") => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const ALL_LABEL = "Tất cả";

export function LessonFilterPanel({
  subject,
  level,
  query,
  onSubjectChange,
  onLevelChange,
  onQueryChange,
  onSearch,
  onClear,
  onRefresh,
  loading
}: LessonFilterPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-3 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Môn học</label>
        <Select
          value={subject || ALL_LABEL}
          onValueChange={(v) =>
            onSubjectChange(v === ALL_LABEL ? "" : (v as LessonSubject))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn môn học" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LABEL}>{ALL_LABEL}</SelectItem>
            {LESSON_SUBJECTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-3 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Cấp độ</label>
        <Select
          value={level || ALL_LABEL}
          onValueChange={(v) =>
            onLevelChange(v === ALL_LABEL ? "" : (v as LessonLevel))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn cấp độ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LABEL}>{ALL_LABEL}</SelectItem>
            {LESSON_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {LESSON_LEVEL_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-4 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Tìm kiếm</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            placeholder="Tìm theo tiêu đề, mô tả, tag..."
          />
        </div>
      </div>

      <div className="md:col-span-2 flex gap-2">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            title="Làm mới"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
        <Button
          onClick={onSearch}
          disabled={loading}
          className="flex-1"
          size="sm"
        >
          {loading ? "Đang tìm..." : "Tìm kiếm"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          title="Xóa bộ lọc"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
