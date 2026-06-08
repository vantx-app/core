"use client";

import React from "react";
import { AlertProps } from "@/types";
import { ShieldAlert, CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export function Alert({
  variant = "info",
  title,
  message,
  icon,
  onClose,
  className = "",
  children,
  ...props
}: AlertProps) {
  // Clases base para DaisyUI alert
  const baseClass =
    "alert shadow-sm text-xs p-3.5 rounded-2xl flex items-start gap-2.5 leading-relaxed border animate-in fade-in duration-200";

  // Configuración de variantes
  const variantClasses = {
    success:
      "alert-success bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400",
    warning:
      "alert-warning bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400",
    error:
      "alert-error bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-400",
    info: "alert-info bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-400",
  };

  // Icono por defecto según la variante si no se proporciona uno personalizado
  const defaultIcons = {
    success: (
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
    ),
    warning: (
      <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
    ),
    error: (
      <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
    ),
    info: (
      <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
    ),
  };

  const resolvedVariant = variantClasses[variant] || variantClasses.info;
  const resolvedIcon = icon !== undefined ? icon : defaultIcons[variant];

  return (
    <div className={`${baseClass} ${resolvedVariant} ${className}`} {...props}>
      {resolvedIcon}

      <div className="flex-1 min-w-0">
        {title && <span className="font-bold block mb-0.5">{title}</span>}
        <div className="text-xs leading-normal">{message || children}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-circle btn-xs -mr-1.5 -mt-1 hover:bg-base-200/50"
          aria-label="Cerrar alerta"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
