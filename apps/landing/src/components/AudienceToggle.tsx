"use client";

import React, { useState } from "react";
import { Truck, UserCheck, ChevronRight } from "lucide-react";
import Link from "next/link";

type Audience = "owner" | "driver";

const content: Record<
  Audience,
  { benefit: string; cta: string; href: string; color: "blue" | "emerald" }
> = {
  owner: {
    benefit:
      "Regístrate gratis para publicar tu flota y buscar conductores con puntaje de conducción verificado. El monitoreo en vivo y la telemetría requieren la instalación del hardware Teltonika.",
    cta: "Registrarme como Propietario",
    href: "/register/owner",
    color: "blue",
  },
  driver: {
    benefit:
      "Construye un portafolio de conducción digital y portátil. Tu buen desempeño al volante se convierte en mejores ofertas laborales.",
    cta: "Registrarme Gratis",
    href: "/register",
    color: "emerald",
  },
};

export function AudienceToggle() {
  const [audience, setAudience] = useState<Audience>("owner");
  const current = content[audience];

  return (
    <div>
      {/* Toggle pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          id="audience-toggle-owner"
          onClick={() => setAudience("owner")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            audience === "owner"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/15"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <Truck className="size-3.5" />
          Propietario de Flota
        </button>
        <button
          id="audience-toggle-driver"
          onClick={() => setAudience("driver")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            audience === "driver"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <UserCheck className="size-3.5" />
          Conductor Profesional
        </button>
      </div>

      {/* Benefit content — fades between states */}
      <div
        key={audience}
        className="animate-[fadeIn_0.2s_ease-in-out]"
        style={{ animation: "fadeIn 0.2s ease-in-out" }}
      >
        <p className="text-slate-600 text-sm leading-relaxed mb-5">
          {current.benefit}
        </p>
        <Link
          href={current.href}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-300 ${
            current.color === "blue"
              ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10 hover:shadow-blue-600/20"
              : "bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20"
          }`}
        >
          {current.cta}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
