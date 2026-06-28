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
import { ShieldCheck, Navigation, Compass, MapPin, Info } from "lucide-react";
import axios from "axios";
import {
  DEFAULT_MAP_CONFIG,
  getDistance,
  formatDistance,
  animateMarkerPosition,
} from "@/utils/client";

// Configure Mapbox Token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

const statusConfig = {
  MOVING: {
    label: "En movimiento",
    badgeClass:
      "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
    dotClass: "bg-blue-500",
    color: "#3b82f6",
  },
  IDLING: {
    label: "En espera",
    badgeClass:
      "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    color: "#f59e0b",
  },
  EXCESSIVE_IDLING: {
    label: "En espera",
    badgeClass:
      "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    color: "#f59e0b",
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
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<[number, number] | null>(null);

  const [details, setDetails] = useState<MapTrackingDetails>(initialDetails);
  const [isFollowing, setIsFollowingState] = useState(true);
  const isFollowingRef = useRef(true);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const setIsFollowing = (val: boolean) => {
    setIsFollowingState(val);
    isFollowingRef.current = val;
  };

  const distance = useMemo(() => {
    if (!userLocation || details.lastLat == null || details.lastLng == null)
      return null;
    return getDistance(
      userLocation.lat,
      userLocation.lng,
      details.lastLat,
      details.lastLng,
    );
  }, [userLocation, details.lastLat, details.lastLng]);

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

    // 1. Mover la posición de forma animada si tenemos una posición previa
    const from = lastCoordsRef.current;
    const to: [number, number] = [longitude, latitude];

    if (from && (from[0] !== to[0] || from[1] !== to[1])) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animationRef.current = animateMarkerPosition(
        markerRef.current,
        from,
        to,
        1000,
        () => {
          animationRef.current = null;
        },
      );
    } else {
      markerRef.current.setLngLat(to);
    }

    lastCoordsRef.current = to;

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
      ...DEFAULT_MAP_CONFIG,
      container: mapContainer.current,
      center: [initialLng, initialLat],
      zoom: 15,
      attributionControl: false, // Disable default bottom-right attribution
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    // Add compact attribution control to bottom-left corner to avoid overlapping custom HUD buttons
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-left",
    );

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
    lastCoordsRef.current = [initialLng, initialLat];
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
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

  const handleShowUserLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Tu navegador no soporta geolocalización");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);

        if (!map.current) return;

        // Disable auto-follow to show both markers
        setIsFollowing(false);

        // Create or update user location marker
        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.className = "user-location-marker";

          const pulse = document.createElement("div");
          pulse.className = "user-location-pulse";

          const dot = document.createElement("div");
          dot.className = "user-location-dot";

          el.appendChild(pulse);
          el.appendChild(dot);

          userMarkerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }

        // Fit map bounds to show both user and vehicle
        if (details.lastLat != null && details.lastLng != null) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([details.lastLng, details.lastLat]);
          bounds.extend([longitude, latitude]);

          map.current.fitBounds(bounds, {
            padding: { top: 80, bottom: 80, left: 80, right: 80 },
            maxZoom: 15,
            duration: 1000,
          });
        } else {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1000,
          });
        }
      },
      (error) => {
        console.error("Error obtaining geolocation:", error);
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Permiso de ubicación denegado");
        } else {
          setLocationError("No se pudo obtener tu ubicación");
        }
        setTimeout(() => setLocationError(null), 3000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  return (
    <div className="relative w-full h-full">
      {/* Mapbox Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Contenedor flotante de la tarjeta de detalles (sólido y ultra-compacto para pantallas móviles) */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-80 z-10 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-base-100 border border-base-300/60 shadow-md rounded-2xl p-4 flex flex-col gap-2.5">
          {/* Fila superior: Placa del vehículo, cliente y estado */}
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

          {/* Mensajes de error de ubicación */}
          {locationError && (
            <div className="text-center text-[10px] text-error font-semibold animate-in fade-in slide-in-from-bottom-1 duration-200 mt-1">
              {locationError}
            </div>
          )}

          {/* Distancia dinámica al vehículo (con mayor espaciado superior) */}
          {distance !== null && (
            <div className="flex items-center justify-between text-xs pt-4 mt-4 border-t border-base-300 animate-in fade-in duration-300">
              <span className="text-base-content/65 font-medium">
                Distancia a ti:
              </span>
              <span className="font-bold text-base-content/90">
                {formatDistance(distance)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Controladores flotantes HUD (estilo Google Maps) */}
      <div className="absolute bottom-6 md:bottom-28 right-4 z-10 flex flex-col gap-2.5">
        {/* Info Legend Tooltip (estilo botón flotante) */}
        <div className="dropdown dropdown-left dropdown-hover">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-circle bg-base-100 text-base-content/70 border-base-300/80 hover:bg-base-200 shadow-md w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-all"
            title="Información de rastreo"
          >
            <Info className="size-5 md:size-6" />
          </div>
          <div
            tabIndex={0}
            className="dropdown-content z-20 mr-2 card card-compact w-64 p-3 shadow-md bg-base-100 border border-base-300 text-[11px] text-base-content/75 leading-normal font-normal animate-in fade-in duration-200 space-y-2.5"
          >
            <p className="font-bold text-base-content/90 border-b border-base-200 pb-1.5 text-xs">
              Información de Rastreo
            </p>
            <p className="text-[10px] text-base-content/60 leading-normal">
              La ubicación del vehículo se actualiza periódicamente, no en
              tiempo real. Úsese como una referencia visual de la proximidad del
              vehículo.
            </p>
            <div className="border-t border-base-200 pt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                <span className="font-semibold text-base-content/95">
                  En movimiento:
                </span>
                <span className="text-base-content/60">
                  Vehículo circulando.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-semibold text-base-content/95">
                  En espera:
                </span>
                <span className="text-base-content/60">
                  Parada temporal (ej. tráfico).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-slate-400 shrink-0" />
                <span className="font-semibold text-base-content/95">
                  Detenido:
                </span>
                <span className="text-base-content/60">
                  Vehículo apagado/estacionado.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Centrar/Seguir Vehículo */}
        <button
          onClick={handleCenterMap}
          className={`btn btn-circle shadow-md border transition-all w-12 h-12 md:w-14 md:h-14 flex items-center justify-center ${
            isFollowing
              ? "btn-primary text-white border-primary"
              : "bg-base-100 text-base-content/70 border-base-300/80 hover:bg-base-200"
          }`}
          title={isFollowing ? "Siguiendo vehículo" : "Seguir vehículo"}
        >
          <Compass className="size-5 md:size-6" />
        </button>

        {/* Mi Ubicación (Geolocalización con spinner de carga) */}
        <button
          onClick={handleShowUserLocation}
          disabled={isLocating}
          className={`btn btn-circle shadow-md border transition-all w-12 h-12 md:w-14 md:h-14 flex items-center justify-center ${
            userLocation
              ? "btn-primary text-white border-primary"
              : "bg-base-100 text-base-content/70 border-base-300/80 hover:bg-base-200"
          }`}
          title="Mi ubicación"
        >
          {isLocating ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <MapPin className="size-5 md:size-6" />
          )}
        </button>
      </div>
    </div>
  );
}
