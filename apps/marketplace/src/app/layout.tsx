import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://vantx.app/marketplace"),
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
    icon: "/icons/icon-32x32.png",
    shortcut: "/favicon.ico",
    apple: "/icons/icon-512x512.png",
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
      <body>{children}</body>
    </html>
  );
}
