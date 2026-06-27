"use client";

import { DriversPageDriver } from "@/types";
import { useState, useEffect, Suspense, useCallback } from "react";
import api from "@/utils/client/api-client";
import {
  Users,
  CreditCard,
  ShieldAlert,
  Loader2,
  Car,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { useSearchParams } from "next/navigation";
import { DriversTableDesktop } from "@/components/DriversTableDesktop";
import { formatDate } from "@/utils/client";

function DriversPageContent() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const [drivers, setDrivers] = useState<DriversPageDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = targetOrgId
        ? `/drivers?targetOrgId=${targetOrgId}`
        : "/drivers";
      const { data } = await api.get(url);
      setDrivers(data);
    } catch (err) {
      console.error(err);
      setError("Error al cargar la lista de conductores");
    } finally {
      setIsLoading(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const getScoreColor = (score: number | null | undefined) => {
    if (score == null)
      return "text-base-content/40 border-base-200 bg-base-200/5";
    return "text-base-content border-base-200 bg-base-200/5";
  };

  const getStatusBadge = (status: DriversPageDriver["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="badge gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <UserCheck className="size-3" />
            Activo
          </span>
        );
      case "INACTIVE":
        return (
          <span
            className="badge badge-neutral gap-1"
            title="Creado por administrador, sin cuenta registrada"
          >
            Sin cuenta vinculada
          </span>
        );
      default:
        return <span className="badge badge-error gap-1">{status}</span>;
    }
  };

  const showGrouping = drivers.length > 5;
  const activeDrivers = drivers.filter((d) => d.status === "ACTIVE");
  const inactiveDrivers = drivers.filter((d) => d.status === "INACTIVE");

  const groups = [
    {
      id: "active",
      name: "Conductores Activos",
      badge: "bg-emerald-500/40",
      drivers: activeDrivers,
    },
    {
      id: "inactive",
      name: "Sin cuenta vinculada",
      badge: "bg-neutral-content/40",
      drivers: inactiveDrivers,
    },
  ];

  const firstNonEmptyGroup =
    groups.find((g) => g.drivers.length > 0)?.id || "active";

  const getDetailLink = (driverId: string) => {
    return targetOrgId
      ? `/drivers/${driverId}/view?targetOrgId=${targetOrgId}`
      : `/drivers/${driverId}/view`;
  };

  const renderDriverCard = (driver: DriversPageDriver) => {
    const activeAssignment = driver.assignments?.[0];
    const hasStats =
      driver.globalStats && driver.globalStats.globalSafetyScore !== null;
    const safetyScore = hasStats
      ? (driver.globalStats!.globalSafetyScore ??
        driver.globalStats!.safetyScore ??
        null)
      : null;
    const ecoScore = hasStats
      ? (driver.globalStats!.globalEcoScore ??
        driver.globalStats!.ecoScore ??
        null)
      : null;
    const assetScore = hasStats
      ? (driver.globalStats!.globalAssetScore ??
        driver.globalStats!.assetScore ??
        null)
      : null;
    const colorClass = getScoreColor(safetyScore);
    return (
      <div
        key={driver.id}
        className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between text-left"
      >
        <div className="card-body p-6 space-y-4">
          {/* Top Bar: Status and Badge */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="card-title text-base font-bold tracking-tight text-base-content leading-none">
                {driver.name ||
                  (driver.firstName && driver.lastName
                    ? `${driver.firstName} ${driver.lastName}`
                    : driver.nationalId)}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-base-content/60 font-mono">
                <CreditCard className="size-3.5" />
                Cédula: {driver.nationalId}
              </div>
            </div>
            {getStatusBadge(driver.status)}
          </div>

          {/* Vehicle Assignment Section */}
          <div className="bg-base-200/50 rounded-xl p-3 flex items-center gap-3 border border-base-300/40">
            <Car className="size-5 text-base-content/60" />
            <div className="text-xs truncate flex-1">
              <span className="text-base-content/40 block">
                Vehículo Asignado
              </span>
              {activeAssignment ? (
                <span className="font-bold text-base-content/95">
                  {activeAssignment.vehicle.alias || "Sin Alias"} (
                  {activeAssignment.vehicle.plateNumber})
                </span>
              ) : (
                <span className="text-base-content/50 italic">
                  Sin asignación activa
                </span>
              )}
            </div>
          </div>

          {/* Scores Grid */}
          <div className="grid grid-cols-3 gap-2 text-center pt-2">
            <div
              className={`p-2 rounded-xl border flex flex-col items-center justify-center ${getScoreColor(safetyScore)}`}
            >
              <span className="text-xl font-black">
                {safetyScore !== null ? Math.round(safetyScore) : "N/A"}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
                Seguridad
              </span>
            </div>

            <div
              className={`p-2 rounded-xl border flex flex-col items-center justify-center ${getScoreColor(ecoScore)}`}
            >
              <span className="text-xl font-black">
                {ecoScore !== null ? Math.round(ecoScore) : "N/A"}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
                Eficiencia
              </span>
            </div>

            <div
              className={`p-2 rounded-xl border flex flex-col items-center justify-center ${getScoreColor(assetScore)}`}
            >
              <span className="text-xl font-black">
                {assetScore !== null ? Math.round(assetScore) : "N/A"}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
                Cuidado Mot.
              </span>
            </div>
          </div>

          {driver.globalStats?.lastUpdated && hasStats && (
            <div className="text-[9px] text-base-content/40 text-center font-medium mt-1">
              Último cálculo: {formatDate(driver.globalStats.lastUpdated)}
            </div>
          )}

          {/* View Details Button */}
          <div className="card-actions justify-end pt-2">
            <Link
              href={getDetailLink(driver.id)}
              className="btn btn-primary btn-sm rounded-xl text-white font-bold"
            >
              Ver Detalle
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <BackButton
          fallbackHref={
            targetOrgId ? `/admin?targetOrgId=${targetOrgId}` : "/admin"
          }
        >
          Volver a administración
        </BackButton>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Users className="text-primary size-7" />
            Directorio de Conductores
          </h1>
          <p className="text-base-content/60 text-sm">
            Visualiza el historial, perfil y puntajes de seguridad de los
            conductores vinculados a tu flota.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error shadow-lg">
          <ShieldAlert className="size-6 text-white" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando conductores...
          </p>
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20">
          <Users className="size-16 text-base-content/20 mb-4" />
          <h3 className="text-lg font-bold">No hay conductores registrados</h3>
          <p className="text-base-content/50 text-sm max-w-sm mt-1">
            Los conductores aparecerán aquí una vez que les asignes un vehículo
            utilizando su número de cédula (identificación).
          </p>
          <Link
            href={
              targetOrgId ? `/vehicle?targetOrgId=${targetOrgId}` : "/vehicle"
            }
            className="btn btn-primary mt-6"
          >
            Ir a Vehículos para Asignar
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden lg:block">
            <DriversTableDesktop drivers={drivers} />
          </div>

          {/* Mobile View */}
          <div className="block lg:hidden">
            {showGrouping ? (
              <div className="space-y-4">
                {groups.map((group) => {
                  if (group.drivers.length === 0) return null;
                  return (
                    <div
                      key={group.id}
                      className="collapse bg-base-100/40 border border-base-200 shadow-md rounded-2xl overflow-hidden backdrop-blur-md"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={group.id === firstNonEmptyGroup}
                        className="peer"
                        aria-label={`Mostrar conductores ${group.name}`}
                      />
                      <div className="collapse-title text-sm font-bold flex items-center gap-2.5 pr-10 text-base-content bg-base-200/20">
                        <span
                          className={`size-2.5 rounded-full ${group.badge} ${group.id === "active" ? "animate-pulse" : ""}`}
                        />
                        <span>{group.name}</span>
                        <span className="badge badge-neutral badge-sm ml-2 font-mono font-bold bg-base-300 border-none text-base-content/85">
                          {group.drivers.length}
                        </span>
                      </div>
                      <div className="collapse-content p-4 bg-base-100/10 space-y-4">
                        {group.drivers.map(renderDriverCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drivers.map(renderDriverCard)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DriversPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando conductores...
          </p>
        </div>
      }
    >
      <DriversPageContent />
    </Suspense>
  );
}
