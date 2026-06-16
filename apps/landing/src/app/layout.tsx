import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_LANDING_URL || "https://vantx.app"),
  title: {
    default: "VantX | Telemetría CAN-bus y Conexión de Flotas",
    template: "%s | VantX",
  },
  description:
    "VantX conecta estadísticas reales de conducción (Driver Score) obtenidas por hardware Teltonika con propietarios de flotas para un transporte seguro y eficiente.",
  keywords: [
    "telemetría",
    "CAN-bus",
    "Teltonika",
    "Driver Score",
    "optimización de transporte",
    "gestión de flotas",
    "conductores",
    "VantX",
  ],
  icons: {
    icon: "/icons/icon-32x32.png",
    shortcut: "/favicon.ico",
    apple: "/icons/icon-512x512.png",
  },
  openGraph: {
    title: "VantX | Telemetría CAN-bus y Conexión de Flotas",
    description:
      "VantX conecta estadísticas reales de conducción (Driver Score) obtenidas por hardware Teltonika con propietarios de flotas para un transporte seguro y eficiente.",
    url: "https://vantx.app",
    siteName: "VantX",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VantX | Telemetría CAN-bus y Conexión de Flotas",
    description:
      "VantX conecta estadísticas reales de conducción (Driver Score) obtenidas por hardware Teltonika con propietarios de flotas.",
  },
  alternates: {
    canonical: "https://vantx.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="light">
      <body className="bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
