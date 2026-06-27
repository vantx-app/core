"use client";

import {
  MobileViewVehicleSummary,
  VehicleMobileViewProps,
  AssignVehicleDriver,
} from "@/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import { Plus, Pencil, UserCog, Eye, Route } from "lucide-react";
import { MobileDrawer } from "@/components/MobileDrawer";
import AssignDriverForm from "@/components/AssignDriverForm";

export function VehicleMobileView({
  vehicles,
  targetOrgId,
}: VehicleMobileViewProps) {
  const router = useRouter();
  const { role } = useAuth();
  const canCreate = [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN].includes(
    role,
  );

  // Drawer states
  const [activeDrawer, setActiveDrawer] = useState<"assign" | null>(null);
  const [selectedVehicle, setSelectedVehicle] =
    useState<MobileViewVehicleSummary | null>(null);
  const [currentDriver, setCurrentDriver] =
    useState<AssignVehicleDriver | null>(null);

  const handleOpenAssign = (vehicle: MobileViewVehicleSummary) => {
    setSelectedVehicle(vehicle);
    const driver = vehicle.assignments?.[0]?.driver || null;
    setCurrentDriver(driver);
    setActiveDrawer("assign");
  };

  const closeDrawer = () => {
    setActiveDrawer(null);
    setSelectedVehicle(null);
    setCurrentDriver(null);
  };

  const getStatusBadgeClass = (status: MobileViewVehicleSummary["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "IN_MAINTENANCE":
        return "bg-warning/10 text-warning border-warning/20";
      case "DECOMMISSIONED":
        return "bg-error/10 text-error border-error/20";
      default:
        return "bg-base-200 text-base-content/60 border-base-300";
    }
  };

  const getStatusLabel = (status: MobileViewVehicleSummary["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "Activo";
      case "IN_MAINTENANCE":
        return "En Mantenimiento";
      case "DECOMMISSIONED":
        return "Decomisionado";
      default:
        return status;
    }
  };

  const renderVehicleCard = (vehicle: MobileViewVehicleSummary) => (
    <div
      key={vehicle.id}
      className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md p-5 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-200 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-base-content text-base leading-snug">
              {vehicle.alias}
            </h3>
          </div>
          <span
            className={`badge badge-sm font-semibold border ${getStatusBadgeClass(vehicle.status)}`}
          >
            {getStatusLabel(vehicle.status)}
          </span>
        </div>

        <div className="divider my-1 opacity-40"></div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-base-content/40 block">Marca</span>
            <span className="font-semibold text-base-content/85">
              {vehicle.make || "-"}
            </span>
          </div>
          <div>
            <span className="text-base-content/40 block">Modelo</span>
            <span className="font-semibold text-base-content/85">
              {vehicle.model || "-"}
            </span>
          </div>
          <div>
            <span className="text-base-content/40 block">Año</span>
            <span className="font-semibold text-base-content/85">
              {vehicle.year || "-"}
            </span>
          </div>
        </div>

        <div className="text-xs flex items-center justify-between bg-base-200/40 p-2 rounded-xl mt-2">
          <span className="text-base-content/50 font-medium">Conductor:</span>
          {vehicle.assignments?.[0]?.driver ? (
            <span className="font-bold text-base-content/90">
              {vehicle.assignments[0].driver.firstName &&
                vehicle.assignments[0].driver.lastName
                ? `${vehicle.assignments[0].driver.firstName} ${vehicle.assignments[0].driver.lastName}`
                : vehicle.assignments[0].driver.nationalId}
            </span>
          ) : (
            <span className="text-base-content/40 italic">Sin conductor</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 mt-4 pt-3 border-t border-base-200">
        <Link
          href={
            targetOrgId
              ? `/vehicle/${vehicle.id}/view?targetOrgId=${targetOrgId}`
              : `/vehicle/${vehicle.id}/view`
          }
          className="btn btn-outline border-base-300 hover:bg-base-200 btn-sm gap-1.5 rounded-xl text-xs text-base-content font-semibold"
        >
          <Eye className="size-3.5" />
          Ver
        </Link>
        <Link
          href={
            targetOrgId
              ? `/vehicle/${vehicle.id}/trips?targetOrgId=${targetOrgId}`
              : `/vehicle/${vehicle.id}/trips`
          }
          className="btn btn-outline border-base-300 hover:bg-base-200 btn-sm gap-1.5 rounded-xl text-xs text-base-content font-semibold"
        >
          <Route className="size-3.5" />
          Viajes
        </Link>
        <Link
          href={
            targetOrgId
              ? `/vehicle/${vehicle.id}/edit?targetOrgId=${targetOrgId}`
              : `/vehicle/${vehicle.id}/edit`
          }
          className="btn btn-outline border-base-300 hover:bg-base-200 btn-sm gap-1.5 rounded-xl text-xs text-base-content font-semibold"
        >
          <Pencil className="size-3.5" />
          Editar
        </Link>
        <button
          onClick={() => handleOpenAssign(vehicle)}
          className="btn btn-primary btn-sm gap-1.5 rounded-xl text-xs text-white font-semibold"
        >
          <UserCog className="size-3.5" />
          Asignar
        </button>
      </div>
    </div>
  );

  const showGrouping = vehicles.length > 5;
  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE");
  const maintenanceVehicles = vehicles.filter(
    (v) => v.status === "IN_MAINTENANCE",
  );
  const decommissionedVehicles = vehicles.filter(
    (v) => v.status === "DECOMMISSIONED",
  );

  const groups = [
    {
      id: "active",
      name: "Activos",
      badge: "bg-emerald-500/40",
      vehicles: activeVehicles,
    },
    {
      id: "maintenance",
      name: "En Mantenimiento",
      badge: "bg-warning",
      vehicles: maintenanceVehicles,
    },
    {
      id: "decommissioned",
      name: "Decomisionados",
      badge: "bg-neutral-content/40",
      vehicles: decommissionedVehicles,
    },
  ];

  const firstNonEmptyGroup =
    groups.find((g) => g.vehicles.length > 0)?.id || "active";

  return (
    <div className="space-y-6">
      {/* Mobile Registration Button */}
      {canCreate && (
        <Link
          href={
            targetOrgId
              ? `/vehicle/new?targetOrgId=${targetOrgId}`
              : "/vehicle/new"
          }
          className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white w-full shadow-lg shadow-blue-500/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Plus className="size-5" />
          Registrar Nuevo Vehículo
        </Link>
      )}

      {/* Cards Grid */}
      {showGrouping ? (
        <div className="space-y-4">
          {groups.map((group) => {
            if (group.vehicles.length === 0) return null;
            return (
              <div
                key={group.id}
                className="collapse  bg-base-100/40 border border-base-200 shadow-md rounded-2xl overflow-hidden backdrop-blur-md"
              >
                <input
                  type="checkbox"
                  defaultChecked={group.id === firstNonEmptyGroup}
                  className="peer"
                  aria-label={`Mostrar vehículos ${group.name}`}
                />
                <div className="collapse-title text-sm font-bold flex items-center gap-2.5 pr-10 text-base-content bg-base-200/20">
                  <span
                    className={`size-2.5 rounded-full ${group.badge} ${group.id === "active" ? "animate-pulse" : ""}`}
                  />
                  <span>{group.name}</span>
                  <span className="badge badge-neutral badge-sm ml-2 font-mono font-bold bg-base-300 border-none text-base-content/85">
                    {group.vehicles.length}
                  </span>
                </div>
                <div className="collapse-content p-4 bg-base-100/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {group.vehicles.map(renderVehicleCard)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map(renderVehicleCard)}
        </div>
      )}

      {/* New/Edit Vehicle Drawer was removed - now handled by dedicated subpages /vehicle/new and /vehicle/[id]/edit */}

      {/* Assign Driver Drawer */}
      <MobileDrawer
        open={activeDrawer === "assign" && !!selectedVehicle}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
        title="Asignar Conductor"
        subtitle={selectedVehicle?.alias}
        icon={<UserCog className="size-5" />}
        onClose={closeDrawer}
      >
        {selectedVehicle && (
          <div className="p-5">
            <AssignDriverForm
              vehicleId={selectedVehicle.id}
              initialDriver={currentDriver}
              onSuccess={() => {
                closeDrawer();
                router.refresh();
              }}
            />
          </div>
        )}
      </MobileDrawer>
    </div>
  );
}
