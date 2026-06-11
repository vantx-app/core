"use client";

import {
  MapLiveLocationPayload,
  MapTrackingDetails,
  TrackingMapProps,
} from "@/types";
import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { io, Socket } from "socket.io-client";
import { ShieldCheck, Navigation, Compass } from "lucide-react";
import axios from "axios";

// Configure Mapbox Token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

const statusConfig = {
  MOVING: {
    label: "En movimiento",
    badgeClass:
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    color: "#10b981",
  },
  IDLING: {
    label: "En ralentí",
    badgeClass:
      "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    color: "#f59e0b",
  },
  EXCESSIVE_IDLING: {
    label: "Ralentí excesivo",
    badgeClass:
      "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
    color: "#ef4444",
  },
  STOPPED: {
    label: "Detenido",
    badgeClass:
      "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400",
    dotClass: "bg-slate-400",
    color: "#94a3b8",
  },
  OFFLINE: {
    label: "Desconectado",
    badgeClass:
      "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400",
    dotClass: "bg-slate-400",
    color: "#94a3b8",
  },
};

export default function TrackingMap({ id, initialDetails }: TrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const markerElementsRef = useRef<{
    pinContainer: HTMLElement;
    svgEl: SVGElement;
    masterEl: HTMLElement;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [details, setDetails] = useState<MapTrackingDetails>(initialDetails);
  const [isFollowing, setIsFollowingState] = useState(true);
  const isFollowingRef = useRef(true);

  const setIsFollowing = (val: boolean) => {
    setIsFollowingState(val);
    isFollowingRef.current = val;
  };

  const currentStatusConfig = useMemo(() => {
    const statusKey = (
      details.currentStatus || "STOPPED"
    ).toUpperCase() as keyof typeof statusConfig;
    return statusConfig[statusKey] || statusConfig.STOPPED;
  }, [details.currentStatus]);

  // helper to update marker state in Mapbox
  const updateMarker = (
    latitude: number,
    longitude: number,
    angle: number,
    status: string,
  ) => {
    if (!markerRef.current) return;

    // 1. Move position
    markerRef.current.setLngLat([longitude, latitude]);

    // 2. Rotate and color using refs to avoid DOM queries
    const cached = markerElementsRef.current;
    if (cached) {
      cached.pinContainer.style.transform = `rotate(${angle}deg)`;
      cached.masterEl.setAttribute("data-status", status);
    }
  };

  // 1. Initialize Map and Marker
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialLat = details.lastLat ?? 8.9824;
    const initialLng = details.lastLng ?? -79.5199;
    const initialAngle = details.lastAngle ?? 0;
    const initialStatus = details.currentStatus ?? "STOPPED";

    // A. Init Map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [initialLng, initialLat],
      zoom: 15,
      pitch: 30, // Slight 3D pitch for premium look
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    // Pause auto-follow if the user manually drags/zooms/pans the map
    map.current.on("movestart", (e) => {
      if (e.originalEvent) {
        setIsFollowing(false);
      }
    });

    const masterDiv = document.createElement("div");
    masterDiv.className = "vehicle-marker";
    masterDiv.setAttribute("data-status", initialStatus);
    masterDiv.style.width = "36px";
    masterDiv.style.height = "36px";
    masterDiv.style.display = "flex";
    masterDiv.style.alignItems = "center";
    masterDiv.style.justifyContent = "center";
    masterDiv.style.cursor = "pointer";
    masterDiv.style.filter = "drop-shadow(0px 3px 5px rgba(0, 0, 0, 0.4))";

    const rotContainer = document.createElement("div");
    rotContainer.className = "marker-pin-container";
    rotContainer.style.width = "100%";
    rotContainer.style.height = "100%";
    rotContainer.style.display = "flex";
    rotContainer.style.alignItems = "center";
    rotContainer.style.justifyContent = "center";
    rotContainer.style.transformOrigin = "center center";
    rotContainer.style.transform = `rotate(${initialAngle}deg)`;
    rotContainer.style.transition =
      "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("fill", "currentColor");

    // SVG polygon (arrow pointing north)
    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("points", "12 2 19 21 12 17 5 21 12 2");

    svg.appendChild(polygon);
    rotContainer.appendChild(svg);
    masterDiv.appendChild(rotContainer);

    // C. Add Marker to Map
    const newMarker = new mapboxgl.Marker({
      element: masterDiv,
      rotationAlignment: "map",
      pitchAlignment: "map",
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map.current);

    markerRef.current = newMarker;
    markerElementsRef.current = {
      pinContainer: rotContainer,
      svgEl: svg,
      masterEl: masterDiv,
    };

    // Clean up
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      markerElementsRef.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 2. Connect WebSockets
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    const SOCKET_URL = isDev ? "http://localhost:8000" : "/";

    const socket = io(SOCKET_URL, {
      path: "/api/socket.io",
      transports: ["websocket"],
      auth: { trackingLinkId: id },
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Public socket connected successfully:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Public socket disconnected");
    });

    socket.on("live-location", (data: MapLiveLocationPayload) => {
      console.log("📥 Public live coordinate received:", data);

      const newLat = data.latitude ?? data.lastLat;
      const newLng = data.longitude ?? data.lastLng;
      const newAngle = data.angle ?? data.lastAngle ?? 0;
      const newStatus = data.status ?? data.currentStatus ?? "STOPPED";

      if (newLat == null || newLng == null) return;

      // Update state for details panel
      setDetails((prev) => ({
        ...prev,
        lastLat: newLat,
        lastLng: newLng,
        lastAngle: newAngle,
        currentStatus: newStatus,
      }));

      // Update Map Marker
      updateMarker(newLat, newLng, newAngle, newStatus);

      // Smooth camera pan if following
      if (map.current && isFollowingRef.current) {
        map.current.flyTo({
          center: [newLng, newLat],
          zoom: 15,
          duration: 1200,
        });
      }
    });

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log(
          "ℹ️ Cambio de visibilidad del documento (mapa público): visible. Comprobando conexión...",
        );

        if (socket && !socket.connected) {
          console.log(
            "⚠️ El socket público está desconectado. Intentando reconectar...",
          );
          socket.connect();
        }

        try {
          console.log(
            "📡 Solicitando estado de ubicación actual por REST en cambio de visibilidad...",
          );
          const response = await axios.get(
            `/api/vehicles/tracking-links/public/${id}`,
          );
          if (response.data) {
            const data = response.data;
            const newLat = data.lastLat;
            const newLng = data.lastLng;
            const newAngle = data.lastAngle ?? 0;
            const newStatus = data.currentStatus ?? "STOPPED";

            if (newLat != null && newLng != null) {
              setDetails((prev) => ({
                ...prev,
                lastLat: newLat,
                lastLng: newLng,
                lastAngle: newAngle,
                currentStatus: newStatus,
              }));
              updateMarker(newLat, newLng, newAngle, newStatus);
            }
          }
        } catch (err) {
          console.error(
            "❌ Error al actualizar coordenadas públicas mediante API REST:",
            err,
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  const handleCenterMap = () => {
    setIsFollowing(true);
    if (map.current && details.lastLat != null && details.lastLng != null) {
      map.current.flyTo({
        center: [details.lastLng, details.lastLat],
        zoom: 15,
        duration: 1000,
      });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Mapbox Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Contenedor flotante de la tarjeta de detalles (sólido y ultra-compacto para pantallas móviles) */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-80 z-10 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-base-100 border border-base-300/60 shadow-md rounded-2xl p-4 flex flex-col gap-2.5">
          {/* Fila superior: Placa del vehículo y Estado del vehículo */}
          <div className="flex items-center justify-between text-xs pb-2">
            <div className="flex items-center gap-1.5 font-bold font-mono text-base-content/85">
              <ShieldCheck className="size-4 text-primary" />
              <span>{details.plateNumber}</span>
            </div>
            <div className="flex items-center text-xs">
              {details.clientName ? (
                <span className="text-sm font-bold text-base-content/90 truncate max-w-[150px] py-0.5">
                  {details.clientName}
                </span>
              ) : (
                <span className="text-sm text-base-content/40 italic py-0.5">
                  Desconocido
                </span>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentStatusConfig.badgeClass}`}
            >
              <span
                className={`size-1.5 rounded-full ${currentStatusConfig.dotClass} ${details.currentStatus === "MOVING" && "animate-ping"}`}
              />
              {currentStatusConfig.label}
            </span>
          </div>

          {/* Botón para centrar y seguir en el mapa */}
          {isFollowing ? (
            <button
              onClick={handleCenterMap}
              className="btn btn-sm btn-primary text-white w-full gap-2 font-bold shadow-sm transition-all rounded-xl mt-0.5"
            >
              <Compass className="size-3.5" />
              Siguiendo
            </button>
          ) : (
            <button
              onClick={handleCenterMap}
              className="btn btn-primary btn-sm w-full gap-2 text-white font-bold shadow-md hover:shadow-lg transition-all rounded-xl mt-0.5 animate-in fade-in zoom-in-95 duration-200"
            >
              <Navigation className="size-3.5 fill-current rotate-45" />
              Centrar y seguir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
