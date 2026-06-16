import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrarse",
  description:
    "Únete a VantX de forma gratuita. Certifica tus estadísticas de seguridad (Driver Score), reclama tu perfil histórico y accede a ofertas exclusivas.",
  alternates: {
    canonical: "https://vantx.app/register",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
