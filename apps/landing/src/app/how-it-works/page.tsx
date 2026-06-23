import React, { Suspense } from "react";
import { Logo } from "@vantx/ui";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Cpu,
  CheckCircle,
  ChevronRight,
  Zap,
  Shield,
  Database,
} from "lucide-react";
import { ScoringRulesInteractive } from "@/components/ScoringRulesInteractive";
import { LoginRedirectHandler } from "@/components/LoginRedirectHandler";

export const metadata: Metadata = {
  title: "¿Cómo Funciona? | VantX",
  description:
    "Conoce en detalle la metodología de telemetría CAN-bus, el motor de puntaje de conducción y los dispositivos IoT de VantX.",
};

async function getScoringProfiles() {
  const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/api/scoring/public-rules`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch scoring profiles: ${res.statusText}`);
    }
    return res.json();
  } catch (error) {
    console.error("Error fetching scoring profiles:", error);
    return [];
  }
}

export default async function HowItWorksPage() {
  const scoringProfiles = await getScoringProfiles();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white relative">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] bg-emerald-600/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Logo size="lg" variant="light" />
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-4 text-sm font-semibold text-slate-700">
          <Link
            href="/#features"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Tecnología
          </Link>
          <Link
            href="/#drivers"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Conductores
          </Link>
          <Link
            href="/how-it-works"
            className="text-blue-600 bg-blue-50 px-3 py-2 rounded-xl transition-all duration-200"
          >
            ¿Cómo Funciona?
          </Link>
          <Link
            href="/#hardware"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Dispositivos IoT
          </Link>
        </nav>
        <Link
          href="/select"
          className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 font-bold text-sm text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md transition-all duration-300 inline-block"
        >
          Acceder
        </Link>
      </header>

      {/* Page Hero */}
      <section className="relative max-w-4xl mx-auto px-6 pt-16 pb-12 text-center z-10">
        <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/50 mb-4">
          Metodología
        </span>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-[1.15]">
          ¿Cómo Funciona VantX?
        </h1>
        <p className="text-slate-600 text-base leading-relaxed max-w-2xl mx-auto">
          Telemetría física real convertida en datos objetivos para conectar
          flotas con los mejores conductores.
        </p>
      </section>

      {/* 3-Step Process */}
      <section className="relative max-w-7xl mx-auto px-6 py-16 z-10 border-t border-slate-200/80">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            Tres pasos, datos reales
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="glass-card p-8 bg-white/90 border-slate-200 relative flex flex-col">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Instala el hardware
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Los dispositivos Teltonika (FMC003, FMC150 + ECAN02) se instalan
              en el vehículo y comienzan a leer el bus CAN sin intervenir el
              cableado.
            </p>
            <div className="mt-auto self-end w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-lg">
              1
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass-card p-8 bg-white/90 border-slate-200 relative flex flex-col">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Los datos fluyen en tiempo real
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Velocidad, fuerza G, consumo de combustible, ralentí y códigos de
              falla se transmiten a 1 Hz hacia nuestro motor de telemetría.
            </p>
            <div className="mt-auto self-end w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
              2
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass-card p-8 bg-white/90 border-slate-200 relative flex flex-col">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Puntaje publicado semanalmente
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              El motor de reglas calcula el puntaje de conducción de cada
              conductor — visible para ellos y para los propietarios de flota en
              el mercado.
            </p>
            <div className="mt-auto self-end w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg">
              3
            </div>
          </div>
        </div>
      </section>

      {/* Full Scoring Rules — relocated from landing page */}
      <ScoringRulesInteractive scoringProfiles={scoringProfiles} />

      {/* Hardware Detail */}
      <section
        id="hardware"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/50 mb-3">
            Respaldado por Teltonika
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2">
            Hardware e integración IoT
          </h2>
          <p className="text-slate-500 text-sm mt-3 max-w-xl mx-auto">
            Dispositivos industriales de estándar internacional — lectura
            directa del bus CAN sin intervenir el cableado del fabricante.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* FMC003 */}
          <div className="glass-card p-6 bg-white/90 border-slate-200">
            <Cpu className="size-7 text-blue-600 mb-4" />
            <h4 className="text-sm font-bold text-slate-850 mb-1">
              Teltonika FMC003
            </h4>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-3">
              OBD-II Plug-and-play
            </span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Rastreador LTE Cat M1/NB-IoT de conexión directa al puerto OBD
              estándar. Lectura inmediata sin instalación especializada.
            </p>
          </div>

          {/* FMC150 */}
          <div className="glass-card p-6 bg-white/90 border-slate-200">
            <Cpu className="size-7 text-emerald-600 mb-4" />
            <h4 className="text-sm font-bold text-slate-850 mb-1">
              Teltonika FMC150
            </h4>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-3">
              CAN Avanzado — Flotas Pesadas
            </span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Localizador profesional con interfaz CAN integrada. Lee datos de
              motor J1939 y J1708 en camiones y maquinaria de carga pesada.
            </p>
          </div>

          {/* ECAN02 */}
          <div className="glass-card p-6 bg-white/90 border-slate-200">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 inline-flex mb-4">
              <Cpu className="size-5" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-bold text-slate-850">
                Teltonika ECAN02
              </h4>
              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 rounded px-1.5 uppercase">
                Sin contacto
              </span>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-3">
              Lector Inductivo CAN
            </span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Captura datos del bus CAN sin pelar ni cortar cables. Ideal para
              vehículos bajo garantía de fabricante.
            </p>
          </div>
        </div>

        {/* Capabilities summary */}
        <div className="mt-8 glass-card p-5 bg-gradient-to-r from-blue-600/5 to-transparent border-slate-200 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
              Capacidades integradas
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {[
                "Lectura inductiva sin cortar cables",
                "Alertas de desconexión en tiempo real",
                "Códigos de falla activos (mantenimiento proactivo)",
              ].map((cap) => (
                <span
                  key={cap}
                  className="flex items-center gap-1.5 text-xs text-slate-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {cap}
                </span>
              ))}
            </div>
          </div>
          <CheckCircle className="size-8 text-blue-600 shrink-0" />
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="relative max-w-7xl mx-auto px-6 py-16 z-10 border-t border-slate-200/80">
        <div className="glass-card p-8 md:p-12 bg-white/90 border-slate-200 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3">
            ¿Listo para conectar tu flota?
          </h2>
          <p className="text-slate-500 text-sm mb-8 max-w-lg mx-auto">
            Solicita una demostración o regístrate como conductor para empezar a
            construir tu historial verificado.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/10 transition-all duration-300"
            >
              Solicitar Demostración
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 hover:border-slate-400 text-slate-700 font-bold text-sm shadow-sm hover:shadow-md transition-all duration-300"
            >
              Registrarme como Conductor
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 text-center text-sm text-slate-500 bg-white relative z-10">
        <p>
          &copy; {new Date().getFullYear()} VantX App. Todos los derechos
          reservados.
        </p>
        <p className="text-slate-400 text-xs mt-2">
          Tecnología de Telemetría para Flotas Logísticas.
        </p>
      </footer>

      <Suspense fallback={null}>
        <LoginRedirectHandler />
      </Suspense>
    </main>
  );
}
