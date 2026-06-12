"use client";

import { DriverSummary, DriversTableDesktopProps, TableColumn } from "@/types";
import React from "react";
import { Table } from "@/components/ui/Table";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { CreditCard, Car, UserCheck } from "lucide-react";
import { getScoreBadgeColor, formatDate, getDriverStatusBadgeClass, getDriverStatusText } from "@/utils/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function DriversTableDesktop({ drivers }: DriversTableDesktopProps) {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");

  const getDetailLink = (driverId: string) => {
    return targetOrgId
      ? `/drivers/${driverId}/view?targetOrgId=${targetOrgId}`
      : `/drivers/${driverId}/view`;
  };

  const getStatusBadge = (status: DriverSummary["status"]) => {
    return (
      <span
        className={`badge gap-1 ${getDriverStatusBadgeClass(status)}`}
        title={status === "INACTIVE" ? "Creado por administrador, sin cuenta registrada" : undefined}
      >
        {status === "ACTIVE" && <UserCheck className="size-3" />}
        {getDriverStatusText(status)}
      </span>
    );
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
          <Link
            href={getDetailLink(driver.id)}
            className="flex items-center gap-3 group/driver hover:opacity-85 transition-opacity"
          >
            <DriverAvatar
              firstName={driver.firstName}
              lastName={driver.lastName}
              nationalId={driver.nationalId}
              size="md"
            />
            <div>
              <div className="font-bold text-sm text-base-content group-hover/driver:text-primary transition-colors">
                {displayName}
              </div>
              {driver.phone && (
                <div className="text-[10px] text-base-content/50 font-mono mt-0.5">
                  {driver.phone}
                </div>
              )}
            </div>
          </Link>
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
        const hasStats =
          driver.globalStats && (driver.globalStats.totalSnapshots ?? 0) > 0;
        const score = hasStats
          ? (driver.globalStats!.globalSafetyScore ??
            driver.globalStats!.safetyScore ??
            null)
          : null;
        const lastUpdated = driver.globalStats?.lastUpdated;

        const badge = (
          <span
            className={`badge font-extrabold text-[10px] px-2.5 py-1 ${getScoreBadgeColor(score)}`}
          >
            {score !== null ? `${Math.round(score)} pts` : "N/A"}
          </span>
        );

        if (score !== null && lastUpdated) {
          return (
            <div
              className="tooltip tooltip-top normal-case font-normal text-xs"
              data-tip={`Calculado el: ${formatDate(lastUpdated)}`}
            >
              {badge}
            </div>
          );
        }
        return badge;
      },
    },
    {
      key: "eco",
      header: "Eco-Conduc.",
      headerClassName: "text-center",
      className: "text-center",
      render: (driver) => {
        const hasStats =
          driver.globalStats && (driver.globalStats.totalSnapshots ?? 0) > 0;
        const score = hasStats
          ? (driver.globalStats!.globalEcoScore ??
            driver.globalStats!.ecoScore ??
            null)
          : null;
        const lastUpdated = driver.globalStats?.lastUpdated;

        const badge = (
          <span
            className={`badge font-extrabold text-[10px] px-2.5 py-1 ${getScoreBadgeColor(score)}`}
          >
            {score !== null ? `${Math.round(score)} pts` : "N/A"}
          </span>
        );

        if (score !== null && lastUpdated) {
          return (
            <div
              className="tooltip tooltip-top normal-case font-normal text-xs"
              data-tip={`Calculado el: ${formatDate(lastUpdated)}`}
            >
              {badge}
            </div>
          );
        }
        return badge;
      },
    },
    {
      key: "asset",
      header: "Cuidado Mot.",
      headerClassName: "text-center",
      className: "text-center",
      render: (driver) => {
        const hasStats =
          driver.globalStats && (driver.globalStats.totalSnapshots ?? 0) > 0;
        const score = hasStats
          ? (driver.globalStats!.globalAssetScore ??
            driver.globalStats!.assetScore ??
            null)
          : null;
        const lastUpdated = driver.globalStats?.lastUpdated;

        const badge = (
          <span
            className={`badge font-extrabold text-[10px] px-2.5 py-1 ${getScoreBadgeColor(score)}`}
          >
            {score !== null ? `${Math.round(score)} pts` : "N/A"}
          </span>
        );

        if (score !== null && lastUpdated) {
          return (
            <div
              className="tooltip tooltip-top normal-case font-normal text-xs"
              data-tip={`Calculado el: ${formatDate(lastUpdated)}`}
            >
              {badge}
            </div>
          );
        }
        return badge;
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (driver) => getStatusBadge(driver.status),
    },
    {
      key: "actions",
      header: "Acciones",
      headerClassName: "text-right",
      className: "text-right",
      render: (driver) => (
        <Link
          href={getDetailLink(driver.id)}
          className="btn btn-xs btn-ghost text-primary font-bold normal-case rounded-lg"
        >
          Ver Detalle
        </Link>
      ),
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
