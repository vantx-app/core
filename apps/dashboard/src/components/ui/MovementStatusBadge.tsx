"use client";

import { MovementStatusBadgeProps } from "@/types";
import React from "react";

export function MovementStatusBadge({
  status,
  speed,
}: MovementStatusBadgeProps) {
  const s = status || "OFFLINE";

  let label = "Desconectado";
  let badgeClass =
    "bg-gray-500/10 border-gray-500/20 text-gray-700 dark:text-gray-400";
  let dotClass = "bg-gray-400";

  switch (s) {
    case "MOVING":
      label = "En movimiento";
      badgeClass =
        "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400";
      dotClass = "bg-emerald-500 animate-pulse";
      break;
    case "IDLING":
      label = "En ralentí";
      badgeClass =
        "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400";
      dotClass = "bg-amber-500";
      break;
    case "EXCESSIVE_IDLING":
      label = "Ralentí excesivo";
      badgeClass =
        "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400";
      dotClass = "bg-rose-500 animate-ping";
      break;
    case "STOPPED":
      label = "Detenido";
      badgeClass =
        "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400";
      dotClass = "bg-slate-400";
      break;
    case "UNPLUGGED":
      label = "Dispositivo Desconectado";
      badgeClass =
        "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400";
      dotClass = "bg-red-500 animate-pulse";
      break;
  }

  const speedText =
    s === "MOVING" && speed != null && speed > 0 ? ` (${speed} km/h)` : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
    >
      <span className={`size-1.5 rounded-full ${dotClass}`} />
      {label}
      {speedText}
    </span>
  );
}
