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

          const currentStats = await tx.driverGlobalStats.findUnique({
            where: { driverId: d.id },
          });

          if (!currentStats) {
            await tx.driverGlobalStats.create({
              data: {
                driverId: d.id,
                totalKm: safeTotalKm,
                totalHours: safeTotalHours,
                totalSnapshots: 1,
                globalSafetyScore: finalSafety,
                globalEcoScore: finalEco,
                globalAssetScore: finalAsset,
                globalOverallScore: finalOverall,
              },
            });
          } else {
            const oldKm = existingSnapshot ? existingSnapshot.totalKm : 0;
            const oldHours = existingSnapshot ? existingSnapshot.totalHours : 0;
            const oldSafety = existingSnapshot
              ? existingSnapshot.safetyScore
              : 0;
            const oldEco = existingSnapshot ? existingSnapshot.ecoScore : 0;
            const oldAsset = existingSnapshot ? existingSnapshot.assetScore : 0;
            const oldOverall = existingSnapshot
              ? existingSnapshot.overallScore
              : 0;

            const snapshotDelta = existingSnapshot ? 0 : 1;

            const newTotalKm = currentStats.totalKm - oldKm + safeTotalKm;
            const newTotalHours =
              currentStats.totalHours - oldHours + safeTotalHours;

            const calcWeighted = (
              global: number,
              oldVal: number,
              newVal: number,
            ) => {
              if (newTotalKm <= 0) return 100.0;
              return parseFloat(
                (
                  (global * currentStats.totalKm -
                    oldVal * oldKm +
                    newVal * safeTotalKm) /
                  newTotalKm
                ).toFixed(2),
              );
            };

            await tx.driverGlobalStats.update({
              where: { driverId: d.id },
              data: {
                totalKm: parseFloat(newTotalKm.toFixed(2)),
                totalHours: parseFloat(newTotalHours.toFixed(2)),
                totalSnapshots: currentStats.totalSnapshots + snapshotDelta,
                globalSafetyScore: calcWeighted(
                  currentStats.globalSafetyScore,
                  oldSafety,
                  finalSafety,
                ),
                globalEcoScore: calcWeighted(
                  currentStats.globalEcoScore,
                  oldEco,
                  finalEco,
                ),
                globalAssetScore: calcWeighted(
                  currentStats.globalAssetScore,
                  oldAsset,
                  finalAsset,
                ),
                globalOverallScore: calcWeighted(
                  currentStats.globalOverallScore,
                  oldOverall,
                  finalOverall,
                ),
              },
            });
          }
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

            const currentStats = await tx.vehicleGlobalStats.findUnique({
              where: { vehicleId: v.id },
            });

            if (!currentStats) {
              await tx.vehicleGlobalStats.create({
                data: {
                  vehicleId: v.id,
                  totalKm: safeTotalKm,
                  totalEngineHours: safeTotalHours,
                  globalMaintenanceScore: metrics.assetScore,
                  globalFuelEfficiency: metrics.ecoScore,
                  globalSafetyScore: metrics.safetyScore,
                  globalOverallScore: metrics.overallScore,
                },
              });
            } else {
              const oldBreakdown = existingSnapshot?.breakdown as any;
              const oldHours = oldBreakdown?.scores?.totalHours || 0;
              const oldKm = existingSnapshot ? existingSnapshot.totalKm : 0;
              const oldMaintenance = existingSnapshot
                ? existingSnapshot.maintenanceScore
                : 0;
              const oldFuel = existingSnapshot
                ? existingSnapshot.fuelEfficiency
                : 0;
              const oldSafety = existingSnapshot
                ? existingSnapshot.safetyScore
                : 0;
              const oldOverall = oldBreakdown?.scores?.overallScore || 0;

              const newTotalKm = currentStats.totalKm - oldKm + safeTotalKm;
              const newTotalHours =
                currentStats.totalEngineHours - oldHours + safeTotalHours;

              const calcWeighted = (
                globalScore: number,
                oldVal: number,
                newVal: number,
              ) => {
                if (newTotalKm <= 0) return 100.0;
                return parseFloat(
                  (
                    (globalScore * currentStats.totalKm -
                      oldVal * oldKm +
                      newVal * safeTotalKm) /
                    newTotalKm
                  ).toFixed(2),
                );
              };

              await tx.vehicleGlobalStats.update({
                where: { vehicleId: v.id },
                data: {
                  totalKm: parseFloat(newTotalKm.toFixed(2)),
                  totalEngineHours: parseFloat(newTotalHours.toFixed(2)),
                  globalMaintenanceScore: calcWeighted(
                    currentStats.globalMaintenanceScore,
                    oldMaintenance,
                    metrics.assetScore,
                  ),
                  globalFuelEfficiency: calcWeighted(
                    currentStats.globalFuelEfficiency,
                    oldFuel,
                    metrics.ecoScore,
                  ),
                  globalSafetyScore: calcWeighted(
                    currentStats.globalSafetyScore ?? 100,
                    oldSafety,
                    metrics.safetyScore,
                  ),
                  globalOverallScore: calcWeighted(
                    currentStats.globalOverallScore ?? 100,
                    oldOverall,
                    metrics.overallScore,
                  ),
                },
              });
            }
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
