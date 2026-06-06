"use client";

import { VehicleTripsClientProps } from "@/types";
import { BackButton } from "@/components/ui/BackButton";
import { ArrowLeft } from "lucide-react";
import TripsHistoryView from "@/components/TripsHistoryView";

export default function VehicleTripsClient({
  vehicle,
  initialTrips,
}: VehicleTripsClientProps) {
  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden space-y-4 flex-grow min-h-0">
      {/* Header & Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-base-100/50 backdrop-blur-md rounded-2xl border border-base-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <BackButton
            fallbackHref="/vehicle"
            className="btn btn-sm btn-ghost btn-square rounded-xl"
            icon={<ArrowLeft className="size-5" />}
          />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-base-content">
              Historial de Viajes
            </h1>
            <p className="text-xs text-base-content/60">
              {vehicle.alias || `Vehículo ${vehicle.plateNumber}`} — Placa:{" "}
              <span className="font-mono">{vehicle.plateNumber}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs font-medium text-base-content/50 bg-base-200/50 px-3 py-1.5 rounded-xl border border-base-300/30 self-start sm:self-auto">
          <span>{vehicle.make || "-"}</span>
          <span>•</span>
          <span>{vehicle.model || "-"}</span>
          <span>•</span>
          <span>{vehicle.year || "-"}</span>
        </div>
      </div>

      {/* Explorador de Viajes Unificado */}
      <div className="flex-grow min-h-0">
        <TripsHistoryView
          initialTrips={initialTrips}
          vehicleContext={vehicle}
          isDriverCentric={false}
        />
      </div>
    </div>
  );
}
