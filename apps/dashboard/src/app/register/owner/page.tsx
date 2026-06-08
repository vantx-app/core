"use client";

import { OwnerRegisterFormValues } from "@/types";
import api from "@/utils/client/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { Logo } from "@/components/Logo";
import { IdDocumentField } from "@/components/ui/IdDocumentField";
import {
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Building2,
  User,
  KeyRound,
  CheckCircle,
  Phone,
  Eye,
  EyeOff,
} from "lucide-react";

type StepType = "account" | "organization";

function OwnerRegisterStepper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Estados de la validación del Token
  const [validationStatus, setValidationStatus] = useState<
    "loading" | "valid" | "invalid"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Paso actual de registro
  const [currentStep, setCurrentStep] = useState<StepType>("account");
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Inicialización de React Hook Form
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    control,
    formState: { isSubmitting, errors },
  } = useForm<OwnerRegisterFormValues>({
    defaultValues: {
      email: "",
      password: "",
      isDriver: false,
      name: "",
      firstName: "",
      lastName: "",
      nationalId: "",
      phone: "",
      orgName: "",
    },
  });

  const isDriver = watch("isDriver");

  // Validación del Token en el Montaje
  useEffect(() => {
    if (!token) {
      setValidationStatus("invalid");
      setErrorMessage(
        "No se ha proporcionado un enlace o token de invitación.",
      );
      return;
    }

    const verifyToken = async () => {
      try {
        // Petición al endpoint público de validación de invitaciones
        const { data } = await api.get(`/invitations/validate?token=${token}`);
        if (data.valid) {
          setValidationStatus("valid");
        } else {
          setValidationStatus("invalid");
          setErrorMessage(
            "El enlace de invitación no es válido o ya fue utilizado.",
          );
        }
      } catch (error) {
        setValidationStatus("invalid");
        const err = error as { response?: { data?: { message?: string } } };
        const msg =
          err.response?.data?.message ||
          "El enlace de invitación ha expirado, es inválido o ya fue consumido.";
        setErrorMessage(msg);
      }
    };

    verifyToken();
  }, [token]);

  // Manejo del paso siguiente
  const handleNextStep = async () => {
    setApiError(null);
    let fieldsToValidate: Array<keyof OwnerRegisterFormValues> = [
      "email",
      "password",
    ];

    if (isDriver) {
      fieldsToValidate = [
        ...fieldsToValidate,
        "firstName",
        "lastName",
        "nationalId",
      ];
    } else {
      fieldsToValidate = [...fieldsToValidate, "name"];
    }

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep("organization");
    }
  };

  // Envío final del formulario de registro
  const onSubmit = async (data: OwnerRegisterFormValues) => {
    setApiError(null);
    try {
      // Endpoint de creación de organización + propietario (FR-8)
      await api.post("/register/owner-with-org", {
        token,
        ...data,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.replace("/login");
      }, 3000);
    } catch (error) {
      console.error("Error en registro de propietario:", error);
      const err = error as { response?: { data?: { message?: string } } };
      const msg =
        err.response?.data?.message ||
        "Error al procesar el registro de la organización.";
      setApiError(msg);
    }
  };

  // 1. PANTALLA DE CARGA (SKELETON CON MICRO-ANIMACIÓN)
  if (validationStatus === "loading") {
    return (
      <div className="flex flex-col justify-center items-center h-screen px-4 w-full bg-base-100/50">
        <div className="mb-8 animate-pulse">
          <Logo size="lg" />
        </div>
        <div className="card bg-base-100 border border-base-200 rounded-3xl w-full max-w-md p-8 shadow-2xl flex flex-col gap-6">
          <div className="h-6 bg-base-300 rounded-md w-2/3 mx-auto animate-pulse"></div>
          <div className="h-4 bg-base-200 rounded-md w-1/2 mx-auto animate-pulse"></div>
          <div className="flex flex-col gap-4 mt-4">
            <div className="h-12 bg-base-200 rounded-xl w-full animate-pulse"></div>
            <div className="h-12 bg-base-200 rounded-xl w-full animate-pulse"></div>
            <div className="h-12 bg-base-200 rounded-xl w-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // 2. PANTALLA DE ERROR (ENLACE EXPIRADO O INVÁLIDO - PREMIUM)
  if (validationStatus === "invalid") {
    return (
      <div className="flex flex-col justify-center items-center h-screen px-4 w-full bg-base-100/50 text-base-content">
        <div className="mb-6">
          <Logo size="lg" />
        </div>
        <div className="card bg-base-100 border border-red-200 rounded-3xl w-full max-w-md p-8 shadow-2xl flex flex-col items-center text-center gap-6 relative overflow-hidden">
          {/* Luz de fondo sutil */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/5 rounded-full blur-3xl"></div>

          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-200 text-red-500 animate-bounce">
            <ShieldAlert size={32} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">
              Acceso Denegado
            </h1>
            <p className="text-sm text-base-content/60">
              El enlace de invitación que intentas utilizar no es válido.
            </p>
          </div>

          <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-800 w-full p-4 rounded-2xl flex items-start gap-3">
            <span className="font-medium text-left">{errorMessage}</span>
          </div>

          <div className="text-base-content/60 text-xs text-left w-full border-t border-base-200 pt-4 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <span>Las invitaciones expiran automáticamente en 24 horas.</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <span>Cada enlace solo puede ser utilizado una única vez.</span>
            </div>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="btn btn-ghost hover:bg-base-200 border border-base-300 text-base-content mt-2 w-full rounded-2xl transition-all duration-300"
          >
            Volver al Inicio de Sesión
          </button>
        </div>
      </div>
    );
  }

  // 3. PANTALLA DE ÉXITO DE REGISTRO
  if (isSuccess) {
    return (
      <div className="flex flex-col justify-center items-center h-screen px-4 w-full bg-base-100/50 text-base-content">
        <div className="card bg-base-100 border border-emerald-200 rounded-3xl w-full max-w-md p-8 shadow-2xl flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-200 text-emerald-600">
            <CheckCircle size={32} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">
              ¡Registro Exitoso!
            </h1>
            <p className="text-sm text-base-content/60">
              Tu organización y cuenta de propietario se han creado
              correctamente.
            </p>
          </div>
          <div className="text-base-content/50 text-xs animate-pulse">
            Redireccionando al inicio de sesión...
          </div>
        </div>
      </div>
    );
  }

  // 4. PANTALLA DE REGISTRO ACTIVA (SI EL TOKEN ES VÁLIDO)
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-base-200/20 text-base-content overflow-x-hidden">
      {/* Columna Izquierda: Branding & Decoración Visual */}
      <div className="hidden md:flex md:col-span-5 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between">
        <div className="z-10 flex items-center gap-2">
          <Logo size="lg" variant="dark" />
        </div>

        <div className="z-10 my-auto flex flex-col gap-6 max-w-md animate-in fade-in slide-in-from-left-6 duration-500">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Portal de Propietarios
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Lleva tu flota al siguiente nivel.
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Completa tu registro como propietario de flota. Podrás gestionar
            conductores, configurar rutas de telemetría y administrar tus
            operaciones en tiempo real desde una única plataforma.
          </p>

          {/* Panel decorativo de telemetría mockup */}
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-300">
                Monitoreo de Flota Activa
              </span>
              <span className="badge badge-primary text-[10px] py-1 font-mono font-bold text-white">
                PRO OWNER
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                  Vehículos Activos
                </span>
                <span className="text-xl font-extrabold text-white">
                  12 / 14
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                  Rendimiento
                </span>
                <span className="text-xl font-extrabold text-emerald-400">
                  92.4%
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-slate-400">
              <span>Eficiencia General</span>
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                ● Óptimo
              </span>
            </div>
          </div>
        </div>

        <div className="z-10 text-xs text-slate-500 flex justify-between">
          <span>© 2026 VantX</span>
          <span>Soporte Administrativo</span>
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
              {currentStep === "account"
                ? "Cuenta de Administrador"
                : "Detalles de tu Organización"}
            </h2>
            <p className="text-sm text-base-content/60 mt-1">
              {currentStep === "account"
                ? "Configura tus credenciales de acceso iniciales."
                : "Registra el nombre de tu flota empresarial."}
            </p>
          </div>

          <div className="flex justify-center">
            <ul className="steps w-full max-w-md mb-2">
              <li className="step step-primary text-xs font-semibold text-base-content">
                Datos de Usuario
              </li>
              <li
                className={`step ${currentStep === "organization" ? "step-primary" : ""} text-xs font-semibold text-base-content`}
              >
                Organización
              </li>
            </ul>
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
            {/* PASO 1: INFORMACIÓN DE LA CUENTA */}
            {currentStep === "account" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="label text-xs font-bold text-base-content/60">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/40">
                      <User size={16} />
                    </span>
                    <input
                      type="email"
                      className="input input-bordered pl-10 w-full bg-base-100 border-base-300 focus:border-primary text-sm rounded-xl text-base-content"
                      placeholder="admin@tuempresa.com"
                      {...register("email", {
                        required: "El correo electrónico es requerido",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Dirección de correo inválida",
                        },
                      })}
                    />
                  </div>
                  {errors.email && (
                    <span className="text-red-500 text-xs mt-1">
                      {errors.email.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label text-xs font-bold text-base-content/60">
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/40">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input input-bordered pl-10 pr-10 w-full bg-base-100 border-base-300 focus:border-primary text-sm rounded-xl text-base-content"
                      placeholder="••••••••"
                      {...register("password", {
                        required: "La contraseña es requerida",
                        minLength: {
                          value: 6,
                          message:
                            "La contraseña debe tener al menos 6 caracteres",
                        },
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
                  {errors.password && (
                    <span className="text-red-500 text-xs mt-1">
                      {errors.password.message}
                    </span>
                  )}
                </div>

                {/* Checkbox de Doble Rol */}
                <div className="form-control border border-base-200 bg-base-200/20 rounded-2xl p-4 mt-2">
                  <label className="label cursor-pointer flex justify-between items-center">
                    <span className="label-text font-bold text-base-content text-sm">
                      Quiero registrarme también como conductor
                    </span>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary rounded-lg border-base-300"
                      {...register("isDriver")}
                    />
                  </label>
                  <p className="text-base-content/60 text-xs mt-1">
                    Activa esta opción para vincular automáticamente un perfil
                    de conductor y registrar tu telemetría histórica.
                  </p>
                </div>

                {/* Campos condicionales */}
                {!isDriver ? (
                  <div className="flex flex-col gap-1 animate-in slide-in-from-top-2 duration-200">
                    <label className="label text-xs font-bold text-base-content/60">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full bg-base-100 border-base-300 focus:border-primary text-sm rounded-xl text-base-content"
                      placeholder="Ej. Juan Pérez"
                      {...register("name", {
                        required: !isDriver
                          ? "El nombre completo es requerido"
                          : false,
                      })}
                    />
                    {errors.name && (
                      <span className="text-red-500 text-xs mt-1">
                        {errors.name.message}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200 border-t border-base-200 pt-4 mt-1">
                    <p className="text-xs font-bold text-primary">
                      Datos del Perfil de Conductor
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="label text-xs font-bold text-base-content/60">
                          Nombre
                        </label>
                        <input
                          type="text"
                          className="input input-bordered w-full bg-base-100 border-base-300 focus:border-primary text-xs rounded-xl text-base-content"
                          placeholder="Nombre"
                          {...register("firstName", {
                            required: isDriver
                              ? "El nombre es requerido"
                              : false,
                          })}
                        />
                        {errors.firstName && (
                          <span className="text-red-500 text-xs">
                            {errors.firstName.message}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="label text-xs font-bold text-base-content/60">
                          Apellido
                        </label>
                        <input
                          type="text"
                          className="input input-bordered w-full bg-base-100 border-base-300 focus:border-primary text-xs rounded-xl text-base-content"
                          placeholder="Apellido"
                          {...register("lastName", {
                            required: isDriver
                              ? "El apellido es requerido"
                              : false,
                          })}
                        />
                        {errors.lastName && (
                          <span className="text-red-500 text-xs">
                            {errors.lastName.message}
                          </span>
                        )}
                      </div>
                    </div>

                    <Controller
                      name="nationalId"
                      control={control}
                      rules={{
                        required: isDriver
                          ? "El documento de identidad es requerido"
                          : false,
                      }}
                      render={({ field }) => (
                        <IdDocumentField
                          value={field.value || ""}
                          onChange={field.onChange}
                          label="Documento de Identidad"
                          disabled={isSubmitting}
                          error={errors.nationalId?.message}
                          required={isDriver}
                        />
                      )}
                    />

                    <div className="flex flex-col gap-1">
                      <label className="label text-xs font-bold text-base-content/60">
                        Teléfono
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/40">
                          <Phone size={14} />
                        </span>
                        <input
                          type="tel"
                          className="input input-bordered pl-9 w-full bg-base-100 border-base-300 focus:border-primary text-xs rounded-xl text-base-content"
                          placeholder="Teléfono"
                          {...register("phone")}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn btn-primary mt-4 w-full rounded-xl flex justify-center items-center gap-2"
                >
                  Siguiente Paso
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* PASO 2: INFORMACIÓN DE LA ORGANIZACIÓN */}
            {currentStep === "organization" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="label text-xs font-bold text-base-content/60">
                    Nombre de la Empresa / Organización
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/40">
                      <Building2 size={16} />
                    </span>
                    <input
                      type="text"
                      className="input input-bordered pl-10 w-full bg-base-100 border-base-300 focus:border-primary text-sm rounded-xl text-base-content"
                      placeholder="Ej. Logística Continental S.A."
                      {...register("orgName", {
                        required: "El nombre de la organización es requerido",
                      })}
                    />
                  </div>
                  {errors.orgName && (
                    <span className="text-red-500 text-xs mt-1">
                      {errors.orgName.message}
                    </span>
                  )}
                </div>

                <div className="mt-6 flex justify-between gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost hover:bg-base-200 border border-base-300 flex-1 rounded-xl flex items-center justify-center gap-2 text-base-content"
                    onClick={() => setCurrentStep("account")}
                  >
                    <ArrowLeft size={16} />
                    Atrás
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary flex-1 rounded-xl flex items-center justify-center gap-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      <>
                        Completar Registro
                        <CheckCircle size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function OwnerRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen bg-base-100/50">
          <span className="loading loading-spinner loading-lg text-primary animate-pulse"></span>
        </div>
      }
    >
      <OwnerRegisterStepper />
    </Suspense>
  );
}
