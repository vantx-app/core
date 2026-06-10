import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoRoutesClient,
  CalculateRoutesCommand,
} from '@aws-sdk/client-geo-routes';

/** Un tramo de ruta con su límite de velocidad y posición en la geometría */
export interface RouteSpanWithSpeedLimit {
  geometryOffset: number;
  speedLimit: number | null; // km/h, null si es Unlimited o no disponible
}

/** Resultado de una llamada exitosa a CalculateRoutes */
export interface CalculatedRouteResult {
  spans: RouteSpanWithSpeedLimit[];
  geometry: [number, number][]; // [lng, lat] puntos decodificados de la ruta
}

@Injectable()
export class AwsRoutesClientService {
  private readonly logger = new Logger(AwsRoutesClientService.name);
  private client: GeoRoutesClient | null = null;
  private consecutiveErrors = 0;
  private isSuspended = false;

  /** Máximo de waypoints por llamada a CalculateRoutes (Origin + 21 Waypoints + Destination) */
  private readonly MAX_WAYPOINTS_PER_CALL = 23;
  /** Distancia mínima entre puntos para el downsampling (en km) */
  private readonly DOWNSAMPLE_MIN_DISTANCE_KM = 0.3;
  /** Máximo de puntos después del downsampling */
  private readonly MAX_DOWNSAMPLED_POINTS = 75;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): GeoRoutesClient | null {
    if (this.client) return this.client;

    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const apiKey = this.configService.get<string>('AWS_GEO_ROUTES_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'AWS_GEO_ROUTES_API_KEY no configurada en las variables de entorno.',
      );
      return null;
    }

    this.client = new GeoRoutesClient({ region });
    return this.client;
  }

  /**
   * Calcula una ruta con límites de velocidad para una secuencia de coordenadas GPS.
   * Aplica downsampling y chunking automáticamente.
   */
  async calculateRouteWithSpeedLimits(
    coordinates: { lat: number; lng: number }[],
    travelMode: 'Car' | 'Truck',
  ): Promise<CalculatedRouteResult | null> {
    if (this.isSuspended) {
      return null;
    }

    const client = this.getClient();
    if (!client) return null;

    const apiKey = this.configService.get<string>('AWS_GEO_ROUTES_API_KEY');
    if (!apiKey) return null;

    // Paso 1: Downsampling basado en distancia
    const sampled = this.downsampleByDistance(coordinates);
    if (sampled.length < 2) {
      return null;
    }

    // Paso 2: Dividir en chunks de hasta MAX_WAYPOINTS_PER_CALL puntos
    const chunks = this.splitIntoChunks(sampled);

    const allSpans: RouteSpanWithSpeedLimit[] = [];
    const allGeometry: [number, number][] = [];
    let geometryOffsetAccumulator = 0;

    for (const chunk of chunks) {
      const result = await this.callCalculateRoutes(
        client,
        apiKey,
        chunk,
        travelMode,
      );

      if (!result) {
        // Si un chunk falla, retornamos null para usar el fallback
        return null;
      }

      // Ajustar los geometryOffsets del chunk al acumulador global
      for (const span of result.spans) {
        allSpans.push({
          geometryOffset: span.geometryOffset + geometryOffsetAccumulator,
          speedLimit: span.speedLimit,
        });
      }

      // Acumular geometría (evitar duplicar el punto de empalme)
      if (allGeometry.length > 0 && result.geometry.length > 0) {
        allGeometry.push(...result.geometry.slice(1));
        geometryOffsetAccumulator += result.geometry.length - 1;
      } else {
        allGeometry.push(...result.geometry);
        geometryOffsetAccumulator += result.geometry.length;
      }
    }

    this.consecutiveErrors = 0;
    return { spans: allSpans, geometry: allGeometry };
  }

  /**
   * Ejecuta una sola llamada a CalculateRoutes para un chunk de coordenadas.
   */
  private async callCalculateRoutes(
    client: GeoRoutesClient,
    apiKey: string,
    chunk: { lat: number; lng: number }[],
    travelMode: 'Car' | 'Truck',
  ): Promise<CalculatedRouteResult | null> {
    const origin = chunk[0];
    const destination = chunk[chunk.length - 1];
    const waypoints =
      chunk.length > 2
        ? chunk.slice(1, -1).map((c) => ({ Position: [c.lng, c.lat] }))
        : undefined;

    try {
      const command = new CalculateRoutesCommand({
        Origin: [origin.lng, origin.lat],
        Destination: [destination.lng, destination.lat],
        Waypoints: waypoints,
        TravelMode: travelMode,
        SpanAdditionalFeatures: ['SpeedLimit'],
        LegGeometryFormat: 'Simple',
        Key: apiKey,
      });

      const response = await client.send(command);
      this.consecutiveErrors = 0;

      if (!response.Routes || response.Routes.length === 0) {
        this.logger.warn(
          'La respuesta de AWS CalculateRoutes no contiene rutas.',
        );
        return null;
      }

      const route = response.Routes[0];
      const spans: RouteSpanWithSpeedLimit[] = [];
      const geometry: [number, number][] = [];

      if (!route.Legs || route.Legs.length === 0) {
        return null;
      }

      let legGeometryOffset = 0;

      for (const leg of route.Legs) {
        // Extraer geometría del leg
        if (leg.Geometry?.LineString) {
          for (const point of leg.Geometry.LineString) {
            geometry.push(point as [number, number]);
          }
        }

        // Extraer spans con speed limits desde VehicleLegDetails (Car/Truck)
        const vehicleSpans = leg.VehicleLegDetails?.Spans;
        if (vehicleSpans) {
          for (const span of vehicleSpans) {
            let speedLimit: number | null = null;

            if (span.SpeedLimit) {
              if (span.SpeedLimit.Unlimited) {
                speedLimit = null; // Sin límite definido
              } else if (
                span.SpeedLimit.MaxSpeed !== undefined &&
                span.SpeedLimit.MaxSpeed !== null
              ) {
                speedLimit = span.SpeedLimit.MaxSpeed;
              }
            }

            spans.push({
              geometryOffset: (span.GeometryOffset ?? 0) + legGeometryOffset,
              speedLimit,
            });
          }
        }

        // Acumular el offset de geometría para el siguiente leg
        if (leg.Geometry?.LineString) {
          legGeometryOffset += leg.Geometry.LineString.length;
        }
      }

      return { spans, geometry };
    } catch (error: any) {
      this.consecutiveErrors++;
      this.logger.error(
        `Error al llamar a AWS CalculateRoutes (#${this.consecutiveErrors}): ${error.message}`,
      );

      if (this.consecutiveErrors >= 3) {
        this.isSuspended = true;
        this.logger.error(
          'Se suspenden temporalmente las llamadas a AWS GeoRoutes por exceso de errores consecutivos. Usando fallback simple.',
        );
      }
      return null;
    }
  }

  /**
   * Reduce la densidad de puntos GPS manteniendo los que están al menos a
   * DOWNSAMPLE_MIN_DISTANCE_KM entre sí. Siempre preserva el primer y último punto.
   */
  downsampleByDistance(
    coordinates: { lat: number; lng: number }[],
  ): { lat: number; lng: number }[] {
    if (coordinates.length <= 2) return [...coordinates];

    const result: { lat: number; lng: number }[] = [coordinates[0]];

    for (let i = 1; i < coordinates.length - 1; i++) {
      const last = result[result.length - 1];
      const dist = this.haversineDistance(
        last.lat,
        last.lng,
        coordinates[i].lat,
        coordinates[i].lng,
      );

      if (dist >= this.DOWNSAMPLE_MIN_DISTANCE_KM) {
        result.push(coordinates[i]);
      }
    }

    // Siempre incluir el último punto
    result.push(coordinates[coordinates.length - 1]);

    // Si aún tenemos demasiados puntos, aplicar un segundo paso de thinning uniforme
    if (result.length > this.MAX_DOWNSAMPLED_POINTS) {
      return this.uniformThin(result, this.MAX_DOWNSAMPLED_POINTS);
    }

    return result;
  }

  /**
   * Reduce uniformemente un array de puntos al tamaño deseado,
   * preservando siempre el primero y el último.
   */
  private uniformThin(
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
   * Divide las coordenadas en chunks solapados de hasta MAX_WAYPOINTS_PER_CALL puntos.
   * El último punto de cada chunk es el primero del siguiente para continuidad.
   */
  splitIntoChunks(
    coordinates: { lat: number; lng: number }[],
  ): { lat: number; lng: number }[][] {
    if (coordinates.length <= this.MAX_WAYPOINTS_PER_CALL) {
      return [coordinates];
    }

    const chunks: { lat: number; lng: number }[][] = [];
    let start = 0;

    while (start < coordinates.length - 1) {
      const end = Math.min(
        start + this.MAX_WAYPOINTS_PER_CALL,
        coordinates.length,
      );
      chunks.push(coordinates.slice(start, end));
      // El siguiente chunk empieza en el último punto del anterior
      start = end - 1;
    }

    return chunks;
  }

  /**
   * Distancia Haversine entre dos puntos en km.
   */
  haversineDistance(
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
   * Reinicia la suspensión del cliente (por ejemplo, al iniciar un nuevo cron run).
   */
  resetSuspension() {
    this.isSuspended = false;
    this.consecutiveErrors = 0;
  }
}
