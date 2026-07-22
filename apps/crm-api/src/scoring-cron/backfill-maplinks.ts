import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PrismaClient, MapLink } from '@prisma/client';
import {
  downsampleByDistance,
  decodeFlexiblePolyline,
} from './route-utils';
import { snapPointToLinks } from '@vantx/telemetry-parser';

// Cargar variables de entorno desde .env local o raíz del proyecto
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
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
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
      console.log(`[INFO] Archivo .env cargado desde: ${envPath}`);
      return;
    }
  }
}

// Analizar argumentos CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    maxApiCalls: 5000,
    delayMs: 300,
    batchSize: 50,
    minPoints: 5,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-api-calls' && args[i + 1]) {
      params.maxApiCalls = parseInt(args[i + 1], 10) || 5000;
      i++;
    } else if (args[i] === '--delay-ms' && args[i + 1]) {
      params.delayMs = parseInt(args[i + 1], 10) || 300;
      i++;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      params.batchSize = parseInt(args[i + 1], 10) || 50;
      i++;
    } else if (args[i] === '--min-points' && args[i + 1]) {
      params.minPoints = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (args[i] === '--dry-run') {
      params.dryRun = true;
    } else if (args[i] === '--verbose') {
      params.verbose = true;
    }
  }

  return params;
}

// Helper de retraso para rate-limiting
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  loadEnv();
  const params = parseArgs();

  console.log('===========================================================');
  console.log('🗺️  BACKFILL DE CACHÉ DE MAPLINK DESDE REGISTROS DE TELEMETRÍA');
  console.log('===========================================================');
  console.log(`- Límite de llamadas API (Límite mensual HERE: 30,000 | Usados: 458): ${params.maxApiCalls}`);
  console.log(`- Retraso entre llamadas (Rate Throttling): ${params.delayMs} ms`);
  console.log(`- Tamaño de lote: ${params.batchSize}`);
  console.log(`- Mínimo de puntos por viaje: ${params.minPoints}`);
  console.log(`- Modo Dry-Run (Simulación sin API ni DB): ${params.dryRun ? 'SÍ (ACTIVO)' : 'NO'}`);
  console.log(`- Modo Verbose: ${params.verbose ? 'SÍ' : 'NO'}`);
  console.log('-----------------------------------------------------------');

  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey && !params.dryRun) {
    console.error('❌ [ERROR] HERE_API_KEY no encontrada en las variables de entorno.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  let apiCallsCount = 0;
  let skippedCacheHitCount = 0;
  let skippedTooFewPoints = 0;
  let totalSavedLinks = 0;
  let totalTripsProcessed = 0;

  try {
    // 1. Obtener viajes / grupos de telemetría por tripId o vehicleId
    console.log('[DB] Consultando registros de telemetría en PostgreSQL...');

    // Obtener tripIds distintos que tengan telemetría válida
    const tripsWithLogs = await prisma.telemetryLog.groupBy({
      by: ['tripId'],
      where: {
        tripId: { not: null },
        latitude: { not: 0 },
        longitude: { not: 0 },
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: params.minPoints } },
      },
    });

    console.log(`[DB] Se encontraron ${tripsWithLogs.length} viajes con telemetría suficiente.`);

    let tripIds = tripsWithLogs.map((t) => t.tripId as string);

    // Si no hay tripIds explícitos, procesar por vehículos
    if (tripIds.length === 0) {
      console.log('[DB] No se encontraron tripIds explícitos. Agrupando telemetría por vehículo...');
      const vehicles = await prisma.vehicle.findMany({ select: { id: true } });
      console.log(`[DB] Encontrados ${vehicles.length} vehículos para escaneo.`);

      for (const veh of vehicles) {
        if (apiCallsCount >= params.maxApiCalls && !params.dryRun) break;

        const logs = await prisma.telemetryLog.findMany({
          where: {
            vehicleId: veh.id,
            latitude: { not: 0 },
            longitude: { not: 0 },
          },
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            speed: true,
            angle: true,
            satellites: true,
            ignition: true,
            timestamp: true,
          },
          take: 500,
        });

        if (logs.length < params.minPoints) continue;

        totalTripsProcessed++;
        await processTrajectory(logs, prisma, apiKey || '', params, {
          onSuccess: (linksSaved, wasApiCalled, wasCacheHit) => {
            if (wasCacheHit) skippedCacheHitCount++;
            if (wasApiCalled) apiCallsCount++;
            totalSavedLinks += linksSaved;
          },
        });
      }
    } else {
      // Procesar viajes agrupados por tripId
      for (let i = 0; i < tripIds.length; i += params.batchSize) {
        if (apiCallsCount >= params.maxApiCalls && !params.dryRun) {
          console.log(`\n🛑 [CUOTA] Se alcanzó el límite de presupuesto de ${params.maxApiCalls} llamadas API. Deteniendo proceso.`);
          break;
        }

        const batchTripIds = tripIds.slice(i, i + params.batchSize);

        for (const tId of batchTripIds) {
          if (apiCallsCount >= params.maxApiCalls && !params.dryRun) break;

          const logs = await prisma.telemetryLog.findMany({
            where: {
              tripId: tId,
              latitude: { not: 0 },
              longitude: { not: 0 },
            },
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              latitude: true,
              longitude: true,
              speed: true,
              angle: true,
              satellites: true,
              ignition: true,
              timestamp: true,
            },
          });

          if (logs.length < params.minPoints) {
            skippedTooFewPoints++;
            continue;
          }

          totalTripsProcessed++;
          await processTrajectory(logs, prisma, apiKey || '', params, {
            onSuccess: (linksSaved, wasApiCalled, wasCacheHit) => {
              if (wasCacheHit) skippedCacheHitCount++;
              if (wasApiCalled) apiCallsCount++;
              totalSavedLinks += linksSaved;
            },
          });
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ [ERROR PROCESO] ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }

  // 3. Resumen final
  const totalAccountUsedBefore = 458;
  const totalAccountUsedNow = totalAccountUsedBefore + apiCallsCount;
  const remainingMonthlyQuota = 30000 - totalAccountUsedNow;

  console.log('\n===========================================================');
  console.log('🏆 RESUMEN FINAL DEL BACKFILL DE MAPLINK');
  console.log('===========================================================');
  console.log(`Trips evaluados:                  ${totalTripsProcessed}`);
  console.log(`Trips omitidos por baja cant pts:  ${skippedTooFewPoints}`);
  console.log(`Trips omitidos por Caché HIT (>85%): ${skippedCacheHitCount}`);
  console.log(`Llamadas a HERE API ejecutadas:   ${apiCallsCount} de máximo ${params.maxApiCalls}`);
  console.log(`Segmentos MapLink creados/upd:    ${totalSavedLinks}`);
  console.log('-----------------------------------------------------------');
  console.log(`Consumo total de HERE API estimado: ${totalAccountUsedNow} / 30,000 solicitudes mensuales.`);
  console.log(`Cuota disponible restante:        ${remainingMonthlyQuota} solicitudes.`);
  console.log('===========================================================');
}

async function processTrajectory(
  logs: {
    id: string;
    latitude: number;
    longitude: number;
    speed: number;
    angle: number;
    satellites: number | null;
    ignition: boolean;
    timestamp: Date;
  }[],
  prisma: PrismaClient,
  apiKey: string,
  params: ReturnType<typeof parseArgs>,
  callbacks: {
    onSuccess: (linksSaved: number, wasApiCalled: boolean, wasCacheHit: boolean) => void;
  },
) {
  const coordinates = logs.map((l) => ({
    lat: l.latitude,
    lng: l.longitude,
    speed: l.speed,
    angle: l.angle,
    satellites: l.satellites ?? 5,
    ignition: l.ignition,
  }));

  // A. Comprobar cobertura existente en caché usando PostGIS/Spatial Box
  const minLat = Math.min(...coordinates.map((c) => c.lat)) - 0.005;
  const maxLat = Math.max(...coordinates.map((c) => c.lat)) + 0.005;
  const minLng = Math.min(...coordinates.map((c) => c.lng)) - 0.005;
  const maxLng = Math.max(...coordinates.map((c) => c.lng)) + 0.005;

  try {
    const cachedLinks = await prisma.$queryRaw<MapLink[]>`
      SELECT * FROM "MapLink"
      WHERE box(point("minLng", "minLat"), point("maxLng", "maxLat")) && box(point(${minLng}, ${minLat}), point(${maxLng}, ${maxLat}))
    `;

    if (cachedLinks && cachedLinks.length > 0) {
      const parsedLinks = cachedLinks.map((link) => {
        const pts = link.geometry.split(';').map((pair) => {
          const [lng, lat] = pair.split(',').map(Number);
          return [lng, lat] as [number, number];
        });
        return {
          linkId: link.linkId,
          functionalClass: link.functionalClass,
          speedLimit: link.speedLimit,
          points: pts,
          isBidirectional: link.isBidirectional,
        };
      });

      let snappedCount = 0;
      for (const pt of coordinates) {
        const res = snapPointToLinks(
          pt.lat,
          pt.lng,
          pt.speed,
          pt.angle,
          parsedLinks,
          0.03, // 30 meters threshold
        );
        if (res.snapped) snappedCount++;
      }

      const coverageRatio = snappedCount / coordinates.length;
      if (coverageRatio >= 0.85) {
        if (params.verbose) {
          console.log(`[SKIP CACHÉ] Viaje cubierto al ${(coverageRatio * 100).toFixed(1)}% con ${cachedLinks.length} segmentos existentes.`);
        }
        callbacks.onSuccess(0, false, true);
        return;
      }
    }
  } catch (err: any) {
    if (params.verbose) {
      console.warn(`[WARN CACHÉ] Error consultando caché de MapLink: ${err.message}`);
    }
  }

  // B. Si es modo Dry-Run, simular llamada sin consumir API
  if (params.dryRun) {
    if (params.verbose) {
      console.log(`[DRY-RUN] Se ejecutaría 1 llamada a HERE Routing API v8 para ${coordinates.length} puntos GPS.`);
    }
    callbacks.onSuccess(0, true, false);
    return;
  }

  // C. Downsampling inteligente para ajustar en 1 sola llamada API
  const processedCoords = downsampleByDistance(coordinates, 0.2, 60);

  const transportMode = 'truck';
  const url = 'https://router.hereapi.com/v8/routes';
  const queryParams = new URLSearchParams();
  queryParams.append('apikey', apiKey);
  queryParams.append('transportMode', transportMode);
  queryParams.append(
    'origin',
    `${processedCoords[0].lat},${processedCoords[0].lng}`,
  );
  queryParams.append(
    'destination',
    `${processedCoords[processedCoords.length - 1].lat},${processedCoords[processedCoords.length - 1].lng}`,
  );

  for (let i = 1; i < processedCoords.length - 1; i++) {
    queryParams.append(
      'via',
      `${processedCoords[i].lat},${processedCoords[i].lng}!passThrough=true`,
    );
  }

  queryParams.append('return', 'polyline');
  queryParams.append('spans', 'functionalClass,segmentRef,streetAttributes');
  queryParams.append('departureTime', 'any');

  try {
    // Aplicar rate-limiting throttle antes de la llamada
    await sleep(params.delayMs);

    const response = await axios.get(`${url}?${queryParams.toString()}`, {
      timeout: 20000,
    });

    const section = response.data?.routes?.[0]?.sections?.[0];
    if (!section || !section.polyline) {
      throw new Error('No se encontró sección o polilínea en la respuesta del API de HERE');
    }

    const decoded = decodeFlexiblePolyline(section.polyline);
    const polylinePoints = decoded.polyline;
    const apiSpans = section.spans || [];

    const linksToSave: {
      linkId: string;
      functionalClass: number;
      speedLimit: number;
      geometry: string;
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
      isBidirectional: boolean;
    }[] = [];

    for (let i = 0; i < apiSpans.length; i++) {
      const span = apiSpans[i];
      const fc = span.functionalClass || 3;
      const rawLinkId = span.segmentRef || `gen-${i}-${Date.now()}`;
      const rawLinkIdStr = String(rawLinkId);

      const isReverse =
        rawLinkIdStr.startsWith('-') ||
        rawLinkIdStr.includes('#-') ||
        (rawLinkIdStr.includes('#') && rawLinkIdStr.split('#')[1].includes('-'));

      let linkId = rawLinkIdStr.split('#')[0];
      if (linkId.startsWith('-') || linkId.startsWith('+')) {
        linkId = linkId.substring(1);
      }

      const streetAttrs: string[] = span.streetAttributes || [];
      const isDivided =
        streetAttrs.includes('dividedRoad') ||
        streetAttrs.includes('ramp') ||
        streetAttrs.includes('roundabout');
      const isBidirectional = !isDivided;

      // Panamá Speed Ceiling mapping per FC
      const speedLimit =
        fc === 1
          ? 110
          : fc === 2
            ? 80
            : fc === 3 || fc === 4
              ? 60
              : 40;

      const startOffset = span.offset;
      const endOffset =
        i < apiSpans.length - 1
          ? apiSpans[i + 1].offset
          : polylinePoints.length - 1;
      const segmentPts = polylinePoints.slice(startOffset, endOffset + 1);
      if (segmentPts.length === 0) continue;

      if (isReverse) {
        segmentPts.reverse();
      }

      const lats = segmentPts.map((p) => p[0]);
      const lons = segmentPts.map((p) => p[1]);

      const geometryStr = segmentPts.map((p) => `${p[1]},${p[0]}`).join(';');
      const sMinLat = Math.min(...lats);
      const sMaxLat = Math.max(...lats);
      const sMinLng = Math.min(...lons);
      const sMaxLng = Math.max(...lons);

      linksToSave.push({
        linkId,
        functionalClass: fc,
        speedLimit,
        geometry: geometryStr,
        minLat: sMinLat,
        maxLat: sMaxLat,
        minLng: sMinLng,
        maxLng: sMaxLng,
        isBidirectional,
      });
    }

    // Upsertar secuencialmente en Postgres MapLink
    for (const link of linksToSave) {
      await prisma.mapLink.upsert({
        where: { linkId: link.linkId },
        create: {
          linkId: link.linkId,
          functionalClass: link.functionalClass,
          speedLimit: link.speedLimit,
          geometry: link.geometry,
          minLat: link.minLat,
          maxLat: link.maxLat,
          minLng: link.minLng,
          maxLng: link.maxLng,
          isBidirectional: link.isBidirectional,
        },
        update: {
          functionalClass: link.functionalClass,
          speedLimit: link.speedLimit,
          geometry: link.geometry,
          minLat: link.minLat,
          maxLat: link.maxLat,
          minLng: link.minLng,
          maxLng: link.maxLng,
          isBidirectional: link.isBidirectional,
        },
      });
    }

    if (params.verbose) {
      console.log(`[HERE API OK] Guardados/Actualizados ${linksToSave.length} segmentos MapLink en BD.`);
    }

    callbacks.onSuccess(linksToSave.length, true, false);
  } catch (error: any) {
    console.error(`⚠️ [HERE API ERROR] ${error.message}`);
    callbacks.onSuccess(0, false, false);
  }
}

run();
