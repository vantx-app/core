"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  CreditCard,
  Car,
  UserCheck,
  ShieldAlert,
  Loader2,
  Activity,
  Calendar,
  Truck,
  Phone,
  ChevronDown,
  ChevronUp,
  Award,
  Info,
  Clock,
  MapPin,
  TrendingDown,
  CornerUpRight,
  Zap,
  Power,
  AlertCircle,
  Thermometer,
  Flame,
  ShieldCheck,
  Route,
} from "lucide-react";
import {
  DriverStats,
  DashboardVehicle,
  TableColumn,
  DriverScoreSnapshot,
  DailyTelemetryRollup,
  VehicleTripsTrip,
} from "@/types";
import {
  formatDate,
  formatDateOnly,
  getScoreBadgeColor,
  formatHours,
  getScoreTextColor,
  groupDailyReportsByVehicle,
} from "@/utils/client";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { Table } from "@/components/ui/Table";
import { ScoreProgressBar } from "@/components/ui/ScoreProgressBar";
import TripsHistoryView from "@/components/TripsHistoryView";
import api from "@/utils/client/api-client";

interface DriverDetailClientProps {
  driver: any;
  trips: any[];
  dailyReports: any[];
  vehicles: DashboardVehicle[];
  targetOrgId?: string;
}

export function DriverDetailClient({
  driver,
  trips,
  dailyReports,
  vehicles,
  targetOrgId,
}: DriverDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "scores" | "trips" | "rollups"
  >("overview");

  // Selection and state for vehicle assignment
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Mobile accordion state for score snapshots
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);

  // Accordion state for vehicle daily reports grouping
  const [expandedVehicles, setExpandedVehicles] = useState<
    Record<string, boolean>
  >({});

  const displayName =
    driver.name ||
    (driver.firstName && driver.lastName
      ? `${driver.firstName} ${driver.lastName}`
      : driver.nationalId);

  const activeAssignment = driver.assignments?.find((a: any) => a.to === null);
  const historicalAssignments =
    driver.assignments?.filter((a: any) => a.to !== null) || [];

  const hasStats =
    driver.globalStats &&
    driver.globalStats.totalSnapshots != null &&
    driver.globalStats.totalSnapshots > 0;
  const safetyScore = hasStats
    ? (driver.globalStats.globalSafetyScore ??
      driver.globalStats.safetyScore ??
      null)
    : null;
  const ecoScore = hasStats
    ? (driver.globalStats.globalEcoScore ?? driver.globalStats.ecoScore ?? null)
    : null;
  const assetScore = hasStats
    ? (driver.globalStats.globalAssetScore ??
      driver.globalStats.assetScore ??
      null)
    : null;
  const overallScore = hasStats
    ? (driver.globalStats.globalOverallScore ?? null)
    : null;

  // Determine rank labels and colors
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

  // Filter available vehicles (not currently assigned to any driver)
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const hasActiveAssignment = v.assignments && v.assignments.length > 0;
      return !hasActiveAssignment;
    });
  }, [vehicles]);

  const handleAssign = async () => {
    if (!selectedVehicleId) return;
    setIsAssigning(true);
    setAssignError(null);
    try {
      await api.post(`/vehicles/${selectedVehicleId}/assign`, {
        nationalId: driver.nationalId,
      });
      setSelectedVehicleId("");
      router.refresh();
    } catch (err: any) {
      console.error("Error al asignar vehículo:", err);
      setAssignError(
        err.response?.data?.message || "Error al asignar vehículo",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (vId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que deseas desvincular este vehículo de este conductor?",
      )
    ) {
      return;
    }
    setIsUnassigning(true);
    try {
      await api.post(`/vehicles/${vId}/unassign`);
      router.refresh();
    } catch (err: any) {
      console.error("Error al desasignar vehículo:", err);
      alert(err.response?.data?.message || "Error al desvincular vehículo");
    } finally {
      setIsUnassigning(false);
    }
  };

  // Columns for score snapshots history table (Desktop)
  const scoreColumns: TableColumn<DriverScoreSnapshot>[] = [
    {
      key: "week",
      header: "Año / Semana",
      className: "font-bold text-base-content",
      render: (snap) => `Año ${snap.year} - Sem. ${snap.weekNumber}`,
    },
    {
      key: "overallScore",
      header: "Puntaje General",
      className: "font-semibold",
      render: (snap) => (
        <span
          className={`badge badge-sm font-bold ${getScoreBadgeColor(snap.overallScore)}`}
        >
          {Math.round(snap.overallScore)} pts
        </span>
      ),
    },
    {
      key: "safetyScore",
      header: "Seguridad Vial",
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
      key: "totalKm",
      header: "Distancia",
      render: (snap) => `${(snap.totalKm ?? 0).toFixed(1)} km`,
    },
    {
      key: "totalHours",
      header: "Tiempo",
      render: (snap) => formatHours(snap.totalHours),
    },
  ];

  // Group daily reports by Vehicle
  const reportsGroupedByVehicle = useMemo(() => {
    return groupDailyReportsByVehicle(dailyReports);
  }, [dailyReports]);

  const toggleVehicle = (vId: string) => {
    setExpandedVehicles((prev) => ({
      ...prev,
      [vId]: !prev[vId],
    }));
  };

  const renderDailyReportCardNoVehicle = (day: any) => {
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
        day.deviceUnpluggedCount > 0 ||
        day.activeFaultCodesCount > 0 ||
        day.highRpmCount > 0 ||
        day.coldEngineStrainCount > 0 ||
        day.coastingInNeutralCount > 0 ||
        day.engineLuggingCount > 0 ||
        day.highLoadStrainCount > 0 ||
        day.criticalOverheatingCount > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {day.overspeedCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono text-[9px] gap-0.5">
                <AlertCircle className="size-2.5" />
                {day.overspeedCount} Exc. Vel.
              </span>
            )}
            {day.brakingCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono text-[9px] gap-0.5">
                <TrendingDown className="size-2.5" />
                {day.brakingCount} Frenados
              </span>
            )}
            {day.corneringCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20 font-bold font-mono text-[9px] gap-0.5">
                <CornerUpRight className="size-2.5" />
                {day.corneringCount} Giros
              </span>
            )}
            {day.accelerationCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold font-mono text-[9px] gap-0.5">
                <Zap className="size-2.5" />
                {day.accelerationCount} Acel.
              </span>
            )}
            {day.deviceUnpluggedCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 font-bold font-mono text-[9px] gap-0.5">
                <Power className="size-2.5" />
                GPS desc. ({day.deviceUnpluggedCount}d)
              </span>
            )}
          </div>
        ) : (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold">
              <ShieldCheck className="size-2.5" />
              Sin incidentes
            </span>
          </div>
        )}
      </div>
    );
  };

  const dailyReportColumnsNoVehicle: TableColumn<any>[] = [
    {
      key: "date",
      header: "Fecha",
      className: "font-bold",
      render: (day) => formatDateOnly(day.date),
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
      render: (day) => {
        const totalHarsh =
          day.brakingCount + day.corneringCount + day.accelerationCount;
        const hasEvents =
          day.overspeedCount > 0 ||
          totalHarsh > 0 ||
          day.deviceUnpluggedCount > 0 ||
          day.activeFaultCodesCount > 0 ||
          day.highRpmCount > 0 ||
          day.coldEngineStrainCount > 0 ||
          day.coastingInNeutralCount > 0 ||
          day.engineLuggingCount > 0 ||
          day.highLoadStrainCount > 0 ||
          day.criticalOverheatingCount > 0;

        if (!hasEvents) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <ShieldCheck className="size-3.5" />
              Sin incidentes
            </span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1.5 items-center">
            {day.overspeedCount > 0 && (
              <span className="inline-flex items-center p-1 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono text-xs gap-0.5">
                <AlertCircle className="size-3.5" />
                {day.overspeedCount} Exc. Vel.
              </span>
            )}
            {totalHarsh > 0 && (
              <span className="inline-flex items-center p-1 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold font-mono text-xs gap-0.5">
                <Zap className="size-3.5" />
                {totalHarsh} Bruscas
              </span>
            )}
            {day.deviceUnpluggedCount > 0 && (
              <span className="inline-flex items-center p-1 rounded-lg bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 font-bold font-mono text-xs gap-0.5">
                <Power className="size-3.5" />
                {day.deviceUnpluggedCount}d desc.
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={
              targetOrgId ? `/drivers?targetOrgId=${targetOrgId}` : "/drivers"
            }
            className="btn btn-sm btn-ghost btn-square rounded-xl"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-3">
            <DriverAvatar
              firstName={driver.firstName}
              lastName={driver.lastName}
              nationalId={driver.nationalId}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-base-content">
                  {displayName}
                </h1>
                <span
                  className={`badge ${driver.status === "ACTIVE" ? "badge-success text-white" : "badge-neutral"} badge-sm font-bold`}
                >
                  {driver.status === "ACTIVE" ? "Activo" : "Shadow Profile"}
                </span>
              </div>
              <p className="text-xs text-base-content/60 mt-0.5">
                Cédula: <span className="font-mono">{driver.nationalId}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Radial Scores Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main average Scorecard */}
        <div
          className={`card bg-base-100/50 backdrop-blur-md border ${cardBorderColor} shadow-md p-6 md:col-span-1 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-[0.03] translate-x-4 translate-y-4 pointer-events-none">
            <Award className="size-36 text-base-content" />
          </div>
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block mb-1">
            Puntaje de Conducción
          </span>
          <RadialScoreGauge
            score={overallScore}
            title=""
            noCard
            size="xl"
            lastUpdated={driver.globalStats?.lastUpdated}
          />
          <div className="space-y-1 mt-2">
            <span
              className={`badge ${rankColor} font-bold text-xs px-3 py-1.5 shadow-lg border-none`}
            >
              Calidad: {rankLabel}
            </span>
            <p className="text-[11px] text-base-content/40 mt-1.5 max-w-[200px]">
              Promedio ponderado del historial de conducción
            </p>
          </div>
        </div>

        {/* Stats Pillars Cards */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-md p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-emerald-500/20">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <MapPin className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block">
                Distancia Conducida
              </span>
              <span className="text-2xl md:text-3xl font-black text-base-content block mt-1 font-mono">
                {(driver.globalStats?.totalKm ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                km
              </span>
              <span className="text-[10px] text-base-content/40 block mt-1">
                Kilometraje total acumulado
              </span>
            </div>
          </div>

          <div className="card bg-base-100/50 backdrop-blur-md border border-base-200 shadow-md p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-emerald-500/20">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <Clock className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider block">
                Tiempo de Conducción
              </span>
              <span className="text-2xl md:text-3xl font-black text-base-content block mt-1 font-mono">
                {formatHours(driver.globalStats?.totalHours)}
              </span>
              <span className="text-[10px] text-base-content/40 block mt-1">
                Horas acumuladas registradas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="tabs tabs-boxed bg-base-200/50 p-1 rounded-xl w-full max-w-lg shrink-0 border border-base-200/60 backdrop-blur-md">
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
          <Calendar className="size-3.5 mr-1.5" />
          Desempeño
        </button>
        <button
          onClick={() => setActiveTab("trips")}
          className={`tab flex-1 rounded-lg font-semibold text-xs transition-all ${
            activeTab === "trips"
              ? "tab-active bg-base-100 shadow-sm text-primary"
              : "text-base-content/60"
          }`}
        >
          <Route className="size-3.5 mr-1.5" />
          Viajes ({trips.length})
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
          {/* Driver Contact & Profile */}
          <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4 lg:col-span-1 text-left">
            <h2 className="text-base font-bold flex items-center gap-2 border-b border-base-200 pb-2 text-base-content">
              <Users className="text-primary size-5" />
              Detalles del Perfil
            </h2>
            <div className="space-y-3 pt-1 text-xs">
              <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                <span className="text-base-content/50">Cédula</span>
                <span className="font-bold font-mono">{driver.nationalId}</span>
              </div>
              <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                <span className="text-base-content/50">Celular</span>
                <span className="font-semibold">
                  {driver.phone || "No Registrado"}
                </span>
              </div>
              <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                <span className="text-base-content/50">Tipo de Licencia</span>
                <span className="badge badge-outline badge-sm font-semibold">
                  {driver.licenseType || "No Declarada"}
                </span>
              </div>
              <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                <span className="text-base-content/50">Fecha Creación</span>
                <span className="font-medium text-base-content/75">
                  {new Date(driver.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>
              <div className="flex justify-between border-b border-base-200/40 pb-1.5">
                <span className="text-base-content/50">Cuenta Vinculada</span>
                <span className="font-medium">
                  {driver.userId ? (
                    <span className="text-success font-bold flex items-center gap-1">
                      <UserCheck className="size-3" />
                      Vinculada (ID: {driver.userId.slice(0, 8)}...)
                    </span>
                  ) : (
                    <span className="text-base-content/40 italic">
                      Shadow Profile
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Assignments Timeline */}
          <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4 lg:col-span-2 text-left">
            <h2 className="text-base font-bold flex items-center gap-2 border-b border-base-200 pb-2 text-base-content">
              <Car className="text-primary size-5" />
              Historial de Vehículos Operados
            </h2>

            {activeAssignment == null && historicalAssignments.length === 0 ? (
              <div className="space-y-4">
                {/* Available Assignment Form */}
                {!activeAssignment && (
                  <div className="bg-base-200/50 border border-base-300 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="size-5 text-base-content/45" />
                      <div>
                        <span className="text-xs font-bold text-base-content/85 block">
                          Sin Vehículo Asignado
                        </span>
                        <span className="text-[10px] text-base-content/50 mt-0.5 block">
                          Asigna una unidad libre de la flota para comenzar a
                          registrar viajes.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        disabled={isAssigning}
                        className="select select-sm select-bordered rounded-xl bg-base-100 focus:outline-none flex-1 text-xs"
                      >
                        <option value="">
                          Seleccionar vehículo disponible...
                        </option>
                        {availableVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.alias || "Sin Alias"} ({v.plateNumber})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssign}
                        disabled={isAssigning || !selectedVehicleId}
                        className="btn btn-sm btn-primary rounded-xl text-white font-bold"
                      >
                        {isAssigning ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Asignar Vehículo"
                        )}
                      </button>
                    </div>
                    {assignError && (
                      <span className="text-xs text-error font-medium block mt-1">
                        {assignError}
                      </span>
                    )}
                  </div>
                )}

                <div className="py-8 flex flex-col items-center justify-center text-center text-base-content/40 border border-dashed border-base-300 rounded-xl bg-base-100/20">
                  <Car className="size-12 opacity-35 mb-2" />
                  <span className="text-sm font-bold">
                    Sin historial de vehículos
                  </span>
                  <span className="text-xs max-w-[200px] mt-1">
                    Este conductor no ha operado ningún vehículo en la flota.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {activeAssignment && (
                  <div className="bg-success/5 border border-success/20 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-success/10 rounded-xl text-success">
                        <Truck className="size-6" />
                      </div>
                      <div>
                        <span className="badge badge-success badge-xs text-white font-bold mb-1">
                          ASIGNACIÓN ACTIVA
                        </span>
                        <h4 className="font-bold text-sm text-base-content">
                          {activeAssignment.vehicle.alias || "Sin Alias"} (
                          {activeAssignment.vehicle.plateNumber})
                        </h4>
                        <p className="text-[10px] text-base-content/55 font-medium mt-0.5">
                          Desde el:{" "}
                          {new Date(activeAssignment.from).toLocaleString(
                            "es-ES",
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnassign(activeAssignment.vehicleId)}
                      disabled={isUnassigning}
                      className="btn btn-sm btn-error btn-outline rounded-xl w-full sm:w-auto shrink-0"
                    >
                      {isUnassigning ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Desvincular Vehículo"
                      )}
                    </button>
                  </div>
                )}

                {!activeAssignment && (
                  <div className="bg-base-200/50 border border-base-300 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="size-5 text-base-content/45" />
                      <div>
                        <span className="text-xs font-bold text-base-content/85 block">
                          Sin Vehículo Asignado
                        </span>
                        <span className="text-[10px] text-base-content/50 mt-0.5 block">
                          Asigna una unidad libre de la flota para comenzar a
                          registrar viajes.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        disabled={isAssigning}
                        className="select select-sm select-bordered rounded-xl bg-base-100 focus:outline-none flex-1 text-xs"
                      >
                        <option value="">
                          Seleccionar vehículo disponible...
                        </option>
                        {availableVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.alias || "Sin Alias"} ({v.plateNumber})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssign}
                        disabled={isAssigning || !selectedVehicleId}
                        className="btn btn-sm btn-primary rounded-xl text-white font-bold"
                      >
                        {isAssigning ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Asignar Vehículo"
                        )}
                      </button>
                    </div>
                    {assignError && (
                      <span className="text-xs text-error font-medium block mt-1">
                        {assignError}
                      </span>
                    )}
                  </div>
                )}

                {historicalAssignments.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider pl-0.5">
                      Historial Pasado
                    </h3>
                    {historicalAssignments.map((a: any) => (
                      <div
                        key={a.id}
                        className="border border-base-200 bg-base-100/50 p-4 rounded-xl flex items-center gap-3"
                      >
                        <div className="p-3 bg-base-200/50 rounded-xl text-base-content/40">
                          <Truck className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-base-content truncate">
                            {a.vehicle.alias || "Sin Alias"} (
                            {a.vehicle.plateNumber})
                          </h4>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-base-content/50 font-medium mt-1">
                            <span>
                              Desde:{" "}
                              {new Date(a.from).toLocaleDateString("es-ES")}
                            </span>
                            <span>
                              Hasta:{" "}
                              {new Date(a.to).toLocaleDateString("es-ES")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SCORES HISTORY */}
      {activeTab === "scores" && (
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4 text-left">
          <h2 className="text-base font-bold flex items-center gap-2 border-b border-base-200 pb-2 text-base-content">
            <Calendar className="text-primary size-5" />
            Historial de Puntajes Semanales
          </h2>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table
              columns={scoreColumns}
              data={driver.scoreSnapshots || []}
              keyExtractor={(snap, index) => index.toString()}
              className="table table-compact w-full text-xs"
              wrapperClassName="overflow-x-auto"
              emptyState={
                <span className="text-base-content/40 py-6 block text-center italic text-xs">
                  Aún no se han acumulado snapshots semanales para este
                  conductor.
                </span>
              }
            />
          </div>

          {/* Mobile Accordion View */}
          <div className="space-y-3 md:hidden">
            {driver.scoreSnapshots && driver.scoreSnapshots.length > 0 ? (
              driver.scoreSnapshots.map((snap: any, index: number) => {
                const isExpanded = expandedWeek === index;
                const formattedOverall = Math.round(snap.overallScore);
                const weeklyKm = snap.totalKm ?? 0;

                return (
                  <div
                    key={index}
                    className={`bg-base-100/50 border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isExpanded
                        ? "border-primary/30 shadow-md"
                        : "border-base-200 hover:border-base-300"
                    }`}
                  >
                    <div
                      className="px-4 py-3 flex justify-between items-center cursor-pointer select-none"
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

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-base-200/40 space-y-3 animate-in fade-in duration-200">
                        <div className="grid grid-cols-2 gap-0 bg-base-200/40 rounded-xl overflow-hidden text-center mt-2">
                          <div className="p-3">
                            <span className="text-[10px] text-base-content/40 uppercase font-bold block">
                              Distancia
                            </span>
                            <span className="text-sm font-black text-base-content block mt-0.5">
                              {weeklyKm.toFixed(1)} km
                            </span>
                          </div>
                          <div className="p-3 border-l border-base-300/40">
                            <span className="text-[10px] text-base-content/40 uppercase font-bold block">
                              Tiempo
                            </span>
                            <span className="text-sm font-black text-base-content block mt-0.5">
                              {formatHours(snap.totalHours)}
                            </span>
                          </div>
                        </div>

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
      )}

      {/* TAB: TRIPS EXPLORER */}
      {activeTab === "trips" && (
        <div className="card bg-transparent sm:bg-base-100/60 backdrop-blur-none sm:backdrop-blur-sm border-none sm:border border-base-200 p-0 sm:p-4 space-y-4 shadow-none sm:shadow-md">
          <div className="flex items-center gap-2 border-b border-base-200 pb-2 text-left px-2">
            <Route className="text-primary size-5" />
            <h2 className="text-base font-bold text-base-content">
              Explorador de Viajes del Conductor
            </h2>
          </div>

          <div className="h-[600px] lg:h-[650px]">
            <TripsHistoryView
              initialTrips={trips}
              isDriverCentric={true}
              driverContextName={displayName}
            />
          </div>
        </div>
      )}

      {/* TAB: DAILY ACTIVITY */}
      {activeTab === "rollups" && (
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4 text-left">
          <h2 className="text-base font-bold flex items-center gap-2 border-b border-base-200 pb-2 text-base-content">
            <Activity className="text-primary size-5" />
            Registro de Actividad Diaria
          </h2>

          {dailyReports.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-base-content/40">
              <Activity className="size-12 opacity-35 mb-2" />
              <span className="text-sm font-bold">
                Sin actividad registrada
              </span>
              <span className="text-xs max-w-[200px] mt-1">
                La actividad diaria aparecerá una vez que se reciban tramos de
                telemetría.
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {reportsGroupedByVehicle.map((g, index) => {
                const groupKey = g.vehicleId || "no-vehicle";
                const isExpanded =
                  expandedVehicles[groupKey] !== undefined
                    ? expandedVehicles[groupKey]
                    : index === 0;

                return (
                  <div
                    key={groupKey}
                    className={`bg-base-100/50 border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isExpanded
                        ? "border-primary/30 shadow-md"
                        : "border-base-200 hover:border-base-300"
                    }`}
                  >
                    <div
                      className="px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center cursor-pointer select-none gap-2 hover:bg-base-200/20 transition-colors"
                      onClick={() => toggleVehicle(groupKey)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <Truck className="size-5" />
                        </div>
                        <div>
                          <span className="text-sm font-black text-base-content">
                            {g.vehicleAlias}
                          </span>
                          {g.vehiclePlate && (
                            <span className="text-xs text-base-content/50 font-mono ml-2">
                              [{g.vehiclePlate}]
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="flex gap-3 text-xs text-base-content/60 font-mono">
                          <span>
                            <strong>{g.totalKm.toFixed(1)}</strong> km
                          </span>
                          <span className="text-base-content/20">|</span>
                          <span>
                            <strong>{formatHours(g.totalHours)}</strong>
                          </span>
                        </div>
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronUp className="size-4 text-base-content/40" />
                          ) : (
                            <ChevronDown className="size-4 text-base-content/40" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-base-200/40 animate-in fade-in duration-200 space-y-4">
                        {/* Desktop view: Table */}
                        <div className="hidden lg:block">
                          <Table
                            columns={dailyReportColumnsNoVehicle}
                            data={g.reports}
                            keyExtractor={(day) => day.id}
                            className="table table-compact w-full text-xs"
                            wrapperClassName="overflow-x-auto"
                            pagination={g.reports.length > 5}
                            pageSize={5}
                          />
                        </div>

                        {/* Mobile view: Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
                          {g.reports.map(renderDailyReportCardNoVehicle)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
