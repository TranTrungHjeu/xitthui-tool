"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CriteriaScoreInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function CriteriaScoreInput({ label, value, onChange }: CriteriaScoreInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onChange(Math.min(0.25, Math.max(0, val)));
    }
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <Label className="text-sm flex-1">{label}</Label>
      <Input
        type="number"
        min={0}
        max={0.25}
        step={0.01}
        value={value}
        onChange={handleChange}
        className="w-20 text-right"
      />
    </div>
  );
}
