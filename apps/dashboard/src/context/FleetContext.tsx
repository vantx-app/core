// context/FleetContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useFleetSocket } from "@/hooks/useFleetSocket";
import api from "@/utils/client/api-client";
import { FleetContextType, FleetProviderProps, FleetVehicle } from "@/types";

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export function FleetProvider({
  children,
  initialVehicles = [],
}: FleetProviderProps) {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");

  const formattedInitialData = useMemo(() => {
    return (initialVehicles || []).reduce<Record<string, FleetVehicle>>(
      (acc, v) => {
        if (!v.liveState) return acc;

        acc[v.id] = {
          ...v,
          latitude: v.liveState.lastLat ?? 0,
          longitude: v.liveState.lastLng ?? 0,
          speed: v.liveState.lastSpeed ?? 0,
          status: v.liveState.currentStatus ?? "STOPPED",
          angle: v.liveState.lastAngle ?? 0,
          updatedAt: v.liveState.lastUpdate ?? "N/A",
          ignition: v.liveState.lastIgnition ?? false,
          odometer: v.liveState.lastOdometer ?? 0,
        };
        return acc;
      },
      {},
    );
  }, [initialVehicles]);

  const [fleet, setFleet] =
    useState<Record<string, FleetVehicle>>(formattedInitialData);
  const { isConnected } = useFleetSocket(setFleet);

  const value = useMemo(
    () => ({
      fleet,
      isConnected,
    }),
    [fleet, isConnected],
  );

  const fetchAndMergeFleet = useCallback(async () => {
    try {
      const url = targetOrgId
        ? `/vehicles?liveState=true&targetOrgId=${targetOrgId}`
        : "/vehicles?liveState=true";
      const res = await api(url);
      if (res.status === 200) {
        const vehicles = res.data as FleetVehicle[];

        setFleet((prevFleet) => {
          const newFleet: Record<string, FleetVehicle> = {};

          vehicles.forEach((v) => {
            if (!v.liveState) return;
            const prev = prevFleet[v.id];

            const dbUpdateTime = v.liveState.lastUpdate
              ? new Date(v.liveState.lastUpdate).getTime()
              : 0;
            const socketUpdateTime = prev?.lastSocketUpdate || 0;
            // Se considera obsoleto o inexistente si no hay conexión de socket o la DB tiene datos más recientes
            const isSocketStale =
              !isConnected || dbUpdateTime > socketUpdateTime;

            if (prev?.isFromSocket && !isSocketStale) {
              // Mantener las coordenadas y métricas recibidas de WebSocket en tiempo real
              newFleet[v.id] = {
                ...v,
                latitude: prev.latitude,
                longitude: prev.longitude,
                speed: prev.speed,
                status: prev.status,
                angle: prev.angle,
                updatedAt: prev.updatedAt,
                ignition: prev.ignition,
                odometer: prev.odometer,
                isFromSocket: true,
                lastSocketUpdate: prev.lastSocketUpdate,
              };
            } else {
              // Usar el estado en vivo de la base de datos si no hay actualización fresca del socket
              newFleet[v.id] = {
                ...v,
                latitude: v.liveState.lastLat ?? 0,
                longitude: v.liveState.lastLng ?? 0,
                speed: v.liveState.lastSpeed ?? 0,
                status: v.liveState.currentStatus ?? "STOPPED",
                angle: v.liveState.lastAngle ?? 0,
                updatedAt: v.liveState.lastUpdate ?? "N/A",
                ignition: v.liveState.lastIgnition ?? false,
                odometer: v.liveState.lastOdometer ?? 0,
                isFromSocket: false,
              };
            }
          });

          return newFleet;
        });
      }
    } catch (error) {
      console.error("Error al obtener/mezclar estado de flota:", error);
    }
  }, [targetOrgId, isConnected]);

  const initialVehiclesRef = useRef(initialVehicles);
  useEffect(() => {
    initialVehiclesRef.current = initialVehicles;
  }, [initialVehicles]);

  const isMounted = useRef(false);

  // Refetch y mezclar cuando cambia la organización objetivo
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      // Evitar el fetch inicial si ya tenemos vehículos precargados en el servidor y no hay targetOrgId
      if (
        initialVehiclesRef.current &&
        initialVehiclesRef.current.length > 0 &&
        !targetOrgId
      ) {
        return;
      }
    }
    fetchAndMergeFleet();
  }, [targetOrgId, fetchAndMergeFleet]);

  // Sync on tab visibility change to pick up any offline updates, while preserving active socket locations
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAndMergeFleet();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchAndMergeFleet]);

  return (
    <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
  );
}

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (context === undefined) {
    throw new Error("useFleet must be used within a FleetProvider");
  }
  return context;
};
