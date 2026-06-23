"use client";

import React, { useState, useEffect } from "react";
import api from "../utils/client/api-client";
import { Lock, AlertCircle } from "lucide-react";
import { VehicleCard, LoadingCard, EmptyState } from "./VehicleCard";

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
  onVerify?: () => void;
}

export function VehicleListingsTab({
  isDriverActive,
  isGuest = false,
  onVerify,
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
    return <LoadingCard message="Cargando vehículos disponibles..." />;
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
        <EmptyState
          title="No hay vehículos listados"
          description="En este momento no hay vehículos listados públicamente para alquiler o asignación. Por favor, vuelve a revisar más tarde."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {listings.map((vehicle) => {
            const isLocked = vehicle.isLocked || !isDriverActive;

            const headerBadge = isLocked ? (
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/50 flex items-center gap-1 text-[10px] font-bold z-10 shadow-sm">
                <Lock className="size-3" />
                {!isGuest && <span>Verificación Requerida</span>}
              </div>
            ) : undefined;

            const actions = isLocked ? (
              isGuest ? (
                <a
                  href={`${landingUrl}/login?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                  className="w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-bold text-xs transition-all shadow-md active:scale-95 shadow-blue-600/10 flex items-center justify-center gap-1.5"
                >
                  <Lock className="size-3.5" />
                  Iniciar Sesión para Contactar
                </a>
              ) : (
                <button
                  onClick={onVerify}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 text-xs text-blue-700 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Lock className="size-3.5" />
                  Desbloquear con tu Verificación
                </button>
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
            );

            return (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                headerBadge={headerBadge}
                actions={actions}
                isLocked={isLocked}
                buyOptionStyle="box"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
