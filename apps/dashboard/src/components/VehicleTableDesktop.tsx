"use client";

import {
  FleetVehicleSummary,
  TableColumn,
  VehicleTableDesktopProps,
} from "@/types";
import Link from "next/link";
import { Pencil, UserCog, Route, Eye } from "lucide-react";
import { DriverInfoLabel } from "@/components/ui/DriverInfoLabel";
import { Table } from "@/components/ui/Table";
import {
  getVehicleStatusBadgeClass,
  getVehicleStatusLabel,
} from "@/utils/client";

export function VehicleTableDesktop({
  vehicles,
  targetOrgId,
}: VehicleTableDesktopProps) {
  const columns: TableColumn<FleetVehicleSummary>[] = [
    {
      key: "index",
      header: "#",
      render: (_, index) => index + 1,
    },
    {
      key: "alias",
      header: "Alias",
      className: "font-medium text-base-content",
    },
    {
      key: "status",
      header: "Estado",
      render: (vehicle) => (
        <span
          className={`badge badge-sm font-semibold ${getVehicleStatusBadgeClass(vehicle.status)}`}
        >
          {getVehicleStatusLabel(vehicle.status)}
        </span>
      ),
    },
    {
      key: "make",
      header: "Marca",
    },
    {
      key: "model",
      header: "Modelo",
    },
    {
      key: "year",
      header: "Año",
    },
    {
      key: "driver",
      header: "Conductor",
      render: (vehicle) => {
        const driver = vehicle.assignments?.[0]?.driver;
        return <DriverInfoLabel driver={driver} />;
      },
    },
    {
      key: "actions",
      header: "Acciones",
      render: (vehicle) => {
        const orgParam = targetOrgId ? `?targetOrgId=${targetOrgId}` : "";
        return (
          <div className="flex gap-1">
            <Link
              href={`/vehicle/${vehicle.id}/view${orgParam}`}
              className="btn btn-square btn-ghost btn-sm"
              title="Ver vehículo"
            >
              <Eye className="size-4 text-base-content/70" />
            </Link>
            <Link
              href={`/vehicle/${vehicle.id}/edit${orgParam}`}
              className="btn btn-square btn-ghost btn-sm"
              title="Editar vehículo"
            >
              <Pencil className="size-4 text-base-content/70" />
            </Link>
            <Link
              href={`/vehicle/${vehicle.id}/assign${orgParam}`}
              className="btn btn-square btn-ghost btn-sm"
              title="Asignar conductor"
            >
              <UserCog className="size-4 text-base-content/70" />
            </Link>
            <Link
              href={`/vehicle/${vehicle.id}/trips${orgParam}`}
              className="btn btn-square btn-ghost btn-sm"
              title="Historial de viajes"
            >
              <Route className="size-4 text-base-content/70" />
            </Link>
          </div>
        );
      },
    },
  ];

  if (!vehicles?.length) {
    return (
      <div className="p-6 text-center text-sm text-base-content/60 bg-base-100/30 rounded-2xl border border-dashed border-base-300">
        No hay vehículos registrados en esta flota.
      </div>
    );
  }

  return (
    <Table
      columns={columns}
      data={vehicles}
      keyExtractor={(v) => v.id}
      className="table table-md w-full"
      pagination={true}
      pageSize={10}
    />
  );
}
