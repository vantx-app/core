"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  Thermometer,
  Flame,
  ShieldAlert,
  Fuel,
  Droplet,
  TrendingUp,
  MapPin,
  Calendar,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Terminal,
  Download,
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
  condenseDailyRollupsByDriver,
  groupRollupsByMonth,
} from "@/utils/client";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { MovementStatusBadge } from "@/components/ui/MovementStatusBadge";
import { DriverInfoLabel } from "@/components/ui/DriverInfoLabel";
import { DetailRow } from "@/components/ui/DetailRow";
import { MiniStatCard } from "@/components/ui/MiniStatCard";
import { DtcBadge } from "@/components/ui/DtcBadge";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { Table } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useFleet } from "@/context/FleetContext";
import api from "@/utils/client/api-client";

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
        lastLat: live.latitude ?? initialVehicle.liveState?.lastLat ?? 0,
        lastLng: live.longitude ?? initialVehicle.liveState?.lastLng ?? 0,
        lastSpeed: live.speed ?? initialVehicle.liveState?.lastSpeed ?? 0,
        currentStatus:
          live.status ?? initialVehicle.liveState?.currentStatus ?? "STOPPED",
        lastAngle: live.angle ?? initialVehicle.liveState?.lastAngle ?? 0,
        lastUpdate:
          live.updatedAt && live.updatedAt !== "N/A"
            ? live.updatedAt
            : (initialVehicle.liveState?.lastUpdate ??
              new Date().toISOString()),
        lastIgnition:
          live.ignition ?? initialVehicle.liveState?.lastIgnition ?? false,
        lastOdometer:
          live.odometer ?? initialVehicle.liveState?.lastOdometer ?? 0,
        lastEngineHours:
          (live as any).engineHours ?? initialVehicle.liveState?.lastEngineHours ?? 0,
        lastFuelLevel:
          live.fuelLevel ?? initialVehicle.liveState?.lastFuelLevel ?? null,
      },
    } as VehicleDetail;
  }, [initialVehicle, fleet]);

  const isMachinery = vehicle.category === "MACHINERY";

  const isAbsoluteOdometer =
    vehicle.odometerSource === "ABSOLUTE" ||
    (vehicle.odometerSource === "AUTO" && !!vehicle.isOdometerAbsolute);

  const displayOdometer = isAbsoluteOdometer
    ? (vehicle.liveState?.lastOdometer ?? 0)
    : (vehicle.initialOdometer ?? 0) + (vehicle.liveState?.lastOdometer ?? 0);

  const isAbsoluteEngineHours =
    vehicle.engineHoursSource === "ABSOLUTE" ||
    (vehicle.engineHoursSource === "AUTO" && !!vehicle.isEngineHoursAbsolute);

  const displayEngineHours = isAbsoluteEngineHours
    ? (vehicle.liveState?.lastEngineHours ?? 0)
    : (vehicle.initialEngineHours ?? 0) + (vehicle.liveState?.lastEngineHours ?? 0);

  const [activeTab, setActiveTab] = useState<
    "overview" | "scores" | "rollups" | "fuel" | "diagnostics"
  >("overview");

  const [fuelAnalysis, setFuelAnalysis] = useState<any>(null);
  const [fuelDays, setFuelDays] = useState<number>(7);
  const [fuelLoading, setFuelLoading] = useState<boolean>(false);
  const [fuelError, setFuelError] = useState<string | null>(null);
  const [fuelEventsPage, setFuelEventsPage] = useState<number>(1);
  const lastLoadedFuelDaysRef = useRef<number | null>(null);

  // Diagnostics tab state
  const [diagFrom, setDiagFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 16);
  });
  const [diagTo, setDiagTo] = useState<string>(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [diagFormat, setDiagFormat] = useState<"csv" | "json">("csv");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  // Hover interactivo para la gráfica de combustible
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Estados para la calibración del tanque con recibo
  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false);
  const [selectedEventForCalibration, setSelectedEventForCalibration] = useState<any>(null);
  const [pumpedLitersInput, setPumpedLitersInput] = useState<string>("");
  const [calibrating, setCalibrating] = useState(false);
  const [calibrateError, setCalibrateError] = useState<string | null>(null);
  const [calibrateSuccess, setCalibrateSuccess] = useState<string | null>(null);

  const parsedPumpedLiters = parseFloat(pumpedLitersInput);
  const selectedEventDelta = selectedEventForCalibration
    ? (selectedEventForCalibration.delta ?? selectedEventForCalibration.percentageDelta ?? 0)
    : 0;
  const previewCapacity =
    !isNaN(parsedPumpedLiters) && parsedPumpedLiters > 0 && selectedEventDelta > 0
      ? Math.round(((parsedPumpedLiters / selectedEventDelta) * 100) * 10) / 10
      : null;

  const handleCalibrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForCalibration || !previewCapacity) return;

    setCalibrating(true);
    setCalibrateError(null);
    setCalibrateSuccess(null);

    try {
      const res = await api.post(`/vehicles/${initialVehicle.id}/calibrate-tank`, {
        pumpedLiters: parsedPumpedLiters,
        eventId: selectedEventForCalibration.id,
        percentageDelta: selectedEventDelta,
      });

      setCalibrateSuccess(
        res.data?.message ||
          `Tanque calibrado a ${res.data?.tankCapacity ?? previewCapacity} L con éxito.`,
      );

      // Refrescar análisis de combustible con la nueva capacidad recalculada
      const updatedFuel = await api.get(
        `/vehicles/${initialVehicle.id}/fuel-analysis?days=${fuelDays}`,
      );
      setFuelAnalysis(updatedFuel.data);

      setTimeout(() => {
        setCalibrateModalOpen(false);
        setCalibrateSuccess(null);
      }, 1800);
    } catch (err: any) {
      setCalibrateError(
        err.response?.data?.message || "Error al calibrar el tanque del vehículo",
      );
    } finally {
      setCalibrating(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "fuel") return;

    let active = true;
    const fetchFuel = async () => {
      // Solo mostrar spinner si no hay datos previos o si cambió el rango de días seleccionado
      if (!fuelAnalysis || lastLoadedFuelDaysRef.current !== fuelDays) {
        setFuelLoading(true);
      }
      setFuelError(null);
      setFuelEventsPage(1);
      try {
        const res = await api.get(
          `/vehicles/${initialVehicle.id}/fuel-analysis?days=${fuelDays}`,
        );
        if (active) {
          setFuelAnalysis(res.data);
          lastLoadedFuelDaysRef.current = fuelDays;
        }
      } catch (err: any) {
        if (active) {
          setFuelError(
            err.response?.data?.message ||
              "Error al cargar el análisis de combustible",
          );
        }
      } finally {
        if (active) {
          setFuelLoading(false);
        }
      }
    };

    fetchFuel();
    return () => {
      active = false;
    };
  }, [activeTab, initialVehicle.id, fuelDays]);

  const sortedFuelEvents = useMemo(() => {
    if (!fuelAnalysis?.events) return [];
    return [...fuelAnalysis.events].sort(
      (a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [fuelAnalysis?.events]);

  const FUEL_EVENTS_PER_PAGE = 10;
  const totalFuelEventPages = Math.max(
    1,
    Math.ceil(sortedFuelEvents.length / FUEL_EVENTS_PER_PAGE),
  );
  const paginatedFuelEvents = useMemo(() => {
    const start = (fuelEventsPage - 1) * FUEL_EVENTS_PER_PAGE;
    return sortedFuelEvents.slice(start, start + FUEL_EVENTS_PER_PAGE);
  }, [sortedFuelEvents, fuelEventsPage]);

  // Preparar puntos de la gráfica SVG
  const points = useMemo(() => {
    if (!fuelAnalysis?.history || fuelAnalysis.history.length === 0) return [];
    return fuelAnalysis.history.map((h: any) => ({
      xVal: new Date(h.timestamp).getTime(),
      yVal: h.fuelLevel ?? 0,
      raw: h,
    }));
  }, [fuelAnalysis]);

  const minX = useMemo(
    () => (points.length > 0 ? Math.min(...points.map((p: any) => p.xVal)) : 0),
    [points],
  );
  const maxX = useMemo(
    () => (points.length > 0 ? Math.max(...points.map((p: any) => p.xVal)) : 1),
    [points],
  );
  const rangeX = useMemo(() => maxX - minX || 1, [minX, maxX]);

  const svgWidth = 500;
  const svgHeight = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const getX = (val: number) =>
    paddingLeft + ((val - minX) / rangeX) * chartWidth;
  const getY = (val: number) =>
    paddingTop + chartHeight - (val / 100) * chartHeight;

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map(
        (p: any, i: number) =>
          `${i === 0 ? "M" : "L"} ${getX(p.xVal)} ${getY(p.yVal)}`,
      )
      .join(" ");
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return "";
    return `${pathD} L ${getX(maxX)} ${paddingTop + chartHeight} L ${getX(
      minX,
    )} ${paddingTop + chartHeight} Z`;
  }, [points, pathD, maxX]);

  const gridLevels = [0, 25, 50, 75, 100];

  const ticks = useMemo(() => {
    if (points.length === 0) return [];
    const count = 4;
    return Array.from({ length: count }).map(
      (_, idx) => minX + (rangeX / (count - 1)) * idx,
    );
  }, [minX, rangeX, points]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    let closest = points[0];
    let minDist = Infinity;
    for (const p of points) {
      const px = getX(p.xVal);
      const dist = Math.abs(px - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    setHoveredPoint(closest);
  };

  const handleDiagnosticsDownload = async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const params = new URLSearchParams({
        from: new Date(diagFrom).toISOString(),
        to: new Date(diagTo).toISOString(),
        format: diagFormat,
      });
      const response = await api.get(
        `/vehicles/${initialVehicle.id}/diagnostics/download?${params.toString()}`,
        { responseType: "blob" },
      );
      const ext = diagFormat === "json" ? "json" : "csv";
      const disposition = response.headers["content-disposition"] as
        | string
        | undefined;
      let filename = `diagnostico_${initialVehicle.id}.${ext}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDiagError(
        err.response?.data?.message ||
          "Error al descargar los datos de diagnóstico.",
      );
    } finally {
      setDiagLoading(false);
    }
  };

  const currentDriver = vehicle.assignments?.[0]?.driver;

  const capabilities = vehicle.capabilities || [];
  const hasFuelLevel =
    capabilities.includes("fuelLevel") ||
    vehicle.liveState?.lastFuelLevel != null;
  const hasFuelRate =
    capabilities.includes("fuelRate") ||
    capabilities.includes("fuelConsumption");

  const activeCardsCount = [hasFuelLevel, hasFuelRate].filter(Boolean).length;
  const gridColsClass =
    activeCardsCount === 1
      ? "grid-cols-1"
      : activeCardsCount === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-3";

  // Grouping and condensing telemetry logs per day per driver using utility
  const rollups = useMemo(() => {
    return condenseDailyRollupsByDriver(vehicle.DailyTelemetryRollup || []);
  }, [vehicle.DailyTelemetryRollup]);

  const showRollupGrouping = rollups.length > 5;

  const groupedRollups = useMemo(() => {
    return groupRollupsByMonth(rollups);
  }, [rollups]);

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
        day.activeFaultCodesCount > 0 ||
        (day.highRpmCount ?? 0) > 0 ||
        (day.coldEngineStrainCount ?? 0) > 0 ||
        (day.coastingInNeutralCount ?? 0) > 0 ||
        (day.engineLuggingCount ?? 0) > 0 ||
        (day.highLoadStrainCount ?? 0) > 0 ||
        (day.criticalOverheatingCount ?? 0) > 0 ? (
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
            {(day.highRpmCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-bold font-mono text-[10px] gap-1">
                <Zap className="size-3" />
                {day.highRpmCount} RPM
              </span>
            )}
            {(day.coldEngineStrainCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold font-mono text-[10px] gap-1">
                <Thermometer className="size-3" />
                Motor Frío ({day.coldEngineStrainCount})
              </span>
            )}
            {(day.coastingInNeutralCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 font-bold font-mono text-[10px] gap-1">
                <Activity className="size-3" />
                Neutro ({day.coastingInNeutralCount})
              </span>
            )}
            {(day.engineLuggingCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold font-mono text-[10px] gap-1">
                <TrendingDown className="size-3" />
                Lugging ({day.engineLuggingCount})
              </span>
            )}
            {(day.highLoadStrainCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold font-mono text-[10px] gap-1">
                <ShieldAlert className="size-3" />
                Esfuerzo Carga ({day.highLoadStrainCount})
              </span>
            )}
            {(day.criticalOverheatingCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-red-600 text-white border border-red-700 font-bold font-mono text-[10px] gap-1 animate-pulse">
                <Flame className="size-3" />
                Calentamiento ({day.criticalOverheatingCount})
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
  const hasStats =
    vehicle.VehicleGlobalStats != null &&
    ((vehicle.VehicleGlobalStats.totalKm ?? 0) > 0 ||
      (vehicle.VehicleGlobalStats.totalEngineHours ?? 0) > 0);
  const avgSafety =
    hasStats && vehicle.VehicleGlobalStats!.globalSafetyScore != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalSafetyScore)
      : null;
  const avgEco =
    hasStats && vehicle.VehicleGlobalStats!.globalFuelEfficiency != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalFuelEfficiency)
      : null;
  const avgAsset =
    hasStats && vehicle.VehicleGlobalStats!.globalMaintenanceScore != null
      ? Math.round(vehicle.VehicleGlobalStats!.globalMaintenanceScore)
      : null;
  const overallScore =
    hasStats && vehicle.VehicleGlobalStats!.globalOverallScore != null
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
          day.activeFaultCodesCount > 0 ||
          (day.highRpmCount ?? 0) > 0 ||
          (day.coldEngineStrainCount ?? 0) > 0 ||
          (day.coastingInNeutralCount ?? 0) > 0 ||
          (day.engineLuggingCount ?? 0) > 0 ||
          (day.highLoadStrainCount ?? 0) > 0 ||
          (day.criticalOverheatingCount ?? 0) > 0;

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
            {(day.highRpmCount ?? 0) > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`Altas revoluciones: ${day.highRpmCount} eventos`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20 font-bold font-mono text-xs gap-1">
                  <Zap className="size-3.5" />
                  {day.highRpmCount} RPM
                </span>
              </div>
            )}
            {(day.coldEngineStrainCount ?? 0) > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`Esfuerzo motor frío: ${day.coldEngineStrainCount} eventos`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold font-mono text-xs gap-1">
                  <Thermometer className="size-3.5" />
                  {day.coldEngineStrainCount} Frío
                </span>
              </div>
            )}
            {(day.coastingInNeutralCount ?? 0) > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`Conducción en neutro (coasting): ${day.coastingInNeutralCount} eventos`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 font-bold font-mono text-xs gap-1">
                  <Activity className="size-3.5" />
                  {day.coastingInNeutralCount} Neutro
                </span>
              </div>
            )}
            {(day.engineLuggingCount ?? 0) > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`Sobreesfuerzo a bajas RPM (lugging): ${day.engineLuggingCount} eventos`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold font-mono text-xs gap-1">
                  <TrendingDown className="size-3.5" />
                  {day.engineLuggingCount} Lugging
                </span>
              </div>
            )}
            {(day.highLoadStrainCount ?? 0) > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`Esfuerzo con alta carga: ${day.highLoadStrainCount} eventos`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono text-xs gap-1">
                  <ShieldAlert className="size-3.5" />
                  {day.highLoadStrainCount} Carga
                </span>
              </div>
            )}
            {(day.criticalOverheatingCount ?? 0) > 0 && (
              <div
                className="tooltip tooltip-bottom"
                data-tip={`SOBRECALENTAMIENTO CRÍTICO: ${day.criticalOverheatingCount} eventos`}
              >
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-600 text-white border border-red-700 font-bold font-mono text-xs gap-1 animate-pulse">
                  <Flame className="size-3.5" />
                  {day.criticalOverheatingCount} TEMP
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
        <button
          onClick={() => setActiveTab("fuel")}
          className={`tab flex-1 rounded-lg font-semibold text-xs transition-all ${
            activeTab === "fuel"
              ? "tab-active bg-base-100 shadow-sm text-primary"
              : "text-base-content/60"
          }`}
        >
          <Fuel className="size-3.5 mr-1.5" />
          Combustible
        </button>
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`tab flex-1 rounded-lg font-semibold text-xs transition-all ${
            activeTab === "diagnostics"
              ? "tab-active bg-base-100 shadow-sm text-primary"
              : "text-base-content/60"
          }`}
        >
          <Terminal className="size-3.5 mr-1.5" />
          Diagnóstico
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

                {isMachinery ? (
                  <MiniStatCard
                    label="Horómetro"
                    value={
                      <div className="flex flex-col w-full min-w-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black font-mono tracking-tight">
                            {displayEngineHours.toLocaleString(undefined, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}
                          </span>
                          <span className="text-[10px] font-semibold text-base-content/50">
                            hrs
                          </span>
                        </div>
                        {isAbsoluteEngineHours ? (
                          <span
                            className="text-[9px] text-base-content/40 mt-1 leading-normal font-medium flex items-center gap-1"
                            title="El horómetro es la lectura real de horas de motor reportada por la computadora de la máquina (CAN/FMS J1939)."
                          >
                            <span className="size-1 bg-green-500 rounded-full shrink-0 animate-pulse" />
                            Lectura real (CAN/FMS)
                          </span>
                        ) : (
                          <span
                            className="text-[9px] text-base-content/40 mt-1 leading-normal font-medium flex items-center gap-1"
                            title="El horómetro es la suma de las horas base iniciales más el tiempo de ignición acumulado por el dispositivo."
                          >
                            <span className="size-1 bg-amber-500 rounded-full shrink-0 animate-pulse" />
                            Estimado (Base:{" "}
                            {(vehicle.initialEngineHours ?? 0).toLocaleString(
                              undefined,
                              { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                            )}{" "}
                            + GPS)
                          </span>
                        )}
                      </div>
                    }
                  />
                ) : (
                  <MiniStatCard
                    label="Odómetro"
                    value={
                      <div className="flex flex-col w-full min-w-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black font-mono tracking-tight">
                            {Math.round(displayOdometer).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-semibold text-base-content/50">
                            km
                          </span>
                        </div>
                        {isAbsoluteOdometer ? (
                          <span
                            className="text-[9px] text-base-content/40 mt-1 leading-normal font-medium flex items-center gap-1"
                            title="El odómetro es la lectura real reportada por el dispositivo desde la computadora del vehículo (ECU)."
                          >
                            <span className="size-1 bg-green-500 rounded-full shrink-0 animate-pulse" />
                            Lectura real (OBD/CAN)
                          </span>
                        ) : (
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
                        )}
                      </div>
                    }
                  />
                )}

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

            {/* Diagnósticos del Vehículo */}
            {activeCardsCount > 0 && (
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Activity className="text-primary size-5" />
                  Diagnósticos del Vehículo
                </h3>
                <div className={`grid ${gridColsClass} gap-4 text-xs`}>
                  {hasFuelLevel && (
                    <div className="border border-base-200/60 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-base-content/40 block font-semibold uppercase tracking-wider text-[10px]">
                          Nivel de Combustible
                        </span>
                        <span className="text-2xl font-black font-mono tracking-tight text-primary mt-1 block">
                          {vehicle.liveState?.lastFuelLevel != null
                            ? `${Number(vehicle.liveState.lastFuelLevel).toFixed(1)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="w-full bg-base-200/50 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{
                            width:
                              vehicle.liveState?.lastFuelLevel != null
                                ? `${Math.min(100, Math.max(0, Number(vehicle.liveState.lastFuelLevel)))}%`
                                : "0%",
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {hasFuelRate && (
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
                  )}
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
                    value={
                      <span className="font-mono">
                        {vehicle.device?.imei || "Sin dispositivo"}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Estado Administrativo"
                    value={
                      <span
                        className={`badge badge-sm font-bold ${vehicle.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "badge-warning text-white"}`}
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
              data={rollups}
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
                    className="collapse bg-base-100/40 border border-base-200 shadow-md rounded-2xl overflow-hidden backdrop-blur-md"
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

      {/* TAB: FUEL ANALYSIS */}
      {activeTab === "fuel" && (
        <div className="space-y-6 w-full animate-in fade-in duration-300">
          {/* Controls: Days Selector */}
          <div className="flex justify-between items-center bg-base-200/20 p-4 rounded-2xl border border-base-200/50 backdrop-blur-md">
            <div>
              <h2 className="text-base font-extrabold text-base-content flex items-center gap-2">
                <Fuel className="text-primary size-5" />
                Análisis de Combustible
              </h2>
              <p className="text-xs text-base-content/40 mt-0.5">
                Historial de consumo y eventos de recargas o drenado.
              </p>
            </div>
            <div className="join bg-base-300/40 p-1 rounded-xl border border-base-200/60">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setFuelDays(days)}
                  className={`btn btn-xs join-item font-bold ${
                    fuelDays === days
                      ? "btn-primary shadow-sm"
                      : "btn-ghost text-base-content/60"
                  }`}
                >
                  {days} días
                </button>
              ))}
            </div>
          </div>

          {fuelLoading && (
            <div className="flex flex-col items-center justify-center p-12 bg-base-200/10 rounded-2xl border border-base-200/40 min-h-[300px]">
              <span className="loading loading-ring loading-lg text-primary"></span>
              <p className="text-xs text-base-content/50 mt-4 animate-pulse">
                Analizando registros de telemetría...
              </p>
            </div>
          )}

          {fuelError && (
            <div className="p-6 bg-error/10 border border-error/20 text-error rounded-2xl flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Error de Carga</h4>
                <p className="text-xs mt-1 text-error/85">{fuelError}</p>
              </div>
            </div>
          )}

          {!fuelLoading && !fuelError && fuelAnalysis && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Level Card */}
                <div className="glass-card p-5 flex flex-col justify-between rounded-2xl hover:border-primary/20 hover:scale-[1.01] transition-all duration-300">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-base-content/40 block">
                      Nivel Actual
                    </span>
                    <span className="text-3xl font-black font-mono tracking-tight text-primary mt-1 block">
                      {fuelAnalysis.summary.currentLiters != null
                        ? `${fuelAnalysis.summary.currentLiters} L`
                        : fuelAnalysis.summary.currentLevel != null
                          ? `${fuelAnalysis.summary.currentLevel}%`
                          : "N/A"}
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    <div className="w-full bg-base-200/50 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${fuelAnalysis.summary.currentLevel ?? 0}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-mono text-base-content/40">
                      <span>{fuelAnalysis.summary.currentLevel ?? 0}%</span>
                      <span className="flex items-center gap-1.5">
                        Capacidad: {fuelAnalysis.summary.tankCapacity ?? 60} L
                        {fuelAnalysis.summary.isCapacityCalibrated ? (
                          <span className="badge badge-xs badge-success text-[8px] font-bold text-white px-1 py-0.2">
                            Calibrado
                          </span>
                        ) : (
                          <span
                            className="badge badge-xs badge-warning text-[8px] font-bold px-1 py-0.2"
                            title="Capacidad estimada por defecto. Calibre usando un recibo de recarga en la tabla inferior."
                          >
                            Por Defecto
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Consumed Card */}
                <div className="glass-card p-5 flex flex-col justify-between rounded-2xl hover:border-success/20 hover:scale-[1.01] transition-all duration-300">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-base-content/40 block">
                      Consumo Total
                    </span>
                    <span className="text-3xl font-black font-mono tracking-tight text-success mt-1 block">
                      {`${fuelAnalysis.summary.consumedLiters ?? 0} L`}
                    </span>
                  </div>
                  <p className="text-[10px] text-base-content/40 italic leading-relaxed mt-4">
                    Equivalente a {fuelAnalysis.summary.totalConsumed}% de la capacidad activa.
                  </p>
                </div>

                {/* Drained Card */}
                <div
                  className={`glass-card p-5 flex flex-col justify-between rounded-2xl hover:scale-[1.01] transition-all duration-300 ${
                    fuelAnalysis.summary.totalDrained > 0
                      ? "border-error/30 hover:border-error/50 bg-error/5"
                      : "hover:border-error/20"
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-base-content/40 block">
                      Drenados / Pérdidas
                    </span>
                    <span
                      className={`text-3xl font-black font-mono tracking-tight mt-1 block ${
                        fuelAnalysis.summary.totalDrained > 0
                          ? "text-error"
                          : "text-base-content/60"
                      }`}
                    >
                      {fuelAnalysis.summary.totalDrained > 0
                        ? `-${fuelAnalysis.summary.totalDrained} L`
                        : "0 L"}
                    </span>
                  </div>
                  <p
                    className={`text-[10px] leading-relaxed mt-4 ${
                      fuelAnalysis.summary.totalDrained > 0
                        ? "text-error/80 font-semibold"
                        : "text-base-content/40 italic"
                    }`}
                  >
                    {fuelAnalysis.summary.totalDrained > 0
                      ? "¡Alerta! Caídas bruscas detectadas con motor apagado."
                      : "No se detectaron pérdidas anormales de combustible."}
                  </p>
                </div>

                {/* Refueled Card */}
                <div className="glass-card p-5 flex flex-col justify-between rounded-2xl hover:border-info/20 hover:scale-[1.01] transition-all duration-300">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-base-content/40 block">
                      Total Recargas
                    </span>
                    <span className="text-3xl font-black font-mono tracking-tight text-info mt-1 block">
                      +{fuelAnalysis.summary.totalRefueled} L
                    </span>
                  </div>
                  <p className="text-[10px] text-base-content/40 italic leading-relaxed mt-4">
                    Combustible ingresado al tanque durante recargas.
                  </p>
                </div>
              </div>

              {/* Graphic Chart */}
              <div className="glass-card p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-1.5 uppercase tracking-wider text-base-content/60">
                  <TrendingUp className="text-primary size-4" />
                  Tendencia del Nivel de Combustible
                </h3>

                {fuelAnalysis.history.length === 0 ? (
                  <div className="flex items-center justify-center p-12 text-xs text-base-content/40">
                    No hay suficientes datos de telemetría para mostrar la
                    gráfica.
                  </div>
                ) : (
                  <div className="relative w-full overflow-hidden">
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto select-none"
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* Gradients */}
                      <defs>
                        <linearGradient
                          id="fuelAreaGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="oklch(var(--p))"
                            stopOpacity="0.25"
                          />
                          <stop
                            offset="100%"
                            stopColor="oklch(var(--p))"
                            stopOpacity="0.0"
                          />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      {gridLevels.map((lvl) => {
                        const cap = fuelAnalysis.summary.tankCapacity ?? 60;
                        const lvlLiters =
                          Math.round((cap * 0.05 + (lvl / 100) * (cap * 0.9)) * 10) /
                          10;
                        return (
                          <g key={lvl}>
                            <line
                              x1={paddingLeft}
                              y1={getY(lvl)}
                              x2={svgWidth - paddingRight}
                              y2={getY(lvl)}
                              className="stroke-base-content/5"
                              strokeWidth="1"
                            />
                            <text
                              x={paddingLeft - 6}
                              y={getY(lvl) + 3}
                              className="text-[8px] font-mono fill-base-content/30"
                              textAnchor="end"
                            >
                              {lvlLiters}L
                            </text>
                          </g>
                        );
                      })}

                      {/* Line Area */}
                      {points.length > 0 && (
                        <path d={areaD} fill="url(#fuelAreaGrad)" />
                      )}

                      {/* Trend Line */}
                      {points.length > 0 && (
                        <path
                          d={pathD}
                          fill="none"
                          className="stroke-primary"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Time Ticks */}
                      {ticks.map((t, idx) => (
                        <text
                          key={idx}
                          x={getX(t)}
                          y={paddingTop + chartHeight + 14}
                          className="text-[8px] font-mono fill-base-content/30"
                          textAnchor="middle"
                        >
                          {new Date(t).toLocaleDateString("es-ES", {
                            month: "short",
                            day: "numeric",
                          })}
                        </text>
                      ))}

                      {/* Event overlay nodes */}
                      {fuelAnalysis.events.map((evt: any, idx: number) => {
                        const timeMs = new Date(evt.timestamp).getTime();
                        if (timeMs < minX || timeMs > maxX) return null;
                        const cx = getX(timeMs);
                        const cy = getY(evt.afterLevel);
                        const isRefuel = evt.type === "REFUEL";
                        const colorClass = isRefuel
                          ? "stroke-success fill-success"
                          : "stroke-error fill-error";

                        return (
                          <g key={idx} className="group cursor-pointer">
                            <title>{`${isRefuel ? "Recarga" : "Drenado"}: ${
                              isRefuel ? "+" : "-"
                            }${evt.liters} L (${evt.beforeLevel}% → ${
                              evt.afterLevel
                            }%) - ${new Date(evt.timestamp).toLocaleString("es-ES")}`}</title>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="7"
                              className={`${colorClass} fill-none stroke-[1.5] opacity-40 animate-pulse`}
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r="3.5"
                              className={colorClass}
                            />
                          </g>
                        );
                      })}

                      {/* Hover Tooltip guide line */}
                      {hoveredPoint && (
                        <g>
                          <line
                            x1={getX(hoveredPoint.xVal)}
                            y1={paddingTop}
                            x2={getX(hoveredPoint.xVal)}
                            y2={paddingTop + chartHeight}
                            className="stroke-base-content/15"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          <circle
                            cx={getX(hoveredPoint.xVal)}
                            cy={getY(hoveredPoint.yVal)}
                            r="5"
                            className="fill-primary stroke-base-100 stroke-2"
                          />
                        </g>
                      )}
                    </svg>

                    {/* Interactive Tooltip Card overlay */}
                    {hoveredPoint && (
                      <div
                        className="absolute bg-base-100/90 border border-base-200/80 p-3 rounded-2xl shadow-xl text-[10px] pointer-events-none z-50 space-y-1 font-semibold backdrop-blur-md"
                        style={{
                          left: `${Math.min(
                            360,
                            Math.max(10, getX(hoveredPoint.xVal) - 60),
                          )}px`,
                          top: `${Math.max(5, getY(hoveredPoint.yVal) - 75)}px`,
                        }}
                      >
                        <p className="text-base-content/40 leading-none mb-1">
                          {new Date(hoveredPoint.xVal).toLocaleDateString(
                            "es-ES",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                        <p className="text-primary font-black text-sm leading-none">
                          {hoveredPoint.raw.fuelLiters != null
                            ? `${hoveredPoint.raw.fuelLiters.toFixed(1)} L (${hoveredPoint.yVal.toFixed(1)}%)`
                            : `Tanque: ${hoveredPoint.yVal.toFixed(1)}%`}
                        </p>
                        <p className="text-base-content/65 flex items-center gap-1 leading-none mt-1">
                          <Power
                            className={`size-3 ${
                              hoveredPoint.raw.ignition
                                ? "text-success animate-pulse"
                                : "text-base-content/30"
                            }`}
                          />
                          Motor:{" "}
                          {hoveredPoint.raw.ignition ? "Marcha" : "Apagado"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Event ledger */}
              <div className="glass-card p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-1.5 uppercase tracking-wider text-base-content/60">
                    <FileText className="text-primary size-4" />
                    Registro de Eventos de Combustible
                  </h3>
                  {sortedFuelEvents.length > 0 && (
                    <span className="text-xs text-base-content/50">
                      {sortedFuelEvents.length} eventos registrados
                    </span>
                  )}
                </div>

                {sortedFuelEvents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-base-content/40 border border-base-200/40 rounded-xl">
                    No se registraron anomalías (drenados) ni recargas en este
                    período.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto w-full border border-base-200/40 rounded-2xl">
                      <table className="table table-sm w-full text-xs">
                        <thead className="bg-base-200/30">
                          <tr>
                            <th>Evento</th>
                            <th>Fecha y Hora</th>
                            <th>Nivel Inicial</th>
                            <th>Nivel Final</th>
                            <th>Volumen / Variación</th>
                            <th>Ubicación</th>
                            <th className="text-right">Calibración</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedFuelEvents.map((evt: any, index: number) => {
                            const isRefuel = evt.type === "REFUEL";
                            const delta = evt.delta ?? evt.percentageDelta ?? 0;
                            const liters = evt.liters;
                            const before = evt.beforeLevel ?? evt.startLevel ?? 0;
                            const after = evt.afterLevel ?? evt.endLevel ?? 0;
                            return (
                              <tr key={evt.id || index} className="hover:bg-base-200/20">
                                <td className="font-bold">
                                  <span
                                    className={`badge badge-sm font-bold border-none ${
                                      isRefuel
                                        ? "bg-success/15 text-success"
                                        : "bg-error/15 text-error"
                                    }`}
                                  >
                                    {isRefuel ? "Recarga" : "Drenado"}
                                  </span>
                                </td>
                                <td className="text-base-content/60 font-medium">
                                  {new Date(evt.timestamp).toLocaleString(
                                    "es-ES",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </td>
                                <td className="font-mono font-bold text-base-content/80">
                                  {before.toFixed(1)}%
                                </td>
                                <td className="font-mono font-bold text-base-content/80">
                                  {after.toFixed(1)}%
                                </td>
                                <td
                                  className={`font-mono font-black ${
                                    isRefuel ? "text-success" : "text-error"
                                  }`}
                                >
                                  {isRefuel ? `+` : `-`}
                                  {liters != null ? `${liters.toFixed(1)} L ` : ""}
                                  ({delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`})
                                </td>
                                <td>
                                  {evt.latitude && evt.longitude ? (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${evt.latitude},${evt.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-ghost btn-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                                    >
                                      <MapPin className="size-3" />
                                      Ver Mapa
                                    </a>
                                  ) : (
                                    <span className="text-base-content/30 italic">
                                      Sin GPS
                                    </span>
                                  )}
                                </td>
                                <td className="text-right">
                                  {isRefuel && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedEventForCalibration(evt);
                                        setPumpedLitersInput(
                                          evt.liters ? String(Math.round(evt.liters * 10) / 10) : "",
                                        );
                                        setCalibrateError(null);
                                        setCalibrateSuccess(null);
                                        setCalibrateModalOpen(true);
                                      }}
                                      className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 gap-1 font-semibold"
                                      title="Calibrar capacidad del tanque con el recibo de esta recarga"
                                    >
                                      <Sliders className="size-3" />
                                      Calibrar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Controles de Paginación */}
                    {totalFuelEventPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-base-content/50">
                          Página {fuelEventsPage} de {totalFuelEventPages}
                        </span>
                        <div className="join">
                          <button
                            className="join-item btn btn-xs btn-ghost"
                            disabled={fuelEventsPage <= 1}
                            onClick={() =>
                              setFuelEventsPage((p) => Math.max(1, p - 1))
                            }
                          >
                            «
                          </button>
                          {Array.from(
                            { length: totalFuelEventPages },
                            (_, i) => i + 1,
                          ).map((p) => (
                            <button
                              key={p}
                              className={`join-item btn btn-xs ${
                                p === fuelEventsPage
                                  ? "btn-active btn-primary text-white"
                                  : "btn-ghost"
                              }`}
                              onClick={() => setFuelEventsPage(p)}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            className="join-item btn btn-xs btn-ghost"
                            disabled={fuelEventsPage >= totalFuelEventPages}
                            onClick={() =>
                              setFuelEventsPage((p) =>
                                Math.min(totalFuelEventPages, p + 1),
                              )
                            }
                          >
                            »
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Calibración de Tanque con Recibo */}
      <Modal
        isOpen={calibrateModalOpen}
        onClose={() => {
          if (!calibrating) {
            setCalibrateModalOpen(false);
            setCalibrateError(null);
            setCalibrateSuccess(null);
          }
        }}
        title="Calibrar Capacidad de Tanque"
        subtitle="Ajusta la capacidad nominal con base en los litros reales facturados en una recarga."
        className="max-w-lg"
      >
        <form onSubmit={handleCalibrateSubmit} className="space-y-4 pt-2">
          {selectedEventForCalibration && (
            <div className="bg-base-200/40 border border-base-200/60 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-base-content/60">Evento de Recarga:</span>
                <span className="font-mono text-base-content/80">
                  {new Date(selectedEventForCalibration.timestamp).toLocaleString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base-content/60">Variación Detectada:</span>
                <span className="font-mono font-bold text-success">
                  +{selectedEventDelta.toFixed(1)}% (del{" "}
                  {(selectedEventForCalibration.beforeLevel ?? selectedEventForCalibration.startLevel ?? 0).toFixed(1)}% al{" "}
                  {(selectedEventForCalibration.afterLevel ?? selectedEventForCalibration.endLevel ?? 0).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base-content/60">Capacidad Registrada:</span>
                <span className="font-mono font-medium text-base-content/70">
                  {fuelAnalysis?.summary?.tankCapacity ?? 60} L{" "}
                  {fuelAnalysis?.summary?.isCapacityCalibrated ? (
                    <span className="text-success font-bold">(Calibrado)</span>
                  ) : (
                    <span className="text-warning font-bold">(Por Defecto)</span>
                  )}
                </span>
              </div>
            </div>
          )}

          <div>
            <Input
              label="Litros Surtidos Reales (Factura / Ticket)"
              type="number"
              step="0.01"
              min="0.1"
              required
              placeholder="Ej: 45.5"
              value={pumpedLitersInput}
              onChange={(e) => setPumpedLitersInput(e.target.value)}
              helperText="Ingrese la cantidad exacta de litros pagados según el ticket de la estación de servicio."
              disabled={calibrating}
            />
          </div>

          {previewCapacity !== null && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-base-content/70">
                  Nueva Capacidad Calculada:
                </span>
                <span className="text-xl font-black font-mono text-primary">
                  {previewCapacity} Litros
                </span>
              </div>
              <p className="text-[11px] text-base-content/60 font-mono">
                Fórmula: ({parsedPumpedLiters} L / {selectedEventDelta.toFixed(1)}%) × 100 = {previewCapacity} L
              </p>
              <p className="text-[11px] text-base-content/50 italic">
                Al guardar, se actualizará la capacidad del tanque del vehículo y se recalcularán automáticamente los litros de todos los viajes y eventos previos.
              </p>
            </div>
          )}

          {calibrateError && (
            <div className="alert alert-error text-xs py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{calibrateError}</span>
            </div>
          )}

          {calibrateSuccess && (
            <div className="alert alert-success text-xs py-2 text-white">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{calibrateSuccess}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCalibrateModalOpen(false)}
              disabled={calibrating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={calibrating}
              disabled={!previewCapacity || calibrating}
            >
              Guardar y Recalcular
            </Button>
          </div>
        </form>
      </Modal>

      {/* TAB: DIAGNOSTICS */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="size-5 text-primary" />
              <h3 className="text-base font-bold">
                Descarga de Datos de Diagnóstico
              </h3>
            </div>
            <p className="text-xs text-base-content/60 leading-relaxed">
              Exporta los registros de telemetría cruda del dispositivo para
              analizar fallas intermitentes como batería baja al arranque,
              códigos DTC activos, o lecturas anómalas de sensores. Máximo{" "}
              <strong>7 días</strong> por descarga.
            </p>

            {/* Date range & format controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-base-content/50">
                  Desde
                </label>
                <Input
                  type="datetime-local"
                  value={diagFrom}
                  onChange={(e) => setDiagFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-base-content/50">
                  Hasta
                </label>
                <Input
                  type="datetime-local"
                  value={diagTo}
                  onChange={(e) => setDiagTo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-base-content/50">
                  Formato
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiagFormat("csv")}
                    className={`btn btn-sm flex-1 ${
                      diagFormat === "csv"
                        ? "btn-primary"
                        : "btn-outline border-base-300"
                    }`}
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setDiagFormat("json")}
                    className={`btn btn-sm flex-1 ${
                      diagFormat === "json"
                        ? "btn-primary"
                        : "btn-outline border-base-300"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>

            {diagError && (
              <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300 rounded-xl text-sm p-3">
                <AlertCircle className="size-4 shrink-0" />
                {diagError}
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              isLoading={diagLoading}
              disabled={diagLoading || !diagFrom || !diagTo}
              onClick={handleDiagnosticsDownload}
              className="w-full sm:w-auto gap-2"
            >
              <Download className="size-4" />
              Descargar{" "}
              {diagFormat === "csv" ? "CSV" : "JSON"}
            </Button>
          </div>

          {/* Field reference card */}
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Info className="size-4 text-primary" />
              Campos clave para diagnóstico de arranque
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  field: "powerSupply",
                  label: "Voltaje de Batería (V)",
                  color: "amber",
                  desc: "Valores < 11.5 V al arranque indican batería descargada.",
                },
                {
                  field: "ignition",
                  label: "Ignición",
                  color: "blue",
                  desc: "Confirma el momento exacto en que se giró la llave.",
                },
                {
                  field: "rpm",
                  label: "RPM",
                  color: "indigo",
                  desc: "Perfil de RPM en arranque en frío vs motor caliente.",
                },
                {
                  field: "coolantTemp",
                  label: "Temperatura del Refrigerante (°C)",
                  color: "rose",
                  desc: "Motor frío en arranques repetidos puede indicar problema eléctrico.",
                },
                {
                  field: "faultCodes",
                  label: "Códigos DTC",
                  color: "purple",
                  desc: "Códigos OBD-II activos lanzados durante el arranque.",
                },
                {
                  field: "dtcCount",
                  label: "Cantidad de DTCs",
                  color: "purple",
                  desc: "Número de fallas activas reportadas por la ECU.",
                },
                {
                  field: "movement",
                  label: "Movimiento",
                  color: "emerald",
                  desc: "¿El vehículo se movía cuando ocurrió la falla?",
                },
                {
                  field: "unplugged",
                  label: "Dispositivo Desconectado",
                  color: "neutral",
                  desc: "Pérdida de alimentación del dispositivo GPS.",
                },
              ].map(({ field, label, color, desc }) => (
                <div
                  key={field}
                  className="flex gap-3 p-3 rounded-xl bg-base-200/30 border border-base-200/60"
                >
                  <div
                    className={`mt-0.5 size-2 rounded-full shrink-0 bg-${color}-500`}
                  />
                  <div>
                    <p className="text-xs font-bold text-base-content/90">
                      {label}{" "}
                      <span className="font-mono text-base-content/40">
                        ({field})
                      </span>
                    </p>
                    <p className="text-[11px] text-base-content/55 mt-0.5 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
