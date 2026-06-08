"use client";

import { DriverInfoLabelDriverInfo, DriverInfoLabelProps } from "@/types";
import React from "react";

export function DriverInfoLabel({
  driver,
  showNationalId = true,
  className = "",
}: DriverInfoLabelProps) {
  if (!driver || !driver.nationalId) {
    return (
      <span className={`text-base-content/40 italic ${className}`}>
        Sin conductor
      </span>
    );
  }

  const name =
    driver.firstName && driver.lastName
      ? `${driver.firstName} ${driver.lastName}`
      : null;

  return (
    <div className={`flex flex-col ${className}`}>
      <span className="font-bold text-base-content/85">
        {name || driver.nationalId}
      </span>
      {name && showNationalId && (
        <span className="text-[10px] text-base-content/40 font-mono">
          {driver.nationalId}
        </span>
      )}
    </div>
  );
}
