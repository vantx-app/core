import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import {
  RuleEngineConfig,
  DEFAULT_RULE_ENGINE_CONFIG,
} from './scoring.interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class WeeklyScoringService {
  private readonly logger = new Logger(WeeklyScoringService.name);
  private readonly BATCH_SIZE = 50;
  private readonly MIN_KM_THRESHOLD = 5.0; // Ignorar tramos muy cortos

  private readonly DEFAULT_CONFIG: RuleEngineConfig =
    DEFAULT_RULE_ENGINE_CONFIG;

  constructor(
    private prisma: PrismaService,
    private rulesEngine: RulesEngineService,
  ) {}

  async runWeeklyScoring() {
    this.logger.log('Iniciando Scoring Semanal a partir de Rollups...');

    // Obtener la fecha actual ajustada a Panamá (UTC-5)
    const now = new Date();
    const panamaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    // Dado que el cron se ejecuta los lunes a las 3:00 AM, hoy es lunes en Panamá.
    // El lunes de la semana pasada es hace exactamente 7 días.
    const prevMonday = new Date(panamaTime.getTime());
    prevMonday.setUTCDate(panamaTime.getUTCDate() - 7);
    const startOfWeekStr = prevMonday.toISOString().split('T')[0];

    // El domingo de la semana pasada (ayer) es hace exactamente 1 día.
    const prevSunday = new Date(panamaTime.getTime());
    prevSunday.setUTCDate(panamaTime.getUTCDate() - 1);
    const endOfWeekStr = prevSunday.toISOString().split('T')[0];

    // Convertir a objetos Date en UTC a las 00:00:00 para la consulta de Prisma
    const startOfWeek = new Date(`${startOfWeekStr}T00:00:00.000Z`);
    const endOfWeek = new Date(`${endOfWeekStr}T00:00:00.000Z`);

    const year = prevMonday.getUTCFullYear();
    const weekNumber = this.getISOWeekNumber(prevMonday);

    await this.processWeeklyDrivers(startOfWeek, endOfWeek, weekNumber, year);
    await this.processWeeklyVehicles(startOfWeek, endOfWeek, weekNumber, year);

    this.logger.log('Scoring Semanal finalizado.');
  }

  private async processWeeklyDrivers(
    start: Date,
    end: Date,
    weekNum: number,
    year: number,
  ) {
    let cursor: string | undefined = undefined;
    let hasMore = true;

    // CACHÉ EN MEMORIA: Evita hacer queries repetitivos para el mismo vehículo
    const vehicleConfigCache = new Map<string, RuleEngineConfig>();

    while (hasMore) {
      const drivers = await this.prisma.driver.findMany({
        take: this.BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        select: { id: true },
      });

      if (drivers.length === 0) break;
      hasMore = drivers.length === this.BATCH_SIZE;
      cursor = drivers[drivers.length - 1].id;

      const driverIds = drivers.map((d) => d.id);

      const allWeeklySummaries = await this.prisma.dailyTelemetryRollup.groupBy(
        {
          by: ['driverId', 'vehicleId'],
          where: {
            driverId: { in: driverIds },
            date: { gte: start, lte: end },
          },
          _sum: {
            totalKm: true,
            totalEngineHours: true,
            idlingHours: true,
            overspeedCount: true,
            overspeedSeverity: true,
            brakingCount: true,
            brakingSeverity: true,
            corneringCount: true,
            corneringSeverity: true,
            accelerationCount: true,
            accelerationSeverity: true,
            highRpmCount: true,
            highRpmSeverity: true,
            coldEngineStrainCount: true,
            coastingInNeutralCount: true,
            engineLuggingCount: true,
            highLoadStrainCount: true,
            criticalOverheatingCount: true,
            activeFaultCodesCount: true,
            deviceUnpluggedCount: true,
          },
        },
      );

      const driverSummariesMap = new Map<string, typeof allWeeklySummaries>();
      for (const summary of allWeeklySummaries) {
        if (!summary.driverId) continue;
        if (!driverSummariesMap.has(summary.driverId)) {
          driverSummariesMap.set(summary.driverId, []);
        }
        driverSummariesMap.get(summary.driverId)!.push(summary);
      }

      for (const d of drivers) {
        const weeklySummaries = driverSummariesMap.get(d.id);
        if (!weeklySummaries || weeklySummaries.length === 0) continue;

        let totalDriverKm = 0;
        let totalDriverHours = 0;
        let totalIdlingHours = 0;
        let weightedSafety = 0;
        let weightedEco = 0;
        let weightedAsset = 0;
        let weightedOverall = 0;

        const vehiclesBreakdown: any[] = [];

        for (const summary of weeklySummaries) {
          const vId = summary.vehicleId;

          if (!vehicleConfigCache.has(vId)) {
            const vConfig = await this.prisma.vehicle.findUnique({
              where: { id: vId },
              select: { scoringProfile: { select: { rulesEngine: true } } },
            });
            const config =
              (vConfig?.scoringProfile
                ?.rulesEngine as unknown as RuleEngineConfig) ||
              this.DEFAULT_CONFIG;
            vehicleConfigCache.set(vId, config);
          }

          const configToUse = vehicleConfigCache.get(vId)!;
          const details = this.rulesEngine.evaluateAggregatedRollupWithDetails(
            summary,
            configToUse,
          );
          const metrics = details.scores;

          totalDriverKm += metrics.totalKm;
          totalDriverHours += metrics.totalHours;
          totalIdlingHours += metrics.idlingHours || 0;
          weightedSafety += metrics.safetyScore * metrics.totalKm;
          weightedEco += metrics.ecoScore * metrics.totalKm;
          weightedAsset += metrics.assetScore * metrics.totalKm;
          weightedOverall += metrics.overallScore * metrics.totalKm;

          const vehicleInfo = await this.prisma.vehicle.findUnique({
            where: { id: vId },
            select: { alias: true, plateNumber: true },
          });

          vehiclesBreakdown.push({
            vehicleId: vId,
            vehicleAlias: vehicleInfo?.alias || null,
            vehiclePlate: vehicleInfo?.plateNumber || null,
            totalKm: parseFloat(details.scores.totalKm.toFixed(2)),
            totalHours: parseFloat(details.scores.totalHours.toFixed(2)),
            idlingHours: parseFloat(details.scores.idlingHours.toFixed(2)),
            scores: details.scores,
            ruleDeductions: details.ruleDeductions,
            pillarDeductions: details.pillarDeductions,
          });
        }

        if (totalDriverKm < this.MIN_KM_THRESHOLD) continue;

        const finalSafety = parseFloat(
          (weightedSafety / totalDriverKm).toFixed(2),
        );
        const finalEco = parseFloat((weightedEco / totalDriverKm).toFixed(2));
        const finalAsset = parseFloat(
          (weightedAsset / totalDriverKm).toFixed(2),
        );
        const finalOverall = parseFloat(
          (weightedOverall / totalDriverKm).toFixed(2),
        );
        const safeTotalKm = parseFloat(totalDriverKm.toFixed(2));
        const safeTotalHours = parseFloat(totalDriverHours.toFixed(2));

        const driverWeeklyBreakdownJson = {
          overallScore: finalOverall,
          safetyScore: finalSafety,
          ecoScore: finalEco,
          assetScore: finalAsset,
          totalKm: parseFloat(totalDriverKm.toFixed(2)),
          totalHours: parseFloat(totalDriverHours.toFixed(2)),
          idlingHours: parseFloat(totalIdlingHours.toFixed(2)),
          vehicles: vehiclesBreakdown,
        };

        await this.prisma.$transaction(async (tx) => {
          const existingSnapshot = await tx.driverScoreSnapshot.findUnique({
            where: {
              driverId_weekNumber_year: {
                driverId: d.id,
                weekNumber: weekNum,
                year,
              },
            },
          });

          await tx.driverScoreSnapshot.upsert({
            where: {
              driverId_weekNumber_year: {
                driverId: d.id,
                weekNumber: weekNum,
                year,
              },
            },
            update: {
              safetyScore: finalSafety,
              ecoScore: finalEco,
              assetScore: finalAsset,
              overallScore: finalOverall,
              totalKm: safeTotalKm,
              totalHours: safeTotalHours,
              breakdown: driverWeeklyBreakdownJson as any,
            },
            create: {
              driverId: d.id,
              weekNumber: weekNum,
              year,
              safetyScore: finalSafety,
              ecoScore: finalEco,
              assetScore: finalAsset,
              overallScore: finalOverall,
              totalKm: safeTotalKm,
              totalHours: safeTotalHours,
              breakdown: driverWeeklyBreakdownJson as any,
            },
          });

          // Obtener todos los snapshots del conductor para calcular los puntajes ponderados exactos
          const snapshots = await tx.driverScoreSnapshot.findMany({
            where: { driverId: d.id },
          });

          let totalSnapshotKm = 0;
          let weightedSafetySum = 0;
          let weightedEcoSum = 0;
          let weightedAssetSum = 0;
          let weightedOverallSum = 0;

          for (const snap of snapshots) {
            totalSnapshotKm += snap.totalKm;
            weightedSafetySum += snap.safetyScore * snap.totalKm;
            weightedEcoSum += snap.ecoScore * snap.totalKm;
            weightedAssetSum += snap.assetScore * snap.totalKm;
            weightedOverallSum += snap.overallScore * snap.totalKm;
          }

          const globalSafetyScore =
            totalSnapshotKm > 0
              ? parseFloat((weightedSafetySum / totalSnapshotKm).toFixed(2))
              : 100;
          const globalEcoScore =
            totalSnapshotKm > 0
              ? parseFloat((weightedEcoSum / totalSnapshotKm).toFixed(2))
              : 100;
          const globalAssetScore =
            totalSnapshotKm > 0
              ? parseFloat((weightedAssetSum / totalSnapshotKm).toFixed(2))
              : 100;
          const globalOverallScore =
            totalSnapshotKm > 0
              ? parseFloat((weightedOverallSum / totalSnapshotKm).toFixed(2))
              : 100;
          const totalSnapshots = snapshots.length;

          // Obtener totalKm y totalHours de todos los rollups diarios para este conductor
          const rollupAgg = await tx.dailyTelemetryRollup.aggregate({
            where: { driverId: d.id },
            _sum: {
              totalKm: true,
              totalEngineHours: true,
            },
          });

          const totalKm = parseFloat((rollupAgg._sum.totalKm ?? 0).toFixed(2));
          const totalHours = parseFloat(
            (rollupAgg._sum.totalEngineHours ?? 0).toFixed(2),
          );

          await tx.driverGlobalStats.upsert({
            where: { driverId: d.id },
            update: {
              totalKm,
              totalHours,
              totalSnapshots,
              globalSafetyScore,
              globalEcoScore,
              globalAssetScore,
              globalOverallScore,
            },
            create: {
              driverId: d.id,
              totalKm,
              totalHours,
              totalSnapshots,
              globalSafetyScore,
              globalEcoScore,
              globalAssetScore,
              globalOverallScore,
            },
          });
        });
      }
    }
  }

  private async processWeeklyVehicles(
    start: Date,
    end: Date,
    weekNumber: number,
    year: number,
  ) {
    const profiles = await this.prisma.scoringProfile.findMany({
      select: { id: true, rulesEngine: true },
    });

    profiles.push({
      id: 'DEFAULT_ORPHAN_PROFILE',
      rulesEngine: this.DEFAULT_CONFIG as unknown as Prisma.JsonValue,
    });

    for (const profile of profiles) {
      const config =
        (profile.rulesEngine as unknown as RuleEngineConfig) ||
        this.DEFAULT_CONFIG;

      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const whereCondition =
          profile.id === 'DEFAULT_ORPHAN_PROFILE'
            ? { scoringProfileId: null }
            : { scoringProfileId: profile.id };

        const vehicles = await this.prisma.vehicle.findMany({
          where: whereCondition,
          take: this.BATCH_SIZE,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          select: { id: true },
        });

        if (vehicles.length === 0) break;
        hasMore = vehicles.length === this.BATCH_SIZE;
        cursor = vehicles[vehicles.length - 1].id;

        const vehicleIds = vehicles.map((v) => v.id);

        const weeklySummaries = await this.prisma.dailyTelemetryRollup.groupBy({
          by: ['vehicleId'],
          where: {
            vehicleId: { in: vehicleIds },
            date: { gte: start, lte: end },
          },
          _sum: {
            totalKm: true,
            totalEngineHours: true,
            idlingHours: true,
            overspeedCount: true,
            overspeedSeverity: true,
            brakingCount: true,
            brakingSeverity: true,
            corneringCount: true,
            corneringSeverity: true,
            accelerationCount: true,
            accelerationSeverity: true,
            highRpmCount: true,
            highRpmSeverity: true,
            coldEngineStrainCount: true,
            coastingInNeutralCount: true,
            engineLuggingCount: true,
            highLoadStrainCount: true,
            criticalOverheatingCount: true,
            activeFaultCodesCount: true,
            deviceUnpluggedCount: true,
          },
        });

        const weeklyTripsCount = await this.prisma.trip.groupBy({
          by: ['vehicleId'],
          where: {
            vehicleId: { in: vehicleIds },
            startTime: { gte: start, lte: end },
          },
          _count: {
            id: true,
          },
        });

        const summaryMap = new Map(
          weeklySummaries.map((s) => [s.vehicleId, s]),
        );

        const tripsMap = new Map(
          weeklyTripsCount.map(
            (t) => [t.vehicleId, t._count.id] as [string, number],
          ),
        );

        for (const v of vehicles) {
          const summary = summaryMap.get(v.id);

          if (!summary) continue;

          const totalKm = summary._sum.totalKm || 0;
          const idlingHours = summary._sum.idlingHours || 0;
          const realTotalTrips = tripsMap.get(v.id) || 0;

          if (totalKm < this.MIN_KM_THRESHOLD && idlingHours === 0) continue;

          const details = this.rulesEngine.evaluateAggregatedRollupWithDetails(
            summary,
            config,
          );
          const metrics = details.scores;
          const safeTotalKm = parseFloat(metrics.totalKm.toFixed(2));
          const safeTotalHours = parseFloat(metrics.totalHours.toFixed(2));

          const vehicleWeeklyBreakdownJson = {
            scores: metrics,
            ruleDeductions: details.ruleDeductions,
            pillarDeductions: details.pillarDeductions,
          };

          await this.prisma.$transaction(async (tx) => {
            const existingSnapshot = await tx.vehicleScoreSnapshot.findUnique({
              where: {
                vehicleId_weekNumber_year: {
                  vehicleId: v.id,
                  weekNumber,
                  year,
                },
              },
            });

            await tx.vehicleScoreSnapshot.upsert({
              where: {
                vehicleId_weekNumber_year: {
                  vehicleId: v.id,
                  weekNumber,
                  year,
                },
              },
              update: {
                maintenanceScore: metrics.assetScore,
                fuelEfficiency: metrics.ecoScore,
                safetyScore: metrics.safetyScore,
                totalKm: safeTotalKm,
                idlingHours: metrics.idlingHours,
                totalTrips: realTotalTrips,
                breakdown: vehicleWeeklyBreakdownJson as any,
              },
              create: {
                vehicleId: v.id,
                weekNumber,
                year,
                maintenanceScore: metrics.assetScore,
                fuelEfficiency: metrics.ecoScore,
                safetyScore: metrics.safetyScore,
                totalKm: safeTotalKm,
                idlingHours: metrics.idlingHours,
                totalTrips: realTotalTrips,
                breakdown: vehicleWeeklyBreakdownJson as any,
              },
            });

            // Obtener todos los snapshots del vehículo para calcular los puntajes ponderados exactos
            const snapshots = await tx.vehicleScoreSnapshot.findMany({
              where: { vehicleId: v.id },
            });

            let totalSnapshotKm = 0;
            let weightedMaintenanceSum = 0;
            let weightedFuelSum = 0;
            let weightedSafetySum = 0;
            let weightedOverallSum = 0;

            for (const snap of snapshots) {
              const snapBreakdown = snap.breakdown as any;
              const snapOverall = snapBreakdown?.scores?.overallScore ?? 100;
              totalSnapshotKm += snap.totalKm;
              weightedMaintenanceSum += snap.maintenanceScore * snap.totalKm;
              weightedFuelSum += snap.fuelEfficiency * snap.totalKm;
              weightedSafetySum += snap.safetyScore * snap.totalKm;
              weightedOverallSum += snapOverall * snap.totalKm;
            }

            const globalMaintenanceScore =
              totalSnapshotKm > 0
                ? parseFloat(
                    (weightedMaintenanceSum / totalSnapshotKm).toFixed(2),
                  )
                : 100;
            const globalFuelEfficiency =
              totalSnapshotKm > 0
                ? parseFloat((weightedFuelSum / totalSnapshotKm).toFixed(2))
                : 100;
            const globalSafetyScore =
              totalSnapshotKm > 0
                ? parseFloat((weightedSafetySum / totalSnapshotKm).toFixed(2))
                : 100;
            const globalOverallScore =
              totalSnapshotKm > 0
                ? parseFloat((weightedOverallSum / totalSnapshotKm).toFixed(2))
                : 100;

            // Obtener totalKm y totalEngineHours de todos los rollups diarios para este vehículo
            const rollupAgg = await tx.dailyTelemetryRollup.aggregate({
              where: { vehicleId: v.id },
              _sum: {
                totalKm: true,
                totalEngineHours: true,
              },
            });

            const totalKm = parseFloat(
              (rollupAgg._sum.totalKm ?? 0).toFixed(2),
            );
            const totalEngineHours = parseFloat(
              (rollupAgg._sum.totalEngineHours ?? 0).toFixed(2),
            );

            await tx.vehicleGlobalStats.upsert({
              where: { vehicleId: v.id },
              update: {
                totalKm,
                totalEngineHours,
                globalMaintenanceScore,
                globalFuelEfficiency,
                globalSafetyScore,
                globalOverallScore,
              },
              create: {
                vehicleId: v.id,
                totalKm,
                totalEngineHours,
                globalMaintenanceScore,
                globalFuelEfficiency,
                globalSafetyScore,
                globalOverallScore,
              },
            });
          });
        }
      }
    }
  }

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
}
