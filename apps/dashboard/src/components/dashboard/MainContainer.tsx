"use client";

import { usePathname } from "next/navigation";
import React from "react";

interface MainContainerProps {
  children: React.ReactNode;
}

export function MainContainer({ children }: MainContainerProps) {
  const pathname = usePathname();
  // Verificar si la ruta actual es el mapa de la flota
  const isMapPage = pathname === "/map";

  return (
    <main
      className={`flex-1 relative z-10 ${
        isMapPage
          ? "overflow-hidden pb-0" // Pantalla completa para el mapa (sin scroll ni padding)
          : "overflow-y-auto pb-36 lg:pb-0" // Scrollable con padding inferior en móvil para evitar que el navbar tape contenido
      }`}
    >
      {children}
    </main>
  );
}
