import { Injectable, Logger } from '@nestjs/common';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import { PrismaService } from 'src/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HereRoutesClientService } from './here-routes-client.service';
import { TelemetryRollupService } from './telemetry-rollup.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { TelemetryLog, VehicleCategory } from '@prisma/client';
import { RouteSpanWithSpeedLimit } from './route-utils';

@Injectable()
export class ScoringCronService {
  private readonly logger = new Logger(ScoringCronService.name);

  constructor(
    private prisma: PrismaService,
    private rulesEngine: RulesEngineService,
    private configService: ConfigService,
    private hereRoutesClient: HereRoutesClientService,
    private telemetryRollupService: TelemetryRollupService,
    private weeklyScoringService: WeeklyScoringService,
  ) {}

  async runDailyRollup(targetDate?: string) {
    this.logger.log('Delegando runDailyRollup a TelemetryRollupService...');
    await this.telemetryRollupService.runDailyRollup(targetDate);

    let dateStr: string;
    if (targetDate) {
      dateStr = targetDate;
    } else {
      const now = new Date();
      const panamaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      panamaTime.setUTCDate(panamaTime.getUTCDate() - 1);
      dateStr = panamaTime.toISOString().split('T')[0];
    }

    const apiKey = this.configService.get<string>('HERE_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'HERE_API_KEY no configurada. Se realizará el post-procesamiento de límites de velocidad utilizando los límites fallback.',
      );
    } else {
      this.logger.log(
        `Iniciando post-procesamiento de límites de velocidad HERE para la fecha: ${dateStr}`,
      );
      // Reiniciar la suspensión del cliente de HERE antes de empezar
      this.hereRoutesClient.resetSuspension();
    }

    // Obtener rollups del día para viajes con conductor
    const rollups = await this.prisma.dailyTelemetryRollup.findMany({
      where: {
        date: new Date(dateStr),
        tripId: { not: null },
        driverId: { not: null },
      },
      select: {
        id: true,
        tripId: true,
        driverId: true,
        vehicleId: true,
      },
    });

    if (rollups.length === 0) {
      this.logger.log(
        'No se encontraron viajes con conductor asignado para post-procesar.',
      );
      return;
    }

    this.logger.log(
      `Procesando límites de velocidad reales para ${rollups.length} viajes...`,
    );

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        id: { in: rollups.map((r) => r.vehicleId) },
      },
      select: {
        id: true,
        category: true,
        scoringProfileId: true,
      },
    });

    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const profiles = await this.prisma.scoringProfile.findMany({
      select: { id: true, rulesEngine: true },
    });
    const profileMap = new Map(
      profiles.map((p) => [
        p.id,
        (p.rulesEngine as any)?.rules?.find(
          (r: any) => r.code === 'OVERSPEEDING',
        )?.threshold ?? 110,
      ]),
    );

    for (const rollup of rollups) {
      const vehicle = vehicleMap.get(rollup.vehicleId);
      const category = vehicle?.category ?? VehicleCategory.PASSENGER;
      const profileId = vehicle?.scoringProfileId;
      const fallbackThreshold = profileId
        ? (profileMap.get(profileId) ?? 110)
        : 110;

      const logs = await this.prisma.telemetryLog.findMany({
        where: { tripId: rollup.tripId! },
        orderBy: { timestamp: 'asc' },
      });

      if (logs.length < 2) {
        continue;
      }

      const result = apiKey
        ? await this.evaluateOverspeedingWithHereRoutes(
            logs,
            fallbackThreshold,
            category,
          )
        : this.fallbackOverspeeding(logs, fallbackThreshold);

      await this.prisma.dailyTelemetryRollup.update({
        where: { id: rollup.id },
        data: {
          overspeedCount: result.overspeedCount,
          overspeedSeverity: result.overspeedSeverity,
        },
      });
    }

    this.logger.log(
      '✅ Post-procesamiento de límites de velocidad HERE finalizado.',
    );
  }

  async runWeeklyScoring() {
    this.logger.log('Delegando runWeeklyScoring a WeeklyScoringService...');
    return this.weeklyScoringService.runWeeklyScoring();
  }

  // Métodos para retrocompatibilidad con tests unitarios y llamadas internas
  private getISOWeekNumber(d: Date): number {
    const date = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
  }

  private fallbackOverspeeding(
    logs: TelemetryLog[],
    fallbackThreshold: number,
  ): { overspeedCount: number; overspeedSeverity: number } {
    let overspeedCount = 0;
    let totalDurationSeconds = 0;

    let currentEpisodeStart: Date | null = null;
    let lastSpeedingTimestamp: Date | null = null;
    const COOLDOWN_MS = 30 * 1000; // Cooldown de 30 segundos

    for (const log of logs) {
      // Umbral con margen de gracia de 12 km/h para Panamá
      const isSpeeding = log.speed > fallbackThreshold + 12;

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

  private async evaluateOverspeedingWithHereRoutes(
    logs: TelemetryLog[],
    fallbackOverspeedThreshold: number,
    category: VehicleCategory,
  ): Promise<{ overspeedCount: number; overspeedSeverity: number }> {
    const validLogs = logs.filter(
      (log) => log.latitude !== 0 && log.longitude !== 0,
    );
    if (validLogs.length < 2) {
      return { overspeedCount: 0, overspeedSeverity: 0 };
    }

    if (!validLogs.some((log) => log.speed > 10)) {
      return { overspeedCount: 0, overspeedSeverity: 0 };
    }

    const startLog = validLogs[0];
    const endLog = validLogs[validLogs.length - 1];
    const distanceKm = this.getDistance(
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
    }));

    const routeResult =
      await this.hereRoutesClient.calculateRouteWithSpeedLimits(
        coordinates,
        travelMode as 'Car' | 'Truck',
      );

    if (!routeResult) {
      return this.fallbackOverspeeding(validLogs, fallbackOverspeedThreshold);
    }

    const { spans, geometry } = routeResult;
    let totalOverspeedCount = 0;
    let totalDurationSeconds = 0;

    let currentEpisodeStart: Date | null = null;
    let lastSpeedingTimestamp: Date | null = null;
    const COOLDOWN_MS = 30 * 1000; // Cooldown de 30 segundos

    let lastSpeedLimit: number | null = null;
    let decelerationGraceWindowEnd = 0; // Marca de tiempo en ms

    for (const log of validLogs) {
      const { index: closestIdx, distanceKm: snapDist } =
        this.findClosestGeometryIndex(log.latitude, log.longitude, geometry);

      let limitToUse: number;

      if (snapDist > 0.05) {
        // Fuera de ruta (> 50m), usar límite fallback general
        limitToUse = fallbackOverspeedThreshold;
      } else {
        const { speedLimit, functionalClass: fc } =
          this.getSpeedLimitAndClassForGeometryIndex(closestIdx, spans);

        if (speedLimit !== null) {
          // Mantener el límite legal real del mapa (no elevar ni truncar hacia arriba)
          limitToUse = speedLimit;
        } else {
          // Smart Fallback Ingestion: Asignar base conservadora basada en Reglamento de Tránsito de Panamá
          if (fc === 1) {
            limitToUse = 90; // Autopistas / Corredores
          } else if (fc === 2) {
            limitToUse = 60; // Avenidas Urbanas Principales
          } else if (fc === 3) {
            limitToUse = 50; // Arterias Secundarias / Conectores
          } else if (fc === 4 || fc === 5) {
            limitToUse = 40; // Calles Locales / Residenciales / Industriales
          } else {
            limitToUse = fallbackOverspeedThreshold;
          }
        }
      }

      // Lógica de transición espacial: Ventana de gracia por desaceleración rápida (drop >= 20 km/h)
      if (lastSpeedLimit !== null && limitToUse <= lastSpeedLimit - 20) {
        decelerationGraceWindowEnd = log.timestamp.getTime() + 15000; // 15 segundos de suspensión
      }
      lastSpeedLimit = limitToUse;

      const inDecelWindow =
        log.timestamp.getTime() <= decelerationGraceWindowEnd;

      // Umbral de velocidad con margen de gracia de 12 km/h
      const threshold = limitToUse + 12;
      const isSpeeding = !inDecelWindow && log.speed > threshold;

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
              totalOverspeedCount++;
            }

            currentEpisodeStart = null;
            lastSpeedingTimestamp = null;
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
        totalDurationSeconds += duration;
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
      const dist = this.getDistance(lat, lng, gLat, gLng);
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

  private getDistance(
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

  // Métodos expuestos para spyOn en tests unitarios
  private async processWeeklyDrivers(
    start: Date,
    end: Date,
    weekNum: number,
    year: number,
  ) {
    return (this.weeklyScoringService as any).processWeeklyDrivers(
      start,
      end,
      weekNum,
      year,
    );
  }

  private async processWeeklyVehicles(
    start: Date,
    end: Date,
    weekNum: number,
    year: number,
  ) {
    return (this.weeklyScoringService as any).processWeeklyVehicles(
      start,
      end,
      weekNum,
      year,
    );
  }
}
