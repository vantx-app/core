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
