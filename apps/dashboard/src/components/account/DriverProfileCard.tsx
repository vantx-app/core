import {
  AssignedVehicle,
  DriverAssignment,
  DriverProfileCardProps,
  DriverProfileStats,
} from "@/types";
import React from "react";
import { Car } from "lucide-react";

export function DriverProfileCard({ stats }: DriverProfileCardProps) {
  if (!stats) return null;

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
          <div className="space-y-4 bg-base-100/50 p-4 rounded-xl border border-base-200">
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
          <div className="space-y-4 bg-base-100/50 p-4 rounded-xl border border-base-200">
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
      </div>
    </div>
  );
}
