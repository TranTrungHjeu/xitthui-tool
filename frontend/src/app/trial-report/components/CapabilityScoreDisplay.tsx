"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CapabilityScoreDisplayProps {
  totalScore: number;
  maxScore: number;
  onAutoFill: (targetScore: number) => void;
  label?: string;
}

export function CapabilityScoreDisplay({ totalScore, maxScore, onAutoFill, label }: CapabilityScoreDisplayProps) {
  const scorePercent = Math.round((totalScore / maxScore) * 100);
  const scoreColor = scorePercent >= 80 ? "text-green-600" : scorePercent >= 50 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-slate-700">{label || "Điểm hiện tại"}</span>
          <div className={`text-lg font-bold ${scoreColor}`}>
            {totalScore.toFixed(2)} / {maxScore.toFixed(2)}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Điểm muốn fill</Label>
            <Input
              type="number"
              min={0}
              max={maxScore}
              step={0.25}
              id="targetScore"
              className="w-24"
              placeholder="VD: 4.00"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.getElementById("targetScore") as HTMLInputElement;
              const val = parseFloat(input?.value || "0");
              if (!isNaN(val) && val >= 0 && val <= maxScore) {
                onAutoFill(val);
              }
            }}
          >
            Fill đều
          </Button>
        </div>
      </div>
    </div>
  );
}
