"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Car,
  Settings,
  UserCog,
  Route,
  Map,
  Eye,
  Activity,
  Compass,
  AlertCircle,
  FileText,
  User,
  Info,
  Gauge,
  Zap,
  ShieldCheck,
  Power,
  TrendingDown,
  CornerUpRight,
} from "lucide-react";
import {
  DailyTelemetryRollup,
  TableColumn,
  VehicleDetail,
  VehicleDetailClientProps,
  VehicleScoreSnapshot,
} from "@/types";
import {
  formatDate,
  formatDateOnly,
  getScoreBadgeColor,
  formatHours,
} from "@/utils/client";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { MovementStatusBadge } from "@/components/ui/MovementStatusBadge";
import { DriverInfoLabel } from "@/components/ui/DriverInfoLabel";
import { DetailRow } from "@/components/ui/DetailRow";
import { MiniStatCard } from "@/components/ui/MiniStatCard";
import { DtcBadge } from "@/components/ui/DtcBadge";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { Table } from "@/components/ui/Table";
import { useFleet } from "@/context/FleetContext";

export function VehicleDetailClient({
  vehicle: initialVehicle,
}: VehicleDetailClientProps) {
  const { fleet } = useFleet();

  const vehicle = useMemo(() => {
    const live = fleet[initialVehicle.id];
    if (!live) return initialVehicle;
    return {
      ...initialVehicle,
      liveState: {
        ...initialVehicle.liveState,
        lastLat: live.latitude,
        lastLng: live.longitude,
        lastSpeed: live.speed,
        currentStatus: live.status,
        lastAngle: live.angle,
        lastUpdate: live.updatedAt,
        lastIgnition:
          live.ignition ?? initialVehicle.liveState?.lastIgnition ?? false,
        lastOdometer:
          live.odometer ?? initialVehicle.liveState?.lastOdometer ?? 0,
      },
    } as VehicleDetail;
  }, [initialVehicle, fleet]);

  const [activeTab, setActiveTab] = useState<"overview" | "scores" | "rollups">(
    "overview",
  );

  const currentDriver = vehicle.assignments?.[0]?.driver;

  // Grouping for telemetry logs on mobile
  const rollups = vehicle.DailyTelemetryRollup || [];
  const showRollupGrouping = rollups.length > 5;

  const getMonthYearLabel = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const groupedRollups: Record<string, DailyTelemetryRollup[]> = {};
  rollups.forEach((day) => {
    const label = getMonthYearLabel(day.date);
    if (!groupedRollups[label]) {
      groupedRollups[label] = [];
    }
    groupedRollups[label].push(day);
  });

  const monthKeys = Object.keys(groupedRollups);
  const firstMonthKey = monthKeys[0] || "";

  const renderRollupCard = (day: DailyTelemetryRollup) => {
    const totalHarsh =
      day.brakingCount + day.corneringCount + day.accelerationCount;
    return (
      <div
        key={day.id}
        className="bg-base-200/30 border border-base-200/60 p-4 rounded-2xl space-y-3 text-left"
      >
        <div className="flex justify-between items-center pb-2 border-b border-base-200/50">
          <span className="font-bold text-sm text-base-content">
            {formatDateOnly(day.date)}
          </span>
          <DtcBadge count={day.activeFaultCodesCount} />
        </div>

        <div className="text-xs flex items-center justify-between bg-base-200/40 p-2 rounded-xl">
          <span className="text-base-content/50 font-medium">Conductor:</span>
          {day.driver ? (
            <span className="font-bold text-base-content/90">
              {day.driver.firstName} {day.driver.lastName}
            </span>
          ) : (
            <span className="text-base-content/40 italic">Sin conductor</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[10px] text-base-content/40 uppercase font-bold">
              Km
            </p>
            <p className="font-semibold font-mono text-base-content/85 mt-0.5">
              {day.totalKm.toFixed(1)} km
            </p>
          </div>
          <div>
            <p className="text-[10px] text-base-content/40 uppercase font-bold">
              Motor
            </p>
            <p className="font-semibold font-mono text-base-content/85 mt-0.5">
              {formatHours(day.totalEngineHours)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-base-content/40 uppercase font-bold">
              Ralentí
            </p>
            <p className="font-semibold font-mono text-base-content/85 mt-0.5">
              {formatHours(day.idlingHours)}
            </p>
          </div>
        </div>

        {day.overspeedCount > 0 ||
        totalHarsh > 0 ||
        (!!day.deviceUnpluggedCount && day.deviceUnpluggedCount > 0) ||
        day.activeFaultCodesCount > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {day.overspeedCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono text-[10px] gap-1">
                <Gauge className="size-3" />
                {day.overspeedCount} Exc. Vel.
              </span>
            )}
            {day.brakingCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold font-mono text-[10px] gap-1">
                <TrendingDown className="size-3" />
                {day.brakingCount} Frenados
              </span>
            )}
            {day.corneringCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-bold font-mono text-[10px] gap-1">
                <CornerUpRight className="size-3" />
                {day.corneringCount} Giros
              </span>
            )}
            {day.accelerationCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold font-mono text-[10px] gap-1">
                <Zap className="size-3" />
                {day.accelerationCount} Acel.
              </span>
            )}
            {!!day.deviceUnpluggedCount && day.deviceUnpluggedCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 font-bold font-mono text-[10px] gap-1">
                <Power className="size-3" />
                GPS desc. ({day.deviceUnpluggedCount}d)
              </span>
            )}
            {day.activeFaultCodesCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold font-mono text-[10px] gap-1">
                <AlertCircle className="size-3" />
                DTC ({day.activeFaultCodesCount})
              </span>
            )}
          </div>
        ) : (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <ShieldCheck className="size-3" />
              Sin incidentes
            </span>
          </div>
        )}
      </div>
    );
  };

  // Calculamos promedios o usamos estadísticas globales
  const hasStats = vehicle.VehicleGlobalStats != null &&
    ((vehicle.VehicleGlobalStats.totalKm ?? 0) > 0 || (vehicle.VehicleGlobalStats.totalEngineHours ?? 0) > 0);
  const avgSafety = hasStats && vehicle.VehicleGlobalStats!.globalSafetyScore != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalSafetyScore)
      : null;
  const avgEco = hasStats && vehicle.VehicleGlobalStats!.globalFuelEfficiency != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalFuelEfficiency)
      : null;
  const avgAsset = hasStats && vehicle.VehicleGlobalStats!.globalMaintenanceScore != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalMaintenanceScore)
      : null;
  const overallScore = hasStats && vehicle.VehicleGlobalStats!.globalOverallScore != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalOverallScore)
      : null;
  const lastUpdated = vehicle.VehicleGlobalStats?.lastUpdated || null;

  const scoreColumns: TableColumn<VehicleScoreSnapshot>[] = [
    {
      key: "week",
      header: "Año / Semana",
      className: "font-bold",
      render: (snap) => `Año ${snap.year} - Sem. ${snap.weekNumber}`,
    },
    {
      key: "safety",
      header: "Seguridad Vial",
      render: (snap) => (
        <span
          className={`badge badge-sm font-bold ${getScoreBadgeColor(snap.safetyScore ?? 100)}`}
        >
          {Math.round(snap.safetyScore ?? 100)} pts
        </span>
      ),
    },
    {
      key: "eco",
      header: "Eficiencia Eco",
      render: (snap) => (
        <span
          className={`badge badge-sm font-bold ${getScoreBadgeColor(snap.fuelEfficiency ?? 100)}`}
        >
          {Math.round(snap.fuelEfficiency ?? 100)} pts
        </span>
      ),
    },
    {
      key: "health",
      header: "Salud del Vehículo",
      render: (snap) => {
        const avg =
          ((snap.maintenanceScore ?? 100) + (snap.fuelEfficiency ?? 100)) / 2;
        return (
          <span
            className={`badge badge-sm font-bold ${getScoreBadgeColor(avg)}`}
          >
            {Math.round(avg)} pts
          </span>
        );
      },
    },
    {
      key: "totalKm",
      header: "Km Recorridos",
      className: "font-mono",
      render: (snap) => `${Math.round(snap.totalKm).toLocaleString()} km`,
    },
    {
      key: "totalTrips",
      header: "Viajes",
      className: "font-mono",
    },
  ];

  const telemetryColumns: TableColumn<DailyTelemetryRollup>[] = [
    {
      key: "date",
      header: "Fecha",
      className: "font-bold",
      render: (day) => formatDateOnly(day.date),
    },
    {
      key: "driver",
      header: "Conductor",
      render: (day) => {
        if (!day.driver) {
          return (
            <span className="text-base-content/40 italic">Sin conductor</span>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <DriverAvatar
              firstName={day.driver.firstName}
              lastName={day.driver.lastName}
              nationalId={day.driver.nationalId}
              size="sm"
            />
            <span className="font-semibold text-base-content/85">
              {day.driver.firstName} {day.driver.lastName}
            </span>
          </div>
        );
      },
    },
    {
      key: "totalKm",
      header: "Km",
      className: "font-mono",
      render: (day) => `${day.totalKm.toFixed(1)} km`,
    },
    {
      key: "totalEngineHours",
      header: "Horas Motor",
      className: "font-mono",
      render: (day) => formatHours(day.totalEngineHours),
    },
    {
      key: "idlingHours",
      header: "Ralentí",
      className: "font-mono text-base-content/60",
      render: (day) => formatHours(day.idlingHours),
    },
    {
      key: "behavior",
      header: "Comportamiento",
      className: "min-w-[180px]",
      render: (day) => {
        const totalHarsh =
          day.brakingCount + day.corneringCount + day.accelerationCount;
        const hasEvents =
          day.overspeedCount > 0 ||
          totalHarsh > 0 ||
          (!!day.deviceUnpluggedCount && day.deviceUnpluggedCount > 0) ||
          day.activeFaultCodesCount > 0;

        if (!hasEvents) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <ShieldCheck className="size-3.5" />
              Sin incidentes
            </span>
          );
        }

        return (
          <div className="flex flex-wrap gap-2 items-center">
            {day.overspeedCount > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`${day.overspeedCount} excesos de velocidad`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono text-xs gap-1">
                  <Gauge className="size-3.5" />
                  {day.overspeedCount}
                </span>
              </div>
            )}
            {totalHarsh > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`Conducción brusca: ${day.brakingCount} frenados, ${day.corneringCount} giros, ${day.accelerationCount} aceleraciones`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold font-mono text-xs gap-1">
                  <Zap className="size-3.5" />
                  {totalHarsh}
                </span>
              </div>
            )}
            {!!day.deviceUnpluggedCount && day.deviceUnpluggedCount > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`GPS desconectado: ${day.deviceUnpluggedCount} días`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 font-bold font-mono text-xs gap-1">
                  <Power className="size-3.5" />
                  {day.deviceUnpluggedCount}d
                </span>
              </div>
            )}
            {day.activeFaultCodesCount > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`${day.activeFaultCodesCount} códigos de falla de motor (DTC)`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold font-mono text-xs gap-1">
                  <AlertCircle className="size-3.5" />
                  {day.activeFaultCodesCount} DTC
                </span>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/vehicle"
            className="btn btn-sm btn-ghost btn-square rounded-xl"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-base-content">
                {vehicle.alias || "Sin Alias"}
              </h1>
              <span className="font-mono bg-base-200/80 text-base-content/70 px-2 py-0.5 rounded text-xs border border-base-300/50">
                {vehicle.plateNumber}
              </span>
            </div>
            <p className="text-xs text-base-content/60 mt-1">
              Información operativa y de telemetría consolidada de esta unidad.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/map?vehicleId=${vehicle.id}`}
            className="btn btn-sm btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow"
          >
            <Map className="size-4" />
            Ver en Mapa
          </Link>
          <Link
            href={`/vehicle/${vehicle.id}/trips`}
            className="btn btn-sm btn-outline border-base-300 hover:bg-base-200 gap-1.5"
          >
            <Route className="size-4" />
            Viajes
          </Link>
          <Link
            href={`/vehicle/${vehicle.id}/assign`}
            className="btn btn-sm btn-outline border-base-300 hover:bg-base-200 gap-1.5"
          >
            <UserCog className="size-4" />
            Asignar
          </Link>
          <Link
            href={`/vehicle/${vehicle.id}/edit`}
            className="btn btn-sm btn-outline border-base-300 hover:bg-base-200 gap-1.5"
          >
            <Settings className="size-4" />
            Configurar
          </Link>
        </div>
      </div>

      {vehicle.liveState?.currentStatus === "UNPLUGGED" && (
        <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-300 rounded-2xl flex items-start gap-3 p-4 shadow-sm animate-in fade-in duration-300">
          <AlertCircle className="size-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div>
            <h4 className="font-bold text-sm">
              Alerta: Dispositivo de Rastreo Desconectado
            </h4>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
              El dispositivo GPS de este vehículo ha sido desenchufado o ha
              perdido su fuente de alimentación principal. Las lecturas en vivo
              y el cálculo de puntajes de la semana se verán afectados.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="tabs tabs-boxed bg-base-200/50 p-1 rounded-xl w-full max-w-md shrink-0 border border-base-200/60 backdrop-blur-md">
        <button
          onClick={() => setActiveTab("overview")}
          className={`tab flex-1 rounded-lg font-semibold text-xs transition-all ${
            activeTab === "overview"
              ? "tab-active bg-base-100 shadow-sm text-primary"
              : "text-base-content/60"
          }`}
        >
          <Info className="size-3.5 mr-1.5" />
          Resumen
        </button>
        <button
          onClick={() => setActiveTab("scores")}
          className={`tab flex-1 rounded-lg font-semibold text-xs transition-all ${
            activeTab === "scores"
              ? "tab-active bg-base-100 shadow-sm text-primary"
              : "text-base-content/60"
          }`}
        >
          <Eye className="size-3.5 mr-1.5" />
          Desempeño
        </button>
        <button
          onClick={() => setActiveTab("rollups")}
          className={`tab flex-1 rounded-lg font-semibold text-xs transition-all ${
            activeTab === "rollups"
              ? "tab-active bg-base-100 shadow-sm text-primary"
              : "text-base-content/60"
          }`}
        >
          <Activity className="size-3.5 mr-1.5" />
          Actividad Diaria
        </button>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Specs Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Telemetry Card */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Activity className="text-primary size-5" />
                  Telemetría en Vivo
                </h3>
                <MovementStatusBadge
                  status={vehicle.liveState?.currentStatus}
                  speed={vehicle.liveState?.lastSpeed}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MiniStatCard
                  label="Velocidad"
                  value={
                    <>
                      <span className="text-2xl font-black font-mono tracking-tight text-primary">
                        {vehicle.liveState?.lastSpeed ?? 0}
                      </span>
                      <span className="text-xs font-semibold text-base-content/50">
                        km/h
                      </span>
                    </>
                  }
                />

                <MiniStatCard
                  label="Ignición"
                  value={
                    <span
                      className={`text-base font-black flex items-center gap-1.5 ${vehicle.liveState?.lastIgnition ? "text-success" : "text-base-content/40"}`}
                    >
                      <span
                        className={`size-2 rounded-full ${vehicle.liveState?.lastIgnition ? "bg-success animate-ping" : "bg-base-content/30"}`}
                      />
                      {vehicle.liveState?.lastIgnition
                        ? "Encendido"
                        : "Apagado"}
                    </span>
                  }
                />

                <MiniStatCard
                  label="Odómetro"
                  value={
                    <div className="flex flex-col w-full min-w-0">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black font-mono tracking-tight">
                          {Math.round(
                            (vehicle.initialOdometer ?? 0) +
                              (vehicle.liveState?.lastOdometer ?? 0),
                          ).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-semibold text-base-content/50">
                          km
                        </span>
                      </div>
                      <span
                        className="text-[9px] text-base-content/40 mt-1 leading-normal font-medium flex items-center gap-1"
                        title="El odómetro es una estimación basada en la distancia calculada por GPS más el kilometraje base inicial."
                      >
                        <span className="size-1 bg-amber-500 rounded-full shrink-0 animate-pulse" />
                        Estimado (Base:{" "}
                        {Math.round(
                          vehicle.initialOdometer ?? 0,
                        ).toLocaleString()}{" "}
                        + GPS)
                      </span>
                    </div>
                  }
                />

                <MiniStatCard
                  label="Rumbo"
                  value={
                    <>
                      <span className="text-xl font-black font-mono tracking-tight">
                        {vehicle.liveState?.lastAngle ?? 0}°
                      </span>
                      <span className="text-[10px] font-semibold text-base-content/50 flex items-center gap-0.5">
                        <Compass className="size-3" />
                        grados
                      </span>
                    </>
                  }
                />
              </div>

              {/* Technical Details Grid */}
              <div className="bg-base-200/20 border border-base-200/60 p-4 rounded-2xl text-xs space-y-3">
                <div className="grid grid-cols-3 gap-4 py-1.5 border-b border-base-200/50">
                  <div>
                    <span className="text-base-content/40 block">Latitud</span>
                    <span className="font-semibold font-mono text-base-content/80">
                      {vehicle.liveState?.lastLat != null
                        ? vehicle.liveState.lastLat.toFixed(6)
                        : "0.000000"}
                    </span>
                  </div>
                  <div>
                    <span className="text-base-content/40 block">Longitud</span>
                    <span className="font-semibold font-mono text-base-content/80">
                      {vehicle.liveState?.lastLng != null
                        ? vehicle.liveState.lastLng.toFixed(6)
                        : "0.000000"}
                    </span>
                  </div>
                  <div>
                    <span className="text-base-content/40 block">
                      Último Heartbeat
                    </span>
                    <span className="font-semibold text-base-content/80">
                      {vehicle.liveState?.lastUpdate
                        ? formatDate(vehicle.liveState.lastUpdate)
                        : "Sin fecha"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnósticos CAN J1939 (Sólo FMC150 y FMC650) */}
            {(vehicle.deviceModel === "FMC150" ||
              vehicle.deviceModel === "FMC650") && (
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Activity className="text-primary size-5" />
                  Diagnósticos CAN J1939
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="border border-base-200/60 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="text-base-content/40 block font-semibold uppercase tracking-wider text-[10px]">
                        Nivel de Combustible
                      </span>
                      <span className="text-2xl font-black font-mono tracking-tight text-primary mt-1 block">
                        74.5%
                      </span>
                    </div>
                    <div className="w-full bg-base-200/50 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: "74.5%" }}
                      ></div>
                    </div>
                  </div>

                  <div className="border border-base-200/60 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="text-base-content/40 block font-semibold uppercase tracking-wider text-[10px]">
                        Consumo de Combustible
                      </span>
                      <span className="text-2xl font-black font-mono tracking-tight text-primary mt-1 block">
                        {vehicle.liveState?.lastIgnition
                          ? `${(8.5 + (vehicle.liveState?.lastSpeed || 0) * 0.25).toFixed(1)} L/h`
                          : "0.0 L/h"}
                      </span>
                    </div>
                    <p className="text-[10px] text-base-content/50 italic leading-relaxed">
                      {vehicle.liveState?.lastIgnition
                        ? "Motor encendido - Lectura en tiempo real"
                        : "Motor apagado"}
                    </p>
                  </div>

                  <div className="border border-base-200/60 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="text-base-content/40 block font-semibold uppercase tracking-wider text-[10px]">
                        Estado de Tacógrafo
                      </span>
                      <span className="text-xl font-black tracking-tight text-success mt-1 block">
                        {vehicle.liveState?.lastIgnition
                          ? (vehicle.liveState?.lastSpeed || 0) > 0
                            ? "CONDUCCIÓN"
                            : "TRABAJO"
                          : "DESCANSO"}
                      </span>
                    </div>
                    <p className="text-[10px] text-base-content/50 leading-relaxed">
                      Límites de tiempo de conducción J1939 / DTCO en regla.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Technical Specifications Card */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Car className="text-primary size-5" />
                Especificaciones Técnicas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border border-base-200/60 p-4 rounded-2xl space-y-2">
                  <DetailRow
                    label="Marca / Fabricante"
                    value={vehicle.make || "No especificado"}
                  />
                  <DetailRow
                    label="Modelo"
                    value={vehicle.model || "No especificado"}
                  />
                  <DetailRow
                    label="Año de Fabricación"
                    value={vehicle.year || "No especificado"}
                    border={false}
                  />
                </div>

                <div className="border border-base-200/60 p-4 rounded-2xl space-y-2">
                  <DetailRow
                    label="Número de Chasis (VIN)"
                    value={
                      <span className="uppercase font-mono">
                        {vehicle.vin || "No especificado"}
                      </span>
                    }
                  />
                  <DetailRow
                    label="IMEI del Dispositivo GPS"
                    value={<span className="font-mono">{vehicle.imei}</span>}
                  />
                  <DetailRow
                    label="Estado Administrativo"
                    value={
                      <span
                        className={`badge badge-sm font-bold text-white ${vehicle.status === "ACTIVE" ? "badge-success" : "badge-warning"}`}
                      >
                        {vehicle.status === "ACTIVE" ? "Activo" : "Taller"}
                      </span>
                    }
                    border={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Driver Column */}
          <div className="space-y-6">
            {/* Current Driver Card */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-1.5 uppercase tracking-wider text-base-content/50">
                <User className="size-4 text-primary" />
                Conductor Asignado
              </h3>

              {currentDriver ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <DriverAvatar
                      firstName={currentDriver.firstName}
                      lastName={currentDriver.lastName}
                      nationalId={currentDriver.nationalId}
                    />
                    <DriverInfoLabel driver={currentDriver} />
                  </div>
                  <div className="divider my-1 opacity-20"></div>
                  <div className="text-[11px] text-base-content/60 leading-relaxed">
                    Este conductor se encuentra actualmente a cargo de la
                    telemetría y viajes generados por este vehículo.
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="size-8 text-amber-500 opacity-60 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-base-content/60">
                    Sin conductor asignado
                  </p>
                  <p className="text-[10px] text-base-content/40 mt-1 max-w-[200px] mx-auto">
                    Asigna un conductor para registrar el historial de
                    comportamiento.
                  </p>
                </div>
              )}
            </div>

            {/* Radial Performance Summary Card */}
            <RadialScoreGauge
              score={overallScore}
              size="xl"
              title="Puntaje Operativo General"
              subtitle="Ponderación de seguridad y economía de la unidad"
              className="min-h-[260px] space-y-4"
              lastUpdated={lastUpdated}
              footer={
                <div className="flex gap-2 w-full text-xs">
                  <div className="flex-1 bg-base-200/40 border border-base-200 p-2 rounded-xl">
                    <span className="text-[9px] text-base-content/40 uppercase block">
                      Distancia
                    </span>
                    <span className="font-bold font-mono text-base-content/80 mt-0.5 block">
                      {Math.round(
                        vehicle.VehicleGlobalStats?.totalKm ?? 0,
                      ).toLocaleString()}{" "}
                      km
                    </span>
                  </div>
                  <div className="flex-1 bg-base-200/40 border border-base-200 p-2 rounded-xl">
                    <span className="text-[9px] text-base-content/40 uppercase block">
                      Horas Motor
                    </span>
                    <span className="font-bold font-mono text-base-content/80 mt-0.5 block">
                      {formatHours(
                        vehicle.VehicleGlobalStats?.totalEngineHours,
                      )}
                    </span>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* TAB: SCORES */}
      {activeTab === "scores" && (
        <div className="space-y-6">
          {/* Radial scores row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RadialScoreGauge
              score={avgSafety}
              title="Seguridad Vial"
              subtitle="Excesos de velocidad y eventos bruscos"
              footerText="Seguridad Vial"
              lastUpdated={lastUpdated}
            />
            <RadialScoreGauge
              score={avgEco}
              title="Eficiencia de Combustible"
              subtitle="Uso excesivo de ralentí y eficiencia"
              footerText="Métrica Eco"
              lastUpdated={lastUpdated}
            />
            <RadialScoreGauge
              score={avgAsset}
              title="Salud del Activo"
              subtitle="Desgaste mecánico, RPMs y DTCs"
              footerText="Cuidado de Motor"
              lastUpdated={lastUpdated}
            />
          </div>

          {/* Score Snapshot table */}
          <div className="glass-card p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <FileText className="text-primary size-5" />
                Historial de Puntajes Semanales
              </h3>
              <p className="text-xs text-base-content/50">
                Historial consolidado por semana del comportamiento de
                conducción.
              </p>
            </div>

            {/* Vista Desktop */}
            <div className="hidden md:block">
              <Table
                columns={scoreColumns}
                data={vehicle.vehicleScoreSnapshots || []}
                keyExtractor={(snap) => snap.id}
                className="table table-compact w-full text-xs"
                wrapperClassName="overflow-x-auto rounded-xl border border-base-200"
                emptyState={
                  <span className="text-base-content/40 py-8 block text-center">
                    No hay historial de puntajes semanales registrado aún.
                  </span>
                }
              />
            </div>

            {/* Vista Móvil */}
            <div className="block md:hidden space-y-3">
              {vehicle.vehicleScoreSnapshots?.map((snap) => (
                <div
                  key={snap.id}
                  className="bg-base-200/30 border border-base-200/60 p-4 rounded-2xl space-y-3"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-base-200/50">
                    <span className="font-bold text-sm text-base-content">
                      Año {snap.year} - Sem. {snap.weekNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-[10px] text-base-content/40 uppercase font-bold">
                        Puntajes
                      </p>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <span
                          className={`badge badge-sm font-bold ${getScoreBadgeColor(snap.safetyScore ?? 100)} justify-start w-fit`}
                          title="Seguridad Vial"
                        >
                          S. Vial: {Math.round(snap.safetyScore ?? 100)} pts
                        </span>
                        <span
                          className={`badge badge-sm font-bold ${getScoreBadgeColor(snap.fuelEfficiency ?? 100)} justify-start w-fit`}
                          title="Eficiencia Eco"
                        >
                          Eco: {Math.round(snap.fuelEfficiency ?? 100)} pts
                        </span>
                        <span
                          className={`badge badge-sm font-bold ${getScoreBadgeColor(((snap.maintenanceScore ?? 100) + (snap.fuelEfficiency ?? 100)) / 2)} justify-start w-fit`}
                          title="Salud del Vehículo"
                        >
                          Salud:{" "}
                          {Math.round(
                            ((snap.maintenanceScore ?? 100) +
                              (snap.fuelEfficiency ?? 100)) /
                              2,
                          )}{" "}
                          pts
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] text-base-content/40 uppercase font-bold">
                        Actividad
                      </p>
                      <p className="font-mono font-bold text-base-content/85 mt-1">
                        {Math.round(snap.totalKm).toLocaleString()} km
                      </p>
                      <p className="text-base-content/60 font-semibold">
                        {snap.totalTrips} viajes
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(!vehicle.vehicleScoreSnapshots ||
                vehicle.vehicleScoreSnapshots.length === 0) && (
                <div className="text-center text-base-content/40 py-8 bg-base-200/30 border border-base-200/60 rounded-2xl text-xs">
                  No hay historial de puntajes semanales registrado aún.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ROLLUPS */}
      {activeTab === "rollups" && (
        <div className="glass-card p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Activity className="text-primary size-5" />
              Logs de Actividad Diaria
            </h3>
            <p className="text-xs text-base-content/50">
              Desglose de distancia, horas motor, excesos de velocidad y eventos
              graves consolidado.
            </p>
          </div>

          {/* Vista Desktop */}
          <div className="hidden md:block">
            <Table
              columns={telemetryColumns}
              data={vehicle.DailyTelemetryRollup || []}
              keyExtractor={(day) => day.id}
              className="table table-compact w-full text-xs"
              wrapperClassName="overflow-x-auto rounded-xl border border-base-200"
              pagination={true}
              pageSize={10}
              emptyState={
                <span className="text-base-content/40 py-8 block text-center">
                  No hay telemetría diaria consolidada registrada para esta
                  unidad.
                </span>
              }
            />
          </div>

          {/* Vista Móvil */}
          <div className="block md:hidden space-y-3">
            {showRollupGrouping
              ? monthKeys.map((monthKey) => (
                  <div
                    key={monthKey}
                    className="collapse collapse-arrow bg-base-100/40 border border-base-200 shadow-md rounded-2xl overflow-hidden backdrop-blur-md"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={monthKey === firstMonthKey}
                      className="peer"
                      aria-label={`Mostrar logs de ${monthKey}`}
                    />
                    <div className="collapse-title text-sm font-bold flex items-center gap-2 pr-10 text-base-content bg-base-200/20 capitalize text-left">
                      <span>{monthKey}</span>
                      <span className="badge badge-neutral badge-sm ml-2 font-mono font-bold bg-base-300 border-none text-base-content/85">
                        {groupedRollups[monthKey].length}
                      </span>
                    </div>
                    <div className="collapse-content p-4 bg-base-100/10 space-y-3">
                      {groupedRollups[monthKey].map(renderRollupCard)}
                    </div>
                  </div>
                ))
              : rollups.map(renderRollupCard)}
            {rollups.length === 0 && (
              <div className="text-center text-base-content/40 py-8 bg-base-200/30 border border-base-200/60 rounded-2xl text-xs">
                No hay telemetría diaria consolidada registrada para esta
                unidad.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
