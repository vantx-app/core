import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VantX | Conectando Flotas y Conductores",
  description:
    "La plataforma líder en optimización de transporte, telemetría IoT y asignación inteligente.",
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
