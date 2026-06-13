import {
  AssignedVehicle,
  DriverAssignment,
  DriverProfileCardProps,
  DriverProfileStats,
} from "@/types";
import React, { useState } from "react";
import { Car, Loader2 } from "lucide-react";
import api from "@/utils/client/api-client";

export function DriverProfileCard({ stats }: DriverProfileCardProps) {
  if (!stats) return null;

  const [shareScores, setShareScores] = useState(
    stats.shareScoresPublicly ?? false,
  );
  const [updating, setUpdating] = useState(false);

  const handleToggleShare = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setUpdating(true);
    try {
      await api.patch("/drivers/me/share-settings", {
        shareScoresPublicly: newValue,
      });
      setShareScores(newValue);
    } catch (err) {
      console.error("Error updating sharing settings:", err);
      alert("No se pudo actualizar la configuración de privacidad.");
    } finally {
      setUpdating(false);
    }
  };

  const activeAssignment = stats.assignments?.find((a) => a.to === null);
  const vehicle = activeAssignment?.vehicle;
  const statusColor =
    stats.status === "ACTIVE"
      ? "bg-emerald-800/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
      : "bg-base-200 text-base-content/60";

  return (
    <div className="card bg-base-100/30 backdrop-blur-md border border-base-200 shadow-md rounded-2xl w-full">
      <div className="card-body p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-base-content flex items-center gap-2">
              <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0">
                <Car className="size-5" />
              </span>
              Perfil de Conductor Vinculado
            </h3>
            <p className="text-xs text-base-content/50 mt-1">
              Información de conducción y asignación de vehículos en tiempo
              real.
            </p>
          </div>
          <span
            className={`badge font-bold px-3 py-2 text-xs border self-start sm:self-auto ${statusColor}`}
          >
            {stats.status === "ACTIVE" ? "Conductor Activo" : "Inactivo"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Driver identity info */}
          <div className="space-y-4 bg-base-100/50 p-4 rounded-xl border border-base-200 text-left">
            <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/40">
              Datos del Conductor
            </h4>
            <div className="space-y-2.5 text-sm text-base-content/85">
              <div className="flex justify-between">
                <span className="text-base-content/50">Cédula:</span>
                <span className="font-mono font-semibold text-base-content">
                  {stats.nationalId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">Teléfono:</span>
                <span className="font-mono font-semibold text-base-content">
                  {stats.phone || "No registrado"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">Nombre:</span>
                <span className="font-semibold text-base-content">
                  {stats.firstName} {stats.lastName}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned vehicle info */}
          <div className="space-y-4 bg-base-100/50 p-4 rounded-xl border border-base-200 text-left">
            <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/40">
              Vehículo Asignado
            </h4>
            {vehicle ? (
              <div className="space-y-2.5 text-sm text-base-content/85">
                <div className="flex justify-between">
                  <span className="text-base-content/50">Alias:</span>
                  <span className="font-semibold text-base-content">
                    {vehicle.alias || "Sin Alias"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/50">Placa:</span>
                  <span className="font-mono font-semibold text-base-content">
                    {vehicle.plateNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/50">Marca / Modelo:</span>
                  <span className="font-semibold text-base-content">
                    {vehicle.make || "-"} / {vehicle.model || "-"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center h-full">
                <p className="text-xs text-base-content/50 italic">
                  No tienes ningún vehículo asignado actualmente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Privacy settings section */}
        <div className="border-t border-base-200/80 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5 max-w-xl text-left">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-1.5">
              Compartir puntuaciones públicamente
            </h4>
            <p className="text-xs text-base-content/50">
              Permite que los dueños de flotas y administradores vean tus scores
              en tu perfil público del Marketplace de Conductores.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {updating && (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={shareScores}
              onChange={handleToggleShare}
              disabled={updating}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
