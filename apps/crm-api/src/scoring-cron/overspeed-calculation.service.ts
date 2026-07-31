import { Injectable } from '@nestjs/common';
import { TelemetryLog, VehicleCategory } from '@prisma/client';
import { ValhallaRoutesClientService } from './valhalla-routes-client.service';
import { haversineDistance, RouteSpanWithSpeedLimit } from './route-utils';

export interface ResolvedSpeedingLog {
  timestamp: Date;
  speed: number;
  speedLimit: number;
  functionalClass: number;
  isSpeeding: boolean;
  multiplier: number;
}

@Injectable()
export class OverspeedCalculationService {
  constructor(private valhallaRoutesClient: ValhallaRoutesClientService) { }

  /**
   * Calcula el exceso de velocidad basándose en el límite fallback (110 km/h o configurado en el perfil)
   */
  public calculateOverspeedingFallback(
    logs: TelemetryLog[],
    fallbackThreshold: number,
  ): { overspeedCount: number; overspeedSeverity: number } {
    let overspeedCount = 0;
    let totalDurationSeconds = 0;

    let currentEpisodeStart: Date | null = null;
    let lastSpeedingTimestamp: Date | null = null;
    const COOLDOWN_MS = 30 * 1000; // Cooldown de 30 segundos

    for (const log of logs) {
      // Umbral con margen de gracia de 10 km/h para Panamá
      const isSpeeding = log.speed > fallbackThreshold + 10;

      if (isSpeeding) {
        if (!currentEpisodeStart) {
          currentEpisodeStart = log.timestamp;
        }
        lastSpeedingTimestamp = log.timestamp;
      } else {
        if (currentEpisodeStart && lastSpeedingTimestamp) {
          const timeSinceLastSpeeding =
            log.timestamp.getTime() - lastSpeedingTimestamp.getTime();
          if (timeSinceLastSpeeding >= COOLDOWN_MS) {
            // Verificar duración mínima de 5 segundos antes de registrar la infracción
            const actualDuration =
              (lastSpeedingTimestamp.getTime() -
                currentEpisodeStart.getTime()) /
              1000;
            if (actualDuration >= 5) {
              const duration = Math.max(10, actualDuration);
              totalDurationSeconds += duration;
              overspeedCount++;
            }

            currentEpisodeStart = null;
            lastSpeedingTimestamp = null;
          }
        }
      }
    }

    // Manejar el último episodio activo si el viaje terminó mientras excedía la velocidad
    if (currentEpisodeStart && lastSpeedingTimestamp) {
      const actualDuration =
        (lastSpeedingTimestamp.getTime() - currentEpisodeStart.getTime()) /
        1000;
      if (actualDuration >= 5) {
        const duration = Math.max(10, actualDuration);
        totalDurationSeconds += duration;
        overspeedCount++;
      }
    }

    return {
      overspeedCount,
      overspeedSeverity: parseFloat(totalDurationSeconds.toFixed(3)),
    };
  }

  /**
   * Evalúa el exceso de velocidad utilizando la ruta real obtenida de Valhalla API.
   * Aplica la ponderación por Functional Class y fallback por inercia/reglas específicas de Panamá.
   */
  public async evaluateOverspeedingWithValhallaRoutes(
    logs: TelemetryLog[],
    fallbackOverspeedThreshold: number,
    category: VehicleCategory,
  ): Promise<{
    overspeedCount: number;
    overspeedSeverity: number;
    polyline?: string;
    matchedDistanceKm?: number;
  }> {
    const validLogs = logs.filter(
      (log) => log.latitude !== 0 && log.longitude !== 0,
    );
    if (validLogs.length < 2) {
      return { overspeedCount: 0, overspeedSeverity: 0 };
    }

    // Si la velocidad máxima registrada no superó los 40 km/h,
    // es matemáticamente imposible que haya un exceso de velocidad,
    // incluso en zonas escolares de 30 km/h con el buffer de 10 km/h.
    if (!validLogs.some((log) => log.speed > 40)) {
      return { overspeedCount: 0, overspeedSeverity: 0 };
    }

    const startLog = validLogs[0];
    const endLog = validLogs[validLogs.length - 1];
    const distanceKm = haversineDistance(
      startLog.latitude,
      startLog.longitude,
      endLog.latitude,
      endLog.longitude,
    );
    if (distanceKm < 0.1) {
      return { overspeedCount: 0, overspeedSeverity: 0 };
    }

    const isTruck =
      category === VehicleCategory.HEAVY_DUTY ||
      category === VehicleCategory.MACHINERY;
    const travelMode = isTruck ? 'Truck' : 'Car';

    const coordinates = validLogs.map((log) => ({
      lat: log.latitude,
      lng: log.longitude,
      speed: log.speed,
      angle: log.angle,
      satellites: log.satellites ?? undefined,
      ignition: log.ignition,
    }));

    const routeResult =
      await this.valhallaRoutesClient.calculateRouteWithSpeedLimits(
        coordinates,
        travelMode as 'Car' | 'Truck',
      );

    if (!routeResult) {
      return this.calculateOverspeedingFallback(
        validLogs,
        fallbackOverspeedThreshold,
      );
    }

    const { spans, geometry, polyline } = routeResult;

    // 1. Resolver límites de velocidad, clases funcionales y estados de exceso para cada punto
    const resolvedLogs = this.resolveSpeedLimitsAndClasses(
      validLogs,
      geometry,
      spans,
      fallbackOverspeedThreshold,
    );

    // 2. Evaluar episodios y calcular duración total ponderada de severidad
    const overspeedResult = this.calculateWeightedOverspeed(resolvedLogs);

    return {
      ...overspeedResult,
      polyline,
      matchedDistanceKm: routeResult.matchedDistanceKm,
    };
  }

  /**
   * Alias de compatibilidad para evaluateOverspeedingWithValhallaRoutes
   */
  public async evaluateOverspeedingWithHereRoutes(
    logs: TelemetryLog[],
    fallbackOverspeedThreshold: number,
    category: VehicleCategory,
  ) {
    return this.evaluateOverspeedingWithValhallaRoutes(
      logs,
      fallbackOverspeedThreshold,
      category,
    );
  }

  /**
   * Mapea una clase funcional (FC) a su correspondiente multiplicador de riesgo/severidad (Bypass Factor)
   */
  private mapFCToMultiplier(fc: number): number {
    if (fc === 1) return 0.5;
    if (fc === 2) return 1.0;
    if (fc === 3) return 1.5;
    if (fc === 4) return 2.0;
    if (fc === 5) return 3.0;
    return 1.0;
  }

  /**
   * Busca el primer límite de velocidad y clase funcional válidos en ruta para inicializar el fallback de inercia
   */
  private initializeInertialFallback(
    validLogs: TelemetryLog[],
    geometry: [number, number][],
    spans: RouteSpanWithSpeedLimit[],
    fallbackThreshold: number,
  ): { limit: number; fc: number } {
    let initialValidLimit = fallbackThreshold;
    let initialValidFC = 3; // Por defecto FC3

    for (const log of validLogs) {
      const { index: closestIdx, distanceKm: snapDist } =
        this.findClosestGeometryIndex(log.latitude, log.longitude, geometry);
      if (snapDist <= 0.05) {
        const { speedLimit: spanLimit, functionalClass: fc } =
          this.getSpeedLimitAndClassForGeometryIndex(closestIdx, spans);
        let limit: number;
        if (spanLimit && spanLimit > 0) limit = spanLimit;
        else if (fc === 1) limit = 90;
        else if (fc === 2) limit = 80;
        else if (fc === 3 || fc === 4) limit = 60;
        else if (fc === 5) limit = 40;
        else limit = fallbackThreshold;

        if (limit !== fallbackThreshold) {
          initialValidLimit = limit;
          initialValidFC = fc ?? 3;
          break;
        }
      }
    }

    return { limit: initialValidLimit, fc: initialValidFC };
  }

  /**
   * Procesa la lista de logs contra la geometría de la ruta y los spans de HERE
   * para resolver las propiedades de límites, FC, y si se encuentra excediendo velocidad.
   */
  private resolveSpeedLimitsAndClasses(
    validLogs: TelemetryLog[],
    geometry: [number, number][],
    spans: RouteSpanWithSpeedLimit[],
    fallbackThreshold: number,
  ): ResolvedSpeedingLog[] {
    const resolvedLogs: ResolvedSpeedingLog[] = [];

    const { limit: initialLimit, fc: initialFC } =
      this.initializeInertialFallback(
        validLogs,
        geometry,
        spans,
        fallbackThreshold,
      );

    let lastValidOnRouteSpeedLimit = initialLimit;
    let lastValidOnRouteFC = initialFC;
    let lastSpeedLimit: number | null = null;
    let decelerationGraceWindowEnd = 0; // Marca de tiempo en ms

    for (const log of validLogs) {
      const { index: closestIdx, distanceKm: snapDist } =
        this.findClosestGeometryIndex(log.latitude, log.longitude, geometry);

      let limitToUse: number;
      let fcToUse: number;

      if (snapDist > 0.05) {
        // Fuera de ruta (> 50m), usar Inertial Fallback (heredar el último límite y FC válidos en ruta)
        limitToUse = lastValidOnRouteSpeedLimit;
        fcToUse = lastValidOnRouteFC;
      } else {
        const { speedLimit: spanLimit, functionalClass: fc } =
          this.getSpeedLimitAndClassForGeometryIndex(closestIdx, spans);
        fcToUse = fc ?? 3;

        // Prefer the exact road link speed limit returned by Valhalla (e.g. 90 km/h vs 110 km/h)
        if (spanLimit && spanLimit > 0) {
          limitToUse = spanLimit;
        } else if (fc === 1) {
          limitToUse = 90; // Autopistas / Corredores fallback (90 km/h)
        } else if (fc === 2) {
          limitToUse = 80; // Carreteras / Vías Interurbanas fallback
        } else if (fc === 3 || fc === 4) {
          limitToUse = 60; // Avenidas Urbanas Principales / Vías Colectoras fallback
        } else if (fc === 5) {
          limitToUse = 40; // Calles Residenciales / Urbanas comerciales fallback
        } else {
          limitToUse = fallbackThreshold;
          fcToUse = 3;
        }

        // Solo actualizar el último límite y FC válidos en ruta si no es el fallback genérico
        if (limitToUse !== fallbackThreshold) {
          lastValidOnRouteSpeedLimit = limitToUse;
          lastValidOnRouteFC = fcToUse;
        }
      }

      // Lógica de transición espacial: Ventana de gracia por desaceleración rápida (drop >= 20 km/h)
      if (lastSpeedLimit !== null && limitToUse <= lastSpeedLimit - 20) {
        decelerationGraceWindowEnd = log.timestamp.getTime() + 15000; // 15 segundos de suspensión
      }
      lastSpeedLimit = limitToUse;

      const inDecelWindow =
        log.timestamp.getTime() <= decelerationGraceWindowEnd;

      // Umbral de velocidad con margen de gracia de 10 km/h
      const threshold = limitToUse + 10;
      const isSpeeding = !inDecelWindow && log.speed > threshold;
      const multiplier = this.mapFCToMultiplier(fcToUse);

      resolvedLogs.push({
        timestamp: log.timestamp,
        speed: log.speed,
        speedLimit: limitToUse,
        functionalClass: fcToUse,
        isSpeeding,
        multiplier,
      });
    }

    return resolvedLogs;
  }

  /**
   * Evalúa la presencia de episodios de velocidad a partir de los logs ya resueltos,
   * aplicando el buffer de duración (mínimo 5s, clamped a 10s) y escalando por la severidad promedio de la FC.
   */
  private calculateWeightedOverspeed(resolvedLogs: ResolvedSpeedingLog[]): {
    overspeedCount: number;
    overspeedSeverity: number;
  } {
    let totalOverspeedCount = 0;
    let totalDurationSeconds = 0;

    let currentEpisodeStart: Date | null = null;
    let lastSpeedingTimestamp: Date | null = null;
    const COOLDOWN_MS = 30 * 1000; // Cooldown de 30 segundos
    let currentMultipliers: number[] = [];

    for (const log of resolvedLogs) {
      if (log.isSpeeding) {
        if (!currentEpisodeStart) {
          currentEpisodeStart = log.timestamp;
          currentMultipliers = [log.multiplier];
        } else {
          currentMultipliers.push(log.multiplier);
        }
        lastSpeedingTimestamp = log.timestamp;
      } else {
        if (currentEpisodeStart && lastSpeedingTimestamp) {
          const timeSinceLastSpeeding =
            log.timestamp.getTime() - lastSpeedingTimestamp.getTime();
          if (timeSinceLastSpeeding >= COOLDOWN_MS) {
            // Verificar duración mínima de 5 segundos antes de registrar la infracción
            const actualDuration =
              (lastSpeedingTimestamp.getTime() -
                currentEpisodeStart.getTime()) /
              1000;
            if (actualDuration >= 5) {
              const duration = Math.max(10, actualDuration);
              // Calcular el promedio de multiplicador para la duración del episodio
              const avgMultiplier =
                currentMultipliers.reduce((sum, val) => sum + val, 0) /
                currentMultipliers.length;
              totalDurationSeconds += duration * avgMultiplier;
              totalOverspeedCount++;
            }

            currentEpisodeStart = null;
            lastSpeedingTimestamp = null;
            currentMultipliers = [];
          }
        }
      }
    }

    if (currentEpisodeStart && lastSpeedingTimestamp) {
      const actualDuration =
        (lastSpeedingTimestamp.getTime() - currentEpisodeStart.getTime()) /
        1000;
      if (actualDuration >= 5) {
        const duration = Math.max(10, actualDuration);
        const avgMultiplier =
          currentMultipliers.reduce((sum, val) => sum + val, 0) /
          currentMultipliers.length;
        totalDurationSeconds += duration * avgMultiplier;
        totalOverspeedCount++;
      }
    }

    return {
      overspeedCount: totalOverspeedCount,
      overspeedSeverity: parseFloat(totalDurationSeconds.toFixed(3)),
    };
  }

  private findClosestGeometryIndex(
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

  private getSpeedLimitAndClassForGeometryIndex(
    geometryIndex: number,
    spans: RouteSpanWithSpeedLimit[],
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
}
