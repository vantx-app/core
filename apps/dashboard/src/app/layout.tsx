import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import PWARegistration from "@/components/PWARegistration";
import { RouteProgressBar } from "@/components/RouteProgressBar";
import { CrossAppTransitionOverlay } from "@vantx/ui";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export const metadata: Metadata = {
  title: "Vantx | Gestión de Flotas y Marketplace de Conductores",
  description:
    "Telemetría IoT en tiempo real y asignación inteligente de vehículos.",
  manifest: "/dashboard/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vantx",
  },
  icons: {
    icon: "/dashboard/icons/icon-32x32.png",
    shortcut: "/dashboard/favicon.ico",
    apple: "/dashboard/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="light">
      {/*
        pageEntry animation: fades the page in from the canvas background color.
        Runs before React hydrates — pure CSS, no framework dependency.
        Masks the visual flash when arriving from a cross-app transition.
      */}
      <style>{`
        @keyframes pageEntry {
          from { opacity: 0; background: #f8fafc; }
          to   { opacity: 1; }
        }
        html {
          animation: pageEntry 250ms ease forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          html { animation: none; }
        }
      `}</style>
      <body>
        <PWARegistration />
        {/* Cross-app transition overlay — background matches dashboard's light canvas */}
        <CrossAppTransitionOverlay background="#f8fafc" />
        {/* Same-app route progress bar — Suspense required for useSearchParams in App Router */}
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

