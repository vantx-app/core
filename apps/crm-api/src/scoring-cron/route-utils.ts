import { TelemetryLog } from '@prisma/client';

/** Un tramo de ruta con su límite de velocidad y posición en la geometría */
export interface RouteSpanWithSpeedLimit {
  geometryOffset: number;
  speedLimit: number | null; // km/h, null si es Unlimited o no disponible
  functionalClass?: number | null;
}

/** Resultado de una llamada exitosa */
export interface CalculatedRouteResult {
  spans: RouteSpanWithSpeedLimit[];
  geometry: [number, number][]; // [lng, lat] puntos decodificados de la ruta
}

/**
 * Distancia Haversine entre dos puntos en km.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Reduce la densidad de puntos GPS manteniendo los que están al menos a
 * minDistanceKm entre sí. Siempre preserva el primer y último punto.
 */
export function downsampleByDistance(
  coordinates: { lat: number; lng: number }[],
  minDistanceKm: number,
  maxPoints: number,
): { lat: number; lng: number }[] {
  if (coordinates.length <= 2) return [...coordinates];

  const result: { lat: number; lng: number }[] = [coordinates[0]];

  for (let i = 1; i < coordinates.length - 1; i++) {
    const last = result[result.length - 1];
    const dist = haversineDistance(
      last.lat,
      last.lng,
      coordinates[i].lat,
      coordinates[i].lng,
    );

    if (dist >= minDistanceKm) {
      result.push(coordinates[i]);
    }
  }

  // Siempre incluir el último punto
  result.push(coordinates[coordinates.length - 1]);

  // Si aún tenemos demasiados puntos, aplicar un segundo paso de thinning uniforme
  if (result.length > maxPoints) {
    return uniformThin(result, maxPoints);
  }

  return result;
}

/**
 * Reduce uniformemente un array de puntos al tamaño deseado,
 * preservando siempre el primero y el último.
 */
export function uniformThin(
  points: { lat: number; lng: number }[],
  maxPoints: number,
): { lat: number; lng: number }[] {
  if (points.length <= maxPoints) return points;

  const result: { lat: number; lng: number }[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    result.push(points[idx]);
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Divide las coordenadas en chunks solapados de hasta maxWaypoints puntos.
 * El último punto de cada chunk es el primero del siguiente para continuidad.
 */
export function splitIntoChunks(
  coordinates: { lat: number; lng: number }[],
  maxWaypoints: number,
): { lat: number; lng: number }[][] {
  if (coordinates.length <= maxWaypoints) {
    return [coordinates];
  }

  const chunks: { lat: number; lng: number }[][] = [];
  let start = 0;

  while (start < coordinates.length - 1) {
    const end = Math.min(start + maxWaypoints, coordinates.length);
    chunks.push(coordinates.slice(start, end));
    start = end - 1;
  }

  return chunks;
}

// ============================================================================
// DECODIFICADOR DE FLEXIBLE POLYLINE (OFICIAL DE HERE MAPS)
// ============================================================================
const FORMAT_VERSION = 1;
const DECODING_TABLE = [
  62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1,
  -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33,
  34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
];

function decodeChar(char: string) {
  const charCode = char.charCodeAt(0);
  return DECODING_TABLE[charCode - 45];
}

function decodeUnsignedValues(encoded: string) {
  let result = 0;
  let shift = 0;
  const resList: number[] = [];

  encoded.split('').forEach((char) => {
    const value = decodeChar(char);
    result |= (value & 0x1f) << shift;
    if ((value & 0x20) === 0) {
      resList.push(result);
      result = 0;
      shift = 0;
    } else {
      shift += 5;
    }
  });

  if (shift > 0) {
    throw new Error('Invalid encoding');
  }

  return resList;
}

function decodeHeader(version: number, encodedHeader: number) {
  if (version !== FORMAT_VERSION) {
    throw new Error('Invalid format version');
  }
  const precision = encodedHeader & 15;
  const thirdDim = (encodedHeader >> 4) & 7;
  const thirdDimPrecision = (encodedHeader >> 7) & 15;
  return { precision, thirdDim, thirdDimPrecision };
}

function toSigned(val: number) {
  let res = val;
  if (res & 1) {
    res = ~res;
  }
  res >>= 1;
  return res;
}

export function decodeFlexiblePolyline(encoded: string) {
  const decoder = decodeUnsignedValues(encoded);
  const header = decodeHeader(decoder[0], decoder[1]);

  const factorDegree = 10 ** header.precision;
  const factorZ = 10 ** header.thirdDimPrecision;
  const { thirdDim } = header;

  let lastLat = 0;
  let lastLng = 0;
  let lastZ = 0;
  const res: [number, number][] = [];

  let i = 2;
  for (; i < decoder.length; ) {
    const deltaLat = toSigned(decoder[i]);
    const deltaLng = toSigned(decoder[i + 1]);
    lastLat += deltaLat;
    lastLng += deltaLng;

    if (thirdDim) {
      const deltaZ = toSigned(decoder[i + 2]);
      lastZ += deltaZ;
      res.push([lastLat / factorDegree, lastLng / factorDegree]);
      i += 3;
    } else {
      res.push([lastLat / factorDegree, lastLng / factorDegree]);
      i += 2;
    }
  }

  if (i !== decoder.length) {
    throw new Error('Invalid encoding. Premature ending reached');
  }

  return {
    ...header,
    polyline: res,
  };
}
