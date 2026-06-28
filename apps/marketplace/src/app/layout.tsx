import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteProgressBar } from "@/components/RouteProgressBar";
import { CrossAppTransitionOverlay } from "@vantx/ui";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "https://vantx.app/marketplace",
  ),
  title: {
    default: "Marketplace de Conductores Certificados | VantX",
    template: "%s | VantX Marketplace",
  },
  description:
    "Conectando conductores profesionales calificados con propietarios de flotas en tiempo real. Driver Score y telemetría verificado por CAN-bus.",
  keywords: [
    "contratar conductores",
    "marketplace de conductores",
    "choferes profesionales",
    "driver score verificado",
    "conductores de carga",
    "VantX",
    "telemetría",
  ],
  icons: {
    icon: "/marketplace/icons/icon-32x32.png",
    shortcut: "/marketplace/favicon.ico",
    apple: "/marketplace/icons/icon-512x512.png",
  },
  openGraph: {
    title: "Marketplace de Conductores Certificados | VantX",
    description:
      "Conectando conductores profesionales calificados con propietarios de flotas en tiempo real. Driver Score verificado.",
    url: "https://vantx.app/marketplace",
    siteName: "VantX Marketplace",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Marketplace de Conductores Certificados | VantX",
    description:
      "Conectando conductores profesionales calificados con propietarios de flotas en tiempo real.",
  },
  alternates: {
    canonical: "https://vantx.app/marketplace",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      {/*
        pageEntry animation: fades the page in from the canvas background color.
        Runs before React hydrates — pure CSS, no framework dependency.
        Masks the visual flash when arriving from a cross-app transition.
      */}
      <style>{`
        @keyframes pageEntry {
          from { opacity: 0; }
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
        {/* Cross-app transition overlay — dynamically theme-aware */}
        <CrossAppTransitionOverlay />
        {/* Same-app route progress bar — Suspense required for useSearchParams in App Router */}
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
