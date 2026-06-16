import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description:
    "Accede a la plataforma VantX para gestionar tu flota, revisar tus estadísticas de Driver Score o actualizar tu perfil de conductor.",
  alternates: {
    canonical: "https://vantx.app/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
