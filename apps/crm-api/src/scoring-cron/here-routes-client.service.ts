import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';
import {
  RouteSpanWithSpeedLimit,
  CalculatedRouteResult,
  haversineDistance,
  encodeFlexiblePolyline,
  decodeFlexiblePolyline,
  downsampleByDistance,
  calculateHeading,
  getAngleDiff,
  uniformThin,
} from './route-utils';

@Injectable()
export class HereRoutesClientService {
  private readonly logger = new Logger(HereRoutesClientService.name);
  public readonly enabled = true;
  private consecutiveErrors = 0;
  private isSuspended = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calcula una ruta con límites de velocidad para una secuencia de coordenadas GPS usando la API de Atributos de Mapa.
   */
  async calculateRouteWithSpeedLimits(
    coordinates: { lat: number; lng: number; speed?: number; angle?: number }[],
    travelMode: 'Car' | 'Truck',
  ): Promise<CalculatedRouteResult | null> {
    if (this.isSuspended) {
      this.logger.warn(
        'El servicio de HERE está suspendido temporalmente por exceso de errores.',
      );
      return null;
    }

    const apiKey = this.configService.get<string>('HERE_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'HERE_API_KEY no configurada en las variables de entorno.',
      );
      return null;
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

      const cachedLinks = await this.prisma.mapLink.findMany({
        where: {
          minLat: { lte: maxLat },
          maxLat: { gte: minLat },
          minLng: { lte: maxLng },
          maxLng: { gte: minLng },
        },
      });

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
          };
        });

        let allPointsSnapped = true;
        const snappedGeometry: [number, number][] = [];
        const spans: RouteSpanWithSpeedLimit[] = [];
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
              const dist = haversineDistance(
                pt.lat,
                pt.lng,
                linkPt[1],
                linkPt[0],
              );

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

          if (!closestPt || bestDist > 0.03) {
            allPointsSnapped = false;
            break;
          }

          snappedGeometry.push(closestPt);

          if (matchedLink && matchedLink.linkId !== lastLinkId) {
            spans.push({
              geometryOffset: i,
              speedLimit: matchedLink.speedLimit,
              functionalClass: matchedLink.functionalClass,
            });
            lastLinkId = matchedLink.linkId;
          }
        }

        if (allPointsSnapped && snappedGeometry.length === coordinates.length) {
          this.logger.log(
            `Cache HIT: Viaje procesado localmente con ${cachedLinks.length} segmentos de la BD.`,
          );
          return { spans, geometry: snappedGeometry };
        }
      }
    } catch (dbError: any) {
      this.logger.warn(
        `Error al intentar resolver la ruta desde la caché local de la BD: ${dbError.message}`,
      );
    }

    // 2. CACHE MISS: LLAMAR A LA API DE HERE ROUTING V8
    this.logger.log(
      `Cache MISS: Solicitando ruta a HERE Routing API v8 para ${coordinates.length} coordenadas...`,
    );

    // Downsampling inteligente usando downsampleByDistance para encajar en límites de URL del API
    const processedCoords = downsampleByDistance(coordinates, 0.2, 60);

    const transportMode = travelMode.toLowerCase();
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

    // Agregar puntos intermedios como via con passThrough
    for (let i = 1; i < processedCoords.length - 1; i++) {
      queryParams.append(
        'via',
        `${processedCoords[i].lat},${processedCoords[i].lng}!passThrough=true`,
      );
    }

    queryParams.append('return', 'polyline');
    queryParams.append('spans', 'functionalClass,segmentId');

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${url}?${queryParams.toString()}`, {
          timeout: 20000,
        }),
      );

      const section = response.data?.routes?.[0]?.sections?.[0];
      if (!section || !section.polyline) {
        throw new Error(
          'No se encontró sección o polilínea en la respuesta del API de HERE',
        );
      }

      const decoded = decodeFlexiblePolyline(section.polyline);
      const polylinePoints = decoded.polyline; // Array de [lat, lng]
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
      }[] = [];

      for (let i = 0; i < apiSpans.length; i++) {
        const span = apiSpans[i];
        const fc = span.functionalClass || 3;
        const rawLinkId =
          span.segmentId || span.segmentRef || `gen-${i}-${Date.now()}`;
        const linkId = String(rawLinkId);

        // Mapeo oficial de límites de velocidad de Panamá (PANAMA_LEGAL_CEILINGS)
        // FC1 se establece en 110 km/h para reflejar límites reales en corredores y autopistas
        const speedLimit =
          fc === 1
            ? 110 // Autopistas / Corredores
            : fc === 2
              ? 80 // Carreteras
              : fc === 3
                ? 60 // Avenidas Principales
                : fc === 4
                  ? 60
                  : 40; // FC5: Calles Residenciales / Urbanas comerciales

        const startOffset = span.offset;
        const endOffset =
          i < apiSpans.length - 1
            ? apiSpans[i + 1].offset
            : polylinePoints.length - 1;
        const segmentPts = polylinePoints.slice(startOffset, endOffset + 1);
        if (segmentPts.length === 0) continue;

        const lats = segmentPts.map((p) => p[0]);
        const lons = segmentPts.map((p) => p[1]);

        // Guardar geometría en formato [lng, lat]
        const geometryStr = segmentPts.map((p) => `${p[1]},${p[0]}`).join(';');
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lons);
        const maxLng = Math.max(...lons);

        linksToSave.push({
          linkId,
          functionalClass: fc,
          speedLimit,
          geometry: geometryStr,
          minLat,
          maxLat,
          minLng,
          maxLng,
        });
      }

      // Upsertar secuencialmente en la BD para autolearning
      for (const link of linksToSave) {
        await this.prisma.mapLink.upsert({
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
          },
          update: {
            functionalClass: link.functionalClass,
            speedLimit: link.speedLimit,
            geometry: link.geometry,
            minLat: link.minLat,
            maxLat: link.maxLat,
            minLng: link.minLng,
            maxLng: link.maxLng,
          },
        });
      }

      this.logger.log(
        `Guardados/Actualizados ${linksToSave.length} segmentos en la BD para autolearning.`,
      );

      // Reconstruir la geometría y spans del viaje usando la misma lógica de snapping
      const parsedLinks = linksToSave.map((link) => {
        const pts = link.geometry.split(';').map((pair) => {
          const [lng, lat] = pair.split(',').map(Number);
          return [lng, lat] as [number, number];
        });
        return {
          linkId: link.linkId,
          functionalClass: link.functionalClass,
          speedLimit: link.speedLimit,
          points: pts,
        };
      });

      const snappedGeometry: [number, number][] = [];
      const spans: RouteSpanWithSpeedLimit[] = [];
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
            const dist = haversineDistance(
              pt.lat,
              pt.lng,
              linkPt[1],
              linkPt[0],
            );

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
                anglePenalty = 0.05;
              }
            }

            if (pt.speed !== undefined && pt.speed > 55) {
              if (link.speedLimit <= 40) {
                speedPenalty = 0.05;
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

      this.consecutiveErrors = 0;
      return { spans, geometry: snappedGeometry };
    } catch (error: any) {
      this.consecutiveErrors++;
      this.logger.error(
        `Error al llamar a HERE Map Attributes API (#${this.consecutiveErrors}): ${error.message}`,
      );

      if (this.consecutiveErrors >= 3) {
        this.isSuspended = true;
        this.logger.error(
          'Se suspenden temporalmente las llamadas a HERE API por exceso de errores consecutivos.',
        );
      }
      return null;
    }
  }

  resetSuspension() {
    this.isSuspended = false;
    this.consecutiveErrors = 0;
  }
}
