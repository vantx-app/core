"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Logo } from "@vantx/ui";
import { OwnerContactForm } from "@/components/OwnerContactForm";
import Link from "next/link";
import {
  Truck,
  UserCheck,
  Cpu,
  X,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

function LandingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Modals state
  const [isOwnerContactOpen, setIsOwnerContactOpen] = useState(false);

  // Auto-redirect to login page if URL has ?login=true
  useEffect(() => {
    if (searchParams.get("login") === "true") {
      router.replace("/login");
    }
  }, [searchParams, router]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white relative">
      {/* Dynamic Light Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] bg-emerald-600/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20 border-b border-slate-200/60 bg-white/40 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-2">
          <Logo size="lg" variant="light" />
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a href="#features" className="hover:text-blue-600 transition-colors">
            Tecnología
          </a>
          <a href="#drivers" className="hover:text-blue-600 transition-colors">
            Conductores
          </a>
          <a href="#hardware" className="hover:text-blue-600 transition-colors">
            Dispositivos IoT
          </a>
        </nav>
        <div>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-350 font-bold text-sm text-slate-700 hover:text-slate-900 shadow-sm transition-all duration-300 inline-block"
          >
            Acceder
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-600/20 bg-blue-600/5 text-blue-700 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          Telemetría OBD-II Avanzada & Driver Marketplace
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.1]">
          Conectando el transporte del <br />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
            futuro en tiempo real
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-600 font-normal leading-relaxed mb-12">
          VantX unifica el rastreo inteligente de flotas comerciales con
          telemetría de alta frecuencia OBD-II/CAN-bus y un ecosistema de
          emparejamiento instantáneo para conductores profesionales.
        </p>

        {/* Hero Split Funnel Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          {/* Card 1: B2B Fleet Owner */}
          <div
            className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
            onClick={() => setIsOwnerContactOpen(true)}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Truck className="size-6" />
            </div>
            <div className="my-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Soy Propietario de Flota
              </h3>
              <p className="text-slate-650 text-xs leading-relaxed">
                Monitorea rutas en vivo, analiza consumo de combustible, hábitos
                de conducción y reduce costos operativos con hardware OBD-II.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
              Solicitar Demostración <ChevronRight className="size-4" />
            </span>
          </div>

          {/* Card 2: B2C Driver */}
          <div
            className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
            onClick={() => router.push("/register")}
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
          </div>
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
                    Algoritmo de Penalización Justo
                  </h4>
                  <p className="text-xs text-slate-500">
                    Deducción de puntaje proporcional a la severidad del evento
                    y al kilometraje total recorrido.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-600 text-xs mt-0.5 font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Tres Pilares Clave
                  </h4>
                  <p className="text-xs text-slate-500">
                    Puntajes individuales para Seguridad Vial, Eficiencia de
                    Combustible e Integridad del Vehículo.
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
                ECO-CONDUCTOR
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
          </div>
        </div>
      </section>

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
                Hardware OBD-II plug-and-play con lectura directa de bus CAN y
                GPS integrado.
              </p>
            </div>
            <div className="glass-card p-6 bg-white/70 border-slate-200">
              <Cpu className="size-8 text-emerald-600 mb-4" />
              <h4 className="text-sm font-bold text-slate-850 mb-2">
                Teltonika FMC150
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                Rastreador avanzado para integración profunda con lecturas de
                motor y sensores adicionales.
              </p>
            </div>
            <div className="col-span-2 glass-card p-5 bg-gradient-to-r from-blue-600/5 to-transparent border-slate-200 flex items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                  Lectura OBD-II
                </span>
                <span className="text-sm font-bold text-slate-800">
                  Soporte completo J1939, J1708 y OBDII
                </span>
              </div>
              <CheckCircle className="size-8 text-blue-600 shrink-0" />
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Hardware & Conectividad IoT
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 mb-6">
              Monitoreo inalterable directo del Bus de Datos (CAN)
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Integramos rastreadores OBD-II líderes del mercado para capturar
              eventos de telemetría directamente del motor. Esto elimina
              reportes subjetivos o manipulación de datos y brinda total
              transparencia en auditorías de viaje.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  Códigos de falla en vivo (DTCs) para mantenimiento proactivo.
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Monitoreo de odómetro e ignition de alta precisión.</span>
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

      {/* SSO LOGIN MODAL REMOVED (Migrated to central /login route) */}

      {/* OWNER CONTACT FORM MODAL */}
      {isOwnerContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsOwnerContactOpen(false)}
          />
          {/* Modal Content */}
          <div className="glass-card w-full max-w-xl p-8 bg-white/95 border-slate-200 relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsOwnerContactOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition-colors"
            >
              <X className="size-5" />
            </button>
            <OwnerContactForm />
          </div>
        </div>
      )}
    </main>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <span className="loading loading-spinner loading-lg text-blue-600"></span>
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
