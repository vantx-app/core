"use client";

import React from "react";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  const handleRetry = () => {
    // Recargar la página actual para reintentar la conexión
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 px-4 text-center">
      <div className="p-8 rounded-2xl bg-base-200 shadow-xl max-w-md w-full border border-base-300">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-error/10 text-error animate-pulse">
            <WifiOff className="w-12 h-12" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-base-content mb-2">
          Sin conexión a Internet
        </h1>

        <p className="text-base-content/70 mb-6">
          Vantx requiere una conexión a Internet activa para sincronizar la
          telemetría en tiempo real, rastrear los vehículos y gestionar los
          conductores.
        </p>

        <button
          onClick={handleRetry}
          className="btn btn-primary w-full text-white font-semibold shadow-md transition-transform active:scale-95"
        >
          Reintentar conexión
        </button>
      </div>
    </div>
  );
}
