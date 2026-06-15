import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  RouteSpanWithSpeedLimit,
  CalculatedRouteResult,
  downsampleByDistance,
  splitIntoChunks,
  decodeFlexiblePolyline,
  haversineDistance,
} from './route-utils';

@Injectable()
export class HereRoutesClientService {
  private readonly logger = new Logger(HereRoutesClientService.name);
  public readonly enabled = true;
  private consecutiveErrors = 0;
  private isSuspended = false;

  /** Máximo de waypoints por llamada a HERE Routing (Origin + 73 Waypoints + Destination) */
  private readonly MAX_WAYPOINTS_PER_CALL = 75;
  /** Distancia mínima entre puntos para el downsampling (en km) */
  private readonly DOWNSAMPLE_MIN_DISTANCE_KM = 0.3;
  /** Máximo de puntos después del downsampling */
  private readonly MAX_DOWNSAMPLED_POINTS = 75;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Calcula una ruta con límites de velocidad para una secuencia de coordenadas GPS usando HERE Routing v8.
   */
  async calculateRouteWithSpeedLimits(
    coordinates: { lat: number; lng: number }[],
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

    // Calcular distancia acumulada del viaje
    let tripDistanceKm = 0;
    for (let i = 1; i < coordinates.length; i++) {
      tripDistanceKm += haversineDistance(
        coordinates[i - 1].lat,
        coordinates[i - 1].lng,
        coordinates[i].lat,
        coordinates[i].lng,
      );
    }

    let maxDownsampledPoints = this.MAX_DOWNSAMPLED_POINTS;
    if (tripDistanceKm >= 30 && tripDistanceKm <= 100) {
      maxDownsampledPoints = 150;
    } else if (tripDistanceKm > 100) {
      maxDownsampledPoints = 225;
    }

    // Paso 1: Downsampling basado en distancia
    const sampled = downsampleByDistance(
      coordinates,
      this.DOWNSAMPLE_MIN_DISTANCE_KM,
      maxDownsampledPoints,
    );
    if (sampled.length < 2) {
      return null;
    }

    // Paso 2: Dividir en chunks de hasta MAX_WAYPOINTS_PER_CALL puntos
    const chunks = splitIntoChunks(sampled, this.MAX_WAYPOINTS_PER_CALL);

    const allSpans: RouteSpanWithSpeedLimit[] = [];
    const allGeometry: [number, number][] = [];

    for (const chunk of chunks) {
      const result = await this.callHereRouting(apiKey, chunk, travelMode);

      if (!result) {
        // Si un chunk falla, retornamos null para usar el fallback global
        return null;
      }

      // El acumulador para este chunk es el final de la geometría actual menos 1 (si ya hay elementos)
      const currentOffset = allGeometry.length > 0 ? allGeometry.length - 1 : 0;

      // Ajustar los geometryOffsets del chunk al acumulador global
      for (const span of result.spans) {
        allSpans.push({
          geometryOffset: span.geometryOffset + currentOffset,
          speedLimit: span.speedLimit,
          functionalClass: span.functionalClass ?? null,
        });
      }

      // Acumular geometría (evitar duplicar el punto de empalme)
      if (allGeometry.length > 0 && result.geometry.length > 0) {
        allGeometry.push(...result.geometry.slice(1));
      } else {
        allGeometry.push(...result.geometry);
      }
    }

    this.consecutiveErrors = 0;
    return { spans: allSpans, geometry: allGeometry };
  }

  /**
   * Realiza la llamada HTTP al endpoint de HERE Routing v8 para un chunk de coordenadas.
   */
  private async callHereRouting(
    apiKey: string,
    chunk: { lat: number; lng: number }[],
    travelMode: 'Car' | 'Truck',
  ): Promise<CalculatedRouteResult | null> {
    const origin = chunk[0];
    const destination = chunk[chunk.length - 1];
    const waypoints = chunk.length > 2 ? chunk.slice(1, -1) : null;

    const url = 'https://router.hereapi.com/v8/routes';
    const queryParams = new URLSearchParams();
    queryParams.append('apikey', apiKey);
    queryParams.append('transportMode', travelMode.toLowerCase());
    queryParams.append('origin', `${origin.lat},${origin.lng}`);
    queryParams.append('destination', `${destination.lat},${destination.lng}`);
    queryParams.append('return', 'polyline');
    queryParams.append('spans', 'maxSpeed,functionalClass');
    // Forzar modo planeación para desactivar Time-Aware Routing (evita tarifas Advanced Routing y tráfico)
    queryParams.append('departureTime', 'any');

    if (waypoints) {
      for (const wp of waypoints) {
        queryParams.append('via', `${wp.lat},${wp.lng}!passThrough=true`);
      }
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${url}?${queryParams.toString()}`, {
          timeout: 10000,
        }),
      );

      const data = response.data;
      if (!data.routes || data.routes.length === 0) {
        this.logger.warn('La respuesta de HERE Routing no contiene rutas.');
        return null;
      }

      const route = data.routes[0];
      if (!route.sections || route.sections.length === 0) {
        this.logger.warn('La ruta de HERE no contiene secciones.');
        return null;
      }

      const section = route.sections[0];
      const encodedPolyline = section.polyline;
      if (!encodedPolyline) {
        this.logger.warn('La sección de HERE no contiene polyline.');
        return null;
      }

      // Decodificar la flexible polyline obtenida
      const decoded = decodeFlexiblePolyline(encodedPolyline);
      // El decodificador retorna [lat, lng], convertimos a [lng, lat] para consistencia con AWS
      const geometry = decoded.polyline.map(
        ([lat, lng]) => [lng, lat] as [number, number],
      );

      const spans: RouteSpanWithSpeedLimit[] = [];
      if (section.spans) {
        for (const span of section.spans) {
          const rawSpeed = span.maxSpeed;
          // Convertir de m/s a km/h (multiplicando por 3.6)
          const speedLimit = rawSpeed ? Math.round(rawSpeed * 3.6) : null;
          spans.push({
            geometryOffset: span.offset ?? 0,
            speedLimit,
            functionalClass: span.functionalClass ?? null,
          });
        }
      }

      this.consecutiveErrors = 0;
      return { spans, geometry };
    } catch (error: any) {
      this.consecutiveErrors++;
      this.logger.error(
        `Error al llamar a HERE Routing (#${this.consecutiveErrors}): ${error.message}`,
      );

      if (this.consecutiveErrors >= 3) {
        this.isSuspended = true;
        this.logger.error(
          'Se suspenden temporalmente las llamadas a HERE Routing por exceso de errores consecutivos.',
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
