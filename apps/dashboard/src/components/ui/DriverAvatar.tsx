"use client";

import { DriverAvatarProps } from "@/types";
import React from "react";

export function DriverAvatar({
  firstName,
  lastName,
  nationalId,
  size = "md",
  className = "",
}: DriverAvatarProps) {
  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    if (lastName) {
      return lastName.slice(0, 2).toUpperCase();
    }
    if (nationalId) {
      return nationalId.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const sizeClass =
    size === "sm"
      ? "w-6 h-6 rounded-lg text-[10px] flex items-center justify-center"
      : "w-10 h-10 rounded-xl text-sm font-bold flex items-center justify-center";

  return (
    <div className={`avatar placeholder shrink-0 ${className}`}>
      <div className={`bg-primary/10 text-primary ${sizeClass}`}>
        {getInitials()}
      </div>
    </div>
  );
}
