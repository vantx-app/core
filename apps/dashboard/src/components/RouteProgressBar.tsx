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
  const growTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Complete progress bar when location changes
  useEffect(() => {
    // Skip on initial mount
    if (prevLocation.current === null) {
      prevLocation.current = currentLocation;
      return;
    }

    if (prevLocation.current !== currentLocation) {
      prevLocation.current = currentLocation;
      completeLoading();
    }
  }, [currentLocation]);

  const startLoading = () => {
    // Clear any pending completion/hide/grow timers
    if (completeTimer.current) clearTimeout(completeTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (growTimer.current) clearTimeout(growTimer.current);

    setProgress(15);
    setVisible(true);

    // Slowly grow towards 85% to simulate progress
    growTimer.current = setTimeout(() => {
      setProgress(85);
    }, 150);
  };

  const completeLoading = () => {
    if (growTimer.current) clearTimeout(growTimer.current);

    setProgress(100);
    completeTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = setTimeout(() => setProgress(0), 300);
    }, 300);
  };

  // Intercept anchor clicks globally to start loading bar
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const anchorNode = (event.target as Element).closest("a");
      if (!anchorNode) return;

      const href = anchorNode.getAttribute("href");
      if (!href) return;

      // Ignore external or non-http links
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

      // Ignore links with target="_blank"
      const target = anchorNode.getAttribute("target");
      if (target && target === "_blank") return;

      // Ignore links with download attribute
      if (anchorNode.hasAttribute("download")) return;

      // Parse target URL
      let targetUrl: URL;
      try {
        targetUrl = new URL(href, window.location.href);
      } catch {
        return; // invalid URL
      }

      // Only handle same-origin URLs
      if (targetUrl.origin !== window.location.origin) return;

      // Ignore hash changes on same page
      const currentUrl = new URL(window.location.href);
      if (
        targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search &&
        targetUrl.hash !== currentUrl.hash
      ) {
        return;
      }

      // Ignore if clicking the exact same URL (pathname + query)
      if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
        return;
      }

      // Only left clicks without keys held
      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        startLoading();
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
      if (completeTimer.current) clearTimeout(completeTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (growTimer.current) clearTimeout(growTimer.current);
    };
  }, []);

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
