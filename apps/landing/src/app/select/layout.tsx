import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seleccionar Aplicación",
  description:
    "Elige entre el Dashboard de Flotas y el Marketplace de VantX para continuar.",
  alternates: {
    canonical: "https://vantx.app/select",
  },
};

export default function SelectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
