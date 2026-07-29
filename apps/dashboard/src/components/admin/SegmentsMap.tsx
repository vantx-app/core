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
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Save,
  Check
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

// Helper to generate crisp Canvas icons for 1-way (▶) and 2-way (◀━━▶) road segments
const createArrowIconImageData = (isBidi: boolean): ImageData => {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;

  if (isBidi) {
    // 2-Way Double Arrow (◀ ━━ ▶)
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(2, 16);
    ctx.lineTo(10, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(22, 8);
    ctx.lineTo(30, 16);
    ctx.lineTo(22, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(4, 16);
    ctx.lineTo(28, 16);
    ctx.stroke();
  } else {
    // 1-Way Single Arrowhead (▶)
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(26, 16);
    ctx.lineTo(8, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, 32, 32);
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
  const [verificationFilter, setVerificationFilter] = useState<"all" | "unverified" | "verified">("all");
  const [stats, setStats] = useState({ total: 0, filtered: 0, unverified: 0, verified: 0 });

  // Selected Segment & Training Edit states
  const [selectedSegment, setSelectedSegment] = useState<any | null>(null);
  const [editSpeedLimit, setEditSpeedLimit] = useState<number>(60);
  const [editFc, setEditFc] = useState<number>(3);
  const [editBidi, setEditBidi] = useState<boolean>(true);
  const [savingSegment, setSavingSegment] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Sync viewportOnly ref to avoid stale closures in Mapbox callbacks
  const viewportOnlyRef = useRef(viewportOnly);
  useEffect(() => {
    viewportOnlyRef.current = viewportOnly;
  }, [viewportOnly]);

  // Fetch segments data
  const fetchSegments = async (currentMap?: mapboxgl.Map) => {
    const activeMap = currentMap || map.current;
    if (!activeMap) return;

    setLoading(true);
    setError(null);

    try {
      let url = "/map-links";
      if (viewportOnlyRef.current) {
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
    } catch (err: any) {
      console.error("Error fetching map links:", err);
      setError(err.message || "Error al cargar los segmentos");
    } finally {
      setLoading(false);
    }
  };

  // Setup Mapbox map instance (only runs once on mount)
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
      // Load custom vector Canvas arrow icons
      const bidiImageData = createArrowIconImageData(true);
      const onewayImageData = createArrowIconImageData(false);

      mapInstance.addImage("icon-arrow-bidi", { width: 32, height: 32, data: new Uint8Array(bidiImageData.data.buffer) });
      mapInstance.addImage("icon-arrow-oneway", { width: 32, height: 32, data: new Uint8Array(onewayImageData.data.buffer) });

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

      // 3. Add directional icons layer along segments
      mapInstance.addLayer({
        id: "segments-arrows",
        type: "symbol",
        source: "segments",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 80,
          "icon-image": [
            "case",
            ["==", ["get", "isBidirectional"], true],
            "icon-arrow-bidi",
            "icon-arrow-oneway"
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 0.35,
            14, 0.55,
            18, 0.8
          ],
          "icon-rotation-alignment": "map",
          "icon-keep-upright": false,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
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
        const isBidi = props.isBidirectional !== false;
        const isVerif = props.isVerified === true;

        setSelectedSegment({
          linkId: props.linkId,
          functionalClass: props.functionalClass,
          speedLimit: props.speedLimit,
          heading: props.heading,
          isBidirectional: isBidi,
          isVerified: isVerif,
          pointsCount: coords.length,
          coords: coords,
        });

        setEditSpeedLimit(props.speedLimit);
        setEditFc(props.functionalClass);
        setEditBidi(isBidi);
        setSaveSuccess(null);

        // Add standard popup on clicked location
        if (popupRef.current) popupRef.current.remove();

        const verifBadge = isVerif
          ? `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">🟢 Verificado</span>`
          : `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">⚠️ Por Verificar</span>`;

        const popup = new mapboxgl.Popup({ closeButton: true, className: "rounded-xl overflow-hidden font-sans" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2 space-y-1.5 text-slate-800 text-xs">
              <div class="font-black text-slate-900 border-b pb-1 flex items-center justify-between">
                <span>Segmento: ${props.linkId}</span>
                ${verifBadge}
              </div>
              <div><strong>Clase:</strong> ${FC_NAMES[props.functionalClass] || `FC${props.functionalClass}`}</div>
              <div><strong>Velocidad Máx:</strong> ${props.speedLimit} km/h</div>
              <div><strong>Sentido:</strong> ${isBidi ? "↔ Doble sentido" : "➔ Un solo sentido"}</div>
              <div><strong>Rumbo:</strong> ${props.heading}° (${getCardinals(props.heading)})</div>
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
      if (viewportOnlyRef.current) {
        fetchSegments(mapInstance);
      }
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // Save / Verify Manual Training for Segment
  const handleSaveSegment = async () => {
    if (!selectedSegment) return;
    setSavingSegment(true);
    setSaveSuccess(null);
    try {
      await api.patch(`/map-links/${selectedSegment.linkId}`, {
        speedLimit: Number(editSpeedLimit),
        functionalClass: Number(editFc),
        isBidirectional: editBidi,
        isVerified: true,
      });

      // Update selectedSegment local state
      setSelectedSegment((prev: any) =>
        prev
          ? {
              ...prev,
              speedLimit: Number(editSpeedLimit),
              functionalClass: Number(editFc),
              isBidirectional: editBidi,
              isVerified: true,
            }
          : null
      );

      // Update GeoJSON features in memory
      setGeojsonData((prev: any) => {
        if (!prev.features) return prev;
        const newFeatures = prev.features.map((f: any) => {
          if (f.properties.linkId === selectedSegment.linkId) {
            return {
              ...f,
              properties: {
                ...f.properties,
                speedLimit: Number(editSpeedLimit),
                functionalClass: Number(editFc),
                isBidirectional: editBidi,
                isVerified: true,
              },
            };
          }
          return f;
        });
        return { ...prev, features: newFeatures };
      });

      setSaveSuccess("Segmento verificado y guardado en la BD correctamente.");
    } catch (err: any) {
      console.error("Error updating map link:", err);
      alert(err.message || "Error al actualizar segmento");
    } finally {
      setSavingSegment(false);
    }
  };

  // Handle filtering updates
  const filteredGeojson = useMemo(() => {
    if (!geojsonData.features) return { type: "FeatureCollection", features: [] };

    let filtered = geojsonData.features;

    // Filter by Functional Class
    if (selectedFc !== "all") {
      filtered = filtered.filter((f: any) => f.properties.functionalClass === selectedFc);
    }

    // Filter by Verification Status
    if (verificationFilter === "unverified") {
      filtered = filtered.filter((f: any) => f.properties.isVerified === false);
    } else if (verificationFilter === "verified") {
      filtered = filtered.filter((f: any) => f.properties.isVerified === true);
    }

    const collection = {
      type: "FeatureCollection" as const,
      features: filtered,
    };

    // Update map layer source data dynamically without reloading the map!
    if (map.current && map.current.getSource("segments")) {
      (map.current.getSource("segments") as mapboxgl.GeoJSONSource).setData(collection);
    }

    return collection;
  }, [geojsonData, selectedFc, verificationFilter]);

  // Keep stats count in sync cleanly without side-effects in useMemo
  useEffect(() => {
    const features = geojsonData.features || [];
    const unverified = features.filter((f: any) => f.properties.isVerified === false).length;
    const verified = features.filter((f: any) => f.properties.isVerified === true).length;
    setStats({
      total: features.length,
      filtered: filteredGeojson.features ? filteredGeojson.features.length : 0,
      unverified,
      verified,
    });
  }, [geojsonData, filteredGeojson]);

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
          <div className="space-y-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                Estado de Entrenamiento / Verificación
              </label>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value as any)}
                className="select select-bordered select-sm w-full bg-slate-950 border-slate-800 text-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 focus:outline-none text-xs h-9"
              >
                <option value="all">Todos los segmentos ({stats.total})</option>
                <option value="unverified">⚠️ Por Verificar / Fallback ({stats.unverified})</option>
                <option value="verified">🟢 Verificados (OSM / Manual) ({stats.verified})</option>
              </select>
            </div>
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

        {/* Selected Segment Info Details & Manual Training Panel */}
        <div className="mt-8 space-y-5">
          {/* Selected details */}
          {selectedSegment ? (
            <div className="bg-slate-950 border border-indigo-500/30 p-4 rounded-2xl space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Decorative top border accent */}
              <div 
                className="absolute top-0 left-0 right-0 h-1" 
                style={{ backgroundColor: FC_COLORS[selectedSegment.functionalClass] || "#cbd5e1" }}
              />
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="space-y-0.5">
                  <span className="font-black text-xs text-white block truncate max-w-[170px]">
                    {selectedSegment.linkId}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedSegment.isVerified ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="size-3" /> Verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        <AlertTriangle className="size-3" /> Por Verificar
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleZoomToCoordinates(selectedSegment.coords)}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all"
                >
                  <MapPin className="size-3" />
                  Centrar
                </button>
              </div>

              {/* Readonly Specs */}
              <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Rumbo</span>
                  <span className="font-bold text-indigo-400 flex items-center gap-1">
                    <Compass className="size-3" />
                    {selectedSegment.heading}°
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Sentido</span>
                  <span className="font-bold text-slate-300">
                    {selectedSegment.isBidirectional ? "↔ Doble" : "➔ 1 Sentido"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Geometría</span>
                  <span className="font-bold text-slate-300">{selectedSegment.pointsCount} pts</span>
                </div>
              </div>

              {/* Editable Training Form */}
              <div className="space-y-3 pt-1 border-t border-slate-800">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                  🛠️ Entrenamiento / Modificación Manual
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Velocidad Máx (km/h)
                    </label>
                    <input
                      type="number"
                      value={editSpeedLimit}
                      onChange={(e) => setEditSpeedLimit(Number(e.target.value))}
                      className="input input-sm w-full bg-slate-900 border-slate-800 text-slate-100 font-bold rounded-lg text-xs"
                      min={10}
                      max={140}
                      step={5}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Clase Funcional
                    </label>
                    <select
                      value={editFc}
                      onChange={(e) => setEditFc(Number(e.target.value))}
                      className="select select-sm w-full bg-slate-900 border-slate-800 text-slate-100 font-bold rounded-lg text-xs"
                    >
                      <option value={1}>FC1 (110 km/h)</option>
                      <option value={2}>FC2 (80 km/h)</option>
                      <option value={3}>FC3 (60 km/h)</option>
                      <option value={4}>FC4 (60 km/h)</option>
                      <option value={5}>FC5 (40 km/h)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-xs">
                  <span className="text-[10px] font-bold text-slate-300">¿Es Doble Sentido?</span>
                  <button
                    type="button"
                    onClick={() => setEditBidi(!editBidi)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                      editBidi ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {editBidi ? "↔ Doble Sentido" : "➔ Un Solo Sentido"}
                  </button>
                </div>

                {saveSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                <button
                  onClick={handleSaveSegment}
                  disabled={savingSegment}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  <Save className="size-3.5" />
                  {savingSegment ? "Guardando..." : "Guardar y Verificar Segmento"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 border-dashed p-4 rounded-2xl text-center text-xs text-slate-500 py-6 space-y-1">
              <p className="font-bold text-slate-400">Inspección de Segmentos</p>
              <p className="text-[11px]">Haz clic en cualquier segmento en el mapa para entrenar su velocidad máxima o verificar su clase funcional.</p>
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
