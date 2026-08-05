"use client";

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { LmsCriteriaSection } from "@/types/lms";

interface CriteriaPanelProps {
  readonly sections: LmsCriteriaSection[];
  readonly checked: Record<string, string[]>;
  readonly openGroups: string[];
  readonly onCheck: (group: string, values: string[]) => void;
  readonly onCollapse: (group: string) => void;
  readonly loading?: boolean;
}

export function CriteriaPanel({
  sections,
  checked,
  openGroups,
  onCheck,
  onCollapse,
  loading = false,
}: CriteriaPanelProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Không có tiêu chí nào để hiển thị
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden w-full">
      {sections.map((group) => {
        const isOpen = openGroups.includes(group.title);
        const selectedCount = checked[group.title]?.length || 0;
        return (
          <div key={group.title}>
            <button
              type="button"
              onClick={() => onCollapse(group.title)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors text-left"
            >
              <span className="font-semibold text-sm text-foreground truncate max-w-[60%]">
                {group.title}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="info" className="text-xs">
                  {selectedCount}/{group.criteria.length}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
              )}
            >
              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-1.5">
                  {group.criteria.map((c) => {
                    const itemValue = c.label;
                    const isSelected =
                      checked[group.title]?.includes(itemValue) || false;
                    return (
                      <label
                        key={c.id || c.label}
                        className="flex items-start gap-2.5 p-2 rounded-md hover:bg-accent/40 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checkedValue) => {
                            const current = checked[group.title] || [];
                            const next = checkedValue
                              ? [...current, itemValue]
                              : current.filter((v) => v !== itemValue);
                            onCheck(group.title, next);
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium leading-snug text-foreground block">
                            {c.label}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CriteriaPanel;
