"use client";

import api from "@/utils/client/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { Logo, IdDocumentField } from "@vantx/ui";
import { Eye, EyeOff } from "lucide-react";

export interface RegisterFormValues {
  nationalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
}

type StepType = "verify" | "details";

function RegisterStepper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep: StepType =
    searchParams.get("step") === "details" ? "details" : "verify";

  const [isShadowProfile, setIsShadowProfile] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  // Step 1: Verify nationalId & email
  const handleVerifyId = async () => {
    setApiError(null);

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
          setApiError("El correo electrónico ya está en uso.");
          break;
        case "DOCUMENT_TAKEN":
          setApiError("La cédula ya está registrada y activa.");
          break;
        default:
          setApiError("Respuesta desconocida del servidor.");
          break;
      }
    } catch (error) {
      console.error("Error en verificación", error);
      setApiError("Error al verificar. Revisa tus datos o intenta más tarde.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Final Submit
  const onSubmit = async (data: RegisterFormValues) => {
    setApiError(null);

    try {
      await api.patch("/drivers/onboard", data);
      // Success: redirect to centralized login page on landing
      router.replace("/login?registered=true");
    } catch (error) {
      console.error("Error al registrar", error);
      setApiError("Ocurrió un error al procesar tu registro.");
    }
  };

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
          <span>Soporte de Flota</span>
        </div>
      </div>

      {/* Columna Derecha: Formulario Interactivo */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative bg-slate-50">
        <div className="w-full max-w-md z-10 flex flex-col gap-8">
          {/* Logo visible solo en mobile */}
          <div className="md:hidden flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {currentStep === "verify"
                ? "Comencemos tu registro"
                : "Completa tus datos"}
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              {currentStep === "verify"
                ? "Ingresa tu documento para verificar tu perfil en el sistema."
                : "Crea tu cuenta de conductor para acceder a tu panel."}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="text-blue-600">Paso 1: Verificación</span>
              <span className="text-slate-350">|</span>
              <span
                className={currentStep === "details" ? "text-blue-600" : ""}
              >
                Paso 2: Registro
              </span>
            </div>
          </div>

          {apiError && (
            <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-700 p-3.5 rounded-xl animate-in fade-in">
              {apiError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white border border-slate-200 rounded-3xl w-full p-6 md:p-8 flex flex-col gap-6 shadow-xl"
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

              <div className="flex flex-col gap-1 mt-5">
                <label className="label py-0.5">
                  <span className="label-text font-bold text-xs text-slate-700">
                    Correo Electrónico
                  </span>
                </label>
                <input
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                  placeholder="ejemplo@vantx.app"
                  disabled={isLoading}
                  {...register("email", { required: "El correo es requerido" })}
                />
                {errors.email && (
                  <span className="text-red-500 text-xs mt-1">
                    {errors.email.message}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleVerifyId}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition-all mt-6 flex justify-center items-center cursor-pointer"
                disabled={isLoading}
              >
                {isVerifying ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Continuar"
                )}
              </button>
            </div>

            {/* VISTA 2: DETALLES GENERALES */}
            <div
              className={`${currentStep === "details" ? "flex" : "hidden"} flex-col gap-6`}
            >
              {isShadowProfile && (
                <div className="alert alert-info text-xs border border-blue-100 bg-blue-50 text-blue-700 p-3 rounded-xl mb-2">
                  Perfil detectado. Completa tus datos para reclamar tu
                  telemetría histórica.
                </div>
              )}

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-slate-700">
                      Nombre
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                    placeholder="Tu nombre"
                    disabled={isLoading}
                    {...register("firstName", {
                      required: currentStep === "details",
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-slate-700">
                      Apellido
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                    placeholder="Tu apellido"
                    disabled={isLoading}
                    {...register("lastName", {
                      required: currentStep === "details",
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-slate-700">
                      Teléfono
                    </span>
                  </label>
                  <input
                    type="tel"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                    placeholder="Ej. +507 6000-0000"
                    disabled={isLoading}
                    {...register("phone", {
                      required: currentStep === "details",
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label py-0.5">
                    <span className="label-text font-bold text-xs text-slate-700">
                      Contraseña
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 pl-3.5 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
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
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? "Ocultar" : "Mostrar"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 w-full flex justify-between gap-3">
                <button
                  type="button"
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-all"
                  disabled={isLoading}
                  onClick={() => router.back()}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex justify-center items-center cursor-pointer"
                  disabled={isLoading}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-sm"></span>
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
        <div className="flex justify-center items-center h-screen bg-slate-50">
          <span className="loading loading-spinner loading-lg text-blue-600"></span>
        </div>
      }
    >
      <RegisterStepper />
    </Suspense>
  );
}
