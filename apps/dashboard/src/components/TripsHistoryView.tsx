"use client";

import { Coordinate, VehicleTripsTrip, VehicleTripsVehicle } from "@/types";
import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  User,
  Compass,
  AlertTriangle,
  Loader2,
  Maximize2,
  Minimize2,
  Gauge,
  Zap,
  Truck,
  ArrowLeft,
  Shield,
  Leaf,
  Wrench,
} from "lucide-react";
import api from "@/utils/client/api-client";
import { RadialScoreGauge } from "@/components/ui/RadialScoreGauge";
import { DriverInfoLabel } from "@/components/ui/DriverInfoLabel";
import {
  getLocalDateOnlyLabel,
  formatTripDate,
  formatTimeOnly,
  formatTripDuration,
  getScoreBadgeColor,
  getScoreTextColor,
} from "@/utils/client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";

const TripMap = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  ),
});

interface TripsHistoryViewProps {
  initialTrips: VehicleTripsTrip[];
  vehicleContext?: VehicleTripsVehicle | null;
  driverContextName?: string;
  isDriverCentric?: boolean;
  initialSelectedTripId?: string | null;
}

export default function TripsHistoryView({
  initialTrips,
  vehicleContext,
  driverContextName,
  isDriverCentric = false,
  initialSelectedTripId = null,
}: TripsHistoryViewProps) {
  const [trips, setTrips] = useState<VehicleTripsTrip[]>(initialTrips);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    initialSelectedTripId,
  );
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileMapActive, setIsMobileMapActive] = useState(
    !!initialSelectedTripId,
  );

  useEffect(() => {
    setTrips(initialTrips);
  }, [initialTrips]);

  useEffect(() => {
    if (initialSelectedTripId) {
      setSelectedTripId(initialSelectedTripId);
      setIsMobileMapActive(true);
      if (typeof window !== "undefined" && !window.history.state?.mapActive) {
        window.history.pushState({ mapActive: true }, "");
      }
    }
  }, [initialSelectedTripId]);

  useEffect(() => {
    if (selectedTripId && trips.length > 0) {
      const idx = trips.findIndex((t) => t.id === selectedTripId);
      if (idx !== -1 && idx >= visibleCount) {
        setVisibleCount(idx + 1);
      }
    }
  }, [selectedTripId, trips, visibleCount]);

  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const { role: userRole } = useAuth();

  const isManagementRole =
    userRole === ROLES.OWNER ||
    userRole === ROLES.ADMIN ||
    userRole === ROLES.SUPER_ADMIN;

  const visibleTrips = useMemo(() => {
    return trips.slice(0, visibleCount);
  }, [trips, visibleCount]);

  const groupedTrips = useMemo(() => {
    const groups: Record<string, VehicleTripsTrip[]> = {};
    visibleTrips.forEach((trip) => {
      const label = getLocalDateOnlyLabel(trip.startTime);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(trip);
    });
    return groups;
  }, [visibleTrips]);

  const setFullscreenAnimated = (value: boolean) => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // @ts-ignore
      document.startViewTransition(() => {
        setIsFullscreen(value);
      });
    } else {
      setIsFullscreen(value);
    }
  };

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (isFullscreen) {
      document.body.classList.add("overflow-hidden");
      if (mainEl) {
        mainEl.classList.add("z-[9999]");
        mainEl.classList.remove("z-10");
      }
    } else {
      document.body.classList.remove("overflow-hidden");
      if (mainEl) {
        mainEl.classList.remove("z-[9999]");
        mainEl.classList.add("z-10");
      }
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
      if (mainEl) {
        mainEl.classList.remove("z-[9999]");
        mainEl.classList.add("z-10");
      }
    };
  }, [isFullscreen]);

  // Sincronizar el estado del mapa móvil con el historial de navegación del navegador
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.history.state?.mapActive) {
        setIsMobileMapActive(true);
      }

      const handlePopState = (event: PopStateEvent) => {
        setIsMobileMapActive(!!event.state?.mapActive);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, []);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  useEffect(() => {
    setIsFullscreen(false);
    if (!selectedTripId) {
      setRouteCoordinates([]);
      return;
    }

    const fetchRoute = async () => {
      // El estado de carga ya se activa síncronamente en el clic, pero lo aseguramos aquí.
      setIsLoadingRoute(true);
      setError(null);
      try {
        const vId = selectedTrip?.vehicleId || vehicleContext?.id;
        if (!vId) {
          throw new Error("Vehículo no especificado.");
        }
        const { data } = await api.get(
          `/vehicles/${vId}/trips/${selectedTripId}/route`,
        );
        setRouteCoordinates(data || []);
      } catch (err) {
        console.error("Error al cargar la ruta del viaje:", err);
        setError("No se pudo cargar la ruta del viaje.");
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [selectedTripId, vehicleContext?.id, selectedTrip?.vehicleId]);

  const tripMetrics = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) return null;

    const speeds = routeCoordinates
      .map((c) => c.speed)
      .filter((s) => s != null);
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const avgSpeed =
      speeds.length > 0
        ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
        : 0;

    return {
      maxSpeed,
      avgSpeed,
      pointsCount: routeCoordinates.length,
    };
  }, [routeCoordinates]);

  const handleTripSelection = (tripId: string) => {
    if (tripId === selectedTripId) {
      if (!isMobileMapActive) {
        window.history.pushState({ mapActive: true }, "");
        setIsMobileMapActive(true);
      }
      return;
    }
    // Activamos síncronamente el estado de carga y limpiamos coordenadas previas
    setIsLoadingRoute(true);
    setRouteCoordinates([]);
    setSelectedTripId(tripId);
    if (!isMobileMapActive) {
      window.history.pushState({ mapActive: true }, "");
      setIsMobileMapActive(true);
    }
    // Ya no colapsamos la lista automáticamente al seleccionar para mejorar la navegación
  };

  const renderPaginationControls = () => {
    if (trips.length <= visibleCount) return null;
    return (
      <div className="pt-4 pb-2 px-1 flex flex-col items-center gap-3 border-t border-base-200/40 mt-4">
        <div className="text-[11px] text-base-content/50 font-medium">
          Mostrando{" "}
          <span className="font-bold text-base-content/75">{visibleCount}</span>{" "}
          de{" "}
          <span className="font-bold text-base-content/75">{trips.length}</span>{" "}
          viajes
        </div>
        <div className="w-full bg-base-200/45 dark:bg-base-800/30 h-1 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${(visibleCount / trips.length) * 100}%` }}
          />
        </div>
        <button
          onClick={() =>
            setVisibleCount((prev) => Math.min(prev + 10, trips.length))
          }
          className="btn btn-sm btn-outline border-base-300 hover:bg-base-200 rounded-xl text-xs font-bold text-base-content/85 px-4 w-full"
        >
          Cargar más viajes
        </button>
      </div>
    );
  };

  const renderTripList = () => (
    <>
      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-base-content/40">
          <Compass className="size-12 opacity-30 mb-2" />
          <span className="text-sm font-medium">No hay viajes registrados</span>
          <span className="text-xs max-w-[200px] mt-1">
            Los viajes se crean automáticamente al encender el motor y avanzar.
          </span>
        </div>
      ) : (
        Object.entries(groupedTrips).map(([dateLabel, dayTrips], groupIdx) => {
          const hasSelected = dayTrips.some((t) => t.id === selectedTripId);
          return (
            <div
              key={dateLabel}
              className="collapse collapse-arrow bg-transparent border-b border-base-200/60 rounded-none shadow-none lg:bg-base-200/20 lg:border lg:border-base-200/50 lg:rounded-xl lg:shadow-sm lg:overflow-hidden transition-all"
            >
              <input
                type="checkbox"
                defaultChecked={groupIdx === 0 || hasSelected}
                className="peer"
                aria-label={`Mostrar viajes de ${dateLabel}`}
              />
              <div className="collapse-title text-xs font-black flex items-center justify-between pr-10 text-base-content/85 bg-transparent lg:bg-base-200/35 py-3 px-1 lg:px-4">
                <span className="truncate">{dateLabel}</span>
                <span className="badge badge-sm badge-neutral font-bold font-mono ml-2 border-none">
                  {dayTrips.length}
                </span>
              </div>
              <div className="collapse-content p-1 lg:p-2.5 bg-transparent lg:bg-base-100/5 space-y-2 lg:space-y-2.5">
                {dayTrips.map((trip) => {
                  const isSelected = trip.id === selectedTripId;
                  const isOngoing = !trip.endTime;
                  return (
                    <button
                      key={trip.id}
                      onClick={() => handleTripSelection(trip.id)}
                      className={`w-full text-left p-2.5 lg:p-3 rounded-xl border transition-all duration-200 flex flex-col gap-1.5 lg:gap-2 ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-base-100/60 border-base-200/80 dark:bg-base-900/10 hover:border-base-300 text-base-content"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`badge badge-xs font-black px-1.5 border ${
                              isOngoing
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-600 animate-pulse"
                                : "bg-base-200 border-base-300 text-base-content/70"
                            }`}
                          >
                            {isOngoing ? "En Curso" : "Completado"}
                          </span>
                          {!isOngoing && trip.overallScore != null && (
                            <span
                              className={`badge badge-xs font-black px-1.5 ${getScoreBadgeColor(trip.overallScore)}`}
                            >
                              {Math.round(trip.overallScore)} pts
                            </span>
                          )}
                        </div>
                        <span className="opacity-60 font-mono flex items-center gap-0.5">
                          <Clock className="size-2.5" />
                          {formatTripDuration(trip.startTime, trip.endTime)}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-base-content/85 pl-0.5">
                        {formatTimeOnly(trip.startTime)}
                        {!isOngoing &&
                          trip.endTime &&
                          ` - ${formatTimeOnly(trip.endTime)}`}
                      </div>

                      <div className="divider my-0 opacity-15"></div>

                      <div className="flex items-center justify-between gap-1.5 text-[10px] text-base-content/65 pl-0.5 w-full">
                        {isDriverCentric ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <Truck className="size-3 text-base-content/40 shrink-0" />
                            {isManagementRole &&
                            (trip.vehicleId || trip.vehicle?.id) ? (
                              <Link
                                href={`/vehicle/${trip.vehicleId || trip.vehicle?.id}/view${
                                  targetOrgId
                                    ? `?targetOrgId=${targetOrgId}`
                                    : ""
                                }`}
                                className="truncate font-semibold text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {trip.vehicle?.alias || "Vehículo sin alias"} (
                                {trip.vehicle?.plateNumber})
                              </Link>
                            ) : (
                              <span className="truncate font-semibold">
                                {trip.vehicle?.alias || "Vehículo sin alias"} (
                                {trip.vehicle?.plateNumber})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 min-w-0">
                            <User className="size-3 text-base-content/40 shrink-0" />
                            {isManagementRole && trip.driver?.id ? (
                              <Link
                                href={`/reports?driverId=${trip.driver.id}&tab=daily${
                                  targetOrgId
                                    ? `&targetOrgId=${targetOrgId}`
                                    : ""
                                }`}
                                className="flex flex-col text-left group hover:underline text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="font-bold">
                                  {trip.driver.firstName && trip.driver.lastName
                                    ? `${trip.driver.firstName} ${trip.driver.lastName}`
                                    : trip.driver.nationalId}
                                </span>
                                {trip.driver.firstName &&
                                  trip.driver.lastName && (
                                    <span className="text-[10px] text-base-content/40 font-mono">
                                      {trip.driver.nationalId}
                                    </span>
                                  )}
                              </Link>
                            ) : (
                              <DriverInfoLabel
                                driver={trip.driver}
                                className="truncate"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </>
  );

  const renderStatsOverlay = (variant: "panel-flat" | "fullscreen") => {
    if (!tripMetrics || !selectedTrip) return null;

    const overallScore = selectedTrip.overallScore;
    const isOngoing = !selectedTrip.endTime;
    const badgeColorClass =
      overallScore != null
        ? `${getScoreBadgeColor(overallScore)} font-black`
        : "bg-neutral text-neutral-content font-black";

    if (variant === "fullscreen") {
      return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-[45] pointer-events-none">
          <div className="bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-4 flex flex-col gap-3.5 pointer-events-auto">
            {/* Card Header: Entity Info and Overall Score */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                  {isDriverCentric ? "Vehículo" : "Conductor"}
                </span>
                <div className="font-bold text-base-content/90 flex items-center gap-1.5 text-xs mt-0.5 min-w-0">
                  {isDriverCentric ? (
                    <>
                      <Truck className="size-3.5 text-primary shrink-0" />
                      {isManagementRole &&
                      (selectedTrip.vehicleId || selectedTrip.vehicle?.id) ? (
                        <Link
                          href={`/vehicle/${selectedTrip.vehicleId || selectedTrip.vehicle?.id}/view${
                            targetOrgId ? `?targetOrgId=${targetOrgId}` : ""
                          }`}
                          className="truncate text-primary hover:underline font-semibold"
                        >
                          {selectedTrip.vehicle?.alias || "Sin Alias"} (
                          {selectedTrip.vehicle?.plateNumber})
                        </Link>
                      ) : (
                        <span className="truncate">
                          {selectedTrip.vehicle?.alias || "Sin Alias"} (
                          {selectedTrip.vehicle?.plateNumber})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <User className="size-3.5 text-primary shrink-0" />
                      {isManagementRole && selectedTrip.driver?.id ? (
                        <Link
                          href={`/reports?driverId=${selectedTrip.driver.id}&tab=daily${
                            targetOrgId ? `?targetOrgId=${targetOrgId}` : ""
                          }`}
                          className="truncate text-primary hover:underline font-semibold"
                        >
                          {selectedTrip.driver.firstName &&
                          selectedTrip.driver.lastName
                            ? `${selectedTrip.driver.firstName} ${selectedTrip.driver.lastName}`
                            : selectedTrip.driver.nationalId}
                        </Link>
                      ) : (
                        <DriverInfoLabel
                          driver={selectedTrip.driver}
                          showNationalId={false}
                          className="inline-block font-bold text-xs truncate"
                        />
                      )}
                    </>
                  )}
                </div>
                <span className="text-[9px] text-base-content/50 font-bold uppercase mt-1">
                  Fecha y Hora
                </span>
                <span className="font-bold text-[10px] text-base-content/85 font-mono mt-0.5">
                  {formatTripDate(selectedTrip.startTime)}
                </span>
              </div>
              {overallScore != null && (
                <div className="text-center shrink-0 flex flex-col items-center">
                  <span className="text-[9px] text-base-content/40 font-bold uppercase tracking-tight block leading-none mb-1">
                    Puntaje
                  </span>
                  <span
                    className={`inline-flex items-center justify-center text-xs h-7 min-w-[2.25rem] px-2 rounded-lg font-black ${badgeColorClass}`}
                  >
                    {Math.round(overallScore)}
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-base-200"></div>

            {/* Card Body: 3x2 Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Duración */}
              <div className="bg-base-200/30 p-2 rounded-xl border border-base-200/50 flex flex-col items-center justify-center">
                <span className="text-[9px] text-base-content/45 block font-bold uppercase tracking-tight">
                  Duración
                </span>
                <span className="font-bold text-xs text-base-content/90 font-mono block mt-0.5">
                  {formatTripDuration(
                    selectedTrip.startTime,
                    selectedTrip.endTime,
                  )}
                </span>
              </div>

              {/* V. Promedio */}
              <div className="bg-base-200/30 p-2 rounded-xl border border-base-200/50 flex flex-col items-center justify-center">
                <span className="text-[9px] text-base-content/45 block font-bold uppercase tracking-tight">
                  V. Promedio
                </span>
                <span className="font-bold text-xs text-base-content/90 font-mono block mt-0.5">
                  {tripMetrics.avgSpeed}{" "}
                  <span className="text-[8px] font-normal font-sans">km/h</span>
                </span>
              </div>

              {/* V. Máxima */}
              <div className="bg-base-200/30 p-2 rounded-xl border border-base-200/50 flex flex-col items-center justify-center">
                <span className="text-[9px] text-rose-500/70 block font-bold uppercase tracking-tight">
                  V. Máxima
                </span>
                <span className="font-bold text-xs text-rose-500 font-mono block mt-0.5">
                  {tripMetrics.maxSpeed}{" "}
                  <span className="text-[8px] font-normal font-sans">km/h</span>
                </span>
              </div>

              {overallScore != null && (
                <>
                  {/* Seguridad */}
                  <div className="bg-base-200/30 p-2 rounded-xl border border-base-200/50 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-base-content/45 block font-bold uppercase tracking-tight">
                      Seguridad
                    </span>
                    <span className="font-bold text-xs text-base-content/90 font-mono block mt-0.5">
                      {selectedTrip.safetyScore != null
                        ? Math.round(selectedTrip.safetyScore)
                        : "-"}
                    </span>
                  </div>

                  {/* Eco */}
                  <div className="bg-base-200/30 p-2 rounded-xl border border-base-200/50 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-base-content/45 block font-bold uppercase tracking-tight">
                      Eco
                    </span>
                    <span className="font-bold text-xs text-base-content/90 font-mono block mt-0.5">
                      {selectedTrip.ecoScore != null
                        ? Math.round(selectedTrip.ecoScore)
                        : "-"}
                    </span>
                  </div>

                  {/* Cuidado */}
                  <div className="bg-base-200/30 p-2 rounded-xl border border-base-200/50 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-base-content/45 block font-bold uppercase tracking-tight">
                      Cuidado
                    </span>
                    <span className="font-bold text-xs text-base-content/90 font-mono block mt-0.5">
                      {selectedTrip.assetScore != null
                        ? Math.round(selectedTrip.assetScore)
                        : "-"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full bg-base-100 dark:bg-base-950/20 border-t border-base-200/70 p-5 flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Summary Block */}
        <div className="flex items-center gap-5 shrink-0 w-full lg:w-auto lg:pr-8 lg:border-r border-base-200/50">
          <div className="shrink-0 scale-95 origin-center">
            <RadialScoreGauge
              score={overallScore}
              title="Puntaje"
              size="md"
              noCard={true}
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1 py-1">
            <span className="text-[10px] text-base-content/40 font-black uppercase tracking-wider">
              {isDriverCentric ? "Vehículo" : "Conductor"}
            </span>
            <div className="font-bold text-base-content/85 flex items-center gap-1.5 text-sm mt-1 min-w-0">
              {isDriverCentric ? (
                <>
                  <Truck className="size-4 text-primary shrink-0" />
                  {isManagementRole &&
                  (selectedTrip.vehicleId || selectedTrip.vehicle?.id) ? (
                    <Link
                      href={`/vehicle/${selectedTrip.vehicleId || selectedTrip.vehicle?.id}/view${targetOrgId ? `?targetOrgId=${targetOrgId}` : ""}`}
                      className="truncate text-primary hover:underline font-bold text-sm"
                    >
                      {selectedTrip.vehicle?.alias || "Sin Alias"} (
                      {selectedTrip.vehicle?.plateNumber})
                    </Link>
                  ) : (
                    <span className="truncate text-sm">
                      {selectedTrip.vehicle?.alias || "Sin Alias"} (
                      {selectedTrip.vehicle?.plateNumber})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <User className="size-4 text-primary shrink-0" />
                  {isManagementRole && selectedTrip.driver?.id ? (
                    <Link
                      href={`/reports?driverId=${selectedTrip.driver.id}&tab=daily${targetOrgId ? `?targetOrgId=${targetOrgId}` : ""}`}
                      className="truncate text-primary hover:underline font-bold text-sm"
                    >
                      {selectedTrip.driver.firstName &&
                      selectedTrip.driver.lastName
                        ? `${selectedTrip.driver.firstName} ${selectedTrip.driver.lastName}`
                        : selectedTrip.driver.nationalId}
                    </Link>
                  ) : (
                    <DriverInfoLabel
                      driver={selectedTrip.driver}
                      showNationalId={false}
                      className="inline-block font-bold text-sm truncate"
                    />
                  )}
                </>
              )}
            </div>

            <span className="text-[10px] text-base-content/40 font-black uppercase tracking-wider mt-3">
              Fecha y Hora
            </span>
            <span className="font-bold text-xs text-base-content/75 font-mono mt-1">
              {formatTripDate(selectedTrip.startTime)}
            </span>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`badge badge-sm font-black px-2 py-0.5 border ${
                  isOngoing
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-600 animate-pulse"
                    : "bg-base-200 border-base-300 text-base-content/70"
                }`}
              >
                {isOngoing ? "En Curso" : "Completado"}
              </span>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {/* Duración */}
          <div className="bg-base-200/15 dark:bg-base-900/10 hover:bg-base-200/30 dark:hover:bg-base-900/20 border border-base-200/50 dark:border-base-800/20 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-300">
            <div className="flex items-center justify-between w-full gap-2 text-base-content/40">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Duración
              </span>
              <Clock className="size-4 text-blue-500/80 shrink-0" />
            </div>
            <div className="mt-3 font-bold text-base text-base-content/95 font-mono">
              {formatTripDuration(selectedTrip.startTime, selectedTrip.endTime)}
            </div>
          </div>

          {/* V. Promedio */}
          <div className="bg-base-200/15 dark:bg-base-900/10 hover:bg-base-200/30 dark:hover:bg-base-900/20 border border-base-200/50 dark:border-base-800/20 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-300">
            <div className="flex items-center justify-between w-full gap-2 text-base-content/40">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                V. Promedio
              </span>
              <Gauge className="size-4 text-sky-500/80 shrink-0" />
            </div>
            <div className="mt-3 font-bold text-base text-base-content/95 font-mono">
              {tripMetrics.avgSpeed}{" "}
              <span className="text-xs font-normal font-sans">km/h</span>
            </div>
          </div>

          {/* V. Máxima */}
          <div className="bg-base-200/15 dark:bg-base-900/10 hover:bg-base-200/30 dark:hover:bg-base-900/20 border border-base-200/50 dark:border-base-800/20 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-300">
            <div className="flex items-center justify-between w-full gap-2 text-rose-500/70">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                V. Máxima
              </span>
              <Zap className="size-4 text-rose-500/80 shrink-0" />
            </div>
            <div className="mt-3 font-bold text-base text-rose-500 dark:text-rose-450 font-mono">
              {tripMetrics.maxSpeed}{" "}
              <span className="text-xs font-normal text-rose-500/70 font-sans">
                km/h
              </span>
            </div>
          </div>

          {overallScore != null ? (
            <>
              {/* Seguridad */}
              <div className="bg-base-200/15 dark:bg-base-900/10 hover:bg-base-200/30 dark:hover:bg-base-900/20 border border-base-200/50 dark:border-base-800/20 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-300">
                <div className="flex items-center justify-between w-full gap-2 text-base-content/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Seguridad
                  </span>
                  <Shield className="size-4 text-emerald-500/80 shrink-0" />
                </div>
                <div className="mt-3 font-bold text-base text-base-content/95 font-mono">
                  {selectedTrip.safetyScore != null
                    ? Math.round(selectedTrip.safetyScore)
                    : "-"}
                </div>
              </div>

              {/* Eco */}
              <div className="bg-base-200/15 dark:bg-base-900/10 hover:bg-base-200/30 dark:hover:bg-base-900/20 border border-base-200/50 dark:border-base-800/20 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-300">
                <div className="flex items-center justify-between w-full gap-2 text-base-content/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Eco
                  </span>
                  <Leaf className="size-4 text-green-500/80 shrink-0" />
                </div>
                <div className="mt-3 font-bold text-base text-base-content/95 font-mono">
                  {selectedTrip.ecoScore != null
                    ? Math.round(selectedTrip.ecoScore)
                    : "-"}
                </div>
              </div>

              {/* Cuidado */}
              <div className="bg-base-200/15 dark:bg-base-900/10 hover:bg-base-200/30 dark:hover:bg-base-900/20 border border-base-200/50 dark:border-base-800/20 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-300">
                <div className="flex items-center justify-between w-full gap-2 text-base-content/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Cuidado
                  </span>
                  <Wrench className="size-4 text-violet-500/80 shrink-0" />
                </div>
                <div className="mt-3 font-bold text-base text-base-content/95 font-mono">
                  {selectedTrip.assetScore != null
                    ? Math.round(selectedTrip.assetScore)
                    : "-"}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden space-y-4">
      {/* Contenido Principal */}
      <div
        className={`flex-grow flex flex-col lg:flex-row gap-4 min-h-0 lg:overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999] h-dvh w-full bg-base-100 m-0 p-0" : ""}`}
      >
        {/* Lista de Viajes (Escritorio) */}
        <div
          className={`
          ${isFullscreen ? "hidden" : "hidden lg:flex"} 
          w-80 h-full flex-col bg-base-100/50 border border-base-200 rounded-2xl overflow-hidden shadow-sm shrink-0
        `}
        >
          <div className="p-4 border-b border-base-200 shrink-0">
            <h2 className="font-bold text-sm text-base-content/80">
              {isDriverCentric ? "Tus Recorridos" : "Lista de Recorridos"}
            </h2>
            <p className="text-[10px] text-base-content/50 mt-0.5">
              Selecciona un viaje para ver su reconstrucción de ruta.
            </p>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-3">
            {renderTripList()}
            {renderPaginationControls()}
          </div>
        </div>

        {/* Lista de Viajes (Móvil) */}
        <div
          className={`
          ${isFullscreen || isMobileMapActive ? "hidden" : "lg:hidden"} 
          flex flex-col space-y-3 pb-32
        `}
        >
          <div className="shrink-0 pb-2 border-b border-base-200 px-1">
            <h2 className="font-bold text-sm text-base-content/80">
              {isDriverCentric ? "Tus Recorridos" : "Lista de Recorridos"}
            </h2>
            <p className="text-[10px] text-base-content/50 mt-0.5">
              Selecciona un viaje para ver su reconstrucción de ruta.
            </p>
          </div>
          <div className="space-y-2.5">
            {renderTripList()}
            {renderPaginationControls()}
          </div>
        </div>

        {/* Panel del Mapa */}
        <div
          key="stable-map-panel"
          className={`
            relative bg-base-100/50 overflow-hidden shadow-sm flex flex-col
            ${
              isFullscreen
                ? "flex-grow h-full w-full border-none rounded-none"
                : `border border-base-200 rounded-2xl flex-grow lg:flex lg:h-full lg:min-h-0 lg:order-2 ${
                    isMobileMapActive
                      ? "flex h-auto lg:h-full lg:min-h-0"
                      : "hidden"
                  }`
            }
          `}
        >
          <div
            className={`z-10 w-full ${
              isFullscreen
                ? "absolute inset-0 h-full"
                : selectedTripId &&
                    routeCoordinates.length > 0 &&
                    !isLoadingRoute
                  ? "relative h-[320px] lg:relative lg:flex-grow lg:h-0"
                  : "relative h-[320px] lg:absolute lg:inset-0 lg:h-full"
            }`}
          >
            <TripMap
              coordinates={routeCoordinates}
              isOngoing={!selectedTrip?.endTime}
              isFullscreen={isFullscreen}
            />
          </div>

          {/* Botón Volver (Solo Móvil) */}
          {!isFullscreen && isMobileMapActive && (
            <button
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.history.state?.mapActive
                ) {
                  window.history.back();
                } else {
                  setIsMobileMapActive(false);
                }
              }}
              className="absolute top-4 left-4 z-[45] btn btn-circle btn-sm bg-base-100 border border-base-300 shadow-md hover:bg-base-200 text-base-content lg:hidden"
              title="Volver a la lista"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          {/* Cabecera en pantalla completa */}
          {isFullscreen && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-[45] flex items-center justify-between bg-base-100 border border-base-300 px-3 py-2 rounded-2xl shadow-lg">
              <button
                onClick={() => setFullscreenAnimated(false)}
                className="btn btn-ghost btn-xs btn-square rounded-xl text-base-content hover:bg-base-200/50"
                title="Volver"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="text-center flex-1 mx-2">
                <h3 className="text-[10px] font-black tracking-wider text-base-content uppercase">
                  Recorrido de Viaje
                </h3>
                <p className="text-[9px] text-base-content/50 font-bold uppercase tracking-wider mt-0.5">
                  {selectedTrip?.vehicle?.alias ||
                    vehicleContext?.alias ||
                    "Vehículo"}{" "}
                  | Placa:{" "}
                  {selectedTrip?.vehicle?.plateNumber ||
                    vehicleContext?.plateNumber ||
                    "-"}
                </p>
              </div>
              <button
                onClick={() => setFullscreenAnimated(false)}
                className="btn btn-ghost btn-xs btn-square rounded-xl text-base-content hover:bg-base-200/50"
                title="Minimizar mapa"
              >
                <Minimize2 className="size-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="alert alert-error text-xs p-3 absolute left-4 right-4 top-4 z-[48] shadow-lg max-w-md lg:left-6 lg:right-auto">
              <AlertTriangle className="size-4 shrink-0 text-white" />
              <span>{error}</span>
            </div>
          )}

          {!isFullscreen &&
            selectedTripId &&
            routeCoordinates.length > 0 &&
            !isLoadingRoute && (
              <button
                onClick={() => setFullscreenAnimated(true)}
                className="absolute top-4 right-4 z-[45] btn btn-circle btn-sm bg-base-100 border border-base-300 shadow-md hover:bg-base-200 text-base-content"
                title="Pantalla completa"
              >
                <Maximize2 className="size-4" />
              </button>
            )}

          {selectedTripId &&
            routeCoordinates.length > 0 &&
            !isLoadingRoute &&
            (isFullscreen
              ? renderStatsOverlay("fullscreen")
              : renderStatsOverlay("panel-flat"))}

          {isLoadingRoute && (
            <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm z-[40] flex flex-col items-center justify-center text-sm text-base-content/50">
              <Loader2 className="size-8 animate-spin text-primary mb-2" />
              Cargando telemetría de ruta...
            </div>
          )}

          {!selectedTripId && (
            <div className="absolute inset-0 bg-base-100/50 backdrop-blur-sm z-[40] flex flex-col items-center justify-center text-center text-base-content/40 p-8">
              <Compass className="size-16 opacity-20 mb-3" />
              <span className="text-sm font-bold">
                Selecciona un viaje para comenzar
              </span>
              <span className="text-xs mt-1">
                La ruta reconstruida y las estadísticas de velocidad se
                mostrarán aquí.
              </span>
            </div>
          )}

          {selectedTripId &&
            routeCoordinates.length === 0 &&
            !isLoadingRoute && (
              <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm z-[40] flex flex-col items-center justify-center text-center text-base-content/40 p-8">
                <Compass className="size-16 opacity-25 mb-3 animate-pulse" />
                <span className="text-sm font-bold">
                  Sin coordenadas de ruta
                </span>
                <span className="text-xs max-w-sm mt-1">
                  Este viaje no cuenta con registros de ubicación GPS. Esto
                  puede ocurrir si el dispositivo de rastreo perdió señal o
                  alimentación durante el recorrido.
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
