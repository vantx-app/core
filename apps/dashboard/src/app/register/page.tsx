"use client";

import { RegisterFormValues } from "@/types";
import api from "@/utils/client/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { Logo } from "@/components/Logo";
import { IdDocumentField } from "@/components/ui/IdDocumentField";
import { Eye, EyeOff } from "lucide-react";

type StepType = "verify" | "details";

// 1. Tipado completo para todo el formulario
function RegisterStepper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep: StepType =
    searchParams.get("step") === "details" ? "details" : "verify";

  const [isShadowProfile, setIsShadowProfile] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 2. Implementación de React Hook Form
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    control,
    formState: { isSubmitting, errors },
  } = useForm<RegisterFormValues>({
    defaultValues: { nationalId: "", email: "" },
  });

  const isLoading = isSubmitting || isVerifying;

  // Paso 1: Verificar Cédula
  const handleVerifyId = async () => {
    setApiError(null);

    // 3. Validamos dinámicamente solo los campos del primer paso sin enviar el form
    const isStepValid = await trigger(["nationalId", "email"]);
    if (!isStepValid) return;

    setIsVerifying(true);
    const { nationalId, email } = getValues();

    try {
      const { data } = await api.post("/drivers/verify", { email, nationalId });

      switch (data.status) {
        case "UNCLAIMED_PROFILE":
          setIsShadowProfile(true);
          router.push("?step=details");
          break;
        case "NO_RECORD_FOUND":
          setIsShadowProfile(false);
          router.push("?step=details");
          break;
        case "EMAIL_TAKEN":
          router.push("/login");
          break;
        case "DOCUMENT_TAKEN":
          setApiError("La cédula ya está registrada y activa.");
          break;
        default:
          setApiError("Respuesta desconocida del servidor.");
          break;
      }
    } catch (error) {
      console.error("Error en verificación [Anti-scraping/Bloqueo]", error);
      setApiError("Error al verificar. Revisa tus datos o intenta más tarde.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Paso 2: Envío Final manejado limpiamente por RHF
  const onSubmit = async (data: RegisterFormValues) => {
    setApiError(null);

    try {
      // 'data' ya tiene la combinación perfecta del Paso 1 y Paso 2
      await api.patch("/drivers/onboard", data);
      router.replace("/login");
    } catch (error) {
      console.error("Error al registrar", error);
      setApiError("Ocurrió un error al procesar tu registro.");
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
            Portal de Conductores
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Tu camino, tus datos, todo en un solo lugar.
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Regístrate para conectar con tu flota, reclamar tu historial de
            conducción y telemetría, y visualizar tus estadísticas de seguridad
            y eco-driving en tiempo real.
          </p>

          {/* Panel decorativo de telemetría mockup */}
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-300">
                Resumen de Viaje Reciente
              </span>
              <span className="badge badge-success text-[10px] py-1 font-mono font-bold text-white">
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
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-slate-400">
              <span>Ruta: Panamá - Colón</span>
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                ● En Línea
              </span>
            </div>
          </div>
        </div>

        <div className="z-10 text-xs text-slate-500 flex justify-between">
          <span>© 2026 VantX</span>
          <span>Soporte de Flota</span>
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
              {currentStep === "verify"
                ? "Comencemos tu registro"
                : "Completa tus datos"}
            </h2>
            <p className="text-sm text-base-content/60 mt-1">
              {currentStep === "verify"
                ? "Ingresa tu documento para verificar tu perfil en el sistema."
                : "Crea tu cuenta de conductor para acceder a tu panel."}
            </p>
          </div>

          <div className="flex justify-center">
            <ul className="steps w-full max-w-xs mb-2">
              <li className="step step-primary text-xs font-semibold">
                Verificación
              </li>
              <li
                className={`step ${currentStep === "details" ? "step-primary" : ""} text-xs font-semibold`}
              >
                Registro
              </li>
            </ul>
          </div>

          {apiError && (
            <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-800 p-3 rounded-xl animate-in fade-in">
              {apiError}
            </div>
          )}

          {/* RHF maneja el submit */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="card bg-base-100 border border-base-200 rounded-3xl w-full shadow-2xl p-6 flex flex-col gap-4"
          >
            {/* VISTA 1: VERIFICACIÓN */}
            <div className={currentStep === "verify" ? "block" : "hidden"}>
              <Controller
                name="nationalId"
                control={control}
                rules={{ required: "El documento de identidad es requerido" }}
                render={({ field }) => (
                  <IdDocumentField
                    value={field.value}
                    onChange={field.onChange}
                    label="Documento de Identidad"
                    disabled={isLoading}
                    error={errors.nationalId?.message}
                    required
                  />
                )}
              />

              <div className="flex flex-col gap-1 mt-3">
                <label className="label py-0.5">
                  <span className="label-text font-bold text-xs text-base-content/85">
                    Correo Electrónico
                  </span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                  placeholder="Ej. chofer@vantx.app"
                  disabled={isLoading}
                  {...register("email", { required: "El correo es requerido" })}
                />
                {errors.email && (
                  <span className="text-error text-xs mt-1">
                    {errors.email.message}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleVerifyId}
                className="btn btn-primary mt-6 w-full rounded-xl"
                disabled={isLoading}
              >
                {isVerifying ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  "Continuar"
                )}
              </button>
            </div>

            {/* VISTA 2: DETALLES GENERALES */}
            <div
              className={`${currentStep === "details" ? "flex" : "hidden"} flex-col gap-4`}
            >
              {isShadowProfile && (
                <div className="alert alert-info text-xs border border-blue-200 bg-blue-50 text-blue-800 p-3 rounded-xl">
                  Perfil detectado. Completa tus datos para reclamar tu
                  telemetría histórica.
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-base-content/85">
                      Nombre
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                    placeholder="Tu nombre"
                    disabled={isLoading}
                    {...register("firstName", {
                      required: currentStep === "details",
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-base-content/85">
                      Apellido
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                    placeholder="Tu apellido"
                    disabled={isLoading}
                    {...register("lastName", {
                      required: currentStep === "details",
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-base-content/85">
                      Teléfono
                    </span>
                  </label>
                  <input
                    type="tel"
                    className="input input-bordered w-full text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                    placeholder="Ej. +507 6000-0000"
                    disabled={isLoading}
                    {...register("phone", {
                      required: currentStep === "details",
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-base-content/85">
                      Contraseña
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input input-bordered w-full pr-10 text-sm rounded-xl bg-base-100 border-base-300 focus:border-primary text-base-content"
                      placeholder="Mínimo 6 caracteres"
                      disabled={isLoading}
                      {...register("password", {
                        required: currentStep === "details",
                        minLength: 6,
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/40 hover:text-base-content/70 cursor-pointer"
                      title={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 w-full flex justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-ghost border border-base-300 flex-1 rounded-xl"
                  disabled={isLoading}
                  onClick={() => router.back()}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 rounded-xl"
                  disabled={isLoading}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner"></span>
                  ) : isShadowProfile ? (
                    "Reclamar"
                  ) : (
                    "Registrar"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      }
    >
      <RegisterStepper />
    </Suspense>
  );
}
