import './globals.css';
import type { Metadata, Viewport } from 'next';
import PWARegistration from '@/components/PWARegistration';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1d4ed8',
};

export const metadata: Metadata = {
  title: 'Vantx | Gestión de Flotas y Marketplace de Conductores',
  description: 'Telemetría IoT en tiempo real y asignación inteligente de vehículos.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vantx',
  },
  icons: {
    icon: '/icons/icon-32x32.png',
    apple: '/icons/icon-512x512.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='es' data-theme="light">
      <body>
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}