import React from "react";
import { Car, Lock, Loader2, DollarSign } from "lucide-react";
import { getCategoryText, getFuelText } from "../utils/client/format";

export interface VehicleListingData {
  id: string;
  plateNumber?: string;
  alias?: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  category: string;
  fuelType: string | null;
  isListed?: boolean;
  listingPrice: number | null;
  listingDescription: string | null;
  hasOptionToBuy: boolean;
  isLocked?: boolean;
  organization?: {
    name: string;
    users?: {
      email: string;
      name: string | null;
    }[];
  } | null;
  assignments?: {
    driver: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      nationalId: string;
    };
  }[];
}

interface VehicleCardProps {
  vehicle: VehicleListingData;
  headerBadge?: React.ReactNode;
  tags?: React.ReactNode;
  showDetails?: boolean;
  buyOptionStyle?: "badge" | "box";
  warningBanner?: React.ReactNode;
  actions: React.ReactNode;
  isLocked?: boolean;
}

export function VehicleCard({
  vehicle,
  headerBadge,
  tags,
  showDetails = true,
  buyOptionStyle = "box",
  warningBanner,
  actions,
  isLocked = false,
}: VehicleCardProps) {
  return (
    <div
      className={`bg-white border rounded-2xl p-6 shadow-sm overflow-hidden transition-all duration-300 flex flex-col justify-between gap-5 relative ${
        isLocked
          ? "border-slate-200 opacity-95 hover:border-slate-300"
          : "border-slate-200 hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div className="space-y-4 text-left flex-1 flex flex-col justify-between">
        <div>
          {/* Header badge & title info */}
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-slate-400">
                {getCategoryText(vehicle.category)} •{" "}
                {getFuelText(vehicle.fuelType)}
                {vehicle.organization?.name &&
                  ` • ${vehicle.organization.name}`}
              </span>
              <h4 className="font-extrabold text-lg text-slate-900 leading-tight">
                {vehicle.make
                  ? `${vehicle.make} ${vehicle.model || ""}`
                  : "Vehículo sin marca/modelo"}
                {vehicle.year && (
                  <span className="text-slate-400 font-medium text-sm ml-1.5">
                    ({vehicle.year})
                  </span>
                )}
              </h4>
              {tags}
            </div>
            {headerBadge}
          </div>

          {/* Pricing, Description, Option to Buy */}
          {showDetails && (
            <div className="space-y-3 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-baseline gap-1 text-slate-900">
                <span className="font-extrabold text-xl tracking-tight">
                  ${vehicle.listingPrice?.toFixed(2) || "0.00"}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">
                  / Mensual
                </span>
              </div>

              {vehicle.listingDescription && (
                <div className="pt-1">
                  {buyOptionStyle === "box" ? (
                    <>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Descripción de la oferta
                      </span>
                      <p
                        className={`text-xs leading-relaxed ${isLocked ? "text-slate-400 italic" : "text-slate-650"}`}
                      >
                        {vehicle.listingDescription}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-650 line-clamp-2 leading-relaxed italic">
                      &ldquo;{vehicle.listingDescription}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {vehicle.hasOptionToBuy &&
                (buyOptionStyle === "box" ? (
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
                        tras cumplir el tiempo pactado del contrato de alquiler.
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-lg">
                    Alquiler con opción a compra
                  </span>
                ))}
            </div>
          )}
        </div>

        {warningBanner}
      </div>

      {/* Action Buttons Container */}
      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {actions}
      </div>
    </div>
  );
}

export function LoadingCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-slate-200 rounded-2xl w-full">
      <Loader2 className="size-8 animate-spin text-blue-600" />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionButton,
}: {
  title: string;
  description: string;
  actionButton?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-16 w-full">
      <Car className="size-14 text-slate-300 mb-3" />
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
        {description}
      </p>
      {actionButton && <div className="mt-4">{actionButton}</div>}
    </div>
  );
}
