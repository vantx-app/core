"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import api from "@/utils/client/api-client";
import { 
  ArrowLeft, 
  MapPin, 
  RefreshCw, 
  Filter, 
  Compass, 
  Gauge, 
  Layers, 
  Layers2, 
  Database,
  HelpCircle
} from "lucide-react";
import Link from "next/link";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

// Color coding mapping based on Functional Class (FC)
const FC_COLORS: Record<number, string> = {
  1: "#6366f1", // Indigo - Autopistas / Corredores (FC1)
  2: "#06b6d4", // Cyan - Carreteras (FC2)
  3: "#10b981", // Emerald - Avenidas Principales (FC3)
  4: "#f59e0b", // Amber - Colectoras / Avenidas Menores (FC4)
  5: "#ef4444", // Rose - Calles Residenciales / Locales (FC5)
};

const FC_NAMES: Record<number, string> = {
  1: "FC1: Autopistas / Corredores",
  2: "FC2: Carreteras Principales",
  3: "FC3: Avenidas / Arterias",
  4: "FC4: Calles Colectoras",
  5: "FC5: Calles Residenciales / Locales",
};

export default function SegmentsMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // States
  const [geojsonData, setGeojsonData] = useState<any>({ type: "FeatureCollection", features: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportOnly, setViewportOnly] = useState(false);
  const [selectedFc, setSelectedFc] = useState<number | "all">("all");
  const [stats, setStats] = useState({ total: 0, filtered: 0 });

  // Hovered and Selected Segment states
  const [selectedSegment, setSelectedSegment] = useState<any | null>(null);

  // Fetch segments data
  const fetchSegments = async (currentMap?: mapboxgl.Map) => {
    const activeMap = currentMap || map.current;
    if (!activeMap) return;

    setLoading(true);
    setError(null);

    try {
      let url = "/map-links";
      if (viewportOnly) {
        const bounds = activeMap.getBounds();
        if (!bounds) return;
        const minLng = bounds.getWest();
        const minLat = bounds.getSouth();
        const maxLng = bounds.getEast();
        const maxLat = bounds.getNorth();
        url = `/map-links?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`;
      }

      const response = await api.get(url);
      const data = response.data;
      setGeojsonData(data);
      setStats({
        total: data.features.length,
        filtered: data.features.length,
      });
    } catch (err: any) {
      console.error("Error fetching map links:", err);
      setError(err.message || "Error al cargar los segmentos");
    } finally {
      setLoading(false);
    }
  };

  // Setup Mapbox map instance
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11", // Sleek premium dark mode to make neon segments pop
      center: [-79.5199, 8.9824], // Panamá City
      zoom: 12,
      pitch: 0,
      maxPitch: 0,
      minPitch: 0,
      pitchWithRotate: false,
      touchPitch: false,
    });

    map.current = mapInstance;

    // Add controls
    mapInstance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    mapInstance.on("load", () => {
      // 1. Add GeoJSON Source
      mapInstance.addSource("segments", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // 2. Add Line Layer for Segments
      mapInstance.addLayer({
        id: "segments-line",
        type: "line",
        source: "segments",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          // Color dynamically based on functional class
          "line-color": [
            "match",
            ["get", "functionalClass"],
            1, FC_COLORS[1],
            2, FC_COLORS[2],
            3, FC_COLORS[3],
            4, FC_COLORS[4],
            5, FC_COLORS[5],
            "#94a3b8" // Fallback Slate color
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 1.5,
            14, 3,
            18, 6
          ],
          "line-opacity": 0.85,
        },
      });

      // 3. Add directional arrows layer using repeat symbols
      mapInstance.addLayer({
        id: "segments-arrows",
        type: "symbol",
        source: "segments",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 75,
          "text-field": "▶",
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 7,
            14, 10,
            18, 14
          ],
          "text-keep-upright": false,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": [
            "match",
            ["get", "functionalClass"],
            1, "#ffffff", // white arrows on dark corridors
            "#1e293b" // dark grey on others
          ],
          "text-opacity": 0.75,
          "text-halo-color": "#ffffff",
          "text-halo-width": [
            "match",
            ["get", "functionalClass"],
            1, 0,
            1
          ],
        },
      });

      // 4. Add Interactive Hover and Click Events
      mapInstance.on("click", "segments-line", (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;
        const geom = feature.geometry as any;

        // Extract raw coordinates for display
        const coords = geom.coordinates;
        setSelectedSegment({
          linkId: props.linkId,
          functionalClass: props.functionalClass,
          speedLimit: props.speedLimit,
          heading: props.heading,
          pointsCount: coords.length,
          coords: coords,
        });

        // Add standard popup on clicked location
        if (popupRef.current) popupRef.current.remove();

        const popup = new mapboxgl.Popup({ closeButton: true, className: "rounded-xl overflow-hidden font-sans" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2 space-y-1.5 text-slate-800 text-xs">
              <div class="font-black text-slate-900 border-b pb-1">Segmento: ${props.linkId}</div>
              <div><strong>Clase:</strong> ${FC_NAMES[props.functionalClass] || `FC${props.functionalClass}`}</div>
              <div><strong>Velocidad Máx:</strong> ${props.speedLimit} km/h</div>
              <div><strong>Rumbo aprox:</strong> ${props.heading}° (${getCardinals(props.heading)})</div>
              <div class="text-[10px] text-slate-400">Total puntos: ${coords.length}</div>
            </div>
          `)
          .addTo(mapInstance);

        popupRef.current = popup;
      });

      // Change cursor on hover
      mapInstance.on("mouseenter", "segments-line", () => {
        mapInstance.getCanvas().style.cursor = "pointer";
      });
      mapInstance.on("mouseleave", "segments-line", () => {
        mapInstance.getCanvas().style.cursor = "";
      });

      // Initial Fetch after map loads
      fetchSegments(mapInstance);
    });

    // Listen to bounds updates if viewportOnly is enabled
    mapInstance.on("moveend", () => {
      if (viewportOnly) {
        fetchSegments(mapInstance);
      }
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
      mapInstance.remove();
      map.current = null;
    };
  }, [viewportOnly]);

  // Handle filtering updates
  const filteredGeojson = useMemo(() => {
    if (!geojsonData.features) return { type: "FeatureCollection", features: [] };

    let filtered = geojsonData.features;

    // Filter by Functional Class
    if (selectedFc !== "all") {
      filtered = filtered.filter((f: any) => f.properties.functionalClass === selectedFc);
    }

    const collection = {
      type: "FeatureCollection" as const,
      features: filtered,
    };

    // Update map layer source data dynamically without reloading the map!
    if (map.current && map.current.getSource("segments")) {
      (map.current.getSource("segments") as mapboxgl.GeoJSONSource).setData(collection);
    }

    // Recalculate filtered stats count
    setStats((prev) => ({
      ...prev,
      filtered: filtered.length,
    }));

    return collection;
  }, [geojsonData, selectedFc]);

  // Effect to toggle viewportOnly fetching
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      fetchSegments();
    }
  }, [viewportOnly]);

  // Translate heading degrees to cardinal directions
  const getCardinals = (deg: number): string => {
    if (deg >= 337.5 || deg < 22.5) return "Norte ↑";
    if (deg >= 22.5 && deg < 67.5) return "Noreste ↗";
    if (deg >= 67.5 && deg < 112.5) return "Este →";
    if (deg >= 112.5 && deg < 157.5) return "Sureste ↘";
    if (deg >= 157.5 && deg < 202.5) return "Sur ↓";
    if (deg >= 202.5 && deg < 247.5) return "Suroeste ↙";
    if (deg >= 247.5 && deg < 292.5) return "Oeste ←";
    return "Noroeste ↖";
  };

  const handleZoomToCoordinates = (coords: [number, number][]) => {
    if (!map.current || coords.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    map.current.fitBounds(bounds, {
      padding: 100,
      maxZoom: 16,
      duration: 1000,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-96 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-6 flex flex-col justify-between overflow-y-auto shrink-0 z-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Volver al Panel
            </Link>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Layers2 className="text-indigo-500 size-6" />
              Segmentos de Ruta
            </h2>
            <p className="text-xs text-slate-400">
              Visualiza y valida los segmentos de calle (`MapLink`) que almacena el sistema de autolearning durante la recolección de rutas.
            </p>
          </div>

          <div className="divider border-slate-800/60 my-0"></div>

          {/* Mode Switcher */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database className="size-3.5" />
              Modo de Carga de Datos
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewportOnly(false)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  !viewportOnly 
                    ? "bg-indigo-600 text-white shadow" 
                    : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                }`}
              >
                Todo el Caché
              </button>
              <button
                onClick={() => setViewportOnly(true)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  viewportOnly 
                    ? "bg-indigo-600 text-white shadow" 
                    : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                }`}
              >
                Por Vista Map
              </button>
            </div>
            <div className="flex items-start gap-1.5 mt-1">
              <HelpCircle className="size-3.5 text-slate-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500 leading-normal">
                {viewportOnly 
                  ? "Carga solo segmentos en la zona visible del mapa. Útil si hay miles de segmentos en el país." 
                  : "Carga todos los segmentos cargados en la BD (límite de 5000) de forma global."
                }
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Filter className="size-3.5" />
              Filtrar por Clase Funcional
            </label>
            <select
              value={selectedFc}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFc(val === "all" ? "all" : parseInt(val, 10));
              }}
              className="select select-bordered select-sm w-full bg-slate-950 border-slate-800 text-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 focus:outline-none text-xs h-9"
            >
              <option value="all">Todas las clases funcionales</option>
              <option value="1">FC1: Autopistas / Corredores (110 km/h)</option>
              <option value="2">FC2: Carreteras Principales (80 km/h)</option>
              <option value="3">FC3: Avenidas / Arterias (60 km/h)</option>
              <option value="4">FC4: Calles Colectoras (60 km/h)</option>
              <option value="5">FC5: Calles Residenciales / Locales (40 km/h)</option>
            </select>
          </div>

          {/* Legend */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Leyenda Visual
            </label>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2.5">
              {Object.entries(FC_COLORS).map(([fc, color]) => (
                <div key={fc} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-1 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-slate-300 font-medium">{FC_NAMES[parseInt(fc, 10)]}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold">
                    {parseInt(fc, 10) === 1 ? "110km/h" : parseInt(fc, 10) === 2 ? "80km/h" : parseInt(fc, 10) === 5 ? "40km/h" : "60km/h"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Segment Info Details & Statistics */}
        <div className="mt-8 space-y-5">
          {/* Selected details */}
          {selectedSegment ? (
            <div className="bg-slate-950 border border-indigo-500/30 p-4 rounded-2xl space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Decorative top border accent */}
              <div 
                className="absolute top-0 left-0 right-0 h-1" 
                style={{ backgroundColor: FC_COLORS[selectedSegment.functionalClass] || "#cbd5e1" }}
              />
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-extrabold text-xs text-white truncate max-w-[150px]">
                  ID: {selectedSegment.linkId}
                </span>
                <button
                  onClick={() => handleZoomToCoordinates(selectedSegment.coords)}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all"
                >
                  <MapPin className="size-3" />
                  Centrar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Clase</span>
                  <span className="font-bold text-slate-200">FC{selectedSegment.functionalClass}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Velocidad</span>
                  <span className="font-bold text-slate-200 flex items-center gap-1">
                    <Gauge className="size-3.5 text-slate-400" />
                    {selectedSegment.speedLimit} km/h
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Rumbo</span>
                  <span className="font-bold text-indigo-400 flex items-center gap-1">
                    <Compass className="size-3.5" />
                    {selectedSegment.heading}° ({getCardinals(selectedSegment.heading)})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Vértices</span>
                  <span className="font-bold text-slate-200">{selectedSegment.pointsCount} pts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 border-dashed p-4 rounded-2xl text-center text-xs text-slate-500 py-6">
              Haz clic en un segmento en el mapa para inspeccionar sus coordenadas de rumbo y velocidad.
            </div>
          )}

          {/* Bottom Stats */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Métricas de Carga</span>
              <div className="text-slate-200 font-bold flex items-center gap-2">
                <span className="text-white text-sm font-black">{stats.filtered}</span>
                {selectedFc !== "all" && (
                  <span className="text-[10px] text-slate-500">de {stats.total} total</span>
                )}
              </div>
            </div>
            <button
              onClick={() => fetchSegments()}
              disabled={loading}
              className="btn btn-circle btn-ghost btn-sm text-slate-400 hover:text-white"
            >
              <RefreshCw className={`size-4 ${loading && "animate-spin"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Panel */}
      <div className="flex-1 relative h-full">
        {/* Loading Spinner Overlays */}
        {loading && (
          <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs text-white shadow-2xl backdrop-blur-md z-20">
            <RefreshCw className="size-3.5 animate-spin text-indigo-400" />
            <span>Cargando segmentos...</span>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-4 right-4 lg:right-auto bg-rose-500/10 border border-rose-500/30 px-4 py-3 rounded-xl flex items-center gap-2 text-xs text-rose-300 shadow-2xl backdrop-blur-md z-20 max-w-md">
            <HelpCircle className="size-4 shrink-0" />
            <span>Error: {error}</span>
          </div>
        )}

        {/* Map Container */}
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
}
