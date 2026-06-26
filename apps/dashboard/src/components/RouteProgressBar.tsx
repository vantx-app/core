"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Cor do progresso: Royal Blue — combina com a marca do Dashboard
const PROGRESS_COLOR = "#1d4ed8";

/**
 * Barra de progresso para navegações same-app (App Router).
 *
 * - Detecta mudanças de rota via usePathname + useSearchParams
 * - Atraso de 100ms antes de aparecer (evita flash em rotas rápidas)
 * - Compatível com App Router (não usa router.events do Pages Router)
 * - z-index 9998: fica abaixo do CrossAppTransitionOverlay (9999)
 * - Bfcache-safe: sem listeners de beforeunload
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Track previous location to detect changes
  const prevLocation = useRef<string | null>(null);
  const currentLocation = `${pathname}?${searchParams.toString()}`;

  // Timers refs — cleared on cleanup to avoid leaks
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip on initial mount
    if (prevLocation.current === null) {
      prevLocation.current = currentLocation;
      return;
    }

    // No change — skip
    if (prevLocation.current === currentLocation) return;

    prevLocation.current = currentLocation;

    // Navigation completed — advance bar to 100% then hide
    if (showTimer.current) clearTimeout(showTimer.current);

    setProgress(100);
    completeTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = setTimeout(() => setProgress(0), 300);
    }, 300);

    return () => {
      if (completeTimer.current) clearTimeout(completeTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [currentLocation]);

  // Simulate progress: show after 100ms delay, grow to 85% while waiting
  useEffect(() => {
    // Start progress simulation on any potential navigation
    // This runs once per render cycle — the completion effect above handles the finish
    showTimer.current = setTimeout(() => {
      setVisible(true);
      setProgress(15);
      // Grow to 85% over ~1.5s to simulate in-progress
      const growTimer = setTimeout(() => setProgress(85), 100);
      return () => clearTimeout(growTimer);
    }, 100);

    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    };
    // Intentionally runs only on pathname/searchParams change via the outer scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9998,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          backgroundColor: PROGRESS_COLOR,
          transition:
            progress === 100
              ? "width 200ms ease"
              : "width 1500ms cubic-bezier(0.1, 0.7, 0.3, 1)",
          opacity: visible ? 1 : 0,
          transitionProperty: progress === 100 ? "width" : "width, opacity",
        }}
      />
    </div>
  );
}
