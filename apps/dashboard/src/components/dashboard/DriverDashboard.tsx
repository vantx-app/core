"use client";

import { useState } from "react";
import {
  Loader2,
  Calendar,
  ShieldCheck,
  Leaf,
  Activity,
  MapPin,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  Truck,
} from "lucide-react";
import {
  DriverDashboardProps,
  DriverScoreSnapshot,
  DriverStats,
  TableColumn,
} from "@/types";
import { formatHours, getScoreBadgeColor } from "@/utils/client";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { Table } from "@/components/ui/Table";
import { ScoreProgressBar } from "@/components/ui/ScoreProgressBar";

export function DriverDashboard({ stats }: DriverDashboardProps) {
  // Estado para controlar qué semana se encuentra expandida en la vista móvil
  // Se inicializa en 0 para expandir el snapshot más reciente por defecto
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20 animate-pulse">
        <Loader2 className="size-16 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-bold">Cargando perfil del conductor...</h3>
      </div>
    );
  }

  const driverName = stats.firstName
    ? `${stats.firstName} ${stats.lastName}`
    : "Conductor Desconocido";
  const globalStats = stats.globalStats;
  const activeAssignment = stats.assignments?.[0];
  const snapshots = stats.scoreSnapshots || [];

  const hasStats = globalStats && globalStats.totalSnapshots != null && globalStats.totalSnapshots > 0;
  const safetyScore = hasStats
    ? globalStats.globalSafetyScore ?? globalStats.safetyScore ?? null
    : null;
  const ecoScore = hasStats
    ? globalStats.globalEcoScore ?? globalStats.ecoScore ?? null
    : null;
  const assetScore = hasStats
    ? globalStats.globalAssetScore ?? globalStats.assetScore ?? null
    : null;

  // Calcular puntaje general (overall score)
  const overallScore = hasStats
    ? globalStats.globalOverallScore ?? null
    : null;

  // Determinar nivel y colores basados en el rendimiento general
  let rankLabel = "Sin Calificación";
  let rankColor = "bg-slate-500 text-white shadow-slate-500/20";
  let cardBorderColor = "border-base-200";
  if (overallScore !== null) {
    if (overallScore >= 85) {
      rankLabel = "Excelente";
      rankColor = "bg-emerald-500 text-white shadow-emerald-500/20";
      cardBorderColor = "border-emerald-500/20";
    } else if (overallScore >= 70) {
      rankLabel = "Bueno";
      rankColor = "bg-amber-500 text-white shadow-amber-500/20";
      cardBorderColor = "border-amber-500/20";
    } else {
      rankLabel = "Precaución";
      rankColor = "bg-rose-500 text-white shadow-rose-500/20";
      cardBorderColor = "border-rose-500/20";
    }
  }

  const columns: TableColumn<DriverScoreSnapshot>[] = [
    {
      key: "week",
      header: "Año/Semana",
      className: "font-bold text-base-content",
      render: (snap) => `Año ${snap.year} - Sem. ${snap.weekNumber}`,
    },
    {
      key: "overallScore",
      header: "Puntaje Promedio",
      className: "font-semibold",
      render: (snap) => (
        <span
          className={`badge badge-sm font-bold ${getScoreBadgeColor(snap.overallScore)}`}
        >
          {Math.round(snap.overallScore)}
        </span>
      ),
    },
    {
      key: "safetyScore",
      header: "Seguridad",
      render: (snap) => Math.round(snap.safetyScore),
    },
    {
      key: "ecoScore",
      header: "Eco-Conducción",
      render: (snap) => Math.round(snap.ecoScore),
    },
    {
      key: "assetScore",
      header: "Cuidado Motor",
      render: (snap) => Math.round(snap.assetScore),
    },
    {
      key: "distance",
      header: "Distancia",
      render: (snap) =>
        `${(snap.totalKm ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`,
    },
    {
      key: "hours",
      header: "Horas",
      render: (snap) => formatHours(snap.totalHours),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <WelcomeBanner
        badgeText="Portal del Conductor"
        title={`¡Hola, ${driverName}!`}
        description="Este es tu scorecard personal. Conduce de manera segura y eficiente para mantener un puntaje excelente."
        gradientClass="from-emerald-600 via-teal-600 to-cyan-700"
      />

      {/* Resumen Principal de Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tarjeta de Puntaje General */}
        <div
          className={`card bg-base-100/50 backdrop-blur-md border ${cardBorderColor} shadow-xl p-6 lg:col-span-1 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-[0.03] translate-x-4 translate-y-4 pointer-events-none">
            <Award className="size-36 text-base-content" />
          </div>
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block mb-1">
            Puntaje General
          </span>

          <RadialScoreGauge
            score={overallScore}
            title=""
            noCard
            size="xl"
            lastUpdated={globalStats?.lastUpdated}
          />

          <div className="space-y-1 mt-2">
            <span
              className={`badge ${rankColor} font-bold text-xs px-3 py-1.5 shadow-lg border-none`}
            >
              Rendimiento: {rankLabel}
            </span>
            <p className="text-[11px] text-base-content/40 mt-1.5 max-w-[200px]">
              Promedio de conducción basado en seguridad, ecología y cuidado
              motor
            </p>
          </div>
        </div>

        {/* Tarjetas de Estadísticas Acumuladas */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Kilómetros Recorridos */}
          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-emerald-500/20 hover:scale-[1.01]">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <MapPin className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block">
                Distancia Recorrida
              </span>
              <span className="text-2xl md:text-3xl font-black text-base-content block mt-1">
                {(globalStats?.totalKm ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                km
              </span>
              <span className="text-[10px] text-base-content/40 block mt-1">
                Kilómetros acumulados en la plataforma
              </span>
            </div>
          </div>

          {/* Horas de Conducción */}
          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-emerald-500/20 hover:scale-[1.01]">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <Clock className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block">
                Tiempo de Conducción
              </span>
              <span className="text-2xl md:text-3xl font-black text-base-content block mt-1">
                {formatHours(globalStats?.totalHours)}
              </span>
              <span className="text-[10px] text-base-content/40 block mt-1">
                Horas totales registradas al volante
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalle de Categorías */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-base-content/60 uppercase tracking-wider px-1">
          Detalle por Categoría
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl p-6 flex flex-col items-center justify-between text-center transition-all duration-300 hover:border-emerald-500/20 hover:scale-[1.01]">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="size-5 text-emerald-500" />
              <span className="text-base-content/75 text-xs font-bold uppercase tracking-wider">
                Seguridad Vial
              </span>
            </div>
            <RadialScoreGauge
              score={safetyScore}
              title=""
              noCard
              size="lg"
              lastUpdated={globalStats?.lastUpdated}
            />
            <span className="text-[10px] font-medium text-base-content/40 mt-3 max-w-xs leading-normal">
              Excesos de velocidad y eventos de frenados bruscos
            </span>
          </div>

          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl p-6 flex flex-col items-center justify-between text-center transition-all duration-300 hover:border-emerald-500/20 hover:scale-[1.01]">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="size-5 text-emerald-500" />
              <span className="text-base-content/75 text-xs font-bold uppercase tracking-wider">
                Eficiencia Ecológica
              </span>
            </div>
            <RadialScoreGauge
              score={ecoScore}
              title=""
              noCard
              size="lg"
              lastUpdated={globalStats?.lastUpdated}
            />
            <span className="text-[10px] font-medium text-base-content/40 mt-3 max-w-xs leading-normal">
              Consumo óptimo, ralentí y revoluciones (RPM)
            </span>
          </div>

          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-xl p-6 flex flex-col items-center justify-between text-center transition-all duration-300 hover:border-emerald-500/20 hover:scale-[1.01]">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-5 text-emerald-500" />
              <span className="text-base-content/75 text-xs font-bold uppercase tracking-wider">
                Cuidado del Vehículo
              </span>
            </div>
            <RadialScoreGauge
              score={assetScore}
              title=""
              noCard
              size="lg"
              lastUpdated={globalStats?.lastUpdated}
            />
            <span className="text-[10px] font-medium text-base-content/40 mt-3 max-w-xs leading-normal">
              Temperatura de motor y salud mecánica (DTC)
            </span>
          </div>
        </div>
      </div>

      {/* Sección de Vehículo y Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tarjeta de Vehículo Asignado */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4 lg:col-span-1 transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Truck className="text-emerald-500 size-5" />
              Vehículo Asignado
            </h2>
            {activeAssignment && (
              <span className="badge badge-success badge-xs font-bold gap-1 px-2.5 py-2 text-white animate-pulse">
                <span className="size-1.5 rounded-full bg-white block animate-ping"></span>
                Activo
              </span>
            )}
          </div>
          {activeAssignment ? (
            <div className="space-y-4 pt-1">
              <div className="bg-base-200/50 p-4 rounded-2xl border border-base-300 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-[0.03] translate-x-2 translate-y-2 pointer-events-none">
                  <Truck className="size-24 text-base-content" />
                </div>
                <span className="text-xs text-base-content/50 uppercase tracking-wider font-bold block">
                  Alias de Unidad
                </span>
                <span className="text-2xl font-black text-base-content block mt-0.5">
                  {activeAssignment.vehicle.alias || "Sin Alias"}
                </span>
                <span className="inline-block mt-2 badge badge-neutral text-xs font-mono tracking-wider font-semibold">
                  Placa: {activeAssignment.vehicle.plateNumber}
                </span>
              </div>
              <div className="space-y-2.5 text-xs px-1 text-base-content/80">
                {activeAssignment.vehicle.make && (
                  <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                    <span className="text-base-content/50">Marca</span>
                    <span className="font-semibold">
                      {activeAssignment.vehicle.make}
                    </span>
                  </div>
                )}
                {activeAssignment.vehicle.model && (
                  <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                    <span className="text-base-content/50">Modelo</span>
                    <span className="font-semibold">
                      {activeAssignment.vehicle.model}
                    </span>
                  </div>
                )}
                {activeAssignment.vehicle.year && (
                  <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                    <span className="text-base-content/50">Año</span>
                    <span className="font-semibold">
                      {activeAssignment.vehicle.year}
                    </span>
                  </div>
                )}
                {activeAssignment.vehicle.vin && (
                  <div className="flex flex-col gap-1 pt-0.5">
                    <span className="text-base-content/50">VIN</span>
                    <span className="font-mono text-[10px] bg-base-200/40 py-1 px-2 rounded border border-base-300/40 break-all select-all">
                      {activeAssignment.vehicle.vin}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-base-200 rounded-full mb-3 text-base-content/30">
                <Truck className="size-8" />
              </div>
              <p className="text-sm text-base-content/50 font-bold italic">
                Sin vehículo asignado
              </p>
              <p className="text-xs text-base-content/40 mt-1 max-w-[200px]">
                Tu administrador de flota te asignará un vehículo pronto para
                comenzar a registrar viajes.
              </p>
            </div>
          )}
        </div>

        {/* Historial de Calificaciones (Semanales) */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4 lg:col-span-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Calendar className="text-emerald-500 size-5" />
            Historial de Calificaciones (Semanales)
          </h2>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table
              columns={columns}
              data={snapshots}
              keyExtractor={(snap, index) => index.toString()}
              className="table table-compact w-full text-xs"
              wrapperClassName="overflow-x-auto"
              emptyState={
                <span className="text-base-content/40 py-6 block text-center">
                  Aún no se han acumulado snapshots semanales.
                </span>
              }
            />
          </div>

          {/* Mobile Card List View */}
          <div className="space-y-3 md:hidden">
            {snapshots.length > 0 ? (
              snapshots.map((snap, index) => {
                const isExpanded = expandedWeek === index;
                const formattedOverall = Math.round(snap.overallScore);
                const weeklyKm = snap.totalKm ?? 0;
                const weeklyHours = formatHours(snap.totalHours);

                return (
                  <div
                    key={index}
                    className={`bg-base-100/50 border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isExpanded
                        ? "border-emerald-500/30 shadow-md"
                        : "border-base-200 hover:border-base-300"
                    }`}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-3.5 flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setExpandedWeek(isExpanded ? null : index)}
                    >
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-base-content/40 font-bold block uppercase tracking-wider">
                          Año {snap.year}
                        </span>
                        <span className="text-sm font-black text-base-content">
                          Semana {snap.weekNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`badge badge-sm font-extrabold ${getScoreBadgeColor(snap.overallScore)}`}
                        >
                          {formattedOverall} pts
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-base-content/40" />
                        ) : (
                          <ChevronDown className="size-4 text-base-content/40" />
                        )}
                      </div>
                    </div>

                    {/* Expandable Breakdown */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-base-200/40 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Weekly Stats Summary */}
                        <div className="grid grid-cols-2 gap-0 bg-base-200/40 rounded-xl overflow-hidden text-center mt-2">
                          <div className="p-3">
                            <span className="text-[10px] text-base-content/40 uppercase font-bold block">
                              Distancia
                            </span>
                            <span className="text-sm font-black text-base-content block mt-0.5">
                              {weeklyKm.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}{" "}
                              km
                            </span>
                          </div>
                          <div className="p-3 border-l border-base-300/40">
                            <span className="text-[10px] text-base-content/40 uppercase font-bold block">
                              Tiempo
                            </span>
                            <span className="text-sm font-black text-base-content block mt-0.5">
                              {weeklyHours}
                            </span>
                          </div>
                        </div>

                        {/* Sub-scores Progress Bars */}
                        <div className="space-y-3 pt-1">
                          <ScoreProgressBar
                            score={snap.safetyScore}
                            label="Seguridad Vial"
                          />
                          <ScoreProgressBar
                            score={snap.ecoScore}
                            label="Eficiencia Ecológica"
                          />
                          <ScoreProgressBar
                            score={snap.assetScore}
                            label="Cuidado del Vehículo"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <span className="text-base-content/40 py-6 block text-center text-xs italic">
                Aún no se han acumulado snapshots semanales.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
