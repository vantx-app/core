"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";
import { Logo } from "@vantx/ui";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  ShieldAlert,
  Lock,
  Mail,
  LayoutDashboard,
  ShoppingBag,
  CheckCircle,
} from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const registered = searchParams.get("registered") === "true";

  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check if already authenticated on mount
  useEffect(() => {
    const token = Cookies.get("access_token");
    if (token) {
      if (callbackUrl) {
        window.location.href = callbackUrl;
      } else {
        setIsLoggedIn(true);
      }
    }
    setIsCheckingSession(false);
  }, [callbackUrl]);

  const onSubmit = async (data: any) => {
    setApiError(null);

    try {
      const response = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();

        // Save access_token using centralized cookie settings
        const authSettings = getCookieSettings(15 * 60 * 1000); // 15 mins
        Cookies.set("access_token", result.accessToken, {
          path: authSettings.path,
          domain: authSettings.domain,
          sameSite: authSettings.sameSite as any,
          secure: authSettings.secure,
          expires: new Date(Date.now() + 15 * 60 * 1000),
        });

        if (callbackUrl) {
          window.location.href = callbackUrl;
        } else {
          setIsLoggedIn(true);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(
          errData.message || "Credenciales inválidas. Inténtalo de nuevo.",
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setApiError(
        "Error de red. Asegúrate de que los servicios estén activos.",
      );
    }
  };

  const handleLogout = () => {
    const deleteSettings = getCookieSettings(0);
    Cookies.remove("access_token", {
      path: deleteSettings.path,
      domain: deleteSettings.domain,
    });
    Cookies.remove("refresh_token", {
      path: deleteSettings.path,
      domain: deleteSettings.domain,
    });
    setIsLoggedIn(false);
  };

  if (isCheckingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <span className="loading loading-spinner loading-lg text-blue-600"></span>
      </div>
    );
  }

  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";
  const marketplaceUrl =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3002";

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-slate-50 text-slate-800 overflow-x-hidden font-sans">
      {/* Columna Izquierda: Branding & Decoración Visual */}
      <div className="hidden md:flex md:col-span-5 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

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

          {/* Panel decorativo de telemetría mockup */}
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-6 shadow-md overflow-hidden">
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

      {/* Columna Derecha: Formulario o Selección */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative bg-slate-50">
        {!isLoggedIn ? (
          <div className="w-full max-w-md z-10 flex flex-col gap-6 animate-in fade-in duration-350">
            {/* Logo visible solo en mobile */}
            <div className="md:hidden flex justify-center">
              <Logo size="lg" />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Bienvenido de nuevo
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Ingresa tus credenciales para acceder a la plataforma.
              </p>
            </div>

            {registered && (
              <div className="alert alert-success text-xs border border-emerald-200 bg-emerald-50 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="size-4 shrink-0" />
                <span>
                  ¡Registro completado con éxito! Por favor, inicia sesión.
                </span>
              </div>
            )}

            {apiError && (
              <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-700 p-3.5 rounded-xl flex items-start gap-2 animate-in fade-in">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white border border-slate-200 rounded-3xl w-full p-6 md:p-8 flex flex-col gap-4 shadow-md"
            >
              {/* Email Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block pl-0.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    disabled={isSubmitting}
                    className={`w-full bg-slate-50 border ${errors.email
                        ? "border-red-400 focus:border-red-500"
                        : "border-slate-200 focus:border-slate-400"
                      } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
                    placeholder="ejemplo@vantx.app"
                    {...register("email", {
                      required: "El correo es obligatorio",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Formato de correo no válido",
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <span className="text-red-500 text-[11px] block pl-0.5 mt-0.5">
                    {errors.email.message}
                  </span>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block pl-0.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    disabled={isSubmitting}
                    className={`w-full bg-slate-50 border ${errors.password
                        ? "border-red-400 focus:border-red-500"
                        : "border-slate-200 focus:border-slate-400"
                      } rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
                    placeholder="••••••••"
                    {...register("password", {
                      required: "La contraseña es obligatoria",
                    })}
                  />
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-red-500 text-[11px] block pl-0.5 mt-0.5">
                    {errors.password.message}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 flex justify-center items-center cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Iniciar Sesión"
                )}
              </button>

              <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col items-center gap-2">
                <Link
                  href="/register"
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  ¿Eres conductor? Regístrate aquí
                </Link>
              </div>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-lg z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
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
              {/* Opción 1: Dashboard de Flotas */}
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

              {/* Opción 2: Marketplace */}
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <span className="loading loading-spinner loading-lg text-blue-600"></span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
