import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VantX | Driver Marketplace",
  description:
    "Conectando conductores calificados con propietarios de flotas en tiempo real.",
  icons: {
    icon: "/icons/icon-32x32.png",
    shortcut: "/favicon.ico",
    apple: "/icons/icon-512x512.png",
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
