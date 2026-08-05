"use client";

import { cn } from "@/lib/utils";
import type { LmsSubjectOption } from "@/types/lms";

interface SubjectTabsProps {
  readonly selectedSubject: string;
  readonly onChange: (key: string) => void;
  readonly subjects: LmsSubjectOption[];
}

export function SubjectTabs({ selectedSubject, onChange, subjects }: SubjectTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 shrink-0">
      {subjects.map((s) => {
        const active = selectedSubject === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={cn(
              "h-9 px-4 min-w-[100px] rounded-md text-sm font-medium border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary hover:opacity-90"
                : "border-border bg-background text-foreground hover:border-primary/50",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export default SubjectTabs;
