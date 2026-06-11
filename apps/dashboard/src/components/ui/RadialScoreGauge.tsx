"use client";

import { RadialScoreGaugeProps } from "@/types";
import React from "react";
import { getScoreCircleColor, formatDate, getScoreTextColor } from "@/utils/client";
import { Info } from "lucide-react";

export function RadialScoreGauge({
  score,
  title,
  subtitle,
  footerText,
  footer,
  size = "md",
  className = "",
  noCard = false,
  lastUpdated,
}: RadialScoreGaugeProps) {
  // Configs based on size
  let svgSizeClass = "w-24 h-24";
  let radius = 38;
  let strokeWidth = 6;
  let cx = 48;
  let cy = 48;
  let circumference = 238; // 2 * Math.PI * 38 ~ 238.76

  if (size === "lg") {
    svgSizeClass = "w-28 h-28";
    radius = 44;
    strokeWidth = 8;
    cx = 56;
    cy = 56;
    circumference = 276; // 2 * Math.PI * 44 ~ 276.46
  } else if (size === "xl") {
    svgSizeClass = "w-28 h-28";
    radius = 46;
    strokeWidth = 8;
    cx = 56;
    cy = 56;
    circumference = 289; // 2 * Math.PI * 46 ~ 289.02
  }

  const hasScore = score != null && !isNaN(score);
  const displayScore = hasScore ? Math.round(score) : null;
  const offset = hasScore
    ? circumference - (circumference * Math.min(100, Math.max(0, score!))) / 100
    : circumference;

  const gaugeElement = (
    <div className="relative flex items-center justify-center my-4">
      <svg className={`${svgSizeClass} transform -rotate-90`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          className="stroke-base-300"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          className={getScoreCircleColor(score)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center flex flex-col items-center justify-center">
        <span
          className={`${size === "md" ? "text-xl" : "text-2xl"} font-black ${getScoreTextColor(score)}`}
        >
          {displayScore !== null ? displayScore : "N/A"}
        </span>
        {displayScore !== null && (
          <span
            className={`${size === "md" ? "text-[9px]" : "text-[10px]"} text-base-content/40 block`}
          >
            / 100
          </span>
        )}
      </div>
    </div>
  );

  const titleElement = (
    <div>
      <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 mb-1">
        {title}
        {lastUpdated && (
          <span
            className="tooltip tooltip-top normal-case font-normal text-xs z-[99]"
            data-tip={`Calculado el: ${formatDate(lastUpdated)}`}
          >
            <Info className="size-3.5 text-base-content/30 hover:text-base-content/60 cursor-pointer" />
          </span>
        )}
      </span>
      {subtitle && (
        <span className="text-[11px] text-base-content/40 block leading-tight">
          {subtitle}
        </span>
      )}
    </div>
  );

  if (noCard) {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {titleElement}
        {gaugeElement}
        {footerText && (
          <span className="badge badge-neutral text-[10px] font-bold py-1.5 px-3">
            {footerText}
          </span>
        )}
        {footer}
      </div>
    );
  }

  // Choose the card styling based on parent component preferences
  const isDriverPortal =
    className.includes("shadow-xl") ||
    className.includes("items-center justify-center");
  const cardClass = isDriverPortal
    ? "card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl items-center justify-center p-6 text-center"
    : "glass-card p-6 flex flex-col items-center justify-between text-center min-h-[220px] hover:border-primary/25 hover:scale-[1.01] transition-all duration-300";

  return (
    <div className={`${cardClass} ${className}`}>
      {titleElement}
      {gaugeElement}
      {footerText && (
        <span
          className={
            isDriverPortal
              ? "text-[10px] font-medium text-base-content/40 mt-3 max-w-xs"
              : "badge badge-neutral text-[10px] font-bold py-1.5 px-3"
          }
        >
          {footerText}
        </span>
      )}
      {footer}
    </div>
  );
}
