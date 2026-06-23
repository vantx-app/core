"use client";

import { ScoreProgressBarProps } from "@/types";
import React from "react";
import { getScoreTailwindColor } from "@/utils/client";

export function ScoreProgressBar({ score, label }: ScoreProgressBarProps) {
  const hasScore = score != null && !isNaN(score);
  const roundedScore = hasScore ? Math.round(score!) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-base-content/70">{label}</span>
        <span className={`font-bold ${getScoreTailwindColor(roundedScore)}`}>
          {roundedScore !== null ? `${roundedScore} pts` : "N/A"}
        </span>
      </div>
      <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            roundedScore === null
              ? "bg-base-300 w-0"
              : roundedScore >= 85
                ? "bg-emerald-500/40"
                : roundedScore >= 70
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                  : "bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
          }`}
          style={{ width: roundedScore !== null ? `${roundedScore}%` : "0%" }}
        />
      </div>
    </div>
  );
}
