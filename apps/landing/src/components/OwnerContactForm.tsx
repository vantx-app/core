"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Mail,
  Phone,
  Building2,
  User,
  FileText,
} from "lucide-react";

export function OwnerContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      fleetSize: "1-10",
      message: "",
    },
  });

  const onSubmit = async (data: any) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-8 px-4 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
          <ShieldCheck className="size-8" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800">
          Solicitud Recibida
        </h3>
        <p className="text-slate-500 text-sm max-w-sm mb-2">
          Gracias por tu interés en VantX. Un especialista de flotas se pondrá
          en contacto contigo a través del correo o teléfono provisto en menos
          de 24 horas.
        </p>
        {callbackUrl ? (
          <a
            href={callbackUrl}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
          >
            Volver al Marketplace
          </a>
        ) : (
          <a
            href="/"
            className="w-full py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold text-sm transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
          >
            Volver al Inicio
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-extrabold text-slate-850">
          Solicitar Demostración
        </h3>
        <p className="text-slate-500 text-xs mt-1">
          Completa tus datos y un especialista te guiará para seleccionar el
          hardware Teltonika y el adaptador sin contacto ECAN02 ideal para tu
          flota.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block pl-0.5">
            Nombre Completo
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              disabled={isSubmitting}
              className={`w-full bg-slate-50 border ${
                errors.name
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-200 focus:border-slate-400"
              } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              placeholder="Juan Pérez"
              {...register("name", { required: "El nombre es obligatorio" })}
            />
          </div>
          {errors.name && (
            <span className="text-red-500 text-[11px] block pl-0.5">
              {errors.name.message}
            </span>
          )}
        </div>

        {/* Company */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block pl-0.5">
            Nombre de la Empresa
          </label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              disabled={isSubmitting}
              className={`w-full bg-slate-50 border ${
                errors.company
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-200 focus:border-slate-400"
              } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              placeholder="Logística S.A."
              {...register("company", {
                required: "La empresa es obligatoria",
              })}
            />
          </div>
          {errors.company && (
            <span className="text-red-500 text-[11px] block pl-0.5">
              {errors.company.message}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block pl-0.5">
            Correo Corporativo
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="email"
              disabled={isSubmitting}
              className={`w-full bg-slate-50 border ${
                errors.email
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-200 focus:border-slate-400"
              } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              placeholder="juan@empresa.com"
              {...register("email", {
                required: "El correo es obligatorio",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Formato no válido",
                },
              })}
            />
          </div>
          {errors.email && (
            <span className="text-red-500 text-[11px] block pl-0.5">
              {errors.email.message}
            </span>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block pl-0.5">
            Teléfono de Contacto
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="tel"
              disabled={isSubmitting}
              className={`w-full bg-slate-50 border ${
                errors.phone
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-200 focus:border-slate-400"
              } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              placeholder="+507 6000-0000"
              {...register("phone", {
                required: "El teléfono es obligatorio",
                pattern: {
                  value:
                    /^(\+?507)?[-\s]?(6\d{3}[-\s]?\d{4}|[235789]\d{2}[-\s]?\d{4})$/,
                  message: "El formato de teléfono no es válido para Panamá",
                },
              })}
            />
          </div>
          {errors.phone && (
            <span className="text-red-500 text-[11px] block pl-0.5">
              {errors.phone.message}
            </span>
          )}
        </div>
      </div>

      {/* Fleet Size */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-600 block pl-0.5">
          Tamaño de la Flota (vehiculos)
        </label>
        <select
          disabled={isSubmitting}
          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 px-3 text-sm text-slate-800 focus:outline-none transition-all"
          {...register("fleetSize")}
        >
          <option value="1-10">1 a 10 vehiculos</option>
          <option value="11-50">11 a 50 vehiculos</option>
          <option value="51-200">51 a 200 vehiculos</option>
          <option value="200+">Más de 200 vehiculos</option>
        </select>
      </div>

      {/* Message */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-600 block pl-0.5">
          Mensaje o Requerimientos Especiales
        </label>
        <div className="relative">
          <FileText className="absolute left-3.5 top-3.5 size-4 text-slate-400 pointer-events-none" />
          <textarea
            disabled={isSubmitting}
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all resize-none"
            placeholder="Coméntanos más sobre tus operaciones..."
            {...register("message")}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 flex justify-center items-center cursor-pointer"
      >
        {isSubmitting ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          "Enviar Solicitud"
        )}
      </button>
    </form>
  );
}
