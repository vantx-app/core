"use client";

import { DetailRowProps } from "@/types";
import React from "react";

export function DetailRow({
  label,
  value,
  border = true,
  className = "",
}: DetailRowProps) {
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${
        border ? "border-b border-base-200/30" : ""
      } ${className}`}
    >
      <span className="text-base-content/50">{label}</span>
      <span className="font-bold text-base-content/85 truncate max-w-[70%]">
        {value}
      </span>
    </div>
  );
}
