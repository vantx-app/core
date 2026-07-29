"use client";

import { useState, useEffect, Suspense } from "react";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";
import { Logo } from "@vantx/ui";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Unlock, LayoutDashboard, ShoppingBag } from "lucide-react";

function SelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check if authenticated on mount
  useEffect(() => {
    const token = Cookies.get("access_token");
    if (token) {
      setIsLoggedIn(true);
    }
    setIsCheckingSession(false);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    const deleteSettings = getCookieSettings(0);
    Cookies.remove("access_token", { path: "/" });
    if (deleteSettings.domain) {
      Cookies.remove("access_token", {
        path: "/",
        domain: deleteSettings.domain,
      });
    }
    Cookies.remove("refresh_token", { path: "/" });
    if (deleteSettings.domain) {
      Cookies.remove("refresh_token", {
        path: "/",
        domain: deleteSettings.domain,
      });
    }
    router.push("/login");
  };

  if (isCheckingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <span className="loading loading-spinner loading-lg text-blue-600"></span>
      </div>
    );
  }

  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001/dashboard";
  const marketplaceUrl =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3002";

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-slate-50 text-slate-800 overflow-x-hidden font-sans">
      {/* Left Column: Branding & Visual Telemetry Decoration */}
      <div className="hidden md:flex md:col-span-5 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[60px] transform-gpu pointer-events-none" />

        <div className="z-10 flex items-center gap-2">
          <Logo size="lg" variant="dark" />
        </div>

        <div className="z-10 my-auto flex flex-col gap-6 max-w-md animate-in fade-in slide-in-from-left-6 duration-500">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Acceso al Sistema
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Tu flota, optimizada en tiempo real.
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Inicia sesión para monitorear tu telemetría en tiempo real, rastrear
            viajes de conductores y tomar el control de tus operaciones diarias.
          </p>

          {/* Decorative telemetry panel mockup */}
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-6 shadow-md overflow-hidden transform-gpu">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-350">
                Resumen de Viaje Reciente
              </span>
              <span className="badge badge-success text-[10px] py-1 font-mono font-bold text-white bg-emerald-500 border-none rounded px-2">
                ECO-EXPERT
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                  Distancia
                </span>
                <span className="text-xl font-extrabold text-white">
                  124.5 km
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                  Puntaje Eco
                </span>
                <span className="text-xl font-extrabold text-emerald-400">
                  96 / 100
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-slate-300">
              <span>Ruta: Panamá - Colón</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                ● En Línea
              </span>
            </div>
          </div>
        </div>

        <div className="z-10 text-xs text-slate-500 flex justify-between">
          <span>© 2026 VantX</span>
          <span>Soporte 24/7</span>
        </div>
      </div>

      {/* Right Column: Form, Selection, or Unified Gateway */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative bg-slate-50">
        {/* CASE 1: NOT LOGGED IN & SHOW SELECTION SCREEN (UNIFIED GATEWAY) */}
        {!isLoggedIn && (
          <div className="w-full max-w-lg z-10 flex flex-col items-center gap-6 animate-in fade-in duration-350">
            <div className="md:hidden flex justify-center mb-2">
              <Logo size="lg" />
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Bienvenido a VantX
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                Elige la plataforma a la que deseas acceder hoy.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-6">
              {/* Option 1: Dashboard de Flotas (LOCKED for guest users) */}
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(dashboardUrl)}`}
                className="border border-slate-200 bg-white hover:border-blue-650 hover:shadow-lg rounded-3xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-3 right-3 p-1 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 flex items-center gap-1 text-[9px] font-bold z-10">
                  <Lock className="size-3" />
                  Protegido
                </div>

                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <LayoutDashboard className="size-6" />
                </div>
                <div className="my-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Dashboard de Flotas
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Monitoreo, telemetría y reportes de conducción en tiempo
                    real.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 transition-transform">
                  Iniciar Sesión
                </span>
              </Link>

              {/* Option 2: Marketplace (OPEN for guest users) */}
              <Link
                href="/marketplace"
                className="border border-slate-200 bg-white hover:border-emerald-650 hover:shadow-lg rounded-3xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-3 right-3 p-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-1 text-[9px] font-bold z-10">
                  <Unlock className="size-3" />
                  Acceso Libre
                </div>

                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <ShoppingBag className="size-6" />
                </div>
                <div className="my-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Marketplace
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Publicar vehículos, buscar alquileres o contratar
                    conductores.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 transition-transform">
                  Explorar como Invitado
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* CASE 2: LOGGED IN & SHOW SELECTION SCREEN (UNLOCKED GATEWAY) */}
        {isLoggedIn && (
          <div className="w-full max-w-lg z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="md:hidden flex justify-center mb-2">
              <Logo size="lg" />
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                ¿A dónde deseas acceder hoy?
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                Elige la plataforma a la que deseas ingresar con tu sesión
                activa.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-6">
              {/* Option 1: Dashboard de Flotas (UNLOCKED) */}
              <a
                href={dashboardUrl}
                className="border border-slate-200 bg-white hover:border-blue-600 hover:shadow-lg rounded-3xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <LayoutDashboard className="size-6" />
                </div>
                <div className="my-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Dashboard de Flotas
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Monitoreo, telemetría y reportes de conducción en tiempo
                    real.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                  Ingresar
                </span>
              </a>

              {/* Option 2: Marketplace (UNLOCKED) */}
              <a
                href={marketplaceUrl}
                className="border border-slate-200 bg-white hover:border-emerald-600 hover:shadow-lg rounded-3xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <ShoppingBag className="size-6" />
                </div>
                <div className="my-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Marketplace
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Publicar vehículos, buscar alquileres o gestionar anuncios.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                  Ingresar
                </span>
              </a>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-600 font-semibold mt-6 transition-all hover:underline cursor-pointer"
            >
              Cerrar sesión e iniciar con otra cuenta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SelectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <span className="loading loading-spinner loading-lg text-blue-600"></span>
        </div>
      }
    >
      <SelectContent />
    </Suspense>
  );
}
