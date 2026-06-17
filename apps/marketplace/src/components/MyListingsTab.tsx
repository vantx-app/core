"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import api from "../utils/client/api-client";
import { getCategoryText, getFuelText } from "../utils/client/format";
import {
  Car,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Save,
  X,
} from "lucide-react";

interface Vehicle {
  id: string;
  alias: string | null;
  plateNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  category: string;
  fuelType: string | null;
  isListed: boolean;
  listingPrice: number | null;
  listingDescription: string | null;
  hasOptionToBuy: boolean;
}

interface VehicleFormValues {
  plateNumber: string;
  alias: string;
  make: string;
  model: string;
  year: string;
  category: string;
  fuelType: string;
  isListed: boolean;
  listingPrice: string;
  listingDescription: string;
  hasOptionToBuy: boolean;
}

export function MyListingsTab() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de los Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Inicializar React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    defaultValues: {
      plateNumber: "",
      alias: "",
      make: "",
      model: "",
      year: "",
      category: "PASSENGER",
      fuelType: "",
      isListed: true,
      listingPrice: "",
      listingDescription: "",
      hasOptionToBuy: false,
    },
  });

  const watchedIsListed = watch("isListed");

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get<Vehicle[]>("/vehicles");
      setVehicles(data);
    } catch (err: any) {
      console.error("Error cargando vehículos de la flota:", err);
      setError("No se pudieron cargar tus vehículos. Inténtalo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const openCreateModal = () => {
    setEditingVehicle(null);
    reset({
      plateNumber: "",
      alias: "",
      make: "",
      model: "",
      year: "",
      category: "PASSENGER",
      fuelType: "",
      isListed: true,
      listingPrice: "",
      listingDescription: "",
      hasOptionToBuy: false,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    reset({
      plateNumber: vehicle.plateNumber,
      alias: vehicle.alias || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      year: vehicle.year ? String(vehicle.year) : "",
      category: vehicle.category,
      fuelType: vehicle.fuelType || "",
      isListed: vehicle.isListed,
      listingPrice: vehicle.listingPrice ? String(vehicle.listingPrice) : "",
      listingDescription: vehicle.listingDescription || "",
      hasOptionToBuy: vehicle.hasOptionToBuy,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleListed = async (vehicle: Vehicle) => {
    try {
      const updatedStatus = !vehicle.isListed;
      await api.patch(`/vehicles/${vehicle.id}`, {
        isListed: updatedStatus,
      });
      // Actualizar estado local
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id ? { ...v, isListed: updatedStatus } : v,
        ),
      );
    } catch (err) {
      console.error("Error al actualizar estado de publicación:", err);
      alert("No se pudo actualizar la publicación en el mercado.");
    }
  };

  const onFormSubmit = async (data: VehicleFormValues) => {
    setFormError(null);
    setFormSaving(true);

    const payload = {
      plateNumber: data.plateNumber.trim().toUpperCase(),
      alias: data.alias.trim() || undefined,
      make: data.make.trim() || undefined,
      model: data.model.trim() || undefined,
      year: data.year ? Number(data.year) : undefined,
      category: data.category,
      fuelType: data.fuelType || null,
      isListed: data.isListed,
      listingPrice:
        data.isListed && data.listingPrice ? Number(data.listingPrice) : null,
      listingDescription:
        data.isListed && data.listingDescription.trim()
          ? data.listingDescription.trim()
          : undefined,
      hasOptionToBuy: data.isListed ? data.hasOptionToBuy : false,
    };

    try {
      if (editingVehicle) {
        // Modo Edición
        await api.patch(`/vehicles/${editingVehicle.id}`, payload);
      } else {
        // Modo Creación
        await api.post("/vehicles", payload);
      }
      setIsModalOpen(false);
      fetchVehicles();
    } catch (err: any) {
      console.error("Error al guardar vehículo:", err);
      const msg =
        err.response?.data?.message ||
        "Ocurrió un error al guardar los datos del vehículo.";
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-slate-200 rounded-2xl">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500">Cargando tus publicaciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning shadow p-4 rounded-xl text-left flex items-start gap-3">
        <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-slate-800">Error</h4>
          <p className="text-xs text-slate-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900">
            Mis Publicaciones de Vehículos
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Registra y publica tus vehículos en el mercado de conductores de
            VantX de forma gratuita.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 shadow-lg shadow-blue-500/20 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="size-4" />
          Publicar Vehículo
        </button>
      </div>

      {/* Grid de Vehículos */}
      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-16">
          <Car className="size-14 text-slate-350 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">
            No tienes vehículos registrados
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
            Aún no has registrado ningún vehículo en tu flota. Registra uno
            ahora para listarlo en el mercado.
          </p>
          <button
            onClick={openCreateModal}
            className="btn btn-outline border-slate-300 text-slate-650 hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-xl"
          >
            Comenzar Registro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className={`p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden`}
            >
              <div>
                {/* Estatus e Identificación */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getCategoryText(vehicle.category)} &bull;{" "}
                      {getFuelText(vehicle.fuelType)}
                    </span>
                    <h4 className="font-extrabold text-lg text-slate-900 leading-tight">
                      {vehicle.make
                        ? `${vehicle.make} ${vehicle.model || ""}`
                        : "Vehículo sin marca/modelo"}
                      {vehicle.year && (
                        <span className="text-slate-400 font-medium text-xs ml-1.5">
                          ({vehicle.year})
                        </span>
                      )}
                    </h4>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-700">
                        Placa: {vehicle.plateNumber}
                      </span>
                      {vehicle.alias && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 border border-blue-100 text-blue-700">
                          Alias: {vehicle.alias}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge de Listado */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                      vehicle.isListed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-200 border-slate-200 text-slate-500"
                    }`}
                  >
                    {vehicle.isListed ? "Listado" : "Borrador"}
                  </span>
                </div>

                {/* Precios y Detalles */}
                {vehicle.isListed && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-baseline gap-1 text-slate-900">
                      <span className="font-extrabold text-xl tracking-tight">
                        ${vehicle.listingPrice?.toFixed(2) || "0.00"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">
                        / Mensual
                      </span>
                    </div>
                    {vehicle.listingDescription && (
                      <p className="text-xs text-slate-650 line-clamp-2 leading-relaxed italic">
                        &ldquo;{vehicle.listingDescription}&rdquo;
                      </p>
                    )}
                    {vehicle.hasOptionToBuy && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-lg">
                        Alquiler con opción a compra
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="border-t border-slate-100 pt-4 flex gap-3">
                <button
                  onClick={() => openEditModal(vehicle)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="size-3.5 text-slate-400" />
                  Editar Detalles
                </button>
                <button
                  onClick={() => handleToggleListed(vehicle)}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border ${
                    vehicle.isListed
                      ? "border-slate-200 hover:border-red-350 bg-white hover:bg-red-50 text-slate-700 hover:text-red-650"
                      : "border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/10"
                  }`}
                >
                  {vehicle.isListed ? (
                    <>
                      <EyeOff className="size-3.5" />
                      Desactivar Oferta
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" />
                      Activar Oferta
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="bg-white border border-slate-200 w-full max-w-xl p-6 rounded-3xl relative z-10 animate-in fade-in zoom-in-95 duration-205 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-5 text-left">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Car className="size-5 text-blue-600" />
                {editingVehicle
                  ? "Editar Publicación"
                  : "Publicar Nuevo Vehículo"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-slate-650 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {formError && (
              <div className="alert alert-error text-xs border border-red-200 bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-left">
                {formError}
              </div>
            )}

            <form
              onSubmit={handleSubmit(onFormSubmit)}
              className="space-y-4 text-left"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Placa */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Número de Placa *
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border ${
                      errors.plateNumber
                        ? "border-red-400 focus:border-red-500"
                        : "border-slate-250 focus:border-slate-400"
                    } text-xs text-slate-800 uppercase focus:outline-none transition-all`}
                    placeholder="Ej. AB1234"
                    {...register("plateNumber", {
                      required: "La placa del vehículo es requerida",
                      onChange: (e) =>
                        setValue("plateNumber", e.target.value.toUpperCase()),
                    })}
                  />
                  {errors.plateNumber && (
                    <span className="text-red-500 text-[10px] mt-1 block">
                      {errors.plateNumber.message}
                    </span>
                  )}
                </div>

                {/* Alias */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Alias del Vehículo (Opcional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all"
                    placeholder="Ej. Mula #5 o Cisterna"
                    {...register("alias")}
                  />
                </div>

                {/* Marca */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Marca
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all"
                    placeholder="Ej. Toyota o Freightliner"
                    {...register("make")}
                  />
                </div>

                {/* Modelo */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Modelo
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all"
                    placeholder="Ej. Hilux o Cascadia"
                    {...register("model")}
                  />
                </div>

                {/* Año */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Año
                  </label>
                  <input
                    type="number"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all"
                    placeholder="Ej. 2023"
                    {...register("year")}
                  />
                </div>

                {/* Tipo de Combustible */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Tipo de Combustible
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all"
                    {...register("fuelType")}
                  >
                    <option value="">No Especificado</option>
                    <option value="DIESEL">Diésel</option>
                    <option value="GASOLINE">Gasolina</option>
                    <option value="ELECTRIC">Eléctrico</option>
                    <option value="HYBRID">Híbrido</option>
                  </select>
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                    Categoría del Vehículo
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all"
                    {...register("category")}
                  >
                    <option value="PASSENGER">Vehículo de Pasajeros</option>
                    <option value="LIGHT_COMMERCIAL">
                      Distribución Ligera
                    </option>
                    <option value="HEAVY_DUTY">Carga Pesada</option>
                    <option value="MACHINERY">Maquinaria Pesada</option>
                  </select>
                </div>

                {/* Activar Oferta al guardar */}
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 h-[53px]">
                  <input
                    type="checkbox"
                    id="isListedCheckbox"
                    className="checkbox checkbox-primary rounded-lg border-slate-300 size-4 bg-white"
                    {...register("isListed")}
                  />
                  <label
                    htmlFor="isListedCheckbox"
                    className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                  >
                    Publicar oferta de inmediato
                  </label>
                </div>
              </div>

              {/* Parámetros de Publicación */}
              {watchedIsListed && (
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-4 animate-in slide-in-from-top-3 duration-250">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Precio de listado */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                        Precio Mensual de Alquiler ($)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-semibold">
                          $
                        </span>
                        <input
                          type="number"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 pl-8 focus:outline-none transition-all"
                          placeholder="0.00"
                          {...register("listingPrice")}
                        />
                      </div>
                    </div>

                    {/* Opción a compra */}
                    <div className="flex items-center gap-2 border border-blue-100 bg-white rounded-xl px-3.5 py-2.5 h-[53px]">
                      <input
                        type="checkbox"
                        id="hasOptionToBuyCheckbox"
                        className="checkbox checkbox-primary rounded-lg border-slate-300 size-4 bg-white"
                        {...register("hasOptionToBuy")}
                      />
                      <label
                        htmlFor="hasOptionToBuyCheckbox"
                        className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                      >
                        Alquiler con opción a compra
                      </label>
                    </div>
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                      Detalles o Requisitos de la Oferta
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-250 focus:border-slate-400 text-xs text-slate-800 focus:outline-none transition-all resize-none"
                      placeholder="Ej. Se busca conductor con licencia comercial tipo F para entrega de materiales. Récord policivo limpio..."
                      {...register("listingDescription")}
                    />
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-250 bg-white hover:bg-slate-55 text-slate-700 font-bold text-xs active:scale-95 transition-all shadow-sm cursor-pointer"
                  disabled={formSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 cursor-pointer"
                  disabled={formSaving}
                >
                  {formSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      {editingVehicle ? "Guardar Cambios" : "Publicar Vehículo"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
