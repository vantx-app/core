"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";
import { Logo } from "@vantx/ui";
import { Eye, EyeOff, ShieldAlert, Lock, Mail } from "lucide-react";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

        if (onSuccess) {
          onSuccess();
        }

        // Direct redirection to the Dashboard App (port 3001) for all users
        window.location.href = "http://localhost:3001";
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(errData.message || "Credenciales inválidas. Inténtalo de nuevo.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setApiError("Error de red. Asegúrate de que los servicios estén activos.");
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center mb-6">
        <Logo size="lg" variant="light" />
        <h2 className="text-xl font-extrabold tracking-tight mt-4 text-slate-850">
          Iniciar Sesión
        </h2>
        <p className="text-slate-500 text-xs text-center mt-1 max-w-[260px]">
          Ingresa tus credenciales para acceder a la plataforma VantX.
        </p>
      </div>

      {apiError && (
        <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-700 p-3.5 rounded-xl mb-4 flex items-start gap-2 animate-in fade-in">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block pl-0.5">
            Correo Electrónico
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="email"
              disabled={isSubmitting}
              className={`w-full bg-slate-50 border ${
                errors.email ? "border-red-400 focus:ring-red-400/20" : "border-slate-200 focus:ring-blue-600/20 focus:border-blue-600"
              } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all`}
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
          <label className="text-xs font-bold text-slate-600 block pl-0.5">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              disabled={isSubmitting}
              className={`w-full bg-slate-50 border ${
                errors.password ? "border-red-400 focus:ring-red-400/20" : "border-slate-200 focus:ring-blue-600/20 focus:border-blue-600"
              } rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="••••••••"
              {...register("password", {
                required: "La contraseña es obligatoria",
                minLength: {
                  value: 6,
                  message: "La contraseña debe tener al menos 6 caracteres",
                },
              })}
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
          className="w-full py-3 px-4 rounded-xl bg-blue-650 hover:bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 flex justify-center items-center"
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "Acceder"
          )}
        </button>
      </form>
    </div>
  );
}
