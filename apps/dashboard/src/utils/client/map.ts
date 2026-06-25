import mapboxgl from "mapbox-gl";

/**
 * Default Mapbox configuration options to enforce 2D cenital focus,
 * disable tilting/pitching gestures, and set the default visual style.
 */
export const DEFAULT_MAP_CONFIG: Partial<mapboxgl.MapOptions> = {
  style: "mapbox://styles/mapbox/streets-v12",
  pitch: 0,
  maxPitch: 0,
  minPitch: 0,
  pitchWithRotate: false,
  touchPitch: false,
};

/**
 * Calculates the straight-line (great-circle) distance between two sets of GPS coordinates using the Haversine formula.
 * Returns the distance in kilometers.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Formats a distance in kilometers into a human-readable string (meters if < 1km, otherwise kilometers with 1 decimal place).
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Anima suavemente la posición de un marcador de Mapbox desde una coordenada inicial
 * hasta una coordenada objetivo usando requestAnimationFrame e interpolación easeOutQuad.
 * Retorna el ID de requestAnimationFrame para que pueda ser cancelado si es necesario.
 */
export function animateMarkerPosition(
  marker: mapboxgl.Marker,
  from: [number, number],
  to: [number, number],
  duration = 1000,
  onComplete?: () => void,
): number {
  const start = performance.now();
  let animationFrameId: number;

  function frame(time: number) {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    const t = progress * (2 - progress); // easeOutQuad

    const lng = from[0] + (to[0] - from[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;

    marker.setLngLat([lng, lat]);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(frame);
    } else if (onComplete) {
      onComplete();
    }
  }

  animationFrameId = requestAnimationFrame(frame);
  return animationFrameId;
}
