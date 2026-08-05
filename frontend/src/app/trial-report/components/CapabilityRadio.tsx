"use client";

import { cn } from "@/lib/utils";

interface CapabilityLevel {
  score: number;
  description: string;
}

interface CapabilityRadioProps {
  title: string;
  subtitle?: string;
  levels: CapabilityLevel[];
  value?: number;
  onChange: (score: number) => void;
}

export function CapabilityRadio({ title, subtitle, levels, value, onChange }: CapabilityRadioProps) {
  return (
    <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h4 className="font-semibold text-sm mb-1">{title}</h4>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      <div className="space-y-2">
        {levels.map((level) => (
          <label
            key={level.score}
            className={cn(
              "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
              value === level.score ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-100"
            )}
          >
            <input
              type="radio"
              name={title}
              checked={value === level.score}
              onChange={() => onChange(level.score)}
              className="mt-0.5"
            />
            <div className="text-sm">
              <span className="font-semibold">Mức {level.score}: </span>
              <span className="text-slate-700">{level.description}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
