import { TelemetryLog } from '@prisma/client';
import {
  haversineDistance,
  calculateHeading,
  getAngleDiff,
  snapPointToLinks,
} from '@vantx/telemetry-parser';

export { haversineDistance, calculateHeading, getAngleDiff };

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
  polyline?: string;
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

const ENCODING_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function encodeUnsignedNumber(val: number): string {
  let res = '';
  let numVal = val;
  while (numVal > 0x1f) {
    const pos = (numVal & 0x1f) | 0x20;
    res += ENCODING_TABLE[pos];
    numVal >>>= 5;
  }
  return res + ENCODING_TABLE[numVal];
}

function encodeScaledValue(value: number): string {
  let numVal = value;
  const negative = numVal < 0;
  numVal <<= 1;
  if (negative) {
    numVal = ~numVal;
  }
  return encodeUnsignedNumber(numVal);
}

function encodeHeader(
  precision: number,
  thirdDim: number,
  thirdDimPrecision: number,
): string {
  if (precision < 0 || precision > 15) {
    throw new Error('precision out of range. Should be between 0 and 15');
  }
  const res = (thirdDimPrecision << 7) | (thirdDim << 4) | precision;
  return encodeUnsignedNumber(FORMAT_VERSION) + encodeUnsignedNumber(res);
}

export function encodeFlexiblePolyline(
  polyline: [number, number][],
  precision = 5,
): string {
  const multiplierDegree = Math.pow(10, precision);
  const encodedHeaderList = encodeHeader(precision, 0, 0);
  const encodedCoords: string[] = [];

  let lastLat = 0;
  let lastLng = 0;

  for (const location of polyline) {
    const lat = Math.round(location[0] * multiplierDegree);
    encodedCoords.push(encodeScaledValue(lat - lastLat));
    lastLat = lat;

    const lng = Math.round(location[1] * multiplierDegree);
    encodedCoords.push(encodeScaledValue(lng - lastLng));
    lastLng = lng;
  }

  return [encodedHeaderList, ...encodedCoords].join('');
}

// Math helpers calculateHeading and getAngleDiff are imported and re-exported from @vantx/telemetry-parser

/**
 * Encuentra el índice del punto más cercano en el arreglo de puntos de un link.
 */
function findClosestPointOnLine(
  lat: number,
  lng: number,
  points: [number, number][],
): number {
  let minDist = Infinity;
  let closestIdx = -1;
  for (let i = 0; i < points.length; i++) {
    const dist = haversineDistance(lat, lng, points[i][1], points[i][0]);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
}

/**
 * Construye una polilínea híbrida uniendo las geometrías de los links transitados
 * cuando están dentro del snapping threshold y usando coordenadas GPS crudas
 * cuando el vehículo va fuera de ruta.
 */
export function buildHybridPolyline(
  coordinates: { lat: number; lng: number; speed?: number; angle?: number }[],
  parsedLinks: any[],
  snappingThresholdKm = 0.035,
): [number, number][] {
  const hybridGeometry: [number, number][] = [];
  let lastMatchedLinkPoints: [number, number][] | null = null;

  for (let i = 0; i < coordinates.length; i++) {
    const pt = coordinates[i];
    const res = snapPointToLinks(
      pt.lat,
      pt.lng,
      pt.speed,
      pt.angle,
      parsedLinks,
      snappingThresholdKm,
    );

    if (res.snapped && res.matchedLink) {
      const linkPoints = res.matchedLink.points; // [lng, lat][]

      if (
        lastMatchedLinkPoints &&
        res.matchedLink.points === lastMatchedLinkPoints
      ) {
        // En el mismo link, interpolar los puntos intermedios de la geometría del link
        const prevProjIdx = findClosestPointOnLine(
          hybridGeometry[hybridGeometry.length - 1][0], // lat es el primer elemento de hybridGeometry
          hybridGeometry[hybridGeometry.length - 1][1], // lng es el segundo elemento de hybridGeometry
          linkPoints,
        );
        const currProjIdx = findClosestPointOnLine(
          res.latitude,
          res.longitude,
          linkPoints,
        );

        if (
          prevProjIdx !== -1 &&
          currProjIdx !== -1 &&
          prevProjIdx !== currProjIdx
        ) {
          const startIdx = Math.min(prevProjIdx, currProjIdx);
          const endIdx = Math.max(prevProjIdx, currProjIdx);

          const intermediate = linkPoints.slice(startIdx + 1, endIdx);
          if (prevProjIdx > currProjIdx) {
            intermediate.reverse();
          }

          // Guardar en formato [lat, lng] para codificación de polilínea
          for (const p of intermediate) {
            hybridGeometry.push([p[1], p[0]]);
          }
        }
      }

      // Proyección actual en formato [lat, lng]
      hybridGeometry.push([res.latitude, res.longitude]);
      lastMatchedLinkPoints = linkPoints;
    } else {
      // Fuera de ruta: usar coordenadas GPS crudas en formato [lat, lng]
      hybridGeometry.push([pt.lat, pt.lng]);
      lastMatchedLinkPoints = null;
    }
  }

  return hybridGeometry;
}
