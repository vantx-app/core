import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import {
  haversineDistance,
  downsampleByDistance,
  splitIntoChunks,
  decodeFlexiblePolyline,
  encodeFlexiblePolyline,
  uniformThin,
  calculateHeading,
  getAngleDiff,
  RouteSpanWithSpeedLimit,
} from './route-utils';

// Interfaces locales para evitar dependencia directa de Prisma generado
interface TelemetryLogLocal {
  id: string;
  vehicleId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  gpsSpeed: number;
  tripId: string;
  status: string;
  movement: boolean;
  angle: number;
}

// Cargar variables de entorno manualmente
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index === -1) return;
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim();
        process.env[key] = value;
      });
      console.log(`[INFO] Archivo .env cargado exitosamente desde: ${envPath}`);
    }
  }
}

// Analizar argumentos de línea de comandos
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    csvPath: '',
    mode: 'Car' as 'Car' | 'Truck',
    fallback: 110,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--csv' && args[i + 1]) {
      params.csvPath = args[i + 1];
      i++;
    } else if (args[i] === '--mode' && args[i + 1]) {
      const m = args[i + 1].toLowerCase();
      params.mode = m === 'truck' ? 'Truck' : 'Car';
      i++;
    } else if (args[i] === '--fallback' && args[i + 1]) {
      params.fallback = parseInt(args[i + 1], 10) || 110;
      i++;
    } else if (args[i] === '--verbose') {
      params.verbose = true;
    }
  }

  // Ruta por defecto para trip.csv
  if (!params.csvPath) {
    const defaultCsv = path.resolve(process.cwd(), 'trip.csv');
    if (fs.existsSync(defaultCsv)) {
      params.csvPath = defaultCsv;
    } else {
      const upperCsv = path.resolve(__dirname, '../../../../trip.csv');
      if (fs.existsSync(upperCsv)) {
        params.csvPath = upperCsv;
      }
    }
  }

  return params;
}

// Analizador simple de CSV para trip.csv
function parseTelemetryCSV(filePath: string): TelemetryLogLocal[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo CSV en la ruta: ${filePath}`);
  }

  console.log(`[CSV] Leyendo archivo: ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return [];

  // Parsear cabeceras
  const headers = lines[0].split(',').map((h) => h.trim());
  const latIndex = headers.indexOf('latitude');
  const lngIndex = headers.indexOf('longitude');
  const speedIndex = headers.indexOf('speed');
  const gpsSpeedIndex = headers.indexOf('gpsSpeed');
  const timeIndex = headers.indexOf('timestamp');
  const idIndex = headers.indexOf('id');
  const vehicleIdIndex = headers.indexOf('vehicleId');
  const tripIdIndex = headers.indexOf('tripId');
  const statusIndex = headers.indexOf('status');
  const movementIndex = headers.indexOf('movement');
  const angleIndex = headers.indexOf('angle');

  const logs: TelemetryLogLocal[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parser que respeta comillas dobles (para campos JSON en el CSV)
    const values: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal);
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal);

    const getVal = (index: number) => {
      if (index === -1 || index >= values.length) return '';
      let val = values[index].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      return val;
    };

    logs.push({
      id: getVal(idIndex),
      vehicleId: getVal(vehicleIdIndex),
      timestamp: getVal(timeIndex),
      latitude: parseFloat(getVal(latIndex)) || 0,
      longitude: parseFloat(getVal(lngIndex)) || 0,
      speed: parseFloat(getVal(speedIndex)) || 0,
      gpsSpeed: parseFloat(getVal(gpsSpeedIndex)) || 0,
      tripId: getVal(tripIdIndex),
      status: getVal(statusIndex),
      movement: getVal(movementIndex) === 't',
      angle: parseInt(getVal(angleIndex), 10) || 0,
    });
  }

  return logs;
}

// Obtener límites de velocidad acumulados para toda la ruta usando la API de Atributos de Mapa (Map Attributes API v8)
async function getRouteSpeedLimits(
  coordinates: { lat: number; lng: number; speed?: number; angle?: number }[],
  travelMode: 'Car' | 'Truck',
  apiKey: string,
): Promise<{ spans: any[]; geometry: [number, number][] } | null> {
  if (coordinates.length < 2) {
    return null;
  }

  // Capping inteligente a 1200 puntos
  let processedCoords = coordinates;
  if (coordinates.length > 1200) {
    console.log(
      `[HERE] Mitigación de tamaño activa: Reduciendo uniformemente de ${coordinates.length} a 1200 puntos.`,
    );
    processedCoords = uniformThin(coordinates, 1200);
  }

  const polylineForHere = processedCoords.map(
    (c) => [c.lat, c.lng] as [number, number],
  );
  const encodedPolyline = encodeFlexiblePolyline(polylineForHere);

  const url = 'https://smap.hereapi.com/v8/maps/attributes/path';
  const queryParams = new URLSearchParams();
  queryParams.append('apikey', apiKey);
  queryParams.append('attributes', 'ROAD_GEOM_FCn(*)');
  queryParams.append('flexiblePolyline', encodedPolyline);

  try {
    const response = await axios.get(`${url}?${queryParams.toString()}`, {
      timeout: 15000,
    });

    const data = response.data;
    const layers = data.Layers || data.layers || [];
    const parsedLinks: {
      linkId: string;
      functionalClass: number;
      speedLimit: number;
      points: [number, number][];
    }[] = [];

    for (const layer of layers) {
      const layerName = layer.LayerName || layer.layerName || '';
      const fcMatch = layerName.match(/FC(\d+)/i);
      const fc = fcMatch ? parseInt(fcMatch[1], 10) : 3;

      // Mapeo oficial de límites de velocidad de Panamá (PANAMA_LEGAL_CEILINGS)
      const speedLimit =
        fc === 1
          ? 100 // Autopistas / Corredores
          : fc === 2
            ? 80 // Carreteras
            : fc === 3
              ? 60 // Avenidas Principales
              : fc === 4
                ? 60
                : 40; // FC5: Calles Residenciales / Urbanas comerciales

      const rows = layer.Attributes || layer.attributes || [];
      for (const row of rows) {
        const linkId = String(row.LINK_ID || row.link_id);
        const latStr = String(row.LAT || row.lat || '');
        const lonStr = String(row.LON || row.lon || '');
        if (!latStr || !lonStr) continue;

        // Decodificar deltas de la geometría del enlace
        const latTokens = latStr.split(',');
        const lonTokens = lonStr.split(',');
        const pts: [number, number][] = [];
        let currentLat = 0;
        let currentLon = 0;

        for (let i = 0; i < latTokens.length; i++) {
          const dLat = parseInt(latTokens[i], 10);
          const dLon = parseInt(lonTokens[i], 10);
          currentLat += dLat;
          currentLon += dLon;
          pts.push([currentLon / 100000.0, currentLat / 100000.0]); // [lng, lat]
        }

        parsedLinks.push({
          linkId,
          functionalClass: fc,
          speedLimit,
          points: pts,
        });
      }
    }

    console.log(
      `[HERE] Se obtuvieron ${parsedLinks.length} enlaces desde la API.`,
    );

    // Reconstruir la geometría y spans del viaje usando la misma lógica de snapping
    const snappedGeometry: [number, number][] = [];
    const spans: any[] = [];
    let lastLinkId: string | null = null;

    for (let i = 0; i < coordinates.length; i++) {
      const pt = coordinates[i];
      let bestScore = Infinity;
      let closestPt: [number, number] | null = null;
      let matchedLink: (typeof parsedLinks)[0] | null = null;
      let bestDist = Infinity;

      for (const link of parsedLinks) {
        for (let idx = 0; idx < link.points.length; idx++) {
          const linkPt = link.points[idx];
          const dist = haversineDistance(pt.lat, pt.lng, linkPt[1], linkPt[0]);

          let anglePenalty = 0;
          let speedPenalty = 0;

          if (
            pt.speed !== undefined &&
            pt.angle !== undefined &&
            pt.speed > 15
          ) {
            let segmentHeading = 0;
            if (idx < link.points.length - 1) {
              const nextPt = link.points[idx + 1];
              segmentHeading = calculateHeading(
                linkPt[1],
                linkPt[0],
                nextPt[1],
                nextPt[0],
              );
            } else if (idx > 0) {
              const prevPt = link.points[idx - 1];
              segmentHeading = calculateHeading(
                prevPt[1],
                prevPt[0],
                linkPt[1],
                linkPt[0],
              );
            }

            const diffNormal = getAngleDiff(pt.angle, segmentHeading);
            const diffReverse = getAngleDiff(
              pt.angle,
              (segmentHeading + 180) % 360,
            );
            const minDiff = Math.min(diffNormal, diffReverse);

            if (minDiff > 45) {
              anglePenalty = 0.05; // Penalización de 50 metros
            }
          }

          if (pt.speed !== undefined && pt.speed > 55) {
            if (link.speedLimit <= 40) {
              speedPenalty = 0.05; // Penalización de 50 metros si va rápido en calle residencial
            }
          }

          const score = dist + anglePenalty + speedPenalty;
          if (score < bestScore) {
            bestScore = score;
            bestDist = dist;
            closestPt = linkPt;
            matchedLink = link;
          }
        }
      }

      if (closestPt) {
        snappedGeometry.push(closestPt);
      } else {
        snappedGeometry.push([pt.lng, pt.lat]);
      }

      if (matchedLink && matchedLink.linkId !== lastLinkId) {
        spans.push({
          geometryOffset: i,
          speedLimit: matchedLink.speedLimit,
          functionalClass: matchedLink.functionalClass,
        });
        lastLinkId = matchedLink.linkId;
      }
    }

    return { spans, geometry: snappedGeometry };
  } catch (error: any) {
    console.error(
      `[HERE] Error al llamar a HERE Map Attributes: ${error.message}`,
    );
    if (error.response) {
      console.error(
        `[HERE] Detalles del error: ${JSON.stringify(error.response.data)}`,
      );
    }
    return null;
  }
}

// Snapping y lógica de exceso de velocidad
function findClosestGeometryIndex(
  lat: number,
  lng: number,
  geometry: [number, number][],
): { index: number; distanceKm: number } {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < geometry.length; i++) {
    const [gLng, gLat] = geometry[i];
    const dist = haversineDistance(lat, lng, gLat, gLng);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  return { index: closestIdx, distanceKm: minDist };
}

function getSpeedLimitForGeometryIndex(
  geometryIndex: number,
  spans: any[],
): { speedLimit: number | null; functionalClass: number | null } {
  if (spans.length === 0) return { speedLimit: null, functionalClass: null };
  let matchedSpan = spans[0];
  for (const span of spans) {
    if (span.geometryOffset <= geometryIndex) {
      matchedSpan = span;
    } else {
      break;
    }
  }
  return {
    speedLimit: matchedSpan.speedLimit,
    functionalClass: matchedSpan.functionalClass ?? null,
  };
}

// Ejecutar el proceso local
async function run() {
  loadEnv();
  const params = parseArgs();

  console.log('====================================================');
  console.log('📊 PROCESADOR LOCAL DE LÍMITES DE VELOCIDAD');
  console.log('====================================================');
  console.log(`- Archivo CSV: ${params.csvPath}`);
  console.log(`- Modo de transporte: ${params.mode}`);
  console.log(`- Límite fallback: ${params.fallback} km/h`);
  console.log(`- Detalle por punto (verbose): ${params.verbose ? 'SÍ' : 'NO'}`);
  console.log('----------------------------------------------------');

  let logs: TelemetryLogLocal[];
  try {
    logs = parseTelemetryCSV(params.csvPath);
  } catch (err: any) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }

  if (logs.length === 0) {
    console.log('[ERROR] No se encontraron registros de telemetría en el CSV.');
    process.exit(1);
  }

  console.log(`[CSV] Se cargaron ${logs.length} registros de telemetría.`);

  // Filtrar logs con coordenadas válidas
  const validLogs = logs.filter(
    (log) => log.latitude !== 0 && log.longitude !== 0,
  );
  console.log(
    `[FILTRADO] Registros válidos (coords != 0): ${validLogs.length} de ${logs.length}`,
  );

  if (validLogs.length < 2) {
    console.log('[INFO] Insuficientes puntos válidos para procesar.');
    process.exit(0);
  }

  // Calcular distancia directa y velocidad máxima del CSV
  const startLog = validLogs[0];
  const endLog = validLogs[validLogs.length - 1];
  const distanceKm = haversineDistance(
    startLog.latitude,
    startLog.longitude,
    endLog.latitude,
    endLog.longitude,
  );
  const maxSpeed = Math.max(...validLogs.map((l) => l.speed));
  const avgSpeed =
    validLogs.reduce((acc, l) => acc + l.speed, 0) / validLogs.length;

  console.log(
    `- Distancia línea recta (Inicio-Fin): ${distanceKm.toFixed(3)} km`,
  );
  console.log(`- Velocidad máxima registrada: ${maxSpeed} km/h`);
  console.log(`- Velocidad promedio: ${avgSpeed.toFixed(1)} km/h`);

  // Validación rápida previa a llamadas de API (igual que el servicio)
  if (!validLogs.some((log) => log.speed > 40)) {
    console.log(
      '[INFO] La velocidad máxima no superó los 40 km/h. Exceso de velocidad: 0',
    );
    process.exit(0);
  }

  if (distanceKm < 0.1) {
    console.log(
      '[INFO] La distancia del viaje es menor a 0.1 km. Exceso de velocidad: 0',
    );
    process.exit(0);
  }

  const apiKey = process.env.HERE_API_KEY;
  let useHere = false;
  let routeResult: {
    spans: RouteSpanWithSpeedLimit[];
    geometry: [number, number][];
  } | null = null;

  if (apiKey) {
    console.log('[HERE] Intentando post-procesamiento con HERE Routing...');
    const coordinates = validLogs.map((l) => ({
      lat: l.latitude,
      lng: l.longitude,
      speed: l.speed,
      angle: l.angle,
    }));
    routeResult = await getRouteSpeedLimits(coordinates, params.mode, apiKey);
    if (routeResult) {
      useHere = true;
      console.log(
        `[HERE] Ruta obtenida con éxito. Geometría decodificada: ${routeResult.geometry.length} puntos.`,
      );
    } else {
      console.log(
        '[HERE] No se pudo obtener la ruta de HERE API. Se aplicará el cálculo fallback.',
      );
    }
  } else {
    console.log('[WARNING] HERE_API_KEY no configurada. Usando modo fallback.');
  }

  // --- CÁLCULO FALLBACK ---
  let fallbackCount = 0;
  let fallbackSeverity = 0;

  let fallbackEpisodeStart: Date | null = null;
  let lastFallbackSpeeding: Date | null = null;
  const COOLDOWN_MS = 30 * 1000; // Cooldown de 30 segundos

  for (const log of validLogs) {
    const logTime = new Date(log.timestamp);
    // Margen de gracia de 10 km/h para Panamá
    const isSpeeding = log.speed > params.fallback + 10;

    if (isSpeeding) {
      if (!fallbackEpisodeStart) {
        fallbackEpisodeStart = logTime;
      }
      lastFallbackSpeeding = logTime;
    } else {
      if (fallbackEpisodeStart && lastFallbackSpeeding) {
        const timeSinceLastSpeeding =
          logTime.getTime() - lastFallbackSpeeding.getTime();
        if (timeSinceLastSpeeding >= COOLDOWN_MS) {
          const actualDuration =
            (lastFallbackSpeeding.getTime() - fallbackEpisodeStart.getTime()) /
            1000;
          if (actualDuration >= 5) {
            const duration = Math.max(10, actualDuration);
            fallbackSeverity += duration;
            fallbackCount++;
          }
          fallbackEpisodeStart = null;
          lastFallbackSpeeding = null;
        }
      }
    }
  }

  if (fallbackEpisodeStart && lastFallbackSpeeding) {
    const actualDuration =
      (lastFallbackSpeeding.getTime() - fallbackEpisodeStart.getTime()) / 1000;
    if (actualDuration >= 5) {
      const duration = Math.max(10, actualDuration);
      fallbackSeverity += duration;
      fallbackCount++;
    }
  }

  // --- CÁLCULO CON LÍMITES REALES DE HERE ---
  let hereCount = 0;
  let hereSeverity = 0;
  let offRoutePoints = 0;
  let limitChanges = 0;
  let lastLimit: number | null = null;
  let decelerationGraceWindowEnd = 0;
  let lastValidOnRouteSpeedLimit = params.fallback; // Inertial Fallback

  let currentEpisodeStart: Date | null = null;
  let lastSpeedingTimestamp: Date | null = null;

  interface Violation {
    timestamp: string;
    speed: number;
    limit: number;
    excess: number;
    distanceToRouteMeters: number;
    isOffRoute: boolean;
    functionalClass: number | null;
    originalLimit: number | null;
  }
  const violations: Violation[] = [];

  if (useHere && routeResult) {
    const { spans, geometry } = routeResult;

    for (const log of validLogs) {
      const logTime = new Date(log.timestamp);
      const { index: closestIdx, distanceKm: snapDist } =
        findClosestGeometryIndex(log.latitude, log.longitude, geometry);

      let limitToUse: number;
      let originalLimit: number | null = null;
      let functionalClass: number | null = null;
      let isOffRoute = false;

      // Off route si la distancia es > 50 metros (0.05 km)
      if (snapDist > 0.05) {
        // Fuera de ruta (> 50m), usar Inertial Fallback (heredar el último límite válido en ruta)
        limitToUse = lastValidOnRouteSpeedLimit;
        isOffRoute = true;
        offRoutePoints++;
      } else {
        const { speedLimit, functionalClass: fc } =
          getSpeedLimitForGeometryIndex(closestIdx, spans);
        originalLimit = speedLimit;
        functionalClass = fc;

        // Smart Fallback Ingestion para Panamá (ignorar speedLimit de HERE y usar estrictamente el FC)
        if (fc === 1) {
          limitToUse = 100;
        } else if (fc === 2) {
          limitToUse = 80;
        } else if (fc === 3) {
          limitToUse = 60;
        } else if (fc === 4) {
          limitToUse = 60;
        } else if (fc === 5) {
          limitToUse = 40;
        } else {
          limitToUse = params.fallback;
        }
        lastValidOnRouteSpeedLimit = limitToUse; // Actualizar último límite válido en ruta
      }

      // Lógica de transición espacial: Ventana de gracia por desaceleración rápida (drop >= 20 km/h)
      if (lastLimit !== null && limitToUse <= lastLimit - 20) {
        decelerationGraceWindowEnd = logTime.getTime() + 15000;
      }

      if (lastLimit !== null && lastLimit !== limitToUse) {
        limitChanges++;
      }
      lastLimit = limitToUse;

      const inDecelWindow = logTime.getTime() <= decelerationGraceWindowEnd;
      // Umbral de exceso con margen de gracia de 10 km/h
      const threshold = limitToUse + 10;
      const isSpeeding = !inDecelWindow && log.speed > threshold;

      if (isSpeeding) {
        if (!currentEpisodeStart) {
          currentEpisodeStart = logTime;
        }
        lastSpeedingTimestamp = logTime;

        // Guardar para detalles CLI
        violations.push({
          timestamp: log.timestamp,
          speed: log.speed,
          limit: limitToUse,
          excess: log.speed - limitToUse,
          distanceToRouteMeters: snapDist * 1000,
          isOffRoute,
          functionalClass,
          originalLimit,
        });
      } else {
        if (currentEpisodeStart && lastSpeedingTimestamp) {
          const timeSinceLastSpeeding =
            logTime.getTime() - lastSpeedingTimestamp.getTime();
          if (timeSinceLastSpeeding >= COOLDOWN_MS) {
            const actualDuration =
              (lastSpeedingTimestamp.getTime() -
                currentEpisodeStart.getTime()) /
              1000;
            if (actualDuration >= 5) {
              const duration = Math.max(10, actualDuration);
              hereSeverity += duration;
              hereCount++;
            }
            currentEpisodeStart = null;
            lastSpeedingTimestamp = null;
          }
        }
      }

      if (params.verbose) {
        const fcStr = functionalClass !== null ? `, FC${functionalClass}` : '';
        console.log(
          `[LOG] Hora: ${log.timestamp} | Vel: ${log.speed} km/h | Límite: ${limitToUse} km/h (orig: ${originalLimit} km/h${fcStr}) | ` +
            `DistRuta: ${(snapDist * 1000).toFixed(1)}m | ` +
            `${log.speed > threshold ? (inDecelWindow ? '⏳ DECEL-SUSPEND' : '🚨 EXCESO') : 'OK'}` +
            `${isOffRoute ? ' (OFF-ROUTE)' : ''}`,
        );
      }
    }

    if (currentEpisodeStart && lastSpeedingTimestamp) {
      const actualDuration =
        (lastSpeedingTimestamp.getTime() - currentEpisodeStart.getTime()) /
        1000;
      if (actualDuration >= 5) {
        const duration = Math.max(10, actualDuration);
        hereSeverity += duration;
        hereCount++;
      }
    }
  }

  // --- REPORTAR RESULTADOS ---
  console.log('\n====================================================');
  console.log('🏆 RESUMEN DEL ANÁLISIS DE VIAJE');
  console.log('====================================================');
  console.log(`Total de registros procesados: ${validLogs.length}`);
  console.log(`Velocidad Promedio:            ${avgSpeed.toFixed(2)} km/h`);
  console.log(`Velocidad Máxima:              ${maxSpeed} km/h`);

  console.log('\n--- 1. Cálculo Fallback (Límite Fijo) ---');
  console.log(`Límite Fallback Aplicado:      ${params.fallback} km/h`);
  console.log(`Episodios de infracción:       ${fallbackCount}`);
  console.log(`Duración de Severidad (seg):   ${fallbackSeverity.toFixed(3)}`);

  if (useHere) {
    console.log('\n--- 2. Cálculo Real-Route (HERE API) ---');
    console.log(
      `Puntos fuera de ruta (>50m):   ${offRoutePoints} (${((offRoutePoints / validLogs.length) * 100).toFixed(1)}%)`,
    );
    console.log(`Cambios de límite detectados:  ${limitChanges}`);
    console.log(`Episodios de infracción:       ${hereCount}`);
    console.log(`Duración de Severidad (seg):   ${hereSeverity.toFixed(3)}`);

    console.log(
      '\n--- Infracciones con Límite Real Detectadas (Episodios >= 5s, +10 km/h buffer) ---',
    );
    if (violations.length === 0) {
      console.log(
        '    Ningún exceso de velocidad registrado bajo los límites reales de la ruta (+10 km/h buffer).',
      );
    } else {
      console.log(
        `Se detectaron ${violations.length} puntos con exceso. Mostrando los primeros 15:`,
      );
      violations.slice(0, 15).forEach((v, idx) => {
        const offRouteStr = v.isOffRoute ? ' [Off-Route (Fallback)]' : '';
        console.log(
          `  ${idx + 1}. [${v.timestamp}] Vel: ${v.speed} km/h en zona de ${v.limit} km/h ` +
            `(Exceso: +${v.excess} km/h) | Distancia a Ruta: ${v.distanceToRouteMeters.toFixed(1)}m${offRouteStr}`,
        );
      });
      if (violations.length > 15) {
        console.log(`  ... y ${violations.length - 15} infracciones más.`);
      }
    }
  } else {
    console.log(
      '\n[INFO] No se ejecutó el cálculo con límites reales de HERE (API key no disponible o error).',
    );
  }
  console.log('====================================================\n');
}

run();
