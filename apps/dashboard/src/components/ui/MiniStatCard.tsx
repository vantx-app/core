"use client";

import { MiniStatCardProps } from "@/types";
import React from "react";

export function MiniStatCard({
  label,
  value,
  className = "",
}: MiniStatCardProps) {
  return (
    <div
      className={`bg-base-200/30 border border-base-200/50 p-4 rounded-2xl flex flex-col justify-between ${className}`}
    >
      <span className="text-[10px] text-base-content/50 font-bold uppercase truncate">
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-2 min-w-0">{value}</div>
    </div>
  );
}
