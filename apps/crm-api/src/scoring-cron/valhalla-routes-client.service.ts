import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';
import { MapLink } from '@prisma/client';
import { snapPointToLinks } from '@vantx/telemetry-parser';
import {
  RouteSpanWithSpeedLimit,
  CalculatedRouteResult,
  decodePolyline6,
  flipCoordinatesToGeoJSON,
  encodePolyline6,
  removeConsecutiveDuplicateCoords,
  buildHybridPolyline,
  calculatePolylineDistanceKm,
} from './route-utils';

/**
 * Valhalla road_class / use mapping aligned with Panama ATTT Traffic Regulations
 * FC 1: Autopistas / Corredores (110 km/h or 90 km/h)
 * FC 2: Carreteras Interurbanas Principales / Vías Rápidas (80 km/h e.g. Vía Centenario)
 * FC 3: Avenidas / Arterias Urbanas (Vía Panamá Norte, Vía España, Calle 50, etc.) (60 km/h)
 * FC 4: Calles Colectoras (60 km/h)
 * FC 5: Calles Residenciales / Locales (40 km/h)
 */
export function mapValhallaRoadClassToFC(
  roadClass?: string | number,
  speedLimitValhalla?: number,
  use?: string,
): { fc: number; speedLimit: number; isVerified: boolean } {
  const rc = String(roadClass || '').toLowerCase().trim();
  const u = String(use || '').toLowerCase().trim();
  const speed = speedLimitValhalla && speedLimitValhalla > 0 ? speedLimitValhalla : 0;

  let fc = 3;
  let defaultSpeed = 60;

  // 1. Base Classification from Valhalla road_class (Text or Numeric Enum)
  if (
    rc === 'motorway' ||
    rc === 'freeway' ||
    rc === '0'
  ) {
    fc = 1;
    defaultSpeed = 110; // Motorways default to 110 km/h when untagged in OSM
  } else if (rc === 'trunk' || rc === '1') {
    fc = 1;
    defaultSpeed = 90; // Trunks default to 90 km/h
  } else if (rc === 'primary' || rc === '2') {
    // In Panama urban areas, primary avenues (Vía Panamá Norte, Vía España, Calle 50) are FC3 (60 km/h)
    fc = 3;
    defaultSpeed = 60;
  } else if (rc === 'secondary' || rc === '3') {
    fc = 3;
    defaultSpeed = 60;
  } else if (rc === 'tertiary' || rc === '4') {
    fc = 3;
    defaultSpeed = 60;
  } else if (rc === 'unclassified' || rc === 'collector' || rc === '5') {
    fc = 4;
    defaultSpeed = 60;
  } else if (
    rc === 'residential' ||
    rc === 'service' ||
    rc === 'track' ||
    rc === 'living_street' ||
    rc === '6' ||
    rc === '7'
  ) {
    fc = 5;
    defaultSpeed = 40;
  }

  // 2. Ramps & Turn Channels
  if (u === 'ramp' || u === 'turn_channel') {
    if (speed >= 80 || fc === 1) {
      fc = 1;
      defaultSpeed = 90;
    } else {
      fc = 3;
      defaultSpeed = 60;
    }
  }

  // 3. Speed Limit Resolution: Respect exact tagged speedLimitValhalla from OSM if present, else fallback
  const isVerified = speedLimitValhalla !== undefined && speedLimitValhalla > 0;
  const finalSpeedLimit = isVerified ? speedLimitValhalla : defaultSpeed;

  return { fc, speedLimit: finalSpeedLimit, isVerified };
}

@Injectable()
export class ValhallaRoutesClientService {
  private readonly logger = new Logger(ValhallaRoutesClientService.name);
  private consecutiveErrors = 0;
  private isSuspended = false;
  private suspendedUntil: number | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Obtiene la URL de Valhalla desde las variables de entorno (default: http://localhost:8002)
   */
  public getValhallaUrl(): string {
    const url = this.configService.get<string>('VALHALLA_URL') || process.env.VALHALLA_URL || 'http://localhost:8005';
    return url.replace(/\/$/, '');
  }

  /**
   * Calcula una ruta con límites de velocidad usando Valhalla Map Matching (/trace_attributes).
   */
  async calculateRouteWithSpeedLimits(
    coordinates: {
      lat: number;
      lng: number;
      speed?: number;
      angle?: number;
      satellites?: number;
      ignition?: boolean;
    }[],
    travelMode: 'Car' | 'Truck',
  ): Promise<CalculatedRouteResult | null> {
    if (this.isSuspended) {
      if (this.suspendedUntil && Date.now() > this.suspendedUntil) {
        this.logger.log('Restableciendo suspensión de Valhalla tras el periodo de espera.');
        this.resetSuspension();
      } else {
        this.logger.warn(
          'El servicio de Valhalla está suspendido temporalmente por exceso de errores.',
        );
        return null;
      }
    }

    if (coordinates.length < 2) {
      return null;
    }

    // 1. INTENTAR RESOLUCIÓN LOCAL DESDE LA CACHÉ DE LA BASE DE DATOS
    try {
      const minLat = Math.min(...coordinates.map((c) => c.lat)) - 0.005;
      const maxLat = Math.max(...coordinates.map((c) => c.lat)) + 0.005;
      const minLng = Math.min(...coordinates.map((c) => c.lng)) - 0.005;
      const maxLng = Math.max(...coordinates.map((c) => c.lng)) + 0.005;

      const cachedLinks = await this.prisma.$queryRaw<MapLink[]>`
        SELECT * FROM "MapLink"
        WHERE box(point("minLng", "minLat"), point("maxLng", "maxLat")) && box(point(${minLng}, ${minLat}), point(${maxLng}, ${maxLat}))
      `;

      if (cachedLinks.length > 0) {
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

        let allPointsSnapped = true;
        const snappedGeometry: [number, number][] = [];
        const spans: RouteSpanWithSpeedLimit[] = [];
        let lastLinkId: string | null = null;

        for (let i = 0; i < coordinates.length; i++) {
          const pt = coordinates[i];

          const lowSatellites =
            pt.satellites !== undefined && pt.satellites < 5;
          const ignitionOff = pt.ignition === false;

          if (lowSatellites || ignitionOff) {
            snappedGeometry.push([pt.lng, pt.lat]);
            continue;
          }

          const res = snapPointToLinks(
            pt.lat,
            pt.lng,
            pt.speed,
            pt.angle,
            parsedLinks,
            0.03, // 30 meters threshold
          );

          if (!res.snapped) {
            allPointsSnapped = false;
            break;
          }

          snappedGeometry.push([res.longitude, res.latitude]);

          if (res.matchedLink && res.matchedLink.linkId !== lastLinkId) {
            spans.push({
              geometryOffset: i,
              speedLimit: res.matchedLink.speedLimit,
              functionalClass: res.matchedLink.functionalClass,
            });
            lastLinkId = res.matchedLink.linkId;
          }
        }

        if (allPointsSnapped && snappedGeometry.length === coordinates.length) {
          this.logger.log(
            `Cache HIT: Viaje procesado localmente con ${cachedLinks.length} segmentos de la BD.`,
          );
          const hybridPts = buildHybridPolyline(
            coordinates,
            parsedLinks,
            0.035,
          );
          const polylineStr = encodePolyline6(hybridPts);
          const matchedDistanceKm = calculatePolylineDistanceKm(snappedGeometry);
          return {
            spans,
            geometry: snappedGeometry,
            polyline: polylineStr,
            matchedDistanceKm,
          };
        }
      }
    } catch (dbError: any) {
      this.logger.warn(
        `Error al intentar resolver la ruta desde la caché local de la BD: ${dbError.message}`,
      );
    }

    // 2. CACHE MISS: LLAMAR A LA API DE VALHALLA (/trace_attributes)
    const baseUrl = this.getValhallaUrl();
    this.logger.log(
      `Cache MISS: Solicitando ruta a Valhalla API (${baseUrl}/trace_attributes) para ${coordinates.length} coordenadas (alta granularidad local)...`,
    );

    // Filtrado de duplicados consecutivos idénticos para evitar redundancia de puntos estacionarios
    const processedCoords = removeConsecutiveDuplicateCoords(coordinates);

    const shapePayload = processedCoords.map((c) => ({
      lat: c.lat,
      lon: c.lng,
      search_radius: 80,
    }));

    const costing = travelMode.toLowerCase() === 'truck' ? 'truck' : 'auto';

    const payload = {
      shape: shapePayload,
      costing: costing,
      shape_match: 'walk_or_snap',
      trace_options: {
        search_radius: 80,
      },
      filters: {
        attributes: [
          'edge.length',
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
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/trace_attributes`, payload, {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const data = response.data;
      const edges = data?.edges || [];
      const shapePolyline6 = data?.shape;

      if (!edges.length && !shapePolyline6) {
        throw new Error('Valhalla no retornó bordes ni geometría en la respuesta.');
      }

      // Decodificar la polilínea general de la ruta obtenida de Valhalla (6 decimales)
      // NOTA CRÍTICA: decodePolyline6 entrega [lat, lon].
      // Para GeoJSON, Mapbox y almacenamiento en DB se deben invertir a [lng, lat].
      const decodedLatLng = shapePolyline6 ? decodePolyline6(shapePolyline6) : [];
      const decodedGeoJSON = flipCoordinatesToGeoJSON(decodedLatLng); // [lng, lat][]

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
      const existingMapLinks = await this.prisma.mapLink.findMany({
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
            this.prisma.mapLink.update({
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
            this.prisma.mapLink.upsert({
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
          await this.prisma.$transaction(updates.slice(i, i + 50));
        }
      }

      this.logger.log(
        `Guardados/Actualizados ${uniqueLinksToSave.length} segmentos OSM/Valhalla únicos en la BD (en lotes).`,
      );

      // Reconstruir la geometría y spans del viaje usando la misma lógica de snapping
      const parsedLinks = uniqueLinksToSave.map((link) => {
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

      const snappedGeometry: [number, number][] = [];
      const spans: RouteSpanWithSpeedLimit[] = [];
      let lastLinkId: string | null = null;

      for (let i = 0; i < coordinates.length; i++) {
        const pt = coordinates[i];

        const lowSatellites = pt.satellites !== undefined && pt.satellites < 5;
        const ignitionOff = pt.ignition === false;

        if (lowSatellites || ignitionOff) {
          snappedGeometry.push([pt.lng, pt.lat]);
          continue;
        }

        const res = snapPointToLinks(
          pt.lat,
          pt.lng,
          pt.speed,
          pt.angle,
          parsedLinks,
          0.035, // 35 meters threshold
        );

        if (res.snapped) {
          snappedGeometry.push([res.longitude, res.latitude]);
        } else {
          snappedGeometry.push([pt.lng, pt.lat]);
        }

        if (res.matchedLink && res.matchedLink.linkId !== lastLinkId) {
          spans.push({
            geometryOffset: i,
            speedLimit: res.matchedLink.speedLimit,
            functionalClass: res.matchedLink.functionalClass,
          });
          lastLinkId = res.matchedLink.linkId;
        }
      }

      this.consecutiveErrors = 0;
      const hybridPts = buildHybridPolyline(coordinates, parsedLinks, 0.035);
      const polylineStr = shapePolyline6 || encodePolyline6(hybridPts);

      let matchedDistanceKm = 0;
      if (edges && edges.length > 0) {
        const totalEdgeKm = edges.reduce(
          (sum: number, edge: any) => sum + (edge.length || 0),
          0,
        );
        matchedDistanceKm = parseFloat(totalEdgeKm.toFixed(2));
      }

      if (matchedDistanceKm <= 0) {
        matchedDistanceKm = calculatePolylineDistanceKm(
          decodedGeoJSON.length > 0 ? decodedGeoJSON : snappedGeometry,
        );
      }
      return {
        spans,
        geometry: snappedGeometry,
        polyline: polylineStr,
        matchedDistanceKm,
      };
    } catch (error: any) {
      this.consecutiveErrors++;
      this.logger.error(
        `Error al llamar a Valhalla API (#${this.consecutiveErrors}): ${error.message}`,
      );

      if (this.consecutiveErrors >= 5) {
        this.isSuspended = true;
        this.suspendedUntil = Date.now() + 60000; // Auto-reset after 60s
        this.logger.error(
          'Se suspenden temporalmente las llamadas a Valhalla por 60 segundos por exceso de errores consecutivos.',
        );
      }
      return null;
    }
  }

  /**
   * Calcula una ruta punto a punto entre la ubicación de un usuario y un vehículo
   * utilizando el endpoint /route de Valhalla.
   */
  async calculatePointToPointRoute(
    userLat: number,
    userLng: number,
    vehicleLat: number,
    vehicleLng: number,
    travelMode: 'Car' | 'Truck' = 'Car',
  ): Promise<{
    distanceKm: number;
    durationMinutes: number;
    coordinates: [number, number][];
    polyline?: string;
  } | null> {
    this.resetSuspension();
    const baseUrl = this.getValhallaUrl();
    const costing = travelMode.toLowerCase() === 'truck' ? 'truck' : 'auto';
    const payload = {
      locations: [
        { lat: vehicleLat, lon: vehicleLng },
        { lat: userLat, lon: userLng },
      ],
      costing,
      costing_options: {
        truck: {
          use_highways: 0.9,
          use_distance: 0.35,
          service_penalty: 30,
          maneuver_penalty: 15,
        },
        auto: {
          use_highways: 0.9,
          use_distance: 0.35,
          service_penalty: 25,
          maneuver_penalty: 12,
        },
      },
      directions_options: { units: 'km' },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/route`, payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const trip = response.data?.trip;
      if (!trip || !trip.legs || trip.legs.length === 0) return null;

      const summary = trip.summary || {};
      const distanceKm = summary.length ? parseFloat(summary.length.toFixed(2)) : 0;
      const durationMinutes = summary.time ? Math.round(summary.time / 60) : 0;

      const shapePolyline6 = trip.legs[0].shape;
      const decodedLatLng = shapePolyline6 ? decodePolyline6(shapePolyline6) : [];
      const coordinates = flipCoordinatesToGeoJSON(decodedLatLng);

      return {
        distanceKm,
        durationMinutes,
        coordinates,
        polyline: shapePolyline6,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      this.logger.error(
        `Error al calcular ruta punto a punto en Valhalla: ${errorMsg}`,
      );
      return null;
    }
  }

  resetSuspension() {
    this.isSuspended = false;
    this.suspendedUntil = null;
    this.consecutiveErrors = 0;
  }
}
