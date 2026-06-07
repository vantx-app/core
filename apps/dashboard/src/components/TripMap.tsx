'use client';

import { Coordinate, TripMapProps } from '@/types';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function TripMap({ coordinates, isOngoing = false, isFullscreen = false }: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // 1. Inicialización del mapa (una sola vez)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Centrado inicial por defecto en Panamá o primer punto si existe
    const initialCenter: [number, number] = coordinates.length > 0
      ? [coordinates[0].longitude, coordinates[0].latitude]
      : [-79.5199, 8.9824];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: 13,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Registrar fuente y capa de ruta vacías al inicio
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      });

      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': typeof window !== 'undefined'
            ? getComputedStyle(document.documentElement).getPropertyValue('--color-route-path').trim() || '#2563eb'
            : '#2563eb',
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });

      // Si ya hay coordenadas cargadas, dibujarlas
      if (coordinates.length > 0) {
        drawRoute(coordinates);
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

  // 2. Escuchar cambios en las coordenadas para actualizar la ruta y los marcadores
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapRef.current.isStyleLoaded()) {
      drawRoute(coordinates);
    } else {
      mapRef.current.once('load', () => drawRoute(coordinates));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates]);

  // 3. Redimensionar el mapa cuando cambia el estado de pantalla completa
  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  const drawRoute = (coords: Coordinate[]) => {
    const map = mapRef.current;
    if (!map) return;

    // Redimensionar el mapa al dibujar (vital para contenedores flex/móviles dinámicos)
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
      const source = map.getSource('route') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        });
      }
      return;
    }

    // A. Actualizar la polilínea del recorrido
    const lineCoords = coords.map(c => [c.longitude, c.latitude]);
    const source = map.getSource('route') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: lineCoords,
        },
      });
    }

    // B. Crear marcador de Inicio (Verde vía CSS class)
    const startEl = document.createElement('div');
    startEl.className = 'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md trip-marker-start';
    startEl.innerText = 'I';
    startEl.title = 'Inicio del Viaje';

    const startMarker = new mapboxgl.Marker({ element: startEl })
      .setLngLat([coords[0].longitude, coords[0].latitude])
      .addTo(map);
    startMarkerRef.current = startMarker;

    // C. Crear marcador de Fin (Rojo o Azul si sigue activo)
    if (coords.length > 1) {
      const endEl = document.createElement('div');

      if (isOngoing) {
        endEl.className = 'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md trip-marker-end-active animate-pulse';
        endEl.innerText = 'A';
        endEl.title = 'Posición Activa';
      } else {
        endEl.className = 'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md trip-marker-end-final';
        endEl.innerText = 'F';
        endEl.title = 'Fin del Viaje';
      }

      const endMarker = new mapboxgl.Marker({ element: endEl })
        .setLngLat([coords[coords.length - 1].longitude, coords[coords.length - 1].latitude])
        .addTo(map);
      endMarkerRef.current = endMarker;
    }

    // D. Encuadrar toda la ruta en pantalla
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach(c => bounds.extend([c.longitude, c.latitude]));
    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 15,
      duration: 1000,
    });
  };

  return (
    <div className={`w-full h-full relative overflow-hidden ${isFullscreen ? 'rounded-none border-none' : 'rounded-2xl border border-base-300'}`}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
