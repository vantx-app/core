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
} from "lucide-react";
import api from "@/utils/client/api-client";
import { DriverInfoLabel } from "@/components/ui/DriverInfoLabel";
import {
  getLocalDateOnlyLabel,
  formatTripDate,
  formatTimeOnly,
  formatTripDuration,
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
}

export default function TripsHistoryView({
  initialTrips,
  vehicleContext,
  driverContextName,
  isDriverCentric = false,
}: TripsHistoryViewProps) {
  const [trips] = useState<VehicleTripsTrip[]>(initialTrips);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileMapActive, setIsMobileMapActive] = useState(false);

  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const { role: userRole } = useAuth();

  const isManagementRole =
    userRole === ROLES.OWNER ||
    userRole === ROLES.ADMIN ||
    userRole === ROLES.SUPER_ADMIN;

  const groupedTrips = useMemo(() => {
    const groups: Record<string, VehicleTripsTrip[]> = {};
    trips.forEach((trip) => {
      const label = getLocalDateOnlyLabel(trip.startTime);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(trip);
    });
    return groups;
  }, [trips]);

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
              className="collapse collapse-arrow bg-base-200/20 border border-base-200/50 rounded-xl overflow-hidden shadow-sm transition-all"
            >
              <input
                type="checkbox"
                defaultChecked={groupIdx === 0 || hasSelected}
                className="peer"
                aria-label={`Mostrar viajes de ${dateLabel}`}
              />
              <div className="collapse-title text-xs font-black flex items-center justify-between pr-10 text-base-content/85 bg-base-200/35 py-3">
                <span className="truncate">{dateLabel}</span>
                <span className="badge badge-sm badge-neutral font-bold font-mono ml-2 border-none">
                  {dayTrips.length}
                </span>
              </div>
              <div className="collapse-content p-2.5 bg-base-100/5 space-y-2.5">
                {dayTrips.map((trip) => {
                  const isSelected = trip.id === selectedTripId;
                  const isOngoing = !trip.endTime;
                  return (
                    <button
                      key={trip.id}
                      onClick={() => handleTripSelection(trip.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex flex-col gap-2 ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-base-100/50 border-base-200 hover:border-base-300 text-base-content"
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
                          {!isOngoing && trip.overallScore !== undefined && (
                            <span
                              className={`badge badge-xs font-black px-1.5 border ${
                                trip.overallScore >= 90
                                  ? "bg-green-500/10 border-green-500/20 text-green-600"
                                  : trip.overallScore >= 75
                                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600"
                                    : "bg-red-500/10 border-red-500/20 text-red-600"
                              }`}
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

  const renderStatsOverlay = (variant: "map-float" | "fullscreen") => {
    if (!tripMetrics || !selectedTrip) return null;

    if (variant === "fullscreen") {
      return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-[45] bg-base-100/90 backdrop-blur-md border border-base-200 p-4 rounded-2xl shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-base-200/50 pb-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                {isDriverCentric ? "Vehículo" : "Conductor"}
              </span>
              <div className="font-bold text-base-content/90 flex items-center gap-1.5 text-xs mt-0.5">
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
                          targetOrgId ? `&targetOrgId=${targetOrgId}` : ""
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
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider block">
                Fecha y Hora
              </span>
              <span className="font-bold text-xs text-base-content/90 block mt-0.5 font-mono">
                {formatTripDate(selectedTrip.startTime)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-base-200/50 text-center">
            <div className="px-1">
              <span className="text-[9px] text-base-content/50 block font-bold uppercase tracking-tight">
                Duración
              </span>
              <span className="font-bold text-sm text-base-content/90 font-mono">
                {formatTripDuration(
                  selectedTrip.startTime,
                  selectedTrip.endTime,
                )}
              </span>
            </div>
            <div className="px-1">
              <span className="text-[9px] text-base-content/50 block font-bold uppercase tracking-tight">
                V. Promedio
              </span>
              <span className="font-bold text-sm text-base-content/90 font-mono">
                {tripMetrics.avgSpeed}{" "}
                <span className="text-[9px] font-normal">km/h</span>
              </span>
            </div>
            <div className="px-1">
              <span className="text-[9px] text-base-content/50 block font-bold uppercase tracking-tight text-error/80">
                V. Máxima
              </span>
              <span className="font-bold text-sm text-error font-mono">
                {tripMetrics.maxSpeed}{" "}
                <span className="text-[9px] font-normal">km/h</span>
              </span>
            </div>
          </div>
          {selectedTrip.overallScore !== undefined && (
            <div className="border-t border-base-200/50 pt-2 grid grid-cols-4 divide-x divide-base-200/50 text-center">
              <div className="px-1">
                <span className="text-[9px] text-primary block font-bold uppercase tracking-tight">
                  Puntaje
                </span>
                <span className="font-black text-sm text-primary font-mono">
                  {Math.round(selectedTrip.overallScore)}
                </span>
              </div>
              <div className="px-1">
                <span className="text-[9px] text-base-content/50 block font-bold uppercase tracking-tight">
                  Seguridad
                </span>
                <span className="font-bold text-sm text-base-content/90 font-mono">
                  {Math.round(selectedTrip.safetyScore ?? 100)}
                </span>
              </div>
              <div className="px-1">
                <span className="text-[9px] text-base-content/50 block font-bold uppercase tracking-tight">
                  Eco
                </span>
                <span className="font-bold text-sm text-base-content/90 font-mono">
                  {Math.round(selectedTrip.ecoScore ?? 100)}
                </span>
              </div>
              <div className="px-1">
                <span className="text-[9px] text-base-content/50 block font-bold uppercase tracking-tight">
                  Cuidado
                </span>
                <span className="font-bold text-sm text-base-content/90 font-mono">
                  {Math.round(selectedTrip.assetScore ?? 100)}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="absolute bottom-4 left-4 right-4 z-[45] pointer-events-none">
        <div className="bg-base-100/90 backdrop-blur-md border border-base-200/80 rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-3 pointer-events-auto">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isDriverCentric ? (
                <>
                  <Truck className="size-3.5 text-primary shrink-0" />
                  {isManagementRole &&
                  (selectedTrip.vehicleId || selectedTrip.vehicle?.id) ? (
                    <Link
                      href={`/vehicle/${selectedTrip.vehicleId || selectedTrip.vehicle?.id}/view${
                        targetOrgId ? `?targetOrgId=${targetOrgId}` : ""
                      }`}
                      className="text-xs font-bold text-primary hover:underline truncate"
                    >
                      {selectedTrip.vehicle?.alias || "Vehículo"}
                    </Link>
                  ) : (
                    <span className="text-xs font-bold truncate">
                      {selectedTrip.vehicle?.alias || "Vehículo"}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <User className="size-3.5 text-primary shrink-0" />
                  {isManagementRole && selectedTrip.driver?.id ? (
                    <Link
                      href={`/reports?driverId=${selectedTrip.driver.id}&tab=daily${
                        targetOrgId ? `&targetOrgId=${targetOrgId}` : ""
                      }`}
                      className="text-xs font-bold text-primary hover:underline truncate"
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
                      className="text-xs font-bold truncate"
                    />
                  )}
                </>
              )}
            </div>
            <span className="text-[9px] text-base-content/60 font-semibold truncate mt-0.5">
              {formatTripDate(selectedTrip.startTime)}
            </span>
          </div>
          <div className="w-px h-8 bg-base-300/60 shrink-0" />
          <div className="flex items-center gap-3 shrink-0">
            {selectedTrip.overallScore !== undefined && (
              <>
                <div className="text-center">
                  <span className="text-[9px] text-primary font-bold uppercase block leading-none">
                    Score
                  </span>
                  <span className="text-xs font-black text-primary block mt-0.5 font-mono">
                    {Math.round(selectedTrip.overallScore)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-base-content/40 font-bold uppercase block leading-none">
                    Seg.
                  </span>
                  <span className="text-xs font-black text-base-content/90 block mt-0.5 font-mono">
                    {Math.round(selectedTrip.safetyScore ?? 100)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-base-content/40 font-bold uppercase block leading-none">
                    Eco
                  </span>
                  <span className="text-xs font-black text-base-content/90 block mt-0.5 font-mono">
                    {Math.round(selectedTrip.ecoScore ?? 100)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-base-content/40 font-bold uppercase block leading-none">
                    Cuid.
                  </span>
                  <span className="text-xs font-black text-base-content/90 block mt-0.5 font-mono">
                    {Math.round(selectedTrip.assetScore ?? 100)}
                  </span>
                </div>
                <div className="w-px h-6 bg-base-300/60 shrink-0" />
              </>
            )}
            <div className="text-center">
              <span className="text-[9px] text-base-content/40 font-bold uppercase block leading-none">
                Dur.
              </span>
              <span className="text-xs font-black font-mono text-base-content/90 block mt-0.5">
                {formatTripDuration(
                  selectedTrip.startTime,
                  selectedTrip.endTime,
                )}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-base-content/40 font-bold uppercase block leading-none flex items-center gap-0.5">
                <Gauge className="size-2.5" />
                Prom.
              </span>
              <span className="text-xs font-black font-mono text-base-content/90 block mt-0.5">
                {tripMetrics.avgSpeed}
                <span className="text-[8px] font-normal">km/h</span>
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-error/60 font-bold uppercase block leading-none flex items-center gap-0.5">
                <Zap className="size-2.5" />
                Máx.
              </span>
              <span className="text-xs font-black font-mono text-error block mt-0.5">
                {tripMetrics.maxSpeed}
                <span className="text-[8px] font-normal text-error/70">
                  km/h
                </span>
              </span>
            </div>
          </div>
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
          </div>
        </div>

        {/* Lista de Viajes (Móvil) */}
        <div
          className={`
          ${isFullscreen || isMobileMapActive ? "hidden" : "lg:hidden"} 
          flex flex-col bg-base-100/50 border border-base-200 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3
        `}
        >
          <div className="shrink-0 pb-2 border-b border-base-200">
            <h2 className="font-bold text-sm text-base-content/80">
              {isDriverCentric ? "Tus Recorridos" : "Lista de Recorridos"}
            </h2>
            <p className="text-[10px] text-base-content/50 mt-0.5">
              Selecciona un viaje para ver su reconstrucción de ruta.
            </p>
          </div>
          <div className="space-y-2.5">{renderTripList()}</div>
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
                      ? "flex h-[500px] sm:h-[600px] lg:h-full lg:min-h-0"
                      : "hidden"
                  }`
            }
          `}
        >
          <div className="absolute inset-0 z-10 w-full h-full">
            <TripMap
              coordinates={routeCoordinates}
              isOngoing={!selectedTrip?.endTime}
              isFullscreen={isFullscreen}
            />
          </div>

          {/* Botón Volver (Solo Móvil) */}
          {!isFullscreen && isMobileMapActive && (
            <button
              onClick={() => setIsMobileMapActive(false)}
              className="absolute top-4 left-4 z-[45] btn btn-circle btn-sm bg-base-100/80 backdrop-blur-md border border-base-200 shadow-md hover:bg-base-100 text-base-content lg:hidden"
              title="Volver a la lista"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          {/* Cabecera en pantalla completa */}
          {isFullscreen && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-[45] flex items-center justify-between bg-base-100/90 backdrop-blur-md border border-base-200/80 px-3 py-2 rounded-2xl shadow-lg">
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
                className="absolute top-4 right-4 z-[45] btn btn-circle btn-sm bg-base-100/80 backdrop-blur-md border border-base-200 shadow-md hover:bg-base-100 text-base-content"
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
              : renderStatsOverlay("map-float"))}

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
