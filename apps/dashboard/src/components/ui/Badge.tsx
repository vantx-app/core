"use client";

import React from "react";
import { BadgeProps } from "@/types";

export function Badge({
  children,
  className = "",
  variant = "neutral",
  size = "md",
  outline = false,
  ...props
}: BadgeProps) {
  // Clases base para DaisyUI badges
  const baseClass = "badge font-bold";

  // Configuración de colores
  const variantClasses = {
    primary: "badge-primary text-white",
    secondary: "badge-secondary",
    accent: "badge-accent",
    neutral: "badge-neutral",
    success: "badge-success text-white bg-emerald-500 border-none",
    warning: "badge-warning text-white bg-amber-500 border-none",
    error: "badge-error text-white bg-rose-500 border-none",
    ghost: "badge-ghost",
    info: "badge-info text-white bg-blue-500 border-none",
  };

  // Configuración de tamaños
  const sizeClasses = {
    xs: "badge-xs text-[9px] py-1 px-1.5 rounded-full",
    sm: "badge-sm text-[10px] py-1.5 px-2 rounded-full",
    md: "badge-md text-xs py-2 px-2.5 rounded-lg",
    lg: "badge-lg text-sm py-2.5 px-3 rounded-xl",
  };

  const resolvedVariant = variantClasses[variant] || variantClasses.neutral;
  const resolvedSize = sizeClasses[size] || sizeClasses.md;
  const outlineClass = outline ? "badge-outline" : "";

  return (
    <span
      className={`${baseClass} ${resolvedVariant} ${resolvedSize} ${outlineClass} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
