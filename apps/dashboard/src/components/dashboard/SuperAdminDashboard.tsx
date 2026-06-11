"use client";

import { useMemo } from "react";
import {
  Building2,
  Car,
  Activity,
  Users,
  Compass,
  Radio,
  Wrench,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  DashboardDriver,
  DashboardOrganization,
  DashboardVehicle,
  SuperAdminDashboardProps,
  SuperAdminOrgWithScore,
  TableColumn,
} from "@/types";
import { getScoreBadgeColor } from "@/utils/client";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { DashboardStatCard } from "@/components/ui/DashboardStatCard";
import { Table } from "@/components/ui/Table";
import { useFleet } from "@/context/FleetContext";

export function SuperAdminDashboard({
  organizations = [],
  vehicles = [],
  drivers = [],
}: SuperAdminDashboardProps) {
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

  // Calculamos vehículos activos/en línea (monitoreo activo)
  // Se considera activo si tiene liveState y se ha actualizado en los últimos 15 minutos.
  const activeVehicles = liveVehicles.filter((v) => {
    if (!v.liveState) return false;
    const lastUpdate = new Date(v.liveState.lastUpdate);
    const diffMs = Date.now() - lastUpdate.getTime();
    return diffMs < 15 * 60 * 1000; // 15 minutos
  }).length;

  // Calculamos promedios globales de conducción de todo el sistema
  let sumSafety = 0;
  let sumEco = 0;
  let sumAsset = 0;
  let countWithStats = 0;
  let latestUpdate: Date | null = null;

  drivers.forEach((d) => {
    if (d.globalStats && d.globalStats.totalSnapshots != null && d.globalStats.totalSnapshots > 0) {
      sumSafety +=
        d.globalStats.globalSafetyScore ?? d.globalStats.safetyScore ?? 100;
      sumEco += d.globalStats.globalEcoScore ?? d.globalStats.ecoScore ?? 100;
      sumAsset +=
        d.globalStats.globalAssetScore ?? d.globalStats.assetScore ?? 100;
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
  const avgEco = countWithStats > 0 ? Math.round(sumEco / countWithStats) : null;
  const avgAsset =
    countWithStats > 0 ? Math.round(sumAsset / countWithStats) : null;

  // Pre-calcular promedios de seguridad vial por organización (basado en asignación activa de conductores)
  const orgSafetyScores: Record<string, { sum: number; count: number }> = {};
  drivers.forEach((d) => {
    if (d.globalStats && d.globalStats.totalSnapshots != null && d.globalStats.totalSnapshots > 0) {
      const activeAssignment = d.assignments?.[0];
      const orgId = activeAssignment?.vehicle?.orgId;
      if (orgId) {
        const score =
          d.globalStats.globalSafetyScore ?? d.globalStats.safetyScore ?? 100;
        if (!orgSafetyScores[orgId]) {
          orgSafetyScores[orgId] = { sum: 0, count: 0 };
        }
        orgSafetyScores[orgId].sum += score;
        orgSafetyScores[orgId].count += 1;
      }
    }
  });

  // Métricas adicionales de valor
  const totalKm = drivers.reduce(
    (acc, d) => acc + (d.globalStats?.totalKm ?? 0),
    0,
  );
  const activeStatusCount = liveVehicles.filter(
    (v) => v.status === "ACTIVE",
  ).length;
  const maintenanceStatusCount = liveVehicles.filter(
    (v) => v.status === "IN_MAINTENANCE",
  ).length;
  const inactiveStatusCount = liveVehicles.filter(
    (v) => v.status !== "ACTIVE" && v.status !== "IN_MAINTENANCE",
  ).length;

  const orgsWithScores = organizations
    .map((org) => {
      const scoreData = orgSafetyScores[org.id];
      const avgSafety = scoreData
        ? Math.round(scoreData.sum / scoreData.count)
        : null;
      const owner = org.users?.[0]?.name || "Sin Owner";
      return {
        ...org,
        avgSafety,
        owner,
      };
    })
    .sort((a, b) => {
      if (a.avgSafety !== null && b.avgSafety !== null) {
        return b.avgSafety - a.avgSafety;
      }
      if (a.avgSafety !== null) return -1;
      if (b.avgSafety !== null) return 1;
      return (b._count?.vehicles || 0) - (a._count?.vehicles || 0);
    });

  const columns: TableColumn<SuperAdminOrgWithScore>[] = [
    {
      key: "name",
      header: "Organización",
      className: "font-bold text-base-content",
    },
    {
      key: "owner",
      header: "Propietario",
      className: "text-base-content/70",
    },
    {
      key: "vehicles",
      header: "Vehículos",
      headerClassName: "text-center",
      className: "text-center font-semibold",
      render: (org) => org._count?.vehicles || 0,
    },
    {
      key: "avgSafety",
      header: "Puntaje Promedio",
      headerClassName: "text-center",
      className: "text-center",
      render: (org) => {
        return org.avgSafety !== null ? (
          <span
            className={`badge text-[10px] font-extrabold px-2.5 py-1 ${getScoreBadgeColor(org.avgSafety)}`}
          >
            {org.avgSafety} pts
          </span>
        ) : (
          <span className="text-base-content/40 italic">Sin datos</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <WelcomeBanner
        badgeText="Super Administrador Global"
        title="Panel de Administración Global"
        description="Bienvenido al centro de mando de VantX. Monitorea el rendimiento de conducción global, el estado de dispositivos de telemetría y gestiona las organizaciones operando en la plataforma."
        gradientClass="from-blue-700 via-indigo-700 to-purple-800"
        icon={<Building2 className="size-96" />}
      />

      {/* Global Driver Performance Scores */}
      <div>
        <h2 className="text-lg font-bold text-base-content/80 mb-4 flex items-center gap-2">
          <Activity className="size-5 text-indigo-500" />
          Puntajes Globales de Conducción
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RadialScoreGauge
            score={avgSafety}
            title="Seguridad Vial Global"
            subtitle="Exceso de velocidad y maniobras bruscas"
            footerText="Promedio de la Plataforma"
            lastUpdated={latestUpdate}
            className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-md p-6 flex flex-col items-center justify-between text-center min-h-[220px] hover:border-primary/20 hover:shadow-lg transition-all duration-300"
          />
          <RadialScoreGauge
            score={avgEco}
            title="Eficiencia Combustible Global"
            subtitle="Tiempos en ralentí y revoluciones (RPM)"
            footerText="Eficiencia Consolidada"
            lastUpdated={latestUpdate}
            className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-md p-6 flex flex-col items-center justify-between text-center min-h-[220px] hover:border-primary/20 hover:shadow-lg transition-all duration-300"
          />
          <RadialScoreGauge
            score={avgAsset}
            title="Salud del Activo Global"
            subtitle="Monitoreo de códigos DTC y temperaturas"
            footerText="Cuidado de Unidades"
            lastUpdated={latestUpdate}
            className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-md p-6 flex flex-col items-center justify-between text-center min-h-[220px] hover:border-primary/20 hover:shadow-lg transition-all duration-300"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStatCard
          icon={
            <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-600">
              <Building2 className="size-8" />
            </div>
          }
          label="Organizaciones"
          value={organizations.length}
          className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl hover:shadow-2xl transition-all duration-300"
        />
        <DashboardStatCard
          icon={
            <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-600">
              <Car className="size-8" />
            </div>
          }
          label="Vehículos Totales"
          value={liveVehicles.length}
          className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl hover:shadow-2xl transition-all duration-300"
        />
        <DashboardStatCard
          icon={
            <div className="p-4 bg-teal-500/10 rounded-2xl text-teal-600">
              <Users className="size-8" />
            </div>
          }
          label="Conductores"
          value={drivers.length}
          className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl hover:shadow-2xl transition-all duration-300"
        />
        <DashboardStatCard
          icon={
            <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-600">
              <Compass className="size-8" />
            </div>
          }
          label="Recorrido Global"
          value={`${totalKm.toLocaleString()} km`}
          className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl hover:shadow-2xl transition-all duration-300"
        />
      </div>

      {/* Metrics and Rankings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Desempeño por Organización */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Building2 className="text-primary size-5" />
              Rendimiento de Seguridad por Organización
            </h2>
            <p className="text-xs text-base-content/50">
              Organizaciones ordenadas por el promedio de puntaje de seguridad
              de sus conductores.
            </p>
          </div>
          <Table
            columns={columns}
            data={orgsWithScores}
            keyExtractor={(org) => org.id}
            className="table w-full text-xs"
            wrapperClassName="overflow-x-auto"
            emptyState={
              <span className="text-base-content/40 py-6 block text-center">
                No hay organizaciones registradas.
              </span>
            }
          />
        </div>

        {/* Distribución de la Flota y Telemetría */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="text-primary size-5" />
              Estado y Uso de la Flota Global
            </h2>
            <p className="text-xs text-base-content/50">
              Análisis detallado de la conectividad y estados operativos a nivel
              del sistema.
            </p>
          </div>

          <div className="space-y-4">
            {/* Conectividad Telemetría en Vivo */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold flex items-center gap-1.5 text-base-content/85">
                  <Radio className="size-4 text-emerald-500 animate-pulse" />
                  Monitoreo Activo (En línea)
                </span>
                <span className="font-semibold text-base-content">
                  {activeVehicles} de {liveVehicles.length} unidades
                </span>
              </div>
              <div className="w-full bg-base-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${liveVehicles.length > 0 ? (activeVehicles / liveVehicles.length) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-base-content/50">
                <span>ONLINE: {activeVehicles}</span>
                <span>OFFLINE: {liveVehicles.length - activeVehicles}</span>
              </div>
            </div>

            <div className="divider opacity-40 my-2"></div>

            {/* Distribución de Estados de Vehículos */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-base-content/80 uppercase tracking-wider mb-2">
                Distribución Operativa
              </h3>

              {/* Activos */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-base-content/75">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-success" /> Activos
                  </span>
                  <span className="font-bold">{activeStatusCount}</span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-success h-1.5 rounded-full"
                    style={{
                      width: `${liveVehicles.length > 0 ? (activeStatusCount / liveVehicles.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Taller / Mantenimiento */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-base-content/75">
                  <span className="flex items-center gap-1">
                    <Wrench className="size-3.5 text-warning" /> En
                    Mantenimiento
                  </span>
                  <span className="font-bold">{maintenanceStatusCount}</span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-warning h-1.5 rounded-full"
                    style={{
                      width: `${liveVehicles.length > 0 ? (maintenanceStatusCount / liveVehicles.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Inactivos u otros */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-base-content/75">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-neutral" /> Inactivos
                  </span>
                  <span className="font-bold">{inactiveStatusCount}</span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-neutral/40 h-1.5 rounded-full"
                    style={{
                      width: `${liveVehicles.length > 0 ? (inactiveStatusCount / liveVehicles.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
