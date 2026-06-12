"use client";

import { useState, useMemo } from "react";
import {
  Car,
  Users,
  Activity,
  ShieldAlert,
  Compass,
  Map,
  ChevronDown,
  ChevronUp,
  Info,
  WifiOff,
  Power,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  DashboardDriver,
  DashboardVehicle,
  OwnerDashboardProps,
  TableColumn,
} from "@/types";
import { getScoreBadgeColor } from "@/utils/client";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { ScoreProgressBar } from "@/components/ui/ScoreProgressBar";
import { MovementStatusBadge } from "@/components/ui/MovementStatusBadge";
import { DashboardStatCard } from "@/components/ui/DashboardStatCard";
import { DriverInfoLabel } from "@/components/ui/DriverInfoLabel";
import { Table } from "@/components/ui/Table";
import { useFleet } from "@/context/FleetContext";

export function OwnerDashboard({
  vehicles = [],
  drivers = [],
  targetOrgId,
}: OwnerDashboardProps) {
  const { fleet } = useFleet();

  const liveVehicles = useMemo(() => {
    return (vehicles || []).map((v) => {
      const live = fleet[v.id];
      if (!live) return v;
      return {
        ...v,
        liveState: {
          ...v.liveState,
          lastLat: live.latitude,
          lastLng: live.longitude,
          lastSpeed: live.speed,
          currentStatus: live.status,
          lastAngle: live.angle,
          lastUpdate: live.updatedAt,
        },
      } as DashboardVehicle;
    });
  }, [vehicles, fleet]);

  const [expandedVehicles, setExpandedVehicles] = useState<
    Record<string, boolean>
  >({});

  const toggleVehicleExpand = (vehicleId: string) => {
    setExpandedVehicles((prev) => ({
      ...prev,
      [vehicleId]: !prev[vehicleId],
    }));
  };
  const totalVehicles = liveVehicles.length;
  // Validamos de manera segura la longitud de las asignaciones de conductores
  const activeAssignments = drivers.filter(
    (d) => d.assignments && d.assignments.length > 0,
  ).length;

  // Calculamos promedios y totales de uso de la flota
  let sumSafety = 0;
  let sumEco = 0;
  let sumAsset = 0;
  let totalKm = 0;
  let countWithStats = 0;
  let latestUpdate: Date | null = null;

  drivers.forEach((d) => {
    if (
      d.globalStats &&
      d.globalStats.totalSnapshots != null &&
      d.globalStats.totalSnapshots > 0
    ) {
      sumSafety +=
        d.globalStats.globalSafetyScore ?? d.globalStats.safetyScore ?? 100;
      sumEco += d.globalStats.globalEcoScore ?? d.globalStats.ecoScore ?? 100;
      sumAsset +=
        d.globalStats.globalAssetScore ?? d.globalStats.assetScore ?? 100;
      totalKm += d.globalStats.totalKm ?? 0;
      countWithStats++;

      if (d.globalStats.lastUpdated) {
        const updateDate = new Date(d.globalStats.lastUpdated);
        if (!latestUpdate || updateDate > latestUpdate) {
          latestUpdate = updateDate;
        }
      }
    }
  });

  const avgSafety =
    countWithStats > 0 ? Math.round(sumSafety / countWithStats) : null;
  const avgEco =
    countWithStats > 0 ? Math.round(sumEco / countWithStats) : null;
  const avgAsset =
    countWithStats > 0 ? Math.round(sumAsset / countWithStats) : null;

  // Conductores ordenados por puntaje de seguridad (de menor a mayor para destacar riesgos)
  const riskDrivers = [...drivers]
    .filter(
      (d) =>
        d.globalStats &&
        d.globalStats.totalSnapshots != null &&
        d.globalStats.totalSnapshots > 0,
    )
    .sort((a, b) => {
      const scoreA =
        a.globalStats?.globalSafetyScore ?? a.globalStats?.safetyScore ?? 100;
      const scoreB =
        b.globalStats?.globalSafetyScore ?? b.globalStats?.safetyScore ?? 100;
      return scoreA - scoreB;
    })
    .slice(0, 5);

  // Alertas críticas de la flota calculadas en tiempo real (Mobile-First)
  const fleetAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      vehicleId: string;
      vehicleAlias: string;
      plateNumber: string;
      type: "unplugged" | "speeding" | "no_driver" | "offline";
      message: string;
      severity: "error" | "warning";
      timestamp: string;
    }> = [];

    liveVehicles.forEach((v) => {
      const alias = v.alias || "Sin Alias";
      const plate = v.plateNumber;

      // 1. Dispositivo desconectado (Error)
      const isUnplugged =
        v.status === "UNPLUGGED" ||
        v.liveState?.currentStatus === "UNPLUGGED" ||
        v.liveState?.unplugged === true;
      if (isUnplugged) {
        alerts.push({
          id: `${v.id}-unplugged`,
          vehicleId: v.id,
          vehicleAlias: alias,
          plateNumber: plate,
          type: "unplugged",
          message: `Dispositivo desconectado en unidad ${alias} (${plate})`,
          severity: "error",
          timestamp: v.liveState?.lastUpdate || new Date().toISOString(),
        });
      }

      // 2. Exceso de velocidad en vivo (Error)
      const speed = (v.liveState?.lastSpeed as number | undefined) ?? 0;
      if (speed > 110) {
        alerts.push({
          id: `${v.id}-speeding-${Date.now()}`,
          vehicleId: v.id,
          vehicleAlias: alias,
          plateNumber: plate,
          type: "speeding",
          message: `Exceso de velocidad: ${alias} circula a ${speed} km/h`,
          severity: "error",
          timestamp: v.liveState?.lastUpdate || new Date().toISOString(),
        });
      }

      // 3. Movimiento sin conductor asignado (Warning)
      const isMoving = v.liveState?.currentStatus === "MOVING" || speed > 0;
      const hasDriver = v.assignments && v.assignments.length > 0;
      if (isMoving && !hasDriver) {
        alerts.push({
          id: `${v.id}-no-driver`,
          vehicleId: v.id,
          vehicleAlias: alias,
          plateNumber: plate,
          type: "no_driver",
          message: `Movimiento detectado sin conductor asignado en unidad ${alias}`,
          severity: "warning",
          timestamp: v.liveState?.lastUpdate || new Date().toISOString(),
        });
      }

      // 4. Pérdida de señal / fuera de línea por más de 30 minutos (Warning)
      if (v.liveState?.lastUpdate) {
        const lastUpdateMs = new Date(v.liveState.lastUpdate).getTime();
        const diffMins = (Date.now() - lastUpdateMs) / (1000 * 60);
        if (diffMins > 30 && !isUnplugged && v.status === "ACTIVE") {
          alerts.push({
            id: `${v.id}-offline`,
            vehicleId: v.id,
            vehicleAlias: alias,
            plateNumber: plate,
            type: "offline",
            message: `Pérdida de señal hace más de ${Math.round(diffMins)} min en unidad ${alias}`,
            severity: "warning",
            timestamp: v.liveState.lastUpdate,
          });
        }
      }
    });

    return alerts.sort((a, b) => {
      if (a.severity === "error" && b.severity !== "error") return -1;
      if (a.severity !== "error" && b.severity === "error") return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [liveVehicles]);

  const vehicleColumns: TableColumn<DashboardVehicle>[] = [
    {
      key: "alias",
      header: "Vehículo",
      className: "font-bold",
      render: (v) => (
        <Link
          href={
            targetOrgId
              ? `/vehicle/${v.id}/view?targetOrgId=${targetOrgId}`
              : `/vehicle/${v.id}/view`
          }
          className="hover:text-primary hover:underline transition-colors"
        >
          {v.alias || "Sin Alias"}
        </Link>
      ),
    },
    {
      key: "plateNumber",
      header: "Placa",
      className: "font-mono",
    },
    {
      key: "makeModel",
      header: "Marca/Modelo",
      render: (v) =>
        v.make && v.model ? `${v.make} ${v.model}` : "No definido",
    },
    {
      key: "driver",
      header: "Conductor",
      render: (v) => {
        const driver = v.assignments?.[0]?.driver;
        return <DriverInfoLabel driver={driver} />;
      },
    },
    {
      key: "liveState",
      header: "Actividad en Vivo",
      render: (v) => {
        const speed = (v.liveState?.lastSpeed as number | undefined) ?? 0;
        return (
          <MovementStatusBadge
            status={v.liveState?.currentStatus}
            speed={speed}
          />
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (v) => (
        <span
          className={`badge badge-sm font-bold text-white ${
            v.status === "ACTIVE"
              ? "badge-success"
              : v.status === "IN_MAINTENANCE"
                ? "badge-warning"
                : "badge-neutral"
          }`}
        >
          {v.status === "ACTIVE"
            ? "Activo"
            : v.status === "IN_MAINTENANCE"
              ? "Taller"
              : v.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Dashboard Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-base-content">
            Dashboard de Control de Flota
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Métricas consolidadas y telemetría en tiempo real de tu flota
            comercial.
          </p>
        </div>
        <Link
          href={targetOrgId ? `/map?targetOrgId=${targetOrgId}` : "/map"}
          className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow-lg active:scale-95 transition-all self-start sm:self-center"
        >
          <Map className="size-4" />
          Ver Mapa en Vivo
        </Link>
      </div>

      {/* Performance Score indicators - Mobile View (< 768px) */}
      <div className="md:hidden glass-card p-6 space-y-4">
        <div>
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block mb-1">
            Resumen de Rendimiento
          </span>
          <span className="text-[11px] text-base-content/40 block leading-tight">
            Puntajes promedio de conducción de la flota
          </span>
        </div>
        <ScoreProgressBar score={avgSafety} label="Seguridad Vial" />
        <ScoreProgressBar score={avgEco} label="Eficiencia de Combustible" />
        <ScoreProgressBar
          score={avgAsset}
          label="Salud del Activo / Vehículo"
        />
      </div>

      {/* Three Score Cards (Radial Gauges side-by-side) - Desktop view */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <RadialScoreGauge
          score={avgSafety}
          title="Seguridad Vial"
          subtitle="Velocidades y frenadas bruscas"
          footerText="Promedio de Conductores"
          lastUpdated={latestUpdate}
        />
        <RadialScoreGauge
          score={avgEco}
          title="Eficiencia de Combustible"
          subtitle="Ralentí y revoluciones (RPM)"
          footerText="Métrica de Consumo"
          lastUpdated={latestUpdate}
        />
        <RadialScoreGauge
          score={avgAsset}
          title="Salud del Activo / Vehículo"
          subtitle="Códigos DTC y temperaturas"
          footerText="Cuidado de Mecánica"
          lastUpdated={latestUpdate}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStatCard
          icon={
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 shrink-0">
              <Car className="size-6" />
            </div>
          }
          label="Vehiculos Totales"
          value={totalVehicles}
          href={
            targetOrgId ? `/vehicle?targetOrgId=${targetOrgId}` : "/vehicle"
          }
        />
        <DashboardStatCard
          icon={
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 shrink-0">
              <Users className="size-6" />
            </div>
          }
          label="Conductores"
          value={drivers.length}
          href={
            targetOrgId ? `/drivers?targetOrgId=${targetOrgId}` : "/drivers"
          }
        />
        <DashboardStatCard
          icon={
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 shrink-0">
              <Activity className="size-6" />
            </div>
          }
          label="Asignaciones"
          value={activeAssignments}
        />
        <DashboardStatCard
          icon={
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 shrink-0">
              <Compass className="size-6" />
            </div>
          }
          label="Recorrido Flota"
          value={`${totalKm.toLocaleString()} km`}
        />
      </div>

      {/* Driver Risk Alerts & Fleet Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts Feed & Risk Drivers */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Critical Alerts Feed */}
          <div className="glass-card p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="text-error size-5 animate-pulse" />
                Alertas Críticas de Flota
              </h2>
              <p className="text-xs text-base-content/50">
                Incidentes de telemetría y seguridad en tiempo real.
              </p>
            </div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {fleetAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex gap-3 text-xs animate-in fade-in duration-300 ${
                    alert.severity === "error"
                      ? "bg-rose-500/5 border-rose-500/20 text-rose-800 dark:text-rose-200"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {alert.type === "unplugged" && (
                    <Power className="size-4.5 shrink-0 text-rose-500 mt-0.5" />
                  )}
                  {alert.type === "speeding" && (
                    <Gauge className="size-4.5 shrink-0 text-rose-500 mt-0.5" />
                  )}
                  {alert.type === "no_driver" && (
                    <Users className="size-4.5 shrink-0 text-amber-500 mt-0.5" />
                  )}
                  {alert.type === "offline" && (
                    <WifiOff className="size-4.5 shrink-0 text-amber-500 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold leading-snug">
                      {alert.message}
                    </p>
                    <span className="text-[10px] text-base-content/40 font-mono block">
                      {new Date(alert.timestamp).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
              {fleetAlerts.length === 0 && (
                <div className="text-center py-10 text-xs text-base-content/40 flex flex-col items-center justify-center gap-2">
                  <ShieldCheck className="size-8 text-success opacity-60" />
                  <p className="font-semibold">Flota segura y operativa</p>
                  <p className="text-[10px] text-base-content/30">
                    No hay incidentes de telemetría reportados.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Risk Alerts */}
          <div className="glass-card p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="text-error size-5" />
                Conductores con Mayor Riesgo
              </h2>
              <p className="text-xs text-base-content/50">
                Prioriza capacitación para conductores con puntajes de seguridad
                bajos.
              </p>
            </div>
            <div className="divide-y divide-base-200 max-h-[250px] overflow-y-auto pr-1">
              {riskDrivers.map((d) => {
                const driverScore =
                  d.globalStats?.globalSafetyScore ??
                  d.globalStats?.safetyScore ??
                  null;
                return (
                  <div
                    key={d.id}
                    className="py-3 flex justify-between items-center text-xs"
                  >
                    <DriverInfoLabel driver={d} className="mt-0" />
                    <div className="flex items-center gap-3">
                      {driverScore !== null ? (
                        <span
                          className={`badge font-bold px-2 py-0.5 ${getScoreBadgeColor(driverScore)}`}
                        >
                          {Math.round(driverScore)} pts
                        </span>
                      ) : (
                        <span className="badge badge-ghost text-base-content/50 border-base-200/80 font-bold px-2 py-0.5">
                          N/A
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {riskDrivers.length === 0 && (
                <p className="text-center text-xs text-base-content/40 py-6">
                  No hay datos de conducción registrados.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Vehicles Operational List (Fleet Health) */}
        <div className="glass-card p-6 space-y-4 lg:col-span-2">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Car className="text-primary size-5" />
                Estado de Vehiculos
              </h2>
              <p className="text-xs text-base-content/50">
                Resumen y estado operativo de tus unidades de transporte.
              </p>
            </div>
            <Link
              href={
                targetOrgId ? `/vehicle?targetOrgId=${targetOrgId}` : "/vehicle"
              }
              className="text-xs text-primary font-bold hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {/* Vista Móvil (Tarjetas) - Expandible */}
          <div className="md:hidden space-y-3">
            {liveVehicles.slice(0, 5).map((v) => {
              const isExpanded = expandedVehicles[v.id] || false;

              return (
                <div
                  key={v.id}
                  className="bg-base-100/60 backdrop-blur-sm border border-base-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  {/* Header de la tarjeta */}
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm text-base-content flex items-center gap-2">
                        <Link
                          href={
                            targetOrgId
                              ? `/vehicle/${v.id}/view?targetOrgId=${targetOrgId}`
                              : `/vehicle/${v.id}/view`
                          }
                          className="hover:text-primary active:text-primary/70 transition-colors"
                        >
                          {v.alias || "Sin Alias"}
                        </Link>
                        <span className="font-mono bg-base-300/40 text-base-content/70 px-1.5 py-0.5 rounded text-[10px]">
                          {v.plateNumber}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MovementStatusBadge
                        status={v.liveState?.currentStatus}
                        speed={v.liveState?.lastSpeed as number | undefined}
                      />
                      <button
                        onClick={() => toggleVehicleExpand(v.id)}
                        className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content"
                        aria-label={
                          isExpanded ? "Colapsar detalles" : "Expandir detalles"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Detalles colapsables */}
                  {isExpanded && (
                    <div className="text-xs border-t border-base-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="grid grid-cols-2 gap-0 bg-base-200/30">
                        <div className="px-4 py-3 border-r border-base-200/60">
                          <span className="text-base-content/40 block text-[10px] uppercase font-bold mb-0.5">
                            Marca / Modelo
                          </span>
                          <span className="font-semibold text-base-content/80">
                            {v.make && v.model
                              ? `${v.make} ${v.model}`
                              : "No definido"}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          <span className="text-base-content/40 block text-[10px] uppercase font-bold mb-0.5">
                            Conductor
                          </span>
                          <DriverInfoLabel
                            driver={v.assignments?.[0]?.driver}
                            className="mt-0"
                          />
                        </div>
                        <div className="px-4 py-3 col-span-2 border-t border-base-200/60">
                          <span className="text-base-content/40 block text-[10px] uppercase font-bold mb-1">
                            Estado Administrativo
                          </span>
                          <span
                            className={`badge badge-sm font-bold text-white ${
                              v.status === "ACTIVE"
                                ? "badge-success"
                                : v.status === "IN_MAINTENANCE"
                                  ? "badge-warning"
                                  : "badge-neutral"
                            }`}
                          >
                            {v.status === "ACTIVE"
                              ? "Activo"
                              : v.status === "IN_MAINTENANCE"
                                ? "Taller"
                                : v.status}
                          </span>
                        </div>
                      </div>

                      <div className="px-4 py-3 flex gap-2 border-t border-base-200/60">
                        <Link
                          href={
                            targetOrgId
                              ? `/vehicle/${v.id}/view?targetOrgId=${targetOrgId}`
                              : `/vehicle/${v.id}/view`
                          }
                          className="btn btn-primary btn-sm flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white font-bold gap-1.5"
                        >
                          <Info className="size-3.5" />
                          Ver Detalles
                        </Link>
                        <Link
                          href={
                            targetOrgId
                              ? `/map?vehicleId=${v.id}&targetOrgId=${targetOrgId}`
                              : `/map?vehicleId=${v.id}`
                          }
                          className="btn btn-outline border-base-300 hover:bg-base-200 btn-sm flex-1 text-base-content font-bold gap-1.5"
                        >
                          <Map className="size-3.5" />
                          Mapa
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {liveVehicles.length === 0 && (
              <p className="text-center text-xs text-base-content/40 py-6">
                No hay vehículos registrados.
              </p>
            )}
          </div>

          {/* Vista Escritorio (Tabla) */}
          <div className="hidden md:block">
            <Table
              columns={vehicleColumns}
              data={liveVehicles.slice(0, 5)}
              keyExtractor={(v) => v.id}
              className="table table-compact w-full text-xs"
              wrapperClassName="overflow-x-auto"
              emptyState={
                <span className="text-base-content/40 py-6 block text-center">
                  No hay vehículos registrados.
                </span>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
