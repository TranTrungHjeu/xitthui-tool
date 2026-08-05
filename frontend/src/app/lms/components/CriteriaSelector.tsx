"use client";

import { Settings } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { LmsCriteriaTemplate } from "@/types/lms";

interface CriteriaSelectorProps {
  readonly criteriaList: LmsCriteriaTemplate[];
  readonly selectedCriteriaId: string;
  readonly onChange: (id: string) => void;
  readonly onManage?: () => void;
  readonly loading?: boolean;
}

export function CriteriaSelector({
  criteriaList,
  selectedCriteriaId,
  onChange,
  onManage,
  loading = false,
}: CriteriaSelectorProps) {
  const isEmpty = criteriaList.length === 0;

  return (
    <div className="flex gap-2 w-full">
      <Select
        value={selectedCriteriaId}
        onValueChange={onChange}
        disabled={isEmpty || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Chọn bộ tiêu chí" />
        </SelectTrigger>
        <SelectContent>
          {criteriaList.map((c) => (
            <SelectItem key={c._id} value={c._id}>
              <span className="inline-flex items-center gap-2">
                <span>{c.name}</span>
                {c.type === "default" && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    Mặc định
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onManage && (
        <button
          type="button"
          onClick={onManage}
          className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-sm hover:bg-accent transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Quản lý</span>
        </button>
      )}
    </div>
  );
}

export default CriteriaSelector;
