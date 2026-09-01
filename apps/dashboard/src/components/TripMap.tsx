"use client";

import { Coordinate, TripMapProps } from "@/types";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DEFAULT_MAP_CONFIG } from "@/utils/client";
import { Flame, Route } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function TripMap({
  coordinates,
  isOngoing = false,
  isFullscreen = false,
  isMachinery = false,
  defaultMode,
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const initialMode = defaultMode || (isMachinery ? "heatmap" : "route");
  const [mapMode, setMapMode] = useState<"route" | "heatmap">(initialMode);

  // Sync mode if isMachinery or defaultMode changes
  useEffect(() => {
    if (defaultMode) {
      setMapMode(defaultMode);
    } else if (isMachinery) {
      setMapMode("heatmap");
    }
  }, [isMachinery, defaultMode]);

  // 1. Inicialización del mapa (una sola vez)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Centrado inicial por defecto en Panamá o primer punto si existe
    const initialCenter: [number, number] =
      coordinates.length > 0
        ? [coordinates[0].longitude, coordinates[0].latitude]
        : [-79.5199, 8.9824];

    const map = new mapboxgl.Map({
      ...DEFAULT_MAP_CONFIG,
      container: mapContainer.current,
      center: initialCenter,
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Registrar fuente de ruta (LineString)
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      // Capa de ruta
      map.addLayer({
        id: "route-layer",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: initialMode === "route" ? "visible" : "none",
        },
        paint: {
          "line-color":
            typeof window !== "undefined"
              ? getComputedStyle(document.documentElement)
                  .getPropertyValue("--color-route-path")
                  .trim() || "#2563eb"
              : "#2563eb",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });

      // Registrar fuente de puntos de calor (FeatureCollection)
      map.addSource("heatmap-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Capa de mapa de calor (Zona de Trabajo)
      map.addLayer({
        id: "heatmap-layer",
        type: "heatmap",
        source: "heatmap-points",
        maxzoom: 18,
        layout: {
          visibility: initialMode === "heatmap" ? "visible" : "none",
        },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            15,
            3,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33, 102, 172, 0)",
            0.2,
            "rgb(103, 169, 207)",
            0.4,
            "rgb(209, 229, 240)",
            0.6,
            "rgb(253, 219, 199)",
            0.8,
            "rgb(239, 138, 98)",
            1,
            "rgb(178, 24, 43)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            4,
            13,
            20,
            16,
            35,
            18,
            50,
          ],
          "heatmap-opacity": 0.85,
        },
      });

      // Capa de círculos individuales al hacer zoom profundo en el heatmap
      map.addLayer({
        id: "heatmap-circles",
        type: "circle",
        source: "heatmap-points",
        minzoom: 14,
        layout: {
          visibility: initialMode === "heatmap" ? "visible" : "none",
        },
        paint: {
          "circle-radius": 4,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.8,
        },
      });

      // Si ya hay coordenadas cargadas, dibujarlas
      if (coordinates.length > 0) {
        drawMapData(coordinates);
      }
    });

    return () => {
      if (startMarkerRef.current) startMarkerRef.current.remove();
      if (endMarkerRef.current) endMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Controlar visibilidad según mapMode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer("route-layer")) {
      map.setLayoutProperty(
        "route-layer",
        "visibility",
        mapMode === "route" ? "visible" : "none",
      );
    }
    if (map.getLayer("heatmap-layer")) {
      map.setLayoutProperty(
        "heatmap-layer",
        "visibility",
        mapMode === "heatmap" ? "visible" : "none",
      );
    }
    if (map.getLayer("heatmap-circles")) {
      map.setLayoutProperty(
        "heatmap-circles",
        "visibility",
        mapMode === "heatmap" ? "visible" : "none",
      );
    }
  }, [mapMode]);

  // 3. Escuchar cambios en las coordenadas
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapRef.current.isStyleLoaded()) {
      drawMapData(coordinates);
    } else {
      mapRef.current.once("load", () => drawMapData(coordinates));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates]);

  // 4. Redimensionar el mapa cuando cambia el estado de pantalla completa
  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  const drawMapData = (coords: Coordinate[]) => {
    const map = mapRef.current;
    if (!map) return;

    map.resize();

    // Limpiar marcadores antiguos
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

    if (!coords || coords.length === 0) {
      const routeSource = map.getSource("route") as mapboxgl.GeoJSONSource;
      if (routeSource) {
        routeSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        });
      }
      const heatmapSource = map.getSource(
        "heatmap-points",
      ) as mapboxgl.GeoJSONSource;
      if (heatmapSource) {
        heatmapSource.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      return;
    }

    // A. Actualizar la polilínea del recorrido
    const lineCoords = coords.map((c) => [c.longitude, c.latitude]);
    const routeSource = map.getSource("route") as mapboxgl.GeoJSONSource;
    if (routeSource) {
      routeSource.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: lineCoords,
        },
      });
    }

    // B. Actualizar fuente de mapa de calor
    const pointFeatures = coords.map((c) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Point" as const,
        coordinates: [c.longitude, c.latitude],
      },
    }));
    const heatmapSource = map.getSource(
      "heatmap-points",
    ) as mapboxgl.GeoJSONSource;
    if (heatmapSource) {
      heatmapSource.setData({
        type: "FeatureCollection",
        features: pointFeatures,
      });
    }

    // C. Crear marcador de Inicio
    const startEl = document.createElement("div");
    startEl.className =
      "w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md trip-marker-start";
    startEl.innerText = "I";
    startEl.title = "Inicio del Viaje / Turno";

    const startMarker = new mapboxgl.Marker({ element: startEl })
      .setLngLat([coords[0].longitude, coords[0].latitude])
      .addTo(map);
    startMarkerRef.current = startMarker;

    // D. Crear marcador de Fin
    if (coords.length > 1) {
      const endEl = document.createElement("div");

      if (isOngoing) {
        endEl.className =
          "w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md trip-marker-end-active animate-pulse";
        endEl.innerText = "A";
        endEl.title = "Posición Activa";
      } else {
        endEl.className =
          "w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md trip-marker-end-final";
        endEl.innerText = "F";
        endEl.title = "Fin del Viaje / Turno";
      }

      const endMarker = new mapboxgl.Marker({ element: endEl })
        .setLngLat([
          coords[coords.length - 1].longitude,
          coords[coords.length - 1].latitude,
        ])
        .addTo(map);
      endMarkerRef.current = endMarker;
    }

    // E. Encuadrar toda la ruta en pantalla
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend([c.longitude, c.latitude]));
    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 16,
      duration: 1000,
    });
  };

  return (
    <div
      className={`w-full h-full relative overflow-hidden ${
        isFullscreen ? "rounded-none border-none" : "rounded-2xl border border-base-300"
      }`}
    >
      <div ref={mapContainer} className="w-full h-full" />

      {/* Control Selector de Modo: Ruta vs Mapa de Calor */}
      <div className="absolute top-4 right-4 z-30 flex items-center bg-base-100/90 backdrop-blur-md p-1 rounded-xl shadow-lg border border-base-300/80 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setMapMode("route")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all duration-200 ${
            mapMode === "route"
              ? "bg-primary text-primary-content shadow-sm"
              : "text-base-content/70 hover:text-base-content hover:bg-base-200/60"
          }`}
          title="Ver trazado lineal del viaje"
        >
          <Route className="size-3.5" />
          <span>Ruta</span>
        </button>

        <button
          type="button"
          onClick={() => setMapMode("heatmap")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all duration-200 ${
            mapMode === "heatmap"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-base-content/70 hover:text-base-content hover:bg-base-200/60"
          }`}
          title="Ver concentración de actividad / zona de trabajo"
        >
          <Flame className="size-3.5" />
          <span>Mapa de Calor</span>
          {isMachinery && (
            <span className="badge badge-xs bg-white text-amber-700 font-bold border-none ml-0.5">
              Equipo
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
