import React, { Suspense } from "react";
import type { Metadata } from "next";
import { OwnerContactForm } from "@/components/OwnerContactForm";
import { Logo } from "@vantx/ui";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Shield, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Solicitar Demostración",
  description:
    "Lleva tu flota al siguiente nivel. Completa el formulario de contacto para programar una demostración personalizada de telemetría y puntaje de conducción con nuestro equipo.",
  alternates: {
    canonical: "https://vantx.app/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-slate-50 text-slate-800 overflow-x-hidden font-sans">
      {/* Left Column: Branding, Decorative Telemetry & Copy */}
      <div className="hidden md:flex md:col-span-5 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between">
        {/* Decorative Glows */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[60px] transform-gpu pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-indigo-500/10 rounded-full blur-[60px] transform-gpu pointer-events-none" />

        <div className="z-10 flex items-center gap-2">
          <Logo size="lg" variant="dark" />
        </div>

        <div className="z-10 my-auto flex flex-col gap-6 max-w-md animate-in fade-in slide-in-from-left-6 duration-500">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-450 flex items-center gap-1.5">
            <Sparkles className="size-4 text-emerald-450" />
            Demostración & Consulta
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Lleva tu flota al siguiente nivel.
          </h1>
          <p className="text-slate-350 text-sm leading-relaxed">
            Completa el formulario de la derecha. Un especialista en telemetría
            de flotas se pondrá en contacto contigo a través de esta plataforma
            para coordinar una prueba y guiarte en el equipamiento Teltonika
            idóneo.
          </p>

          {/* Mini info card */}
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-5 shadow-md space-y-3.5">
            <div className="flex items-center gap-2">
              <Shield className="size-5 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Garantía VantX
              </span>
            </div>
            <ul className="text-slate-400 text-xs space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 text-emerald-450 shrink-0 mt-0.5" />
                <span>
                  Instalación no invasiva sin invalidar la garantía del
                  fabricante.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 text-emerald-450 shrink-0 mt-0.5" />
                <span>Score verificado por CAN-bus a nivel físico.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="z-10 text-xs text-slate-500 flex justify-between">
          <span>© 2026 VantX</span>
          <span>Soporte 24/7</span>
        </div>
      </div>

      {/* Right Column: Interactive Form Card */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative bg-slate-50">
        <div className="w-full max-w-lg z-10 flex flex-col gap-6">
          {/* Logo visible only on mobile */}
          <div className="md:hidden flex justify-center mb-2">
            <Logo size="lg" />
          </div>

          {/* Form wrapper card */}
          <div className="bg-white border border-slate-200 rounded-3xl w-full p-6 md:p-10 shadow-md">
            <Suspense
              fallback={
                <div className="text-center py-8 text-xs text-slate-400">
                  Cargando formulario...
                </div>
              }
            >
              <OwnerContactForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
