import { Injectable, Logger } from '@nestjs/common';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import { PrismaService } from 'src/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AwsRoutesClientService } from './aws-routes-client.service';
import { TelemetryRollupService } from './telemetry-rollup.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { TelemetryLog, VehicleCategory } from '@prisma/client';

@Injectable()
export class ScoringCronService {
  private readonly logger = new Logger(ScoringCronService.name);

  constructor(
    private prisma: PrismaService,
    private rulesEngine: RulesEngineService,
    private configService: ConfigService,
    private awsRoutesClient: AwsRoutesClientService,
    private telemetryRollupService: TelemetryRollupService,
    private weeklyScoringService: WeeklyScoringService,
  ) {}

  async runDailyRollup(targetDate?: string) {
    this.logger.log('Delegando runDailyRollup a TelemetryRollupService...');
    return this.telemetryRollupService.runDailyRollup(targetDate);
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
    let overspeedSeverity = 0;
    for (const log of logs) {
      if (log.speed > fallbackThreshold) {
        overspeedCount++;
        overspeedSeverity += log.speed - fallbackThreshold;
      }
    }
    return {
      overspeedCount,
      overspeedSeverity: parseFloat(overspeedSeverity.toFixed(3)),
    };
  }

  private async evaluateOverspeedingWithAwsRoutes(
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
      await this.awsRoutesClient.calculateRouteWithSpeedLimits(
        coordinates,
        travelMode as 'Car' | 'Truck',
      );

    if (!routeResult) {
      return this.fallbackOverspeeding(validLogs, fallbackOverspeedThreshold);
    }

    const { spans, geometry } = routeResult;
    let totalOverspeedCount = 0;
    let totalOverspeedSeverity = 0;

    for (const log of validLogs) {
      const { index: closestIdx, distanceKm: snapDist } =
        this.findClosestGeometryIndex(log.latitude, log.longitude, geometry);

      let limitToUse: number;

      if (snapDist > 0.02) {
        // 20m
        limitToUse = fallbackOverspeedThreshold;
      } else {
        const speedLimit = this.getSpeedLimitForGeometryIndex(
          closestIdx,
          spans,
        );
        limitToUse = speedLimit ?? fallbackOverspeedThreshold;
      }

      const threshold = limitToUse + 10;

      if (log.speed > threshold) {
        totalOverspeedCount++;
        totalOverspeedSeverity += log.speed - limitToUse;
      }
    }

    return {
      overspeedCount: totalOverspeedCount,
      overspeedSeverity: parseFloat(totalOverspeedSeverity.toFixed(3)),
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

  private getSpeedLimitForGeometryIndex(
    geometryIndex: number,
    spans: any[],
  ): number | null {
    if (spans.length === 0) return null;
    let matchedSpan = spans[0];
    for (const span of spans) {
      if (span.geometryOffset <= geometryIndex) {
        matchedSpan = span;
      } else {
        break;
      }
    }
    return matchedSpan.speedLimit;
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
