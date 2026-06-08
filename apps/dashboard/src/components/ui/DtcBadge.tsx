"use client";

import { DtcBadgeProps } from "@/types";
import React from "react";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

export function DtcBadge({ count, showOk = true }: DtcBadgeProps) {
  if (count > 0) {
    return (
      <span className="badge badge-error badge-sm text-white font-bold gap-1">
        <ShieldAlert className="size-3" />
        {count} DTC
      </span>
    );
  }

  if (showOk) {
    return (
      <span className="badge badge-success badge-sm text-white font-bold gap-1">
        <CheckCircle2 className="size-3" />
        OK
      </span>
    );
  }

  return null;
}
