"use client";

import {
  ScoreSnapshot,
  SimpleDriver,
  VehicleTripsTrip,
} from "@/types";
import { useState, useEffect, Suspense, useCallback } from "react";
import api from "@/utils/client/api-client";
import TripsHistoryView from "@/components/TripsHistoryView";
import {
  Loader2,
  Calendar,
  ShieldCheck,
  Leaf,
  Activity,
  FileText,
  Truck,
  Info,
  UserCheck,
  Clock,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { ScoreProgressBar } from "@/components/ui/ScoreProgressBar";
import type { RuleDeductionDetail, ScoreBreakdown } from "@/types";
import { BackButton } from "@/components/ui/BackButton";
import { formatHours } from "@/utils/client";

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const { role: userRole } = useAuth();

  const isManagementRole =
    userRole === ROLES.OWNER ||
    userRole === ROLES.ADMIN ||
    userRole === ROLES.SUPER_ADMIN;

  // Driver states
  const [drivers, setDrivers] = useState<SimpleDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("me");
  const [driverSnapshots, setDriverSnapshots] = useState<ScoreSnapshot[]>([]);

  // Page layout states
  const [activeTab, setActiveTab] = useState<"breakdown" | "daily">(
    "breakdown",
  );
  const [isLoadingDriver, setIsLoadingDriver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Score breakdown tab states
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(""); // Format: YYYY-WW
  const [breakdownData, setBreakdownData] = useState<ScoreBreakdown | null>(
    null,
  );
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);

  // Trips tab states
  const [driverTrips, setDriverTrips] = useState<VehicleTripsTrip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);

  // Fetch directory of drivers for selection
  const fetchDrivers = useCallback(async () => {
    if (!isManagementRole) return;
    try {
      const url = targetOrgId
        ? `/drivers?targetOrgId=${targetOrgId}`
        : "/drivers";
      const { data } = await api.get(url);
      setDrivers(data);
      // Auto-select first driver if any
      if (data.length > 0) {
        setSelectedDriverId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching drivers", err);
      setErrorMsg("Error al cargar la lista de conductores.");
    }
  }, [isManagementRole, targetOrgId]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Load selected driver snapshots (available weeks)
  const fetchDriverStats = useCallback(async () => {
    // Si es un rol administrativo y el ID es 'me', esperamos a cargar la lista de conductores
    // y asignar el primero real para evitar llamadas erróneas a /drivers/me
    if (isManagementRole && selectedDriverId === "me") {
      return;
    }

    setIsLoadingDriver(true);
    setErrorMsg(null);
    setDriverSnapshots([]);
    setBreakdownData(null);
    setSelectedWeekKey("");

    try {
      const endpoint =
        selectedDriverId === "me"
          ? "/drivers/me/stats"
          : `/drivers/${selectedDriverId}`;
      const { data } = await api.get(endpoint);

      const snaps = data.scoreSnapshots || [];
      setDriverSnapshots(snaps);

      if (snaps.length > 0) {
        // Pre-select most recent week
        const latest = snaps[0];
        const key = `${latest.year}-${latest.weekNumber}`;
        setSelectedWeekKey(key);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.response?.data?.message || "Error al cargar perfil de conductor.",
      );
    } finally {
      setIsLoadingDriver(false);
    }
  }, [selectedDriverId]);

  useEffect(() => {
    fetchDriverStats();
  }, [fetchDriverStats]);

  // Load Score breakdown for selected week
  const fetchScoreBreakdown = useCallback(async () => {
    if (!selectedWeekKey) {
      setBreakdownData(null);
      return;
    }
    const [year, week] = selectedWeekKey.split("-").map(Number);
    setIsLoadingBreakdown(true);
    try {
      const endpoint =
        selectedDriverId === "me"
          ? `/drivers/me/score-breakdown?year=${year}&week=${week}`
          : `/drivers/${selectedDriverId}/score-breakdown?year=${year}&week=${week}`;

      const { data } = await api.get(endpoint);
      setBreakdownData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingBreakdown(false);
    }
  }, [selectedWeekKey, selectedDriverId]);

  useEffect(() => {
    if (activeTab === "breakdown") {
      fetchScoreBreakdown();
    }
  }, [fetchScoreBreakdown, activeTab]);

  // Load Driver trips
  const fetchDriverTrips = useCallback(async () => {
    // Si es un rol administrativo y el ID es 'me', no consultamos viajes hasta tener el conductor real
    if (isManagementRole && selectedDriverId === "me") {
      return;
    }

    setIsLoadingTrips(true);
    try {
      const endpoint =
        selectedDriverId === "me"
          ? "/drivers/me/trips"
          : `/drivers/${selectedDriverId}/trips`;

      const { data } = await api.get(endpoint);
      setDriverTrips(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTrips(false);
    }
  }, [selectedDriverId]);

  useEffect(() => {
    if (activeTab === "daily") {
      fetchDriverTrips();
    }
  }, [fetchDriverTrips, activeTab]);

  const renderRuleList = (
    rules: RuleDeductionDetail[],
    pillar: "SAFETY" | "EFFICIENCY" | "ASSET_CARE",
  ) => {
    const filtered = rules.filter(
      (r) => r.pillar === pillar && r.occurrences > 0,
    );

    if (filtered.length === 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-success bg-success/5 border border-success/10 p-3 rounded-xl mt-2">
          <UserCheck className="size-4 shrink-0" />
          <span>
            ¡Excelente conducción! Sin eventos detectados ni penalizaciones en
            esta categoría.
          </span>
        </div>
      );
    }

    return (
      <div className="space-y-2 mt-2">
        {filtered.map((rule, idx) => {
          const isIdling = rule.code === "EXCESSIVE_IDLING";
          const isUnplugged = rule.code === "DEVICE_UNPLUGGED";
          const qtyText = isIdling
            ? formatHours(rule.occurrences / 4)
            : isUnplugged
              ? `${rule.occurrences} ${rule.occurrences === 1 ? "día" : "días"} (-20 pts/día)`
              : `${rule.occurrences} ${rule.occurrences === 1 ? "vez" : "veces"}`;

          return (
            <div
              key={idx}
              className="flex justify-between items-center bg-base-200/50 hover:bg-base-200 border border-base-300/40 p-3 rounded-xl transition-all duration-200"
            >
              <div>
                <span className="text-xs font-bold text-base-content block">
                  {rule.label}
                </span>
                <span className="text-[10px] text-base-content/50 font-medium">
                  {qtyText}{" "}
                  {rule.severity > 0 &&
                    `(Severidad: ${rule.severity.toFixed(1)})`}
                </span>
              </div>
              <span className="text-xs font-black text-rose-500 font-mono">
                -{rule.appliedDeduction.toFixed(1)} pts
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`p-6 max-w-7xl mx-auto ${activeTab === "daily"
        ? "lg:h-[calc(100vh-48px)] lg:overflow-hidden lg:flex lg:flex-col lg:space-y-4"
        : "space-y-6"
        }`}
    >
      {/* Volver */}
      <div>
        {isManagementRole ? (
          <BackButton
            fallbackHref={
              targetOrgId ? `/admin?targetOrgId=${targetOrgId}` : "/admin"
            }
          >
            Volver a administración
          </BackButton>
        ) : (
          <BackButton fallbackHref="/">Volver al Dashboard</BackButton>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <FileText className="text-primary size-7" />
            Reportes y Diagnósticos
          </h1>
          <p className="text-base-content/60 text-sm">
            Consulta el log diario de telemetría y el desglose de los puntajes
            semanales de conducción.
          </p>
        </div>

        {/* Driver Selector for Admins */}
        {isManagementRole && drivers.length > 0 && (
          <div className="form-control min-w-[250px]">
            <label className="label py-1">
              <span className="label-text font-bold text-xs">
                Seleccionar Conductor
              </span>
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="select select-bordered select-sm w-full bg-base-100"
              disabled={isLoadingDriver}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.nationalId})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="alert alert-error shadow-lg">
          <AlertTriangle className="size-6 text-white shrink-0" />
          <span className="text-white font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Tab Controls */}
      <div className="tabs tabs-boxed bg-base-200/50 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab("breakdown")}
          className={`tab tab-sm font-bold flex-1 py-2 h-auto rounded-lg ${activeTab === "breakdown" ? "tab-active bg-primary text-white" : "text-base-content/60"}`}
        >
          Explicación de Puntaje
        </button>
        <button
          onClick={() => setActiveTab("daily")}
          className={`tab tab-sm font-bold flex-1 py-2 h-auto rounded-lg ${activeTab === "daily" ? "tab-active bg-primary text-white" : "text-base-content/60"}`}
        >
          Historial de Viajes
        </button>
      </div>

      {isLoadingDriver ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando perfil del conductor...
          </p>
        </div>
      ) : (
        <>
          {/* Tab 1: Score Breakdown */}
          {activeTab === "breakdown" && (
            <div className="space-y-6">
              {/* Dropdown week selector */}
              {driverSnapshots.length > 0 ? (
                <div className="flex items-center gap-3 bg-base-100/50 backdrop-blur-md p-4 rounded-xl border border-base-200 max-w-sm">
                  <Calendar className="size-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="text-[10px] text-base-content/40 font-bold block uppercase tracking-wider">
                      Período de Evaluación
                    </span>
                    <select
                      value={selectedWeekKey}
                      onChange={(e) => setSelectedWeekKey(e.target.value)}
                      className="select select-ghost select-xs font-bold text-base-content p-0 focus:bg-transparent h-auto min-h-0 border-none w-full"
                    >
                      {driverSnapshots.map((snap, idx) => {
                        const val = `${snap.year}-${snap.weekNumber}`;
                        return (
                          <option key={idx} value={val}>
                            Año {snap.year} - Semana {snap.weekNumber} (Score:{" "}
                            {Math.round(snap.overallScore)} pts)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-base-100/30 rounded-2xl border border-dashed border-base-300">
                  <Info className="size-12 text-base-content/20 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-base-content">
                    Sin snapshots de puntaje
                  </h3>
                  <p className="text-xs text-base-content/50 max-w-xs mx-auto mt-1">
                    El conductor aún no cuenta con calificaciones semanales
                    calculadas por el sistema.
                  </p>
                </div>
              )}

              {/* Breakdown display */}
              {isLoadingBreakdown ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-base-content/50">
                    Cargando desglose de puntaje...
                  </p>
                </div>
              ) : (
                breakdownData && (
                  <div className="space-y-6">
                    {/* Global stats banner */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Score Card */}
                      <div className="card bg-base-100/50 border border-base-200 p-6 flex flex-col items-center justify-center text-center shadow-xl">
                        <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mb-2">
                          Puntaje de la Semana
                        </span>
                        <RadialScoreGauge
                          score={breakdownData.overallScore}
                          title=""
                          noCard
                          size="lg"
                        />
                      </div>

                      {/* Stats widgets */}
                      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="card bg-base-100/50 border border-base-200 p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-primary/20">
                          <div className="p-3.5 bg-primary/10 text-primary rounded-xl">
                            <MapPin className="size-6" />
                          </div>
                          <div>
                            <span className="text-xs text-base-content/40 font-bold uppercase tracking-wider block">
                              Distancia recorrida
                            </span>
                            <span className="text-xl font-black text-base-content block mt-0.5">
                              {breakdownData.totalKm} km
                            </span>
                          </div>
                        </div>

                        <div className="card bg-base-100/50 border border-base-200 p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-primary/20">
                          <div className="p-3.5 bg-primary/10 text-primary rounded-xl">
                            <Clock className="size-6" />
                          </div>
                          <div>
                            <span className="text-xs text-base-content/40 font-bold uppercase tracking-wider block">
                              Horas al volante
                            </span>
                            <span className="text-xl font-black text-base-content block mt-0.5">
                              {formatHours(breakdownData.totalHours)}
                            </span>
                          </div>
                        </div>

                        <div className="card bg-base-100/50 border border-base-200 p-6 flex flex-row items-center gap-4 transition-all duration-300 hover:border-primary/20">
                          <div className="p-3.5 bg-primary/10 text-primary rounded-xl">
                            <Clock className="size-6" />
                          </div>
                          <div>
                            <span className="text-xs text-base-content/40 font-bold uppercase tracking-wider block">
                              Tiempo en ralentí
                            </span>
                            <span className="text-xl font-black text-base-content block mt-0.5">
                              {formatHours(breakdownData.idlingHours)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vehicles driven lists */}
                    <div className="space-y-4">
                      <h2 className="text-sm font-bold text-base-content/60 uppercase tracking-wider px-1">
                        Desglose de Penalizaciones y Conducción
                      </h2>

                      {breakdownData.vehicles.map((vBreak, vIdx) => (
                        <div
                          key={vIdx}
                          className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 shadow-md space-y-6"
                        >
                          {/* Vehicle Title */}
                          <div className="flex justify-between items-center border-b border-base-200/60 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
                                <Truck className="size-5" />
                              </div>
                              <div>
                                <span className="font-bold text-base-content block">
                                  {vBreak.vehicleAlias || "Sin Alias"}
                                </span>
                                <span className="text-xs text-base-content/40 font-mono font-medium">
                                  {vBreak.vehiclePlate} ({vBreak.totalKm} km
                                  conducidos)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Pillars detailed breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Pillar 1: Safety */}
                            <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-base-200/50 pb-4 md:pb-0 md:pr-6">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="size-5 text-emerald-500" />
                                  <span className="text-xs font-black uppercase tracking-wider text-base-content/75">
                                    Seguridad Vial
                                  </span>
                                </div>
                                <ScoreProgressBar
                                  score={vBreak.scores.safetyScore}
                                  label=""
                                />
                                <div className="text-[10px] text-base-content/40 font-bold uppercase mt-1">
                                  Límite / Penalizaciones:
                                </div>
                                {renderRuleList(
                                  vBreak.ruleDeductions,
                                  "SAFETY",
                                )}
                              </div>
                            </div>

                            {/* Pillar 2: Efficiency */}
                            <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-base-200/50 pb-4 md:pb-0 md:px-6">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Leaf className="size-5 text-emerald-500" />
                                  <span className="text-xs font-black uppercase tracking-wider text-base-content/75">
                                    Eficiencia Ecológica
                                  </span>
                                </div>
                                <ScoreProgressBar
                                  score={vBreak.scores.ecoScore}
                                  label=""
                                />
                                <div className="text-[10px] text-base-content/40 font-bold uppercase mt-1">
                                  Límite / Penalizaciones:
                                </div>
                                {renderRuleList(
                                  vBreak.ruleDeductions,
                                  "EFFICIENCY",
                                )}
                              </div>
                            </div>

                            {/* Pillar 3: Asset Care */}
                            <div className="flex flex-col justify-between md:pl-6">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Activity className="size-5 text-emerald-500" />
                                  <span className="text-xs font-black uppercase tracking-wider text-base-content/75">
                                    Cuidado del Vehículo
                                  </span>
                                </div>
                                <ScoreProgressBar
                                  score={vBreak.scores.assetScore}
                                  label=""
                                />
                                <div className="text-[10px] text-base-content/40 font-bold uppercase mt-1">
                                  Límite / Penalizaciones:
                                </div>
                                {renderRuleList(
                                  vBreak.ruleDeductions,
                                  "ASSET_CARE",
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Tab 2: Historial de Viajes */}
          {activeTab === "daily" && (
            <div className="flex-grow min-h-0 flex flex-col">
              {isLoadingTrips ? (
                <div className="flex flex-col items-center justify-center flex-grow py-20 gap-4 bg-base-100/50 border border-base-200 rounded-2xl">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-base-content/50">
                    Cargando viajes del conductor...
                  </p>
                </div>
              ) : (
                <div className="flex-grow min-h-0">
                  <TripsHistoryView
                    initialTrips={driverTrips}
                    isDriverCentric={true}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando página de reportes...
          </p>
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
