"use client";

import { LoginFormValues } from "@/types";
import { useState, Suspense } from "react";
import Cookies from "js-cookie";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>();

  const onSubmit = async (data: LoginFormValues) => {
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

        // Mantenemos tu config de cookies centralizada
        Cookies.set("access_token", result.accessToken, {
          expires: 15 / 1440, // 15 minutos
          secure: process.env.NODE_ENV === "production", // Solo secure en prod
          sameSite: "lax",
        });

        router.push(callbackUrl);
        router.refresh(); // Forzamos al Middleware a re-evaluar la sesión
      } else {
        setApiError("Credenciales inválidas");
      }
    } catch (error) {
      console.error("Login error:", error);
      setApiError("Ocurrió un error al intentar iniciar sesión.");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-base-200/20 text-base-content overflow-x-hidden">
      {/* Columna Izquierda: Branding & Decoración Visual */}
      <div className="hidden md:flex md:col-span-5 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between">
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
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-300">
                Rastreador de Flota
              </span>
              <span className="badge badge-success text-[10px] py-1 font-mono font-bold text-white">
                CONECTADO
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Camión T-105</span>
                <span className="text-blue-400 font-medium font-mono">
                  En Ruta
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-blue-500 rounded-full animate-pulse" />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Ocupación: 85%</span>
                <span>ETA: 45 min</span>
              </div>
            </div>
          </div>
        </div>

        <div className="z-10 text-xs text-slate-500 flex justify-between">
          <span>© 2026 VantX</span>
          <span>Soporte 24/7</span>
        </div>
      </div>

      {/* Columna Derecha: Formulario Interactivo */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative bg-base-100/50">
        <div className="w-full max-w-md z-10 flex flex-col gap-6">
          {/* Logo visible solo en mobile */}
          <div className="md:hidden flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-base-content">
              Bienvenido de nuevo
            </h2>
            <p className="text-sm text-base-content/60 mt-1">
              Ingresa tus credenciales para acceder a la plataforma.
            </p>
          </div>

          {apiError && (
            <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-800 p-3 rounded-xl animate-in fade-in">
              {apiError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="card bg-base-100 border border-base-200 rounded-3xl w-full shadow-2xl p-6 md:p-8 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <label className="label py-0.5">
                <span className="label-text font-bold text-xs text-base-content/85">
                  Correo Electrónico
                </span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                placeholder="Ej. usuario@empresa.com"
                disabled={isSubmitting}
                {...register("email", { required: true })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label py-0.5">
                <span className="label-text font-bold text-xs text-base-content/85">
                  Contraseña
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                placeholder="Ingresa tu contraseña"
                disabled={isSubmitting}
                {...register("password", { required: true })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary mt-2 w-full rounded-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner"></span>
              ) : (
                "Iniciar Sesión"
              )}
            </button>

            <div className="border-t border-base-200 pt-4 mt-2 flex flex-col items-center gap-2">
              <Link
                href="/register"
                className="text-xs text-primary hover:underline font-medium"
              >
                ¿Eres conductor? Regístrate aquí
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
