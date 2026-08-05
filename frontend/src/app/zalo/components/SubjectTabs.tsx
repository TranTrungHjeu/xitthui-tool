"use client";

import { cn } from "@/lib/utils";
import type { LmsSubjectOption } from "@/types/lms";

interface SubjectTabsProps {
  readonly selectedSubject: string | "all";
  readonly onChange: (key: string | "all") => void;
  readonly subjects: readonly LmsSubjectOption[];
  readonly showAll?: boolean;
}

export function SubjectTabs({
  selectedSubject,
  onChange,
  subjects,
  showAll = true,
}: SubjectTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-brand-60-soft/60 border border-brand-60/10">
      {showAll && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className={cn(
            "h-7 px-3 rounded-md text-xs font-semibold border transition-all",
            selectedSubject === "all"
              ? "bg-brand-10 text-white border-brand-10 shadow-[0_1px_3px_-1px_rgba(227,31,38,0.4)]"
              : "border-transparent bg-transparent text-brand-60/80 hover:bg-brand-10/10 hover:text-brand-10",
          )}
        >
          Tất cả
        </button>
      )}
      {subjects.map((s) => {
        const active = selectedSubject === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={cn(
              "h-7 px-3 rounded-md text-xs font-semibold border transition-all",
              active
                ? "bg-brand-10 text-white border-brand-10 shadow-[0_1px_3px_-1px_rgba(227,31,38,0.4)]"
                : "border-transparent bg-transparent text-brand-60/80 hover:bg-brand-10/10 hover:text-brand-10",
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