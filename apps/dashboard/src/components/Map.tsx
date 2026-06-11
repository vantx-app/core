"use client";

import { FleetVehicle, TrackingLink } from "@/types";
import { useEffect, useMemo, useRef, useState, memo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useFleet } from "@/context/FleetContext";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Share2, Copy, Trash2, Eye, Locate, X } from "lucide-react";
import Link from "next/link";
import ShareLocationModal from "./ShareLocationModal";
import api from "@/utils/client/api-client";
import { MobileFleetDrawer } from "./MobileFleetDrawer";
import { formatDate } from "@/utils/client";
import { DetailRow } from "@/components/ui/DetailRow";

// 1. Extraemos y limpiamos el token ANTES de que React haga nada.
// El trim() es vital porque a veces los .env inyectan saltos de línea (\n) invisibles.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";

// Asignación global por si otros submódulos de mapbox lo requieren
mapboxgl.accessToken = MAPBOX_TOKEN;

// const updateMarkerStatus = (el: HTMLElement, status: string) => {
//   el.setAttribute('data-status', status);
// };

const VehicleListItem = memo(
  ({
    id,
    vehicle,
    onSelect,
  }: {
    id: string;
    vehicle: FleetVehicle;
    onSelect: (id: string) => void;
  }) => {
    const statusColor =
      vehicle.status === "MOVING"
        ? "bg-success"
        : vehicle.status === "IDLING"
          ? "bg-warning"
          : vehicle.status === "EXCESSIVE_IDLING"
            ? "bg-error"
            : "bg-slate-400";

    // const driverName = vehicle.assignments?.[0]?.driver
    //   ? `${vehicle.assignments[0].driver.firstName} ${vehicle.assignments[0].driver.lastName}`
    //   : 'Sin conductor';

    return (
      <button
        onClick={() => onSelect(id)}
        className="w-full text-left p-4 hover:bg-base-300 rounded-sm transition-colors flex items-center gap-3 border-b border-base-200 last:border-none"
      >
        <div className={`w-3 h-3 rounded-full ${statusColor} shadow-sm`} />
        <div className="flex-1 overflow-hidden">
          <div className="font-bold truncate">
            {vehicle.alias || vehicle.plateNumber}
          </div>
          {/* <div className="text-[10px] text-base-content/50 truncate">
          {driverName}
        </div> */}
          <div className="text-xs text-base-content/60 flex justify-between items-center mt-0.5">
            <span>{vehicle.speed} km/h</span>
            <span className="italic uppercase">{vehicle.status}</span>
          </div>
        </div>
      </button>
    );
  },
  (prev, next) => {
    // Solo re-renderiza si cambió el status, la velocidad, o el conductor
    return (
      prev.vehicle.status === next.vehicle.status &&
      prev.vehicle.speed === next.vehicle.speed &&
      prev.vehicle.assignments?.[0]?.driver?.id ===
      next.vehicle.assignments?.[0]?.driver?.id
    );
  },
);

VehicleListItem.displayName = "VehicleListItem";

function ExpirationCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(expiresAt).getTime() - Date.now();
      if (difference <= 0) {
        return "Expirado";
      }
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      return `${hours}h ${minutes}m ${seconds}s`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return <span>{timeLeft}</span>;
}

export default function FleetMap() {
  const searchParams = useSearchParams();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const markerElementsRef = useRef<
    Record<
      string,
      {
        pinContainer: HTMLElement;
        svgEl: SVGElement;
        masterEl: HTMLElement;
        labelEl?: HTMLElement;
      }
    >
  >({});
  const lastAppliedStateRef = useRef<
    Record<string, { lat: number; lng: number; angle: number; status: string }>
  >({});

  const { fleet, isConnected } = useFleet();
  const initialFitDone = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // Dynamic closed height to place the drawer handle just above the bottom navigation
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.bottom = "0";
    div.style.height = "env(safe-area-inset-bottom)";
    div.style.visibility = "hidden";
    document.body.appendChild(div);
    const height = div.offsetHeight;
    document.body.removeChild(div);
    setSafeAreaBottom(height);
  }, []);

  const closedHeight = useMemo(() => {
    // 64px is bottom navigation height (h-16).
    // 30px exposes only the drag handle (p-4 padding-top + 6px handle + 8px gap) above the bottom nav,
    // ensuring the title text is completely hidden underneath the bottom navigation.
    return `${64 + safeAreaBottom + 30}px`;
  }, [safeAreaBottom]);

  const [snapPoint, setSnapPoint] = useState<number | string | null>("94px");

  useEffect(() => {
    setSnapPoint(closedHeight);
  }, [closedHeight]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [followedVehicleId, setFollowedVehicleId] = useState<string | null>(
    null,
  );

  // Sincronizar el estado seleccionado con la URL al cambiar de página o cargar
  useEffect(() => {
    const vid = searchParams.get("vehicleId") || null;
    setSelectedVehicleId((prev) => (prev !== vid ? vid : prev));
  }, [searchParams]);

  const vehicleId = selectedVehicleId;

  useEffect(() => {
    if (!vehicleId) {
      setTrackingLinks([]);
      return;
    }

    const fetchLinks = async () => {
      setIsLoadingLinks(true);
      try {
        const res = await api.get(`/vehicles/${vehicleId}/tracking-links`);
        setTrackingLinks(res.data);
      } catch (err) {
        console.error("Error fetching tracking links:", err);
      } finally {
        setIsLoadingLinks(false);
      }
    };

    fetchLinks();
  }, [vehicleId]);

  const handleRevokeLink = async (linkId: string) => {
    try {
      await api.post(`/vehicles/${vehicleId}/tracking-links/${linkId}/revoke`);
      setTrackingLinks((prev) => prev.filter((link) => link.id !== linkId));
      showToast("Enlace de rastreo revocado");
    } catch (err) {
      console.error("Error revoking tracking link:", err);
      showToast("Error al revocar enlace", "error");
    }
  };

  const handleLinkGenerated = (newLink: TrackingLink) => {
    setTrackingLinks((prev) => [newLink, ...prev]);
  };

  const connectionStatus = useMemo(
    () => (isConnected ? "Connected" : "Disconnected"),
    [isConnected],
  );
  const fleetCount = Object.keys(fleet).length;

  // 1. EL BOTÓN SOLO CAMBIA EL ESTADO Y LA URL (Sin SSR reload)
  const handleVehicleSelection = useCallback((id?: string) => {
    const nextId = id || null;
    setSelectedVehicleId(nextId);

    // Al deseleccionar vehículo, salir del modo seguimiento
    if (!nextId) {
      setFollowedVehicleId(null);
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (nextId) {
        params.set("vehicleId", nextId);
      } else {
        params.delete("vehicleId");
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        "",
        newUrl,
      );
    }
  }, []);

  // Activar/desactivar modo seguimiento de un vehículo
  const handleToggleFollow = useCallback(
    (id: string) => {
      setFollowedVehicleId((prev) => {
        if (prev === id) {
          // Ya está siguiendo — desactivar
          return null;
        }
        return id;
      });
      // Colapsar el drawer en móvil para maximizar la vista del mapa
      if (isMobile) {
        setSnapPoint(closedHeight);
      }
    },
    [isMobile, closedHeight],
  );

  const handleExitFollow = useCallback(() => {
    setFollowedVehicleId(null);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    if (vehicleId) {
      // Expand the drawer to show the vehicle details immediately when a vehicle is selected.
      setSnapPoint(1);
    }
  }, [vehicleId, isMobile]);

  // 2. INICIALIZACIÓN BÁSICA DEL MAPA
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-79.5199, 8.9824], // Panamá
      zoom: 12,
    });

    map.current = mapInstance;

    const LABEL_ZOOM_THRESHOLD = 10;
    const updateLabelVisibility = () => {
      const visible = mapInstance.getZoom() >= LABEL_ZOOM_THRESHOLD;
      Object.values(markerElementsRef.current).forEach(({ labelEl }) => {
        if (labelEl) labelEl.style.opacity = visible ? "1" : "0";
      });
    };

    mapInstance.on("zoom", updateLabelVisibility);

    return () => {
      mapInstance.off("zoom", updateLabelVisibility);
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
      markerElementsRef.current = {};
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // Verificar si es pantalla móvil
  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Ocultar la etiqueta del vehículo seguido — el HUD ya lo identifica
  useEffect(() => {
    const currentZoom = map.current?.getZoom() ?? 0;
    Object.entries(markerElementsRef.current).forEach(([id, { labelEl }]) => {
      if (!labelEl) return;
      if (id === followedVehicleId) {
        labelEl.style.opacity = "0";
      } else {
        labelEl.style.opacity = currentZoom >= 10 ? "1" : "0";
      }
    });
  }, [followedVehicleId]);

  // 3. EFECTO DE MARCADORES (Renderizado limpio, sin etiquetas)
  useEffect(() => {
    if (!map.current) return;

    const vehicleIds = Object.keys(fleet);

    vehicleIds.forEach((id: string) => {
      const vehicle = fleet[id];
      const { latitude, longitude, angle, status } = vehicle;

      // Verificar si hay cambios reales en coordenadas, ángulo o estado antes de actualizar el DOM/Mapbox
      const last = lastAppliedStateRef.current[id];
      const hasChanged =
        !last ||
        last.lat !== latitude ||
        last.lng !== longitude ||
        last.angle !== angle ||
        last.status !== status;

      if (markersRef.current[id]) {
        if (hasChanged) {
          // 1. Mover el marcador en el mapa
          markersRef.current[id].setLngLat([longitude, latitude]);

          // 2. Usar referencias cacheadas para evitar querySelector y layout thrashing en Safari
          const cached = markerElementsRef.current[id];
          if (cached) {
            cached.pinContainer.style.transform = `rotate(${angle}deg)`;
            cached.masterEl.setAttribute("data-status", status);
          } else {
            const el = markersRef.current[id].getElement();
            const pinContainer = el.querySelector(
              ".marker-pin-container",
            ) as HTMLElement;
            const svgEl = el.querySelector("svg");
            const labelEl = el.querySelector(
              ".marker-label",
            ) as HTMLElement | null;
            if (pinContainer && svgEl) {
              pinContainer.style.transform = `rotate(${angle}deg)`;
              el.setAttribute("data-status", status);
              markerElementsRef.current[id] = {
                pinContainer,
                svgEl,
                masterEl: el,
                ...(labelEl && { labelEl }),
              };
            }
          }
          // Guardar el último estado aplicado
          lastAppliedStateRef.current[id] = {
            lat: latitude,
            lng: longitude,
            angle,
            status,
          };
        }
      } else {
        // --- CREACIÓN NATIVA DEL MARCADOR (A prueba de fallos en Mapbox) ---

        // A. Contenedor Maestro Mapbox
        const masterDiv = document.createElement("div");
        masterDiv.className = "vehicle-marker";
        masterDiv.setAttribute("data-status", status);
        masterDiv.style.width = "32px";
        masterDiv.style.height = "32px";
        masterDiv.style.display = "flex";
        masterDiv.style.alignItems = "center";
        masterDiv.style.justifyContent = "center";
        masterDiv.style.cursor = "pointer";
        masterDiv.style.position = "relative";
        masterDiv.style.overflow = "visible";
        // En Safari, los filtros CSS en el elemento padre son mucho más eficientes
        // que los filtros SVG individuales que causan re-rasterización continua.
        masterDiv.style.filter = "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.35))";

        // B. Contenedor de Rotación
        const rotContainer = document.createElement("div");
        rotContainer.className = "marker-pin-container";
        rotContainer.style.width = "100%";
        rotContainer.style.height = "100%";
        rotContainer.style.display = "flex";
        rotContainer.style.alignItems = "center";
        rotContainer.style.justifyContent = "center";
        rotContainer.style.transformOrigin = "center center";
        // Inyección del ángulo inicial con transición por hardware
        rotContainer.style.transform = `rotate(${angle}deg)`;
        rotContainer.style.transition =
          "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";

        // C. Creación estricta del SVG usando el Namespace correcto
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("fill", "currentColor"); // Hereda de style.color
        svg.style.display = "block";

        // D. Creación del Polígono (La flecha)
        const polygon = document.createElementNS(svgNS, "polygon");
        polygon.setAttribute("points", "12 2 19 21 12 17 5 21 12 2");

        // Ensamblaje del DOM nativo
        svg.appendChild(polygon);
        rotContainer.appendChild(svg);
        masterDiv.appendChild(rotContainer);

        // E. Badge de identificación del vehículo (placa o alias)
        const labelEl = document.createElement("div");
        labelEl.className = "marker-label";
        const rawLabel = vehicle.alias || vehicle.plateNumber;
        labelEl.textContent =
          rawLabel.length > 10 ? rawLabel.substring(0, 9) + "\u2026" : rawLabel;
        labelEl.style.position = "absolute";
        labelEl.style.top = "38px";
        labelEl.style.left = "50%";
        labelEl.style.transform = "translateX(-50%)";
        labelEl.style.whiteSpace = "nowrap";
        labelEl.style.fontSize = "10.5px";
        labelEl.style.fontWeight = "700";
        labelEl.style.fontFamily =
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        labelEl.style.letterSpacing = "0.04em";
        labelEl.style.color = "#0f172a";
        labelEl.style.background = "rgba(255, 255, 255, 0.96)";
        labelEl.style.border = "1px solid rgba(15, 23, 42, 0.1)";
        labelEl.style.borderRadius = "9999px";
        labelEl.style.padding = "2px 8px";
        labelEl.style.pointerEvents = "none";
        labelEl.style.lineHeight = "1.5";
        labelEl.style.opacity =
          map.current && map.current.getZoom() >= 10 ? "1" : "0";
        labelEl.style.transition = "opacity 0.25s ease";
        masterDiv.appendChild(labelEl);

        // Evento de selección
        masterDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          handleVehicleSelection(id);
        });

        // Instanciación en Mapbox
        const newMarker = new mapboxgl.Marker({
          element: masterDiv,
          rotationAlignment: "map",
          pitchAlignment: "map",
        })
          .setLngLat([longitude, latitude])
          .addTo(map.current!);

        markersRef.current[id] = newMarker;
        // Guardar referencias directas para optimizar actualizaciones en tiempo real
        markerElementsRef.current[id] = {
          pinContainer: rotContainer,
          svgEl: svg,
          masterEl: masterDiv,
          labelEl,
        };
        // Guardar el último estado aplicado
        lastAppliedStateRef.current[id] = {
          lat: latitude,
          lng: longitude,
          angle,
          status,
        };
      }
    });
  }, [fleet, handleVehicleSelection]);

  // Extraer coordenadas primitivas del vehículo seguido para evitar re-centrar el mapa cuando se mueven otros vehículos
  const followedLat =
    followedVehicleId && fleet[followedVehicleId]
      ? fleet[followedVehicleId].latitude
      : null;
  const followedLng =
    followedVehicleId && fleet[followedVehicleId]
      ? fleet[followedVehicleId].longitude
      : null;

  // Efecto de seguimiento continuo: re-centra el mapa suavemente cuando el vehículo seguido se mueve
  useEffect(() => {
    if (followedLat === null || followedLng === null || !map.current) return;

    map.current.easeTo({
      center: [followedLng, followedLat],
      duration: 800,
      easing: (t: number) => t,
    });
  }, [followedLat, followedLng]);

  // Centrar/volar al vehículo seleccionado cuando cambia el id del vehículo
  useEffect(() => {
    if (!map.current || !vehicleId || !fleet[vehicleId]) return;

    const { latitude, longitude } = fleet[vehicleId];
    const currentCenter = map.current.getCenter();
    const isAlreadyCentered =
      Math.abs(currentCenter.lng - longitude) < 0.001 &&
      Math.abs(currentCenter.lat - latitude) < 0.001;

    if (!isAlreadyCentered) {
      const fly = () => {
        if (!map.current) return;
        map.current.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          duration: 1200,
        });
      };

      if (map.current.isStyleLoaded()) {
        fly();
      } else {
        map.current.once("load", fly);
      }
    }
  }, [vehicleId]);

  // Encuadrar la flota una sola vez cuando se cargan los datos por primera vez
  useEffect(() => {
    if (!map.current || initialFitDone.current || vehicleId) return;

    const markers = Object.values(markersRef.current);
    if (markers.length > 0) {
      const fit = () => {
        if (!map.current) return;
        const bounds = new mapboxgl.LngLatBounds();
        markers.forEach((marker) => bounds.extend(marker.getLngLat()));

        map.current.fitBounds(bounds, {
          maxZoom: 14,
          duration: 1200,
        });
        initialFitDone.current = true;
      };

      if (map.current.isStyleLoaded()) {
        fit();
      } else {
        map.current.once("load", fit);
      }
    }
  }, [fleet, vehicleId]);

  const renderVehicleList = () => {
    if (fleetCount === 0) {
      return (
        <div className="p-8 text-center text-base-content/50 text-sm">
          No hay vehículos activos en la flota.
        </div>
      );
    }

    return (
      <div className="overflow-y-auto flex-1">
        {Object.entries(fleet).map(([id, vehicle]: [string, FleetVehicle]) => (
          <VehicleListItem
            key={id}
            id={id}
            vehicle={vehicle}
            onSelect={handleVehicleSelection}
          />
        ))}
      </div>
    );
  };

  const renderVehicleDetail = () => {
    const vehicle = fleet[vehicleId as string];
    if (!vehicle) {
      return (
        <div className="p-8 text-center text-base-content/50 text-sm">
          Cargando datos del vehículo...
        </div>
      );
    }

    const statusConfig = {
      MOVING: {
        label: "En movimiento",
        badgeClass:
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
        dotClass: "bg-emerald-500",
      },
      IDLING: {
        label: "En ralentí",
        badgeClass:
          "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
        dotClass: "bg-amber-500",
      },
      EXCESSIVE_IDLING: {
        label: "Ralentí excesivo",
        badgeClass:
          "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400",
        dotClass: "bg-rose-500",
      },
      STOPPED: {
        label: "Detenido",
        badgeClass:
          "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400",
        dotClass: "bg-slate-400",
      },
    };

    const config = statusConfig[
      vehicle.status as keyof typeof statusConfig
    ] || {
      label: "Detenido",
      badgeClass:
        "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400",
      dotClass: "bg-slate-400",
    };

    return (
      <div className="flex flex-col h-full relative text-base-content">
        {/* CONTENIDO DEL DETALLE (Scrollable) */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          {/* Main Info Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeClass}`}
              >
                <span
                  className={`size-2 rounded-full ${config.dotClass} ${vehicle.status === "MOVING" && "animate-ping"}`}
                />
                {config.label}
              </span>
            </div>

            <h3 className="text-xl font-extrabold tracking-tight">
              {vehicle.alias || `Vehículo ${vehicle.plateNumber}`}
            </h3>

            <p className="text-xs text-base-content/60 font-mono">
              {vehicle.make
                ? `${vehicle.make} ${vehicle.model || ""} ${vehicle.year ? `(${vehicle.year})` : ""}`
                : "Detalles de marca no registrados"}
            </p>

            <div className="text-xs flex items-center justify-end bg-base-200/40 p-2 rounded-xl mt-2">
              {/* <span className="text-base-content/50 font-medium">Conductor:</span> */}
              {vehicle.assignments?.[0]?.driver ? (
                <span className="font-bold text-base-content/90">
                  {vehicle.assignments[0].driver.firstName}{" "}
                  {vehicle.assignments[0].driver.lastName}
                </span>
              ) : (
                <span className="text-base-content/40 italic">
                  Sin conductor
                </span>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="btn btn-primary btn-sm flex-1 gap-2 flex items-center justify-center font-bold text-white shadow-md hover:shadow-lg transition-all"
              >
                <Share2 className="size-4" />
                Compartir
              </button>
              <Link
                href={`/vehicle/${vehicleId}/view`}
                className="btn btn-outline border-base-300 hover:bg-base-200 btn-sm flex-1 gap-2 flex items-center justify-center font-bold text-base-content transition-all"
              >
                <Eye className="size-4" />
                Ver
              </Link>
            </div>

            {/* Botón de seguimiento */}
            <button
              onClick={() => handleToggleFollow(vehicleId as string)}
              className={`btn btn-sm w-full gap-2 mt-1 transition-all ${followedVehicleId === vehicleId
                  ? "btn-success text-white shadow-md"
                  : "btn-outline border-base-300 hover:bg-base-200"
                }`}
            >
              <Locate
                className={`size-4 ${followedVehicleId === vehicleId ? "animate-pulse" : ""}`}
              />
              {followedVehicleId === vehicleId
                ? "Siguiendo..."
                : "Seguir vehículo"}
            </button>
          </div>

          <div className="divider my-0 opacity-40"></div>

          {/* Grid de telemetría en tiempo real */}
          <div>
            <h4 className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider mb-3">
              Telemetría en Vivo
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-base-200/50 border border-base-300/40 p-3.5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-base-content/50 font-bold uppercase">
                  Velocidad
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black font-mono tracking-tight text-primary">
                    {vehicle.speed ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-base-content/50">
                    km/h
                  </span>
                </div>
              </div>

              <div className="bg-base-200/50 border border-base-300/40 p-3.5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-base-content/50 font-bold uppercase">
                  Ultima actualizacion
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-base font-black font-mono tracking-tight">
                    {vehicle.updatedAt ? formatDate(vehicle.updatedAt) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="divider my-0 opacity-40"></div>

          {/* Detalles técnicos */}
          <div>
            <h4 className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider mb-3">
              Especificaciones Técnicas
            </h4>
            <div className="space-y-1 bg-base-200/45 border border-base-300/30 p-4 rounded-xl text-xs">
              <DetailRow
                label="Placa del vehículo"
                value={
                  <span className="font-bold text-base-content/90 font-mono bg-base-300/40 px-2 py-0.5 rounded">
                    {vehicle.plateNumber}
                  </span>
                }
                border={true}
                className="py-1"
              />
              <DetailRow
                label="Ubicación GPS"
                value={
                  <span className="font-semibold text-base-content/95 font-mono text-[10px]">
                    {vehicle.latitude != null
                      ? vehicle.latitude.toFixed(5)
                      : "0.00000"}
                    ,{" "}
                    {vehicle.longitude != null
                      ? vehicle.longitude.toFixed(5)
                      : "0.00000"}
                  </span>
                }
                border={false}
                className="py-1"
              />
            </div>
          </div>

          <div className="divider my-0 opacity-40"></div>

          {/* Enlaces de Rastreo */}
          <div className="pb-4">
            <h4 className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider mb-3">
              Enlaces de Rastreo Activos
            </h4>
            {isLoadingLinks ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            ) : trackingLinks.length === 0 ? (
              <p className="text-xs text-base-content/50 italic text-center py-2">
                No hay enlaces de rastreo activos.
              </p>
            ) : (
              <div className="space-y-3">
                {trackingLinks.map((link) => (
                  <div
                    key={link.id}
                    className="bg-base-200/50 border border-base-300/40 p-3 rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-base-content/90">
                        {link.clientName || "Cliente sin nombre"}
                      </p>
                      <p className="text-[10px] text-base-content/50 font-mono mt-0.5">
                        Expira en:{" "}
                        <ExpirationCountdown expiresAt={link.expiresAt} />
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(link.trackingUrl);
                          showToast("Link copiado al portapapeles");
                        }}
                        className="btn btn-ghost btn-circle btn-xs text-primary hover:bg-base-300"
                        title="Copiar Link"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleRevokeLink(link.id)}
                        className="btn btn-ghost btn-circle btn-xs text-error hover:bg-base-300"
                        title="Revocar Link"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ========================================= */}
      {/* DRAWER PRINCIPAL DESKTOP (DaisyUI)        */}
      {/* ========================================= */}

      <div className="drawer drawer-end lg:drawer-open h-full overflow-hidden">
        <input
          id="drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={!isMobile}
          readOnly
        />

        {/* CONTENIDO PRINCIPAL (MAPA) */}
        <div className="drawer-content relative h-full">
          <div ref={mapContainer} className="w-full h-full" />

          {/* HUD de seguimiento flotante */}
          {followedVehicleId &&
            fleet[followedVehicleId] &&
            (() => {
              const fv = fleet[followedVehicleId];
              const statusDotClass =
                fv.status === "MOVING"
                  ? "bg-emerald-400"
                  : fv.status === "IDLING"
                    ? "bg-amber-400"
                    : fv.status === "EXCESSIVE_IDLING"
                      ? "bg-rose-400"
                      : "bg-slate-400";
              return (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-base-100/90 backdrop-blur-md border border-base-300/60 shadow-md text-sm font-semibold text-base-content pointer-events-auto">
                  <span
                    className={`size-2 rounded-full ${statusDotClass} animate-pulse shrink-0`}
                  />
                  <span className="truncate max-w-[160px]">
                    {fv.alias || fv.plateNumber}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-base-content/50 hidden sm:inline">
                    {fv.speed} km/h
                  </span>
                  <button
                    onClick={handleExitFollow}
                    className="btn btn-ghost btn-circle btn-xs ml-1 hover:bg-base-200"
                    title="Salir del modo seguimiento"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })()}
        </div>

        {/* SIDEBAR */}
        <div className="drawer-side z-40 border-l border-base-300 shadow-2xl">
          <aside className="w-80 lg:w-72 lg:w-80 xl:w-96 min-h-full bg-base-100 text-base-content flex flex-col transition-[width] duration-300 ease-in-out">
            {/* HEADER UNIFICADO (h-16 fijo para alineación perfecta) */}
            <div className="h-16 px-4 border-b border-base-300 flex items-center shrink-0">
              {vehicleId ? (
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => handleVehicleSelection()}
                    className="btn btn-sm btn-ghost btn-square"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <h2 className="font-bold text-lg truncate">Detalles</h2>
                </div>
              ) : (
                <div className="flex justify-between items-center w-full">
                  <h2 className="font-bold text-lg">Mi Flota</h2>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm font-mono">
                      {fleetCount}
                    </span>
                    {/* Indicador de status pequeño si quieres */}
                    <div
                      className={`size - 2 rounded - full ${connectionStatus === "Connected" ? "bg-success" : "bg-error"} `}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CONTENIDO SCROLLABLE */}
            <div className="flex-1 overflow-y-auto bg-base-50/30">
              {vehicleId ? renderVehicleDetail() : renderVehicleList()}
            </div>
          </aside>
        </div>
      </div>

      {/* ========================================= */}
      {/* MOBILE BOTTOM SHEET (Vaul)                */}
      {/* ========================================= */}
      {isMobile && (
        <MobileFleetDrawer
          isMobile={isMobile}
          vehicleId={vehicleId}
          fleetCount={fleetCount}
          connectionStatus={connectionStatus}
          snapPoint={snapPoint}
          setSnapPoint={setSnapPoint}
          handleVehicleSelection={handleVehicleSelection}
          renderVehicleDetail={renderVehicleDetail}
          renderVehicleList={renderVehicleList}
          closedHeight={closedHeight}
          followedVehicleId={followedVehicleId}
          onExitFollow={handleExitFollow}
        />
      )}
      {/* Share location modal */}
      {vehicleId && (
        <ShareLocationModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          vehicleId={vehicleId}
          vehicleName={
            fleet[vehicleId]?.alias ||
            `Vehículo ${fleet[vehicleId]?.plateNumber}`
          }
          onLinkGenerated={handleLinkGenerated}
          showToast={showToast}
        />
      )}
      {/* Toasts */}
      {toast && (
        <div className="toast toast-center md:toast-end z-[10000] animate-in fade-in duration-200">
          <div
            className={`alert ${toast.type === "success" ? "alert-success text-white" : "alert-error text-white"} shadow-lg text-xs font-semibold`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
