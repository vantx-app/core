import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PrismaClient, MapLink } from '@prisma/client';
import {
  removeConsecutiveDuplicateCoords,
  decodePolyline6,
  flipCoordinatesToGeoJSON,
} from './route-utils';
import { snapPointToLinks } from '@vantx/telemetry-parser';
import { mapValhallaRoadClassToFC } from './valhalla-routes-client.service';

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
    batchSize: 20,
    minPoints: 5,
    valhallaUrl: process.env.VALHALLA_URL || 'http://localhost:8002',
    dryRun: false,
    force: false,
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
      params.batchSize = parseInt(args[i + 1], 10) || 20;
      i++;
    } else if (args[i] === '--min-points' && args[i + 1]) {
      params.minPoints = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (args[i] === '--valhalla-url' && args[i + 1]) {
      params.valhallaUrl = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      params.dryRun = true;
    } else if (args[i] === '--force') {
      params.force = true;
    } else if (args[i] === '--verbose') {
      params.verbose = true;
    }
  }

  return params;
}

// Helper de retraso para throttling de recursos del servidor
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  loadEnv();
  const params = parseArgs();

  console.log('===========================================================');
  console.log('🗺️  BACKFILL DE CACHÉ DE MAPLINK DESDE REGISTROS DE TELEMETRÍA (VALHALLA OSM)');
  console.log('===========================================================');
  console.log(`- Endpoint Valhalla:              ${params.valhallaUrl}`);
  console.log(`- Límite de llamadas API:        ${params.maxApiCalls}`);
  console.log(`- Retraso entre llamadas (Throttle): ${params.delayMs} ms`);
  console.log(`- Tamaño de lote (Batch Size):    ${params.batchSize}`);
  console.log(`- Mínimo de puntos por viaje:     ${params.minPoints}`);
  console.log(`- Modo Dry-Run (Simulación sin API/DB): ${params.dryRun ? 'SÍ (ACTIVO)' : 'NO'}`);
  console.log(`- Modo Verbose:                   ${params.verbose ? 'SÍ' : 'NO'}`);
  console.log('-----------------------------------------------------------');

  const prisma = new PrismaClient();

  let apiCallsCount = 0;
  let skippedCacheHitCount = 0;
  let skippedTooFewPoints = 0;
  let totalSavedLinks = 0;
  let totalTripsProcessed = 0;

  try {
    console.log('[DB] Consultando viajes en PostgreSQL para backfill de MapLink...');

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
        });

        if (logs.length < params.minPoints) continue;

        totalTripsProcessed++;
        await processTrajectory(logs, prisma, params, {
          onSuccess: (linksSaved, wasApiCalled, wasCacheHit) => {
            if (wasCacheHit) skippedCacheHitCount++;
            if (wasApiCalled) apiCallsCount++;
            totalSavedLinks += linksSaved;
          },
        });
      }
    } else {
      console.log(`[INFO] Iniciando procesamiento de ${tripIds.length} viajes en lotes de ${params.batchSize}...`);

      for (let i = 0; i < tripIds.length; i += params.batchSize) {
        if (apiCallsCount >= params.maxApiCalls) {
          console.log(`\n🛑 [PROTECCIÓN SERVIDOR] Se alcanzó el límite configurado de ${params.maxApiCalls} solicitudes. Deteniendo proceso.`);
          break;
        }

        const batchTripIds = tripIds.slice(i, i + params.batchSize);
        console.log(`[PROGRESO] Procesando lote ${Math.floor(i / params.batchSize) + 1} (${i + 1} - ${Math.min(i + params.batchSize, tripIds.length)} de ${tripIds.length} viajes)...`);

        for (const tId of batchTripIds) {
          if (apiCallsCount >= params.maxApiCalls) break;

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
          await processTrajectory(logs, prisma, params, {
            onSuccess: (linksSaved, wasApiCalled, wasCacheHit) => {
              if (wasCacheHit) skippedCacheHitCount++;
              if (wasApiCalled) apiCallsCount++;
              totalSavedLinks += linksSaved;
            },
          });
        }

        // Breve pausa entre lotes para liberar memoria y recursos de CPU
        await sleep(1000);
      }
    }
  } catch (error: any) {
    console.error(`❌ [ERROR PROCESO] ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n===========================================================');
  console.log('🏆 RESUMEN FINAL DEL BACKFILL DE MAPLINK (VALHALLA)');
  console.log('===========================================================');
  console.log(`Trips evaluados:                  ${totalTripsProcessed}`);
  console.log(`Trips omitidos por baja cant pts:  ${skippedTooFewPoints}`);
  console.log(`Trips omitidos por Caché HIT (>85%): ${skippedCacheHitCount}`);
  console.log(`Solicitudes ejecutadas a Valhalla: ${apiCallsCount}`);
  console.log(`Segmentos MapLink creados/upd:    ${totalSavedLinks}`);
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
      if (!params.force && coverageRatio >= 0.85) {
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

  // B. Filtrar duplicados estacionarios conservando toda la resolución espacial
  const processedCoords = removeConsecutiveDuplicateCoords(coordinates);

  // C. Si es modo Dry-Run, simular llamada sin consumir API
  if (params.dryRun) {
    if (params.verbose) {
      console.log(
        `[DRY-RUN] Se ejecutaría 1 llamada a Valhalla (${coordinates.length} puntos GPS ➔ ${processedCoords.length} waypoints reducidos).`,
      );
    }
    callbacks.onSuccess(0, true, false);
    return;
  }

  const shapePayload = processedCoords.map((c) => ({
    lat: c.lat,
    lon: c.lng,
    search_radius: 80,
  }));


  const payload = {
    shape: shapePayload,
    costing: 'auto',
    shape_match: 'walk_or_snap',
    trace_options: {
      search_radius: 80,
    },
    filters: {
      attributes: [
        'edge.way_id',
        'edge.speed',
        'edge.speed_limit',
        'edge.road_class',
        'edge.use',
        'edge.traversability',
        'edge.drive_on_right',
        'edge.begin_shape_index',
        'edge.end_shape_index',
        'edge.shape',
        'matched.point',
        'shape',
      ],
      action: 'include',
    },
  };

  try {
    // Aplicar rate-limiting throttle antes de la llamada para no saturar CPU
    await sleep(params.delayMs);

    const valhallaBaseUrl = params.valhallaUrl.replace(/\/$/, '');
    const response = await axios.post(`${valhallaBaseUrl}/trace_attributes`, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;
    const edges = data?.edges || [];
    const shapePolyline6 = data?.shape;

    if (!edges.length && !shapePolyline6) {
      throw new Error('Sin bordes ni geometría en la respuesta de Valhalla');
    }

    // Decodificar polilínea de 6 decimales y transformar [lat, lon] -> [lng, lat]
    const decodedLatLng = shapePolyline6 ? decodePolyline6(shapePolyline6) : [];
    const decodedGeoJSON = flipCoordinatesToGeoJSON(decodedLatLng);

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
      isVerified: boolean;
    }[] = [];

    // 1. Group consecutive edges of the same OpenStreetMap way to construct complete, unbroken road geometries
    const groupedWayEdges: {
      wayId: string;
      roadClass: string;
      use: string;
      speedLimitValhalla?: number;
      traversability: string;
      beginIdx: number;
      endIdx: number;
    }[] = [];

    let currentGroup: (typeof groupedWayEdges)[0] | null = null;

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const wayId = edge.way_id ? String(edge.way_id) : `valhalla_${i}`;
      const bIdx =
        edge.begin_shape_index !== undefined
          ? edge.begin_shape_index
          : Math.floor((i / edges.length) * (decodedGeoJSON.length - 1));
      const eIdx =
        edge.end_shape_index !== undefined
          ? edge.end_shape_index
          : Math.min(
            Math.ceil(((i + 1) / edges.length) * (decodedGeoJSON.length - 1)),
            decodedGeoJSON.length - 1,
          );

      if (currentGroup && currentGroup.wayId === wayId) {
        currentGroup.endIdx = Math.max(currentGroup.endIdx, eIdx);
        if (edge.speed_limit && edge.speed_limit > 0) {
          currentGroup.speedLimitValhalla = edge.speed_limit;
        }
      } else {
        if (currentGroup) groupedWayEdges.push(currentGroup);
        currentGroup = {
          wayId,
          roadClass: edge.road_class || '',
          use: edge.use || '',
          speedLimitValhalla: edge.speed_limit,
          traversability: edge.traversability || '',
          beginIdx: bIdx,
          endIdx: eIdx,
        };
      }
    }
    if (currentGroup) groupedWayEdges.push(currentGroup);

    for (const group of groupedWayEdges) {
      const { fc, speedLimit, isVerified } = mapValhallaRoadClassToFC(
        group.roadClass,
        group.speedLimitValhalla,
        group.use,
      );

      const trav = String(group.traversability || '').toLowerCase().trim();
      const isRampOrTurn = group.use === 'ramp' || group.use === 'turn_channel';
      const isMotorway = group.roadClass === 'motorway' || group.roadClass === '0';
      const isBidirectional = trav === 'both' && !isRampOrTurn && !isMotorway;

      let edgePtsLngLat: [number, number][] = [];
      if (decodedGeoJSON.length > 0) {
        const safeBegin = Math.max(0, Math.min(group.beginIdx, decodedGeoJSON.length - 1));
        const safeEnd = Math.max(safeBegin, Math.min(group.endIdx, decodedGeoJSON.length - 1));
        edgePtsLngLat = decodedGeoJSON.slice(safeBegin, safeEnd + 1);
      }

      if (edgePtsLngLat.length < 2) continue;

      const startPt = edgePtsLngLat[0];
      const endPt = edgePtsLngLat[edgePtsLngLat.length - 1];
      const kStart = `${startPt[0].toFixed(5)},${startPt[1].toFixed(5)}`;
      const kEnd = `${endPt[0].toFixed(5)},${endPt[1].toFixed(5)}`;
      const [p1, p2] = kStart < kEnd ? [kStart, kEnd] : [kEnd, kStart];

      const linkId = `${group.wayId}_${p1}_${p2}`;

      const lons = edgePtsLngLat.map((p) => p[0]);
      const lats = edgePtsLngLat.map((p) => p[1]);

      linksToSave.push({
        linkId,
        functionalClass: fc,
        speedLimit,
        geometry: edgePtsLngLat.map((p) => `${p[0]},${p[1]}`).join(';'),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLng: Math.min(...lons),
        maxLng: Math.max(...lons),
        isBidirectional,
        isVerified,
      });
    }

    // Deduplicate in memory by linkId
    const uniqueLinksMap = new Map<string, typeof linksToSave[0]>();
    for (const link of linksToSave) {
      uniqueLinksMap.set(link.linkId, link);
    }
    const uniqueLinksToSave = Array.from(uniqueLinksMap.values());

    // Batch lookup existing map links to avoid N+1 queries
    const linkIdsToSave = uniqueLinksToSave.map((l) => l.linkId);
    const existingMapLinks = await prisma.mapLink.findMany({
      where: { linkId: { in: linkIdsToSave } },
      select: { linkId: true, isVerified: true },
    });
    const verifiedSet = new Set(
      existingMapLinks.filter((m) => m.isVerified).map((m) => m.linkId),
    );

    const updates: any[] = [];
    for (const link of uniqueLinksToSave) {
      if (verifiedSet.has(link.linkId)) {
        // Si el usuario ya verificó manualmente el segmento en la UI, no sobreescribir la velocidad
        updates.push(
          prisma.mapLink.update({
            where: { linkId: link.linkId },
            data: {
              functionalClass: link.functionalClass,
              geometry: link.geometry,
              minLat: link.minLat,
              maxLat: link.maxLat,
              minLng: link.minLng,
              maxLng: link.maxLng,
              isBidirectional: link.isBidirectional,
            },
          }),
        );
      } else {
        updates.push(
          prisma.mapLink.upsert({
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
              isVerified: link.isVerified,
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
              isVerified: link.isVerified,
            },
          }),
        );
      }
    }

    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 50) {
        await prisma.$transaction(updates.slice(i, i + 50));
      }
    }

    if (params.verbose) {
      console.log(`[VALHALLA API OK] Guardados/Actualizados ${uniqueLinksToSave.length} segmentos MapLink en BD.`);
    }

    callbacks.onSuccess(uniqueLinksToSave.length, true, false);
  } catch (error: any) {
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error(`⚠️ [VALHALLA API ERROR] ${detail}`);
    callbacks.onSuccess(0, false, false);
  }
}

run();
