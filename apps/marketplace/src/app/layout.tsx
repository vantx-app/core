import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VantX | Driver Marketplace',
  description: 'Conectando conductores calificados con propietarios de flotas en tiempo real.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
