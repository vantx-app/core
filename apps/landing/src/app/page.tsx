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
} from "lucide-react";
import { LoginRedirectHandler } from "@/components/LoginRedirectHandler";
import { ScoringRulesInteractive } from "@/components/ScoringRulesInteractive";

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

export default async function LandingPage() {
  const scoringProfiles = await getScoringProfiles();
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
            href="#drivers"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Conductores
          </a>
          <a
            href="#reglas"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Reglas de Scoring
          </a>
          <a
            href="#hardware"
            className="hover:text-blue-650 hover:bg-slate-100/60 px-3 py-2 rounded-xl transition-all duration-200"
          >
            Dispositivos IoT
          </a>
        </nav>
        <div>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-250 hover:border-slate-400 font-bold text-sm text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md transition-all duration-300 inline-block"
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
            Telemetría J1939/J1708 & CAN-bus
          </div>
          <div className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm">
            Powered by<span className="font-bold text-blue-600">Teltonika</span>
          </div>
        </div>
        <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-600 font-normal leading-relaxed mb-12">
          VantX integra hardware Teltonika y adaptadores ECAN02 para certificar
          el desempeño de tus vehículos. Conectamos estadísticas reales de
          conducción (Driver Score) para emparejar de forma transparente a
          conductores profesionales con propietarios de flotas.
        </p>

        {/* Hero Split Funnel Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          {/* Card 1: B2B Fleet Owner (Direct Link to Contact Page) */}
          <Link
            href="/contact"
            className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Truck className="size-6" />
            </div>
            <div className="my-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Soy Propietario de Flota
              </h3>
              <p className="text-slate-650 text-xs leading-relaxed">
                Monitorea rutas en vivo, comparte enlaces de seguimiento en
                tiempo real con tus clientes, analiza consumo de combustible y
                reduce costos operativos.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
              Solicitar Demostración <ChevronRight className="size-4" />
            </span>
          </Link>

          {/* Card 2: B2C Driver (Standard Server Component Link) */}
          <Link
            href="/register"
            className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-650 group-hover:text-white transition-all duration-300">
              <UserCheck className="size-6" />
            </div>
            <div className="my-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Soy Conductor
              </h3>
              <p className="text-slate-655 text-xs leading-relaxed">
                Regístrate gratis para reclamar tu perfil histórico, certificar
                tus estadísticas de seguridad (Driver Score) y aplicar a ofertas
                exclusivas.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
              Registrarme Gratis <ChevronRight className="size-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* Feature Section: Telemetry & Safety Score */}
      <section
        id="features"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Driver Behavior Scoring
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-6">
              Evalúa la seguridad y el cuidado de los activos de forma objetiva
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              VantX calcula semanalmente calificaciones de seguridad basados en
              eventos reales detectados en los sensores del vehículo:
              aceleraciones bruscas, frenados intempestivos, giros de alta
              gravedad y excesos de velocidad.
            </p>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-600 text-xs mt-0.5 font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Análisis de Fuerza G y Sensor de Acelerómetro
                  </h4>
                  <p className="text-xs text-slate-500">
                    Detección automática de aceleración brusca, frenadas severas
                    y giros agresivos reportados a 1Hz por los acelerómetros del
                    hardware.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-600 text-xs mt-0.5 font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Correlación con Consumo del CAN-bus
                  </h4>
                  <p className="text-xs text-slate-500">
                    Cruzamos el comportamiento de conducción con el consumo real
                    de combustible, temperatura del motor y tiempos en ralentí
                    (Idle Time).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Driver Score Mockup */}
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
                  <span className="text-[10px] text-slate-550 font-mono">
                    ID: 8-777-2190
                  </span>
                </div>
              </div>
              <span className="badge badge-success text-[10px] py-1 bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded px-2">
                CONDUCTOR EFICIENTE
              </span>
            </div>

            <div className="flex flex-col items-center py-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Gauge Background */}
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
                Puntuación General Excelente
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-6 mt-2 text-center">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">
                  Seguridad
                </span>
                <span className="text-sm font-extrabold text-slate-850">
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
                * Score calculado semanalmente según norma SAE J1939 y lecturas
                de telemetría física a 1Hz.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section: Marketplace & Matching */}
      <section
        id="drivers"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Visual Matching Mockup on the Left */}
          <div className="order-2 lg:order-1 glass-card p-6 md:p-8 bg-white/90 border-slate-200 relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Criterios de Asignación de Viaje
            </h4>

            {/* Match Status Card */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Evaluación de Requisitos
                </span>
                <span className="text-sm font-bold text-emerald-950">
                  Licencia Tipo I &amp; Score &gt; 85
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500 text-white font-black text-xs uppercase tracking-wider">
                APTO
              </span>
            </div>

            <div className="space-y-4 relative z-10">
              {/* Driver Card Mock */}
              <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center font-bold text-slate-700">
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
                    Driver Score
                  </span>
                  <span className="text-sm font-black text-emerald-600">
                    94 / 100
                  </span>
                </div>
              </div>

              {/* Matching Line Visual */}
              <div className="flex justify-center my-2 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 border border-slate-200 p-1.5 rounded-full z-10 text-blue-600 shadow-sm flex items-center justify-center">
                  <ArrowDown className="size-4" />
                </div>
                <div className="h-10 w-0.5 border-dashed border-slate-300" />
              </div>

              {/* Owner/Fleet Card Mock */}
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
                  <span className="text-xs font-extrabold text-slate-850">
                    Competitiva
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content on the Right */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Conexión Inteligente y Vetted Marketplace
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-6">
              El primer marketplace de empleo logístico respaldado por
              telemetría
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              VantX elimina la incertidumbre en la contratación de transporte.
              Los propietarios de flotas acceden a conductores profesionales
              cuyos hábitos de conducción y seguridad vial han sido auditados
              directamente por el bus CAN.
            </p>

            <div className="mb-8">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all duration-300"
              >
                Explorar Marketplace
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  Para Propietarios de Flotas (Owners)
                </h4>
                <div className="text-xs text-slate-500 mt-1 pl-3.5 space-y-1.5">
                  <p>
                    Filtra candidatos por Driver Score verificado, reduciendo la
                    siniestralidad de tus activos y los costos de seguro desde
                    el primer día de contratación.
                  </p>
                  <p>
                    Genera enlaces públicos y temporales de seguimiento para
                    compartir con tus clientes, permitiéndoles rastrear la
                    ubicación del vehículo y el estado del viaje sin darles
                    acceso a tu panel privado.
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Para Conductores Profesionales (Drivers)
                </h4>
                <p className="text-xs text-slate-500 mt-1 pl-3.5">
                  Construye un portafolio de conducción digital y portátil. Tu
                  buen comportamiento al volante se traduce directamente en
                  mejores ofertas salariales y estabilidad laboral.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Scoring Rules Section */}
      <ScoringRulesInteractive scoringProfiles={scoringProfiles} />

      {/* Feature Section: IoT Integration */}
      <section
        id="hardware"
        className="relative max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Hardware Devices Showcase */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-6 bg-white/70 border-slate-200">
              <Cpu className="size-8 text-blue-600 mb-4" />
              <h4 className="text-sm font-bold text-slate-850 mb-2">
                Teltonika FMC003
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                Rastreador OBD-II plug-and-play LTE Cat M1/NB-IoT. Conexión
                directa y lectura de parámetros de diagnóstico OBD estándar.
              </p>
            </div>
            <div className="glass-card p-6 bg-white/70 border-slate-200">
              <Cpu className="size-8 text-emerald-600 mb-4" />
              <h4 className="text-sm font-bold text-slate-850 mb-2">
                Teltonika FMC150
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                Localizador profesional avanzado con interfaz CAN integrada para
                lectura de datos de motor J1939 y J1708 en flotas pesadas.
              </p>
            </div>
            <div className="col-span-2 glass-card p-6 bg-white/70 border-slate-200">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                  <Cpu className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-850">
                      Teltonika ECAN02
                    </h4>
                    <span className="badge badge-sm py-0 bg-indigo-100 border border-indigo-200 text-indigo-700 text-[9px] font-bold rounded px-1.5 uppercase">
                      Lector Sin Contacto
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Lector de CAN-bus inductivo que captura datos del bus sin
                    pelar o cortar cables. Ideal para leer consumo de
                    combustible y odómetro de vehículos bajo garantía de
                    fabricante.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-2 glass-card p-5 bg-gradient-to-r from-blue-600/5 to-transparent border-slate-200 flex items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                  LECTURA TOTAL CAN-BUS
                </span>
                <span className="text-sm font-bold text-slate-800">
                  Integración directa homologada con ecosistema Teltonika
                </span>
              </div>
              <CheckCircle className="size-8 text-blue-600 shrink-0" />
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                POWERED BY TELTONIKA
              </span>
              Hardware & Conectividad IoT
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-6">
              Monitoreo directo del Bus de Datos (CAN) sin invalidar garantías
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Integramos rastreadores y accesorios Teltonika de estándar
              industrial para leer datos reales del bus CAN. La combinación de
              rastreadores avanzados y lectores sin contacto asegura total
              fidelidad de datos sin intervenir físicamente el cableado.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  Lectura inductiva segura con adaptadores Teltonika ECAN02.
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  Códigos de falla en vivo (DTCs) para mantenimiento proactivo.
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  Alertas inmediatas en caso de desconexión del hardware
                  (Anti-tamper).
                </span>
              </div>
            </div>
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

      {/* Dynamic redirect processor loaded in Suspense */}
      <Suspense fallback={null}>
        <LoginRedirectHandler />
      </Suspense>
    </main>
  );
}
