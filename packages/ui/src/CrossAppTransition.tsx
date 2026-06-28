"use client";

import { useState, useEffect, useCallback } from "react";
import { Logo } from "./Logo";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrossAppVariant = "owner" | "driver";

interface OverlayState {
  visible: boolean;
  variant: CrossAppVariant;
}

// ─── Singleton event bus ──────────────────────────────────────────────────────
// Coordinates between navigateToCrossApp() and the overlay component
// without requiring a shared React context (works across subtrees).

type OverlayListener = (state: OverlayState) => void;
const listeners = new Set<OverlayListener>();

function notifyListeners(state: OverlayState) {
  listeners.forEach((fn) => fn(state));
}

// ─── Public helper ────────────────────────────────────────────────────────────

/**
 * Performs a cross-app hard navigation with a branded transition overlay.
 *
 * - Mounts the overlay synchronously before the redirect fires.
 * - 8-second auto-dismiss guard: shows error toast if navigation stalls.
 * - No `beforeunload` listeners — bfcache safe.
 *
 * @param url     Full URL of the destination (e.g. process.env.NEXT_PUBLIC_MARKETPLACE_URL)
 * @param variant "driver" → Emerald ring; "owner" → Royal Blue ring
 */
export function navigateToCrossApp(
  url: string,
  variant: CrossAppVariant = "owner",
): void {
  // Mount overlay immediately (same frame as user action)
  notifyListeners({ visible: true, variant });

  // Fire the redirect on the next tick so the overlay renders first
  setTimeout(() => {
    window.location.href = url;
  }, 10);
}

// ─── Overlay Component ────────────────────────────────────────────────────────

interface OverlayProps {
  /**
   * Canvas background color of the host app.
   * Should match the page background so the overlay feels like a natural
   * extension of the current surface rather than a jarring color flash.
   *
   * - Dashboard (light): "#ffffff" or "#f8fafc"
   * - Marketplace (dark): "#020617"
   */
  background?: string;
}

/**
 * Full-screen branded overlay that appears during cross-app navigations.
 * Must be placed once in each app's root layout, outside {children}.
 */
export function CrossAppTransitionOverlay({
  background = "#f8fafc",
}: OverlayProps) {
  const [overlay, setOverlay] = useState<OverlayState>({
    visible: false,
    variant: "owner",
  });
  const [showCancel, setShowCancel] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const dismiss = useCallback((showError = false) => {
    setIsDismissing(true);
    setTimeout(() => {
      setOverlay({ visible: false, variant: "owner" });
      setShowCancel(false);
      setIsDismissing(false);

      if (showError) {
        // Dispatch a custom event so each app can display its own toast
        window.dispatchEvent(
          new CustomEvent("crossapp:timeout", {
            detail: { message: "No se pudo conectar. Intenta de nuevo." },
          }),
        );
      }
    }, 150);
  }, []);

  useEffect(() => {
    const handler = (state: OverlayState) => {
      if (state.visible) {
        setOverlay(state);
        setShowCancel(false);
        setIsDismissing(false);
      }
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!overlay.visible) return;

    // Tier 2: show "Cancelar" after 3 seconds
    const cancelTimer = setTimeout(() => setShowCancel(true), 3000);
    // Tier 1: auto-dismiss with error after 8 seconds
    const timeoutTimer = setTimeout(() => dismiss(true), 8000);

    return () => {
      clearTimeout(cancelTimer);
      clearTimeout(timeoutTimer);
    };
  }, [overlay.visible, dismiss]);

  if (!overlay.visible) return null;

  const ringColor =
    overlay.variant === "driver"
      ? "#10b981" // Emerald — Marketplace
      : "#1d4ed8"; // Royal Blue — Dashboard

  const ringColorMuted =
    overlay.variant === "driver"
      ? "rgba(16, 185, 129, 0.15)"
      : "rgba(29, 78, 216, 0.15)";

  const isDarkBg =
    background === "#020617" ||
    background.includes("020617") ||
    background.includes("dark");
  const logoVariant = isDarkBg ? "dark" : "light";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando aplicación..."
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        opacity: isDismissing ? 0 : 1,
        transition: isDismissing ? "opacity 150ms ease" : "none",
        // No pointer-events blocking on the page below needed —
        // the overlay itself covers everything
      }}
    >
      {/* Animated ring */}
      <div style={{ position: "relative", width: 72, height: 72 }}>
        {/* Pulsing glow ring (reduced motion: hidden via CSS) */}
        <div
          className="crossapp-pulse-ring"
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            backgroundColor: ringColorMuted,
            animation: "crossapp-pulse 2s ease-in-out infinite",
          }}
        />
        {/* Spinning stroke ring */}
        <svg
          viewBox="0 0 72 72"
          width={72}
          height={72}
          style={{
            position: "absolute",
            inset: 0,
            animation: "crossapp-spin 1s linear infinite",
          }}
        >
          <circle
            cx={36}
            cy={36}
            r={32}
            fill="none"
            stroke={ringColorMuted.replace("0.15", "0.2")}
            strokeWidth={3}
          />
          <circle
            cx={36}
            cy={36}
            r={32}
            fill="none"
            stroke={ringColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="50 150"
            style={{ transformOrigin: "center" }}
          />
        </svg>
        {/* Logo centered in ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Logo size={28} showText={false} variant={logoVariant} />
        </div>
      </div>

      {/* Wordmark — subtle pulse animation */}
      <div
        style={{
          animation: "crossapp-wordmark-pulse 1.8s ease-in-out infinite",
        }}
      >
        <Logo size="md" showText variant={logoVariant} />
      </div>

      {/* Escape hatch — fades in after 3 seconds */}
      <button
        onClick={() => dismiss(false)}
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#64748b",
          fontSize: "0.75rem",
          textDecoration: "underline",
          opacity: showCancel ? 1 : 0,
          transition: "opacity 300ms ease",
          pointerEvents: showCancel ? "auto" : "none",
        }}
        aria-hidden={!showCancel}
        tabIndex={showCancel ? 0 : -1}
      >
        Cancelar
      </button>

      {/* Keyframe styles — injected inline to avoid CSS module dependency */}
      <style>{`
        @keyframes crossapp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes crossapp-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.6; }
          50%       { transform: scale(1.15); opacity: 1;   }
        }
        @keyframes crossapp-wordmark-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1;   }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="crossapp-spin"],
          [style*="crossapp-pulse"],
          [style*="crossapp-wordmark-pulse"] {
            animation: none !important;
          }
          /* Show a 100ms fade-in instead of instant mount for reduced motion users */
          [role="status"][aria-label="Cargando aplicación..."] {
            animation: crossapp-fadein 100ms ease forwards;
          }
          @keyframes crossapp-fadein {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
