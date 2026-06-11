"use client";

import { WelcomeBannerProps } from "@/types";
import React from "react";

export function WelcomeBanner({
  badgeText,
  title,
  description,
  gradientClass = "from-blue-700 via-indigo-700 to-purple-800",
  icon,
}: WelcomeBannerProps) {
  return (
    <div
      className={`bg-gradient-to-r ${gradientClass} rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-md border border-white/5 animate-fade-in`}
    >
      {icon && (
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10 pointer-events-none">
          {icon}
        </div>
      )}
      <div className="relative z-10 space-y-2 max-w-2xl">
        {badgeText && (
          <span className="badge bg-white/20 border-none text-white text-xs font-bold uppercase tracking-wider px-3 py-1">
            {badgeText}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          {title}
        </h1>
        <p className="text-white/70 text-sm md:text-base">{description}</p>
      </div>
    </div>
  );
}
