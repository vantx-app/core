"use client";

import api from "@/utils/client/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { Logo, IdDocumentField } from "@vantx/ui";
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

export interface OwnerRegisterFormValues {
  email: string;
  password?: string;
  isDriver: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phone?: string;
  orgName: string;
}

type StepType = "account" | "organization";

function OwnerRegisterStepper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Invitation token validation state
  const [validationStatus, setValidationStatus] = useState<
    "loading" | "valid" | "invalid"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Current stepper step
  const [currentStep, setCurrentStep] = useState<StepType>("account");
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  // Token Validation on Mount
  useEffect(() => {
    if (!token) {
      setValidationStatus("valid");
      return;
    }

    const verifyToken = async () => {
      try {
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

  const handleNextStep = async () => {
    setApiError(null);
    let fieldsToValidate: Array<keyof OwnerRegisterFormValues> = [
      "email",
      "password",
      "phone",
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

  const onSubmit = async (data: OwnerRegisterFormValues) => {
    setApiError(null);
    try {
      await api.post("/register/owner-with-org", {
        ...(token ? { token } : {}),
        ...data,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.replace("/?login=true");
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

  if (validationStatus === "loading") {
    return (
      <div className="flex flex-col justify-center items-center h-screen px-4 w-full bg-slate-50">
        <div className="mb-8 animate-pulse">
          <Logo size="lg" />
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 shadow-md flex flex-col gap-6">
          <div className="h-6 bg-slate-100 rounded-md w-2/3 mx-auto animate-pulse"></div>
          <div className="h-4 bg-slate-100/60 rounded-md w-1/2 mx-auto animate-pulse"></div>
          <div className="flex flex-col gap-4 mt-4">
            <div className="h-12 bg-slate-100/50 rounded-xl w-full animate-pulse"></div>
            <div className="h-12 bg-slate-100/50 rounded-xl w-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (validationStatus === "invalid") {
    return (
      <div className="flex flex-col justify-center items-center h-screen px-4 w-full bg-slate-50 text-slate-800">
        <div className="mb-6">
          <Logo size="lg" />
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 shadow-md flex flex-col items-center text-center gap-6 relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/5 rounded-full blur-3xl"></div>

          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100 text-red-500 animate-bounce">
            <ShieldAlert size={32} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Acceso Denegado
            </h1>
            <p className="text-sm text-slate-550">
              El enlace de invitación que intentas utilizar no es válido.
            </p>
          </div>

          <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-700 w-full p-4 rounded-2xl flex items-start gap-3">
            <span className="font-medium text-left">{errorMessage}</span>
          </div>

          <div className="text-slate-500 text-xs text-left w-full border-t border-slate-100 pt-4 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <span>Las invitaciones expiran automáticamente en 24 horas.</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <span>Cada enlace solo puede ser utilizado una única vez.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col justify-center items-center h-screen px-4 w-full bg-slate-50 text-slate-800">
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 shadow-md flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600">
            <CheckCircle size={32} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              ¡Registro Exitoso!
            </h1>
            <p className="text-sm text-slate-500">
              Tu organización y cuenta de propietario se han creado
              correctamente.
            </p>
          </div>
          <div className="text-slate-400 text-xs animate-pulse">
            Redireccionando al inicio de sesión...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-slate-50 text-slate-800 overflow-x-hidden font-sans">
      {/* Columna Izquierda: Branding & Decoración Visual */}
      <div className="hidden md:flex md:col-span-5 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between border-r border-slate-800">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[60px] transform-gpu will-change-[transform,filter] pointer-events-none" />

        <div className="z-10 flex items-center gap-2">
          <Logo size="lg" variant="dark" />
        </div>

        <div className="z-10 my-auto flex flex-col gap-6 max-w-md animate-in fade-in slide-in-from-left-6 duration-500">
          <span className="text-xs px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 font-semibold tracking-wider w-fit">
            Portal de Propietarios
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Lleva tu flota al siguiente nivel.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Completa tu registro como propietario de flota. Podrás gestionar
            conductores, configurar rutas de telemetría y administrar tus
            operaciones en tiempo real desde una única plataforma.
          </p>

          {/* Panel decorativo de telemetría mockup */}
          <div className="mt-8 relative border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-6 shadow-md overflow-hidden transform-gpu">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-300">
                Monitoreo de Flota Activa
              </span>
              <span className="badge badge-primary text-[10px] py-1 font-mono font-bold text-white bg-blue-600 border-none rounded-md px-2">
                PRO OWNER
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                  Vehículos Activos
                </span>
                <span className="text-xl font-extrabold text-white">
                  12 / 14
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
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
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative bg-slate-50">
        <div className="w-full max-w-md z-10 flex flex-col gap-6">
          {/* Logo visible solo en mobile */}
          <div className="md:hidden flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {currentStep === "account"
                ? "Cuenta de Administrador"
                : "Detalles de tu Organización"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {currentStep === "account"
                ? "Configura tus credenciales de acceso iniciales."
                : "Registra el nombre de tu flota empresarial."}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="text-blue-600">Paso 1: Datos de Usuario</span>
              <span className="text-slate-300">|</span>
              <span
                className={
                  currentStep === "organization" ? "text-blue-600" : ""
                }
              >
                Paso 2: Organización
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
            className="bg-white border border-slate-200 rounded-3xl w-full p-6 md:p-8 flex flex-col gap-6 shadow-md"
          >
            {/* PASO 1: INFORMACIÓN DE LA CUENTA */}
            {currentStep === "account" && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <User size={16} />
                    </span>
                    <input
                      type="email"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
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
                  <label className="text-xs font-bold text-slate-700">
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
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
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? "Ocultar" : "Mostrar"}
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

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    Teléfono
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Phone size={14} />
                    </span>
                    <input
                      type="tel"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                      placeholder="Ej. +507 6000-0000"
                      {...register("phone", {
                        required: "El teléfono es obligatorio",
                        pattern: {
                          value:
                            /^(\+?507)?[-\s]?(6\d{3}[-\s]?\d{4}|[235789]\d{2}[-\s]?\d{4})$/,
                          message:
                            "El formato de teléfono no es válido para Panamá",
                        },
                      })}
                    />
                  </div>
                  {errors.phone && (
                    <span className="text-red-500 text-xs mt-1">
                      {errors.phone.message}
                    </span>
                  )}
                </div>

                {/* Checkbox de Doble Rol */}
                <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 mt-2">
                  <label className="cursor-pointer flex justify-between items-center">
                    <span className="text-slate-700 text-sm font-bold">
                      Quiero registrarme también como conductor
                    </span>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary rounded-lg border-slate-300 bg-white"
                      {...register("isDriver")}
                    />
                  </label>
                  <p className="text-slate-500 text-xs mt-1">
                    Activa esta opción para vincular automáticamente un perfil
                    de conductor y registrar tu telemetría histórica.
                  </p>
                </div>

                {/* Campos condicionales */}
                {!isDriver ? (
                  <div className="flex flex-col gap-1 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-bold text-slate-700">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
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
                  <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200 border-t border-slate-100 pt-4 mt-1">
                    <p className="text-xs font-bold text-blue-600">
                      Datos del Perfil de Conductor
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">
                          Nombre
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                          placeholder="Nombre"
                          {...register("firstName", {
                            required: isDriver
                              ? "El nombre es requerido"
                              : false,
                          })}
                        />
                        {errors.firstName && (
                          <span className="text-red-500 text-xs mt-1">
                            {errors.firstName.message}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">
                          Apellido
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                          placeholder="Apellido"
                          {...register("lastName", {
                            required: isDriver
                              ? "El apellido es requerido"
                              : false,
                          })}
                        />
                        {errors.lastName && (
                          <span className="text-red-500 text-xs mt-1">
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
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 mt-4 flex justify-center items-center gap-2 cursor-pointer"
                >
                  Siguiente Paso
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* PASO 2: INFORMACIÓN DE LA ORGANIZACIÓN */}
            {currentStep === "organization" && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    Nombre de la Empresa / Organización
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Building2 size={16} />
                    </span>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                      placeholder="Ej. Logística Continental S.A."
                      {...register("orgName", {
                        required: "El nombre de la organización es requerido",
                        validate: {
                          notEmpty: (val) =>
                            val.trim() !== "" ||
                            "El nombre de la organización no puede estar vacío",
                        },
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
                    className="w-1/2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => setCurrentStep("account")}
                  >
                    <ArrowLeft size={16} />
                    Atrás
                  </button>

                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="loading loading-spinner loading-sm"></span>
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
        <div className="flex justify-center items-center h-screen bg-slate-50">
          <span className="loading loading-spinner loading-lg text-blue-600 animate-pulse"></span>
        </div>
      }
    >
      <OwnerRegisterStepper />
    </Suspense>
  );
}
