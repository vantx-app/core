"use client";

import React, { useState, useEffect } from "react";
import api from "../utils/client/api-client";
import { getCategoryText, getFuelText } from "../utils/client/format";
import {
  Car,
  DollarSign,
  Info,
  Lock,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export interface VehicleListing {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  category: string;
  fuelType: string | null;
  listingPrice: number | null;
  listingDescription: string | null;
  hasOptionToBuy: boolean;
  isLocked?: boolean;
  organization?: {
    name: string;
    users: {
      email: string;
      name: string | null;
    }[];
  } | null;
}

export interface VehicleListingsTabProps {
  isDriverActive: boolean;
  isGuest?: boolean;
}

export function VehicleListingsTab({
  isDriverActive,
  isGuest = false,
}: VehicleListingsTabProps) {
  const [listings, setListings] = useState<VehicleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = isGuest
        ? "/marketplace/vehicles/public"
        : "/marketplace/vehicles";
      const { data } = await api.get(endpoint);
      setListings(data);
    } catch (err: any) {
      console.error("Error al cargar listados de vehículos:", err);
      if (err.response?.status === 403) {
        setError(
          "Acceso denegado: Solo los conductores que no tienen ningún vehículo asignado actualmente pueden explorar vehículos en el mercado.",
        );
      } else {
        setError(
          "No se pudieron cargar los vehículos disponibles en este momento.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleContact = (vehicle: VehicleListing) => {
    const owner = vehicle.organization?.users?.[0];
    if (owner?.email) {
      const subject = encodeURIComponent(
        `Interés en alquiler de vehículo: ${vehicle.make} ${vehicle.model}`,
      );
      const body = encodeURIComponent(
        `Hola ${owner.name || "Propietario"},\n\nSoy un conductor verificado en VantX y he visto tu vehículo ${vehicle.make} ${vehicle.model} (${vehicle.year || ""}) listado en el mercado por $${vehicle.listingPrice || "0.00"}/mensual.\n\nMe gustaría ponerme en contacto contigo para conversar sobre la posible asignación.\n\nSaludos.`,
      );
      window.location.href = `mailto:${owner.email}?subject=${subject}&body=${body}`;
    } else {
      alert(
        `Contacto de la empresa: ${vehicle.organization?.name || "VantX Fleet"}`,
      );
    }
  };

  const handleApply = (vehicle: VehicleListing) => {
    alert(
      `¡Postulación enviada con éxito para el vehículo ${vehicle.make} ${vehicle.model}! El propietario de la flota (${vehicle.organization?.name || "propietaria"}) ha sido notificado y se pondrá en contacto contigo.`,
    );
  };

  if (loading) {
    return (
      <div className="card bg-white border border-slate-200 shadow-md rounded-2xl w-full">
        <div className="card-body p-8 flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-xs text-slate-500 mt-2">
            Cargando vehículos disponibles...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning shadow p-4 rounded-xl text-left flex items-start gap-3">
        <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-slate-800">
            No se pudieron cargar vehículos
          </h4>
          <p className="text-xs text-slate-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900">
            Vehículos en el Mercado
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Explora las ofertas publicadas por empresas y propietarios de flotas
            para asignaciones de vehículos.
          </p>
        </div>
        <span className="badge bg-slate-100 border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">
          {listings.length} listados encontrados
        </span>
      </div>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-16">
          <Car className="size-14 text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">
            No hay vehículos listados
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            En este momento no hay vehículos listados públicamente para alquiler
            o asignación. Por favor, vuelve a revisar más tarde.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {listings.map((vehicle) => {
            const isLocked = vehicle.isLocked || !isDriverActive;

            return (
              <div
                key={vehicle.id}
                className={`card bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-300 flex flex-col justify-between ${
                  isLocked
                    ? "border-slate-200 opacity-95 hover:border-slate-300"
                    : "border-slate-200 hover:border-blue-300 hover:shadow-md"
                }`}
              >
                {/* Header info */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between text-left relative">
                  {isLocked && (
                    <div className="absolute top-4 right-4 p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/50 flex items-center gap-1 text-[10px] font-bold z-10 shadow-sm">
                      <Lock className="size-3" />
                      {isGuest
                        ? "Iniciar Sesión Requerido"
                        : "Verificación Requerida"}
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getCategoryText(vehicle.category)} &bull;{" "}
                      {getFuelText(vehicle.fuelType)}
                      {vehicle.organization?.name &&
                        ` &bull; ${vehicle.organization.name}`}
                    </span>
                    <h4 className="font-extrabold text-lg text-slate-900 leading-tight">
                      {vehicle.make} {vehicle.model}
                      {vehicle.year && (
                        <span className="text-slate-400 font-medium text-sm ml-1.5">
                          ({vehicle.year})
                        </span>
                      )}
                    </h4>
                  </div>

                  <div className="flex items-baseline gap-1 text-slate-900">
                    <span className="font-extrabold text-2xl tracking-tight">
                      ${vehicle.listingPrice?.toFixed(2) || "0.00"}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold uppercase">
                      / Mensual
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Descripción de la oferta
                    </span>
                    <p
                      className={`text-xs leading-relaxed ${isLocked ? "text-slate-400 italic" : "text-slate-600"}`}
                    >
                      {vehicle.listingDescription}
                    </p>
                  </div>

                  {vehicle.hasOptionToBuy && (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl p-3 text-xs flex items-start gap-2.5">
                      <div className="p-1 bg-emerald-500 text-white rounded-lg shrink-0 mt-0.5">
                        <DollarSign className="size-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-emerald-950">
                          Alquiler con Opción a Compra
                        </p>
                        <p className="text-[10px] text-emerald-700 mt-0.5 leading-normal">
                          Esta oferta permite la adquisición final del vehículo
                          tras cumplir el tiempo pactado del contrato de
                          alquiler.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  {isLocked ? (
                    isGuest ? (
                      <a
                        href={`${landingUrl}/login?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                        className="w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-bold text-xs transition-all shadow-md active:scale-95 shadow-blue-600/10 flex items-center justify-center gap-1.5"
                      >
                        <Lock className="size-3.5" />
                        Iniciar Sesión para Contactar
                      </a>
                    ) : (
                      <div className="w-full text-center py-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-500 font-semibold flex items-center justify-center gap-1.5">
                        <Lock className="size-3.5" />
                        Desbloquear con tu Verificación
                      </div>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => handleContact(vehicle)}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs active:scale-95 transition-all shadow-sm"
                      >
                        Contactar
                      </button>
                      <button
                        onClick={() => handleApply(vehicle)}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all shadow-sm shadow-blue-600/10"
                      >
                        Aplicar a Vehículo
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
