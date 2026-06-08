"use client";

import { DriverSummary, DriversTableDesktopProps, TableColumn } from "@/types";
import React from "react";
import { Table } from "@/components/ui/Table";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { CreditCard, Car, UserCheck } from "lucide-react";
import { getScoreBadgeColor } from "@/utils/client";

export function DriversTableDesktop({ drivers }: DriversTableDesktopProps) {
  const getStatusBadge = (status: DriverSummary["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="badge badge-success gap-1 text-white text-[10px] font-bold py-1 px-2.5">
            <UserCheck className="size-3" />
            Activo
          </span>
        );
      case "INACTIVE":
        return (
          <span
            className="badge badge-neutral gap-1 text-[10px] font-bold py-1 px-2.5"
            title="Shadow Profile"
          >
            Shadow Profile
          </span>
        );
      default:
        return (
          <span className="badge badge-error gap-1 text-[10px] font-bold py-1 px-2.5">
            {status}
          </span>
        );
    }
  };

  const columns: TableColumn<DriverSummary>[] = [
    {
      key: "name",
      header: "Conductor",
      className: "font-semibold text-base-content",
      render: (driver) => {
        const displayName =
          driver.name ||
          (driver.firstName && driver.lastName
            ? `${driver.firstName} ${driver.lastName}`
            : driver.nationalId);
        return (
          <div className="flex items-center gap-3">
            <DriverAvatar
              firstName={driver.firstName}
              lastName={driver.lastName}
              nationalId={driver.nationalId}
              size="md"
            />
            <div>
              <div className="font-bold text-sm text-base-content">
                {displayName}
              </div>
              {driver.phone && (
                <div className="text-[10px] text-base-content/50 font-mono mt-0.5">
                  {driver.phone}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "nationalId",
      header: "Documento",
      className: "font-mono text-xs text-base-content/75",
      render: (driver) => (
        <div className="flex items-center gap-1.5">
          <CreditCard className="size-3.5 text-base-content/40" />
          <span>{driver.nationalId}</span>
        </div>
      ),
    },
    {
      key: "assignment",
      header: "Vehículo Asignado",
      render: (driver) => {
        const activeAssignment = driver.assignments?.[0];
        return activeAssignment ? (
          <div className="flex items-center gap-2">
            <Car className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-xs text-base-content/90">
              {activeAssignment.vehicle.alias || "Sin Alias"} (
              {activeAssignment.vehicle.plateNumber})
            </span>
          </div>
        ) : (
          <span className="text-xs text-base-content/40 italic">
            Sin asignación activa
          </span>
        );
      },
    },
    {
      key: "safety",
      header: "Seguridad",
      headerClassName: "text-center",
      className: "text-center",
      render: (driver) => {
        const score =
          driver.globalStats?.globalSafetyScore ??
          driver.globalStats?.safetyScore ??
          100;
        return (
          <span
            className={`badge font-extrabold text-[10px] px-2.5 py-1 ${getScoreBadgeColor(score)}`}
          >
            {Math.round(score)} pts
          </span>
        );
      },
    },
    {
      key: "eco",
      header: "Eco-Conduc.",
      headerClassName: "text-center",
      className: "text-center",
      render: (driver) => {
        const score =
          driver.globalStats?.globalEcoScore ??
          driver.globalStats?.ecoScore ??
          100;
        return (
          <span
            className={`badge font-extrabold text-[10px] px-2.5 py-1 ${getScoreBadgeColor(score)}`}
          >
            {Math.round(score)} pts
          </span>
        );
      },
    },
    {
      key: "asset",
      header: "Cuidado Mot.",
      headerClassName: "text-center",
      className: "text-center",
      render: (driver) => {
        const score =
          driver.globalStats?.globalAssetScore ??
          driver.globalStats?.assetScore ??
          100;
        return (
          <span
            className={`badge font-extrabold text-[10px] px-2.5 py-1 ${getScoreBadgeColor(score)}`}
          >
            {Math.round(score)} pts
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (driver) => getStatusBadge(driver.status),
    },
  ];

  return (
    <Table
      columns={columns}
      data={drivers}
      keyExtractor={(d) => d.id}
      className="table table-md w-full"
      pagination={true}
      pageSize={10}
      emptyState={
        <div className="p-6 text-center text-sm text-base-content/60">
          No hay conductores registrados en esta flota.
        </div>
      }
    />
  );
}
