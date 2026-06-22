import React, { Suspense } from "react";
import { Logo } from "@vantx/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  Truck,
  UserCheck,
  Cpu,
  CheckCircle,
  ChevronRight,
  ArrowDown,
  Zap,
} from "lucide-react";
import { LoginRedirectHandler } from "@/components/LoginRedirectHandler";
import { AudienceToggle } from "@/components/AudienceToggle";

export default async function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white relative">
      {/* Dynamic Light Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[90px] transform-gpu will-change-[transform,filter] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] bg-emerald-600/5 rounded-full blur-[90px] transform-gpu will-change-[transform,filter] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[90px] transform-gpu will-change-[transform,filter] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0 shadow-sm transition-all duration-200 transform-gpu">
        <div className="flex items-center gap-2">
          <Logo size="lg" variant="light" />
        </div>
        <nav className="hidden md:flex items-center gap-4 text-sm font-semibold text-slate-700">
          <a
            href="#features"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Tecnología
          </a>
          <a
            href="#conductores"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Conductores
          </a>
          <Link
            href="/how-it-works"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            ¿Cómo Funciona?
          </Link>
          <a
            href="#hardware"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Dispositivos IoT
          </a>
        </nav>
        <div>
          <Link
            href="/select"
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 font-bold text-sm text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md transition-all duration-300 inline-block"
          >
            Acceder
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-14 pb-24 text-center z-10">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.1]">
          Telemetría CAN-bus y <br />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
            Conexión de Flotas Real
          </span>
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-600/20 bg-blue-600/5 text-blue-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            Telemetría J1939/J1708 &amp; CAN-bus
          </div>
          <div className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm">
            Respaldado por{" "}
            <span className="font-bold text-blue-600">Teltonika</span>
          </div>
        </div>
        <p className="max-w-xl mx-auto text-base md:text-lg text-slate-600 font-normal leading-relaxed mb-12">
          Telemetría física real que convierte conducción en datos objetivos —
          para conectar flotas con los mejores conductores.
        </p>

        {/* Hero Split Funnel Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          {/* Card 1: Propietario de Flota */}
          <Link
            href="/register/owner"
            className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Truck className="size-6" />
            </div>
            <div className="my-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Soy Propietario de Flota
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Publica tu flota en el mercado y conecta con conductores
                verificados por telemetría.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
              Registrarme como Propietario <ChevronRight className="size-4" />
            </span>
          </Link>

          {/* Card 2: Conductor */}
          <Link
            href="/register"
            className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <UserCheck className="size-6" />
            </div>
            <div className="my-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Soy Conductor
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Regístrate gratis para certificar tu historial de seguridad y
                acceder a mejores ofertas laborales.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
              Registrarme Gratis <ChevronRight className="size-4" />
            </span>
          </Link>
        </div>

        {/* Secondary path for full telemetry */}
        <p className="text-xs text-slate-400 mt-6">
          ¿Buscas telemetría y monitoreo en vivo?{" "}
          <Link
            href="/contact"
            className="text-blue-600 font-semibold hover:underline"
          >
            Solicita una demostración
          </Link>{" "}
          con nuestro equipo.
        </p>
      </section>

      {/* Feature Section: Telemetry & Safety Score */}
      <section
        id="features"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Comportamiento y Seguridad Vial
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-6">
              Evalúa la seguridad de tus activos de forma objetiva
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              VantX calcula semanalmente puntajes de conducción a partir de
              eventos reales detectados por los sensores del vehículo.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                  ✓
                </div>
                <span className="text-sm text-slate-700">
                  Fuerza G en tiempo real — frenadas, aceleraciones y giros
                  bruscos a 1 Hz.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                  ✓
                </div>
                <span className="text-sm text-slate-700">
                  Correlación con consumo real de combustible, temperatura del
                  motor y ralentí.
                </span>
              </div>
            </div>
          </div>

          {/* Driver Score Mockup */}
          <div className="glass-card p-6 md:p-8 relative overflow-hidden bg-white/90 border-slate-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                  CM
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Carlos Mendoza
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: 8-777-2190
                  </span>
                </div>
              </div>
              <span className="bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded px-2 py-1 text-[10px] uppercase">
                Conductor Eficiente
              </span>
            </div>

            <div className="flex flex-col items-center py-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f1f5f9"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#10b981"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset="15"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-slate-800">94</span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">
                    / 100
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-4">
                Puntaje General Excelente
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-6 mt-2 text-center">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">
                  Seguridad
                </span>
                <span className="text-sm font-extrabold text-slate-800">
                  96 / 100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">
                  Eficiencia
                </span>
                <span className="text-sm font-extrabold text-blue-600">
                  92 / 100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">
                  Cuidado
                </span>
                <span className="text-sm font-extrabold text-indigo-600">
                  95 / 100
                </span>
              </div>
            </div>
            <div className="text-center mt-4 border-t border-slate-100 pt-3">
              <span className="text-[9px] text-slate-400 font-mono">
                * Puntaje calculado semanalmente según norma SAE J1939 y
                lecturas de telemetría a 1 Hz.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section: Marketplace & Matching */}
      <section
        id="conductores"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Visual Matching Mockup */}
          <div className="order-2 lg:order-1 glass-card p-6 md:p-8 bg-white/90 border-slate-200 relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Criterios de Asignación de Viaje
            </h4>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Evaluación de Requisitos
                </span>
                <span className="text-sm font-bold text-emerald-950">
                  Licencia Tipo I &amp; Puntaje &gt; 85
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500 text-white font-black text-xs uppercase tracking-wider">
                Apto
              </span>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                    CM
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">
                      Carlos Mendoza
                    </h5>
                    <span className="text-[9px] text-slate-400 font-mono block">
                      Licencia: Tipo I (Equipo Pesado)
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Disponibilidad: Inmediata
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">
                    Puntaje de Conducción
                  </span>
                  <span className="text-sm font-black text-emerald-600">
                    94 / 100
                  </span>
                </div>
              </div>

              <div className="flex justify-center my-2 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 border border-slate-200 p-1.5 rounded-full z-10 text-blue-600 shadow-sm flex items-center justify-center">
                  <ArrowDown className="size-4" />
                </div>
                <div className="h-10 w-0.5 border-dashed border-slate-300" />
              </div>

              <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/5 border border-blue-600/10 flex items-center justify-center text-blue-600">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">
                      Transportes Gómez S.A.
                    </h5>
                    <span className="text-[9px] text-slate-400 font-mono block">
                      Ruta: Ciudad de Panamá - Chiriquí
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Carga: Refrigerada (Alimentos)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">
                    Tarifa Ofrecida
                  </span>
                  <span className="text-xs font-extrabold text-slate-800">
                    Competitiva
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="order-1 lg:order-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Conexión Inteligente y Mercado Verificado
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-4">
              El primer mercado de empleo logístico respaldado por telemetría
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              VantX elimina la incertidumbre en la contratación. Los puntajes de
              conducción son auditados directamente por el bus CAN — sin
              encuestas, sin referencias.
            </p>

            {/* Audience Toggle */}
            <AudienceToggle />
          </div>
        </div>
      </section>

      {/* Scoring Callout — replaces full interactive widget */}
      <section className="relative max-w-7xl mx-auto px-6 py-10 z-10 border-t border-slate-200/80">
        <div className="glass-card p-7 bg-white/90 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/10 border border-blue-600/20 rounded-xl text-blue-600 shrink-0">
              <Zap className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                Motor de puntaje transparente
              </h3>
              <p className="text-xs text-slate-500">
                Puntaje calculado semanalmente con base en más de 8 reglas de
                telemetría real — ponderado por tipo de vehículo y combustible.
              </p>
            </div>
          </div>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 font-bold text-sm text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md transition-all duration-300 shrink-0"
          >
            Ver metodología
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Feature Section: IoT Integration */}
      <section
        id="hardware"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Hardware Devices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-6 bg-white/70 border-slate-200">
              <Cpu className="size-8 text-blue-600 mb-4" />
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                Teltonika FMC003
              </h4>
              <p className="text-slate-500 text-xs">
                Rastreador OBD-II LTE plug-and-play.
              </p>
            </div>
            <div className="glass-card p-6 bg-white/70 border-slate-200">
              <Cpu className="size-8 text-emerald-600 mb-4" />
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                Teltonika FMC150
              </h4>
              <p className="text-slate-500 text-xs">
                CAN avanzado para flotas pesadas J1939/J1708.
              </p>
            </div>
            <div className="col-span-2 glass-card p-6 bg-white/70 border-slate-200">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
                  <Cpu className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-800">
                      Teltonika ECAN02
                    </h4>
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 rounded px-1.5 uppercase">
                      Sin Contacto
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Lector CAN inductivo — captura datos del bus sin cortar
                    cables, sin invalidar garantías de fábrica.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-2 glass-card p-5 bg-gradient-to-r from-blue-600/5 to-transparent border-slate-200 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                  Lectura total CAN-bus
                </span>
                <span className="text-sm font-bold text-slate-800">
                  Integración homologada con ecosistema Teltonika
                </span>
              </div>
              <CheckCircle className="size-8 text-blue-600 shrink-0" />
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                Respaldado por Teltonika
              </span>
              Hardware &amp; Conectividad IoT
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-6">
              Monitoreo directo del bus de datos sin invalidar garantías
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Combinamos rastreadores avanzados y lectores sin contacto para
              garantizar total fidelidad de datos sin intervenir físicamente el
              cableado.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Lectura inductiva segura con adaptadores ECAN02.</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  Códigos de falla en vivo para mantenimiento proactivo.
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Alertas inmediatas ante desconexión del hardware.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 bg-white relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Logo size="md" variant="light" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-slate-650">
            <Link
              href="/how-it-works"
              className="hover:text-blue-650 transition-colors"
            >
              ¿Cómo Funciona?
            </Link>
            <Link
              href="/marketplace"
              className="hover:text-blue-650 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/select"
              className="hover:text-blue-650 transition-colors"
            >
              Acceso Portal
            </Link>
            <Link
              href="/contact"
              className="hover:text-blue-650 transition-colors"
            >
              Contacto
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-100 mt-8 pt-8 text-center text-xs text-slate-400 max-w-6xl mx-auto px-6">
          <p>
            &copy; {new Date().getFullYear()} VantX App. Todos los derechos
            reservados.
          </p>
          <p className="mt-1">
            Tecnología de Telemetría para Flotas Logísticas.
          </p>
        </div>
      </footer>

      <Suspense fallback={null}>
        <LoginRedirectHandler />
      </Suspense>
    </main>
  );
}
