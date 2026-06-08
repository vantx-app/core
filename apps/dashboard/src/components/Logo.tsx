import { LogoProps } from "@/types";
import { useId } from "react";

export function Logo({
  className = "",
  showText = true,
  size = "md",
  variant = "auto",
}: LogoProps) {
  const id = useId();

  // Resolve size in pixels
  const sizePx =
    typeof size === "number"
      ? size
      : size === "sm"
        ? 24
        : size === "md"
          ? 32
          : 40;

  // Resolve typography sizing classes
  const textClass =
    size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl";

  // Resolve variant-specific colors for the typography text
  const textColorClass =
    variant === "light"
      ? "text-slate-900"
      : variant === "dark"
        ? "text-white"
        : "text-slate-900 dark:text-white";

  // Wing gradient colors based on variant
  const wingStart =
    variant === "light"
      ? "#475569"
      : variant === "dark"
        ? "#94a3b8"
        : "var(--vantx-wing-start, #475569)";
  const wingEnd =
    variant === "light"
      ? "#0f172a"
      : variant === "dark"
        ? "#475569"
        : "var(--vantx-wing-end, #0f172a)";

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* SVG Icon Graphic */}
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id={`vantx-grad-primary-${id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient
            id={`vantx-grad-secondary-${id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          <linearGradient
            id={`vantx-grad-wing-${id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={wingStart} />
            <stop offset="100%" stopColor={wingEnd} />
          </linearGradient>
        </defs>

        {/* Left wing slash */}
        <path
          d="M5 9 L13 25 H16.5 L8.5 9 Z"
          fill={`url(#vantx-grad-wing-${id})`}
        />

        {/* Right wing slash (Deep Blue) */}
        <path
          d="M27 9 L19 25 H15.5 L23.5 9 Z"
          fill={`url(#vantx-grad-primary-${id})`}
        />

        {/* Center telemetry chevron (Electric Blue pointing up) */}
        <path
          d="M16 5 L23 16 L20 16 L16 11 L12 16 L9 16 Z"
          fill={`url(#vantx-grad-secondary-${id})`}
        />
      </svg>

      {/* Typography */}
      {showText && (
        <span
          className={`font-sans font-black tracking-tight flex items-center leading-none ${textClass} ${textColorClass}`}
        >
          <span>Vant</span>
          {/* Kept text-primary here assuming X stays brand-colored in both variants */}
          <span className="text-primary font-black">X</span>
        </span>
      )}
    </div>
  );
}
