"use client";

import { ScoreProgressBarProps } from "@/types";
import React from "react";

const getScoreTextColor = (score: number): string => {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-error";
};

export function ScoreProgressBar({ score, label }: ScoreProgressBarProps) {
  const roundedScore = Math.round(score);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-base-content/70">{label}</span>
        <span className={`font-bold ${getScoreTextColor(roundedScore)}`}>
          {roundedScore}%
        </span>
      </div>
      <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            roundedScore >= 85
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
              : roundedScore >= 70
                ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                : "bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
          }`}
          style={{ width: `${roundedScore}%` }}
        />
      </div>
    </div>
  );
}
