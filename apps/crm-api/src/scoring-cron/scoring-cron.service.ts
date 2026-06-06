import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RuleEngineConfig } from './scoring.interfaces';
import { PrismaService } from 'src/prisma.service';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScoringCronService {
  private readonly logger = new Logger(ScoringCronService.name);
  private readonly BATCH_SIZE = 50;
  private readonly MIN_KM_THRESHOLD = 5.0; // Ignorar tramos muy cortos
  private readonly DEFAULT_CONFIG: RuleEngineConfig = {
    engineVersion: '1.0',
    pillars: {
      SAFETY: { weight: 0.45, baseScore: 100 },
      EFFICIENCY: { weight: 0.3, baseScore: 100 },
      ASSET_CARE: { weight: 0.25, baseScore: 100 },
    },
    rules: [
      {
        code: 'OVERSPEEDING',
        pillar: 'SAFETY',
        deductionPer100Km: 12.0,
        maxDeduction: 50.0,
      },
      {
        code: 'EXCESSIVE_IDLING',
        pillar: 'EFFICIENCY',
        deductionPer100Km: 20.0,
        maxDeduction: 60.0,
      },
      {
        code: 'HIGH_RPM',
        pillar: 'ASSET_CARE',
        deductionPer100Km: 12.0,
        maxDeduction: 50.0,
      },
      {
        code: 'DEVICE_UNPLUGGED',
        pillar: 'ASSET_CARE',
        deductionPerEvent: 20.0,
        maxDeduction: 60.0,
      },
    ],
  };

  constructor(
    private prisma: PrismaService,
    private rulesEngine: RulesEngineService,
  ) {}

  // =====================================================================
  // 1. EL ROLLUP DIARIO (Extrae millones de filas y las convierte en 1 fila)
  // =====================================================================
  @Cron('0 2 * * *', {
    timeZone: 'America/Panama',
  }) // Todos los días a las 2:00 AM
  async runDailyRollup(targetDate?: string) {
    this.logger.log(
      'Iniciando Rollup Diario de Telemetría Orientado a Perfiles (Modo t3.small)...',
    );

    let dateStr: string;

    if (targetDate) {
      // Si el request envía una fecha manual, la usamos directamente
      dateStr = targetDate;
    } else {
      // Comportamiento del Cron Job: Calculamos el "ayer" real en Panamá (siempre UTC-5)
      const now = new Date();
      // Ajustamos el reloj de Node (UTC) a la hora real de Panamá (UTC-5)
      const panamaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      panamaTime.setUTCDate(panamaTime.getUTCDate() - 1);

      dateStr = panamaTime.toISOString().split('T')[0];
    }

    // --- 1. OBTENCIÓN DE PERFILES (Una sola vez) ---
    const profiles = await this.prisma.scoringProfile.findMany({
      select: { id: true, rulesEngine: true },
    });

    // Añadimos un perfil "fantasma" para no perder la data de los vehiculos sin perfil asignado
    profiles.push({
      id: 'DEFAULT_ORPHAN_PROFILE',
      rulesEngine: this.DEFAULT_CONFIG as unknown as Prisma.JsonValue,
    });

    this.logger.log('Paso 1: Purgando viajes fantasma del hardware...');
    await this.prisma.$executeRaw`
      DELETE FROM "Trip"
      WHERE "id" IN (
        SELECT "tripId"
        FROM "TelemetryLog"
        WHERE "tripId" IS NOT NULL
        GROUP BY "tripId"
        HAVING COUNT(*) < 3
      );
    `;

    // --- 2. BUCLE EXTERNO: ITERAMOS POR PERFIL ---
    for (const profile of profiles) {
      // Parseamos el JSON una sola vez por cada flota/perfil
      const config =
        (profile.rulesEngine as unknown as RuleEngineConfig) ||
        this.DEFAULT_CONFIG;

      const th = {
        overspeed:
          config.rules.find((r) => r.code === 'OVERSPEEDING')?.threshold || 110,
        braking:
          config.rules.find((r) => r.code === 'HARSH_BRAKING')?.threshold ||
          400,
        cornering:
          config.rules.find((r) => r.code === 'HARSH_CORNERING')?.threshold ||
          300,
        accel:
          config.rules.find((r) => r.code === 'HARSH_ACCELERATION')
            ?.threshold || 250,
        rpm: config.rules.find((r) => r.code === 'HIGH_RPM')?.threshold || 3500,
        maxRpm:
          config.rules.find((r) => r.code === 'HIGH_RPM')?.maxThreshold || 5000,
      };

      let cursor: string | undefined = undefined; // o 'number' si no has migrado a CUID/UUID
      let hasMore = true;

      // --- 3. BUCLE INTERNO: PAGINAMOS LOS VEHÍCULOS DE ESTE PERFIL ---
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

        // --- 4. EJECUCIÓN DEL SQL CRUDO ---
        this.logger.log(`Paso 2: Procesando telemetría para ${dateStr}...`);
        await this.prisma.$executeRaw`
          WITH TelemetryLag AS (
            SELECT
              t."vehicleId",
              a."driverId" AS driver_or_unassigned,
              t."speed", t."rpm", t."ignition", t."status",
              t."harshBraking", t."harshCornering", t."harshAcceleration", 
              t."harshBrakingDuration", t."harshCorneringDuration", t."harshAccelerationDuration",
              t."harshBrakingAverage", t."harshCorneringAverage", t."harshAccelerationAverage",
              t."coolantTemp", t."engineLoad", t."dtcCount",
              t."odometer", t."altitude", t."timestamp",
              t."unplugged",
              
              LAG(t."timestamp") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_time,
              LAG(t."odometer") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_odo,
              LAG(t."altitude") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_alt
            FROM "TelemetryLog" t
            
            LEFT JOIN "Assignment" a 
              ON t."vehicleId" = a."vehicleId"
              AND t."timestamp" >= a."from"
              AND (a."to" IS NULL OR t."timestamp" <= a."to")
              
            WHERE t."vehicleId" IN (${Prisma.join(vehicleIds.map((id) => Prisma.sql`${id}::uuid`))})
              AND t."timestamp" >= (${dateStr}::timestamp AT TIME ZONE 'America/Panama')
              AND t."timestamp" < (${dateStr}::timestamp AT TIME ZONE 'America/Panama' + INTERVAL '1 day')
          ),
          Deltas AS (
            SELECT
              "vehicleId",
              driver_or_unassigned,
              EXTRACT(EPOCH FROM ("timestamp" - prev_time)) AS time_diff_sec,
              ("odometer" - prev_odo) AS odo_diff,
              CASE 
                WHEN ("odometer" - prev_odo) >= 0.05 THEN 
                  (("altitude" - prev_alt) / (("odometer" - prev_odo) * 1000.0)) * 100.0
                ELSE 0
              END AS slope_pct,
              "speed", "rpm", "ignition", "status",
              "harshBraking", "harshCornering", "harshAcceleration", 
              "harshBrakingDuration", "harshCorneringDuration", "harshAccelerationDuration",
              "harshBrakingAverage", "harshCorneringAverage", "harshAccelerationAverage",
              "coolantTemp", "engineLoad", "dtcCount",
              "unplugged"
            FROM TelemetryLag 
            WHERE prev_time IS NOT NULL
          )
          INSERT INTO "DailyTelemetryRollup" (
            "id",
            "date",
            "vehicleId",
            "driverId",
            "totalKm",
            "totalEngineHours",
            "idlingHours", 
            "overspeedCount",
            "overspeedSeverity", 
            "brakingCount",
            "brakingSeverity",
            "corneringCount",
            "corneringSeverity",
            "accelerationCount",
            "accelerationSeverity",
            "highRpmCount",
            "highRpmSeverity",
            "coldEngineStrainCount",
            "coastingInNeutralCount", 
            "engineLuggingCount",
            "highLoadStrainCount",
            "criticalOverheatingCount",
            "activeFaultCodesCount",
            "deviceUnpluggedCount"
          )
          SELECT
            gen_random_uuid(),
            ${dateStr}::date,
            "vehicleId",
            driver_or_unassigned,
            
            -- TOTAL KM: Redondeado a 3 decimales (precisión de metros)
            ROUND(COALESCE(SUM(odo_diff) FILTER (WHERE odo_diff > 0 AND odo_diff < (time_diff_sec * 0.05)), 0)::numeric, 3),
            
            -- ENGINE HOURS: Redondeado a 3 decimales
            ROUND((COALESCE(SUM(
              CASE 
                WHEN time_diff_sec <= 3600 THEN time_diff_sec
                WHEN odo_diff > 0 AND odo_diff < (time_diff_sec * 0.05) THEN LEAST(odo_diff * 60.0, time_diff_sec)
                ELSE 0
              END
            ) FILTER (WHERE "status" != 'STOPPED'), 0) / 3600.0)::numeric, 3),
            
            -- IDLING HOURS: Redondeado a 3 decimales
            ROUND((COALESCE(SUM(
              CASE 
                WHEN time_diff_sec <= 3600 THEN time_diff_sec
                ELSE 0
              END
            ) FILTER (WHERE "status" = 'EXCESSIVE_IDLING'), 0) / 3600.0)::numeric, 3),
            
            -- SAFETY: Exceso de Velocidad
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > ${th.overspeed}),
            ROUND(COALESCE(SUM("speed" - ${th.overspeed}) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > ${th.overspeed}), 0)::numeric, 3),
            
            -- SAFETY: Frenazos
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshBraking" >= ${th.braking}),
            ROUND(COALESCE(SUM(("harshBraking"::numeric / ${th.braking}::numeric) * (COALESCE("harshBrakingAverage", "harshBraking")::numeric / ${th.braking}::numeric) * (COALESCE("harshBrakingDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshBraking" >= ${th.braking}), 0)::numeric, 3),
 
            -- SAFETY: Giros Bruscos
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshCornering" >= ${th.cornering}),
            ROUND(COALESCE(SUM(("harshCornering"::numeric / ${th.cornering}::numeric) * (COALESCE("harshCorneringAverage", "harshCornering")::numeric / ${th.cornering}::numeric) * (COALESCE("harshCorneringDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshCornering" >= ${th.cornering}), 0)::numeric, 3),
 
            -- EFFICIENCY: Aceleraciones Bruscas
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshAcceleration" >= ${th.accel}),
            ROUND(COALESCE(SUM(("harshAcceleration"::numeric / ${th.accel}::numeric) * (COALESCE("harshAccelerationAverage", "harshAcceleration")::numeric / ${th.accel}::numeric) * (COALESCE("harshAccelerationDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshAcceleration" >= ${th.accel}), 0)::numeric, 3),
 
            -- ASSET CARE: Métricas Físicas del Motor
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND (
              ("rpm" > ${th.rpm} AND COALESCE(slope_pct, 0) <= 6.0) OR 
              ("rpm" > ${th.maxRpm})
            )),
            ROUND(COALESCE(SUM(
              CASE 
                WHEN COALESCE(slope_pct, 0) <= 6.0 AND "rpm" > ${th.rpm} THEN "rpm" - ${th.rpm}
                WHEN COALESCE(slope_pct, 0) > 6.0 AND "rpm" > ${th.maxRpm} THEN "rpm" - ${th.maxRpm}
                ELSE 0
              END
            ) FILTER (WHERE "ignition" = true OR "rpm" > 400), 0)::numeric, 3),
 
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "coolantTemp" > 0 AND "coolantTemp" < 60 AND "rpm" > 2500),
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > 50 AND "rpm" <= 900),
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "engineLoad" > 90 AND "rpm" < 1200 AND "speed" > 15),
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "engineLoad" > 85),
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "coolantTemp" >= 105),
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "dtcCount" > 0),
            CASE WHEN COUNT(*) FILTER (WHERE "unplugged" = true) > 0 THEN 1 ELSE 0 END
          FROM Deltas
          GROUP BY "vehicleId", driver_or_unassigned
          ON CONFLICT ("date", "vehicleId", "driverId") DO UPDATE SET
            "totalKm" = EXCLUDED."totalKm",
            "totalEngineHours" = EXCLUDED."totalEngineHours",
            "idlingHours" = EXCLUDED."idlingHours",
            "overspeedCount" = EXCLUDED."overspeedCount",
            "overspeedSeverity" = EXCLUDED."overspeedSeverity",
            "brakingCount" = EXCLUDED."brakingCount",
            "brakingSeverity" = EXCLUDED."brakingSeverity",
            "corneringCount" = EXCLUDED."corneringCount",
            "corneringSeverity" = EXCLUDED."corneringSeverity",
            "accelerationCount" = EXCLUDED."accelerationCount",
            "accelerationSeverity" = EXCLUDED."accelerationSeverity",
            "highRpmCount" = EXCLUDED."highRpmCount",
            "highRpmSeverity" = EXCLUDED."highRpmSeverity",
            "coldEngineStrainCount" = EXCLUDED."coldEngineStrainCount",
            "coastingInNeutralCount" = EXCLUDED."coastingInNeutralCount",
            "engineLuggingCount" = EXCLUDED."engineLuggingCount",
            "highLoadStrainCount" = EXCLUDED."highLoadStrainCount",
            "criticalOverheatingCount" = EXCLUDED."criticalOverheatingCount",
            "activeFaultCodesCount" = EXCLUDED."activeFaultCodesCount",
            "deviceUnpluggedCount" = EXCLUDED."deviceUnpluggedCount";
        `;
      }
    }

    this.logger.log('✅ Rollup Diario finalizado.');
  }

  // =====================================================================
  // 2. EL CÁLCULO SEMANAL (Ultra ligero porque lee la tabla Rollup)
  // =====================================================================
  @Cron('0 3 * * 1', {
    timeZone: 'America/Panama',
  }) // Lunes a las 3:00 AM
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

    // CACHÉ EN MEMORIA: Evita hacer queries repetitivos para el mismo camión
    const vehicleConfigCache = new Map<string, RuleEngineConfig>();

    while (hasMore) {
      const drivers = await this.prisma.driver.findMany({
        take: this.BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined, // Ajustado a String/CUID
        select: { id: true },
      });

      if (drivers.length === 0) break;
      hasMore = drivers.length === this.BATCH_SIZE;
      cursor = drivers[drivers.length - 1].id;

      const driverIds = drivers.map((d) => d.id);

      // Prisma agrupa las filas del rollup diario por vehículo usado
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

          // LECTURA DESDE CACHÉ: Evitamos query N+1 al buscar reglas
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

        // Promedios finales exactos de la semana
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

        // Transacción segura: Snapshot y Acumulación
        await this.prisma.$transaction(async (tx) => {
          // 1. Guardar o actualizar el Snapshot semanal
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

          // 2. Fusión Matemática de Reputación Global
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
            const newTotalKm = currentStats.totalKm + safeTotalKm;

            // Helper para la fórmula de promedio ponderado
            const calcWeighted = (global: number, weekly: number) =>
              parseFloat(
                (
                  (global * currentStats.totalKm + weekly * safeTotalKm) /
                  newTotalKm
                ).toFixed(2),
              );

            await tx.driverGlobalStats.update({
              where: { driverId: d.id },
              data: {
                totalKm: parseFloat(newTotalKm.toFixed(2)),
                totalHours: parseFloat(
                  (currentStats.totalHours + safeTotalHours).toFixed(2),
                ),
                totalSnapshots: currentStats.totalSnapshots + 1,
                globalSafetyScore: calcWeighted(
                  currentStats.globalSafetyScore,
                  finalSafety,
                ),
                globalEcoScore: calcWeighted(
                  currentStats.globalEcoScore,
                  finalEco,
                ),
                globalAssetScore: calcWeighted(
                  currentStats.globalAssetScore,
                  finalAsset,
                ),
                globalOverallScore: calcWeighted(
                  currentStats.globalOverallScore,
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
    // 1. Obtenemos los perfiles (Igual que en el Rollup Diario)
    const profiles = await this.prisma.scoringProfile.findMany({
      select: { id: true, rulesEngine: true },
    });

    profiles.push({
      id: 'DEFAULT_ORPHAN_PROFILE',
      rulesEngine: this.DEFAULT_CONFIG as unknown as Prisma.JsonValue,
    });

    // 2. ITERAMOS POR PERFIL
    for (const profile of profiles) {
      // Parseamos el JSON del motor de reglas UNA SOLA VEZ por perfil
      const config =
        (profile.rulesEngine as unknown as RuleEngineConfig) ||
        this.DEFAULT_CONFIG;

      let cursor: string | undefined = undefined;
      let hasMore = true;

      // 3. PAGINAMOS LOS VEHÍCULOS DE ESTE PERFIL
      while (hasMore) {
        const whereCondition =
          profile.id === 'DEFAULT_ORPHAN_PROFILE'
            ? { scoringProfileId: null }
            : { scoringProfileId: profile.id };

        const vehicles = await this.prisma.vehicle.findMany({
          where: whereCondition,
          take: this.BATCH_SIZE,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined, // Ajustado a CUID/String
          select: { id: true },
        });

        if (vehicles.length === 0) break;
        hasMore = vehicles.length === this.BATCH_SIZE;
        cursor = vehicles[vehicles.length - 1].id;

        // Extraemos solo los IDs para el query masivo
        const vehicleIds = vehicles.map((v) => v.id);

        // 4. EL SUPER-QUERY: Sumamos la telemetría de TODOS los vehículos del lote de un solo golpe
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
            startTime: { gte: start, lte: end }, // Filtramos por la misma semana
          },
          _count: {
            id: true, // Solo contamos los IDs
          },
        });

        // Convertimos el resultado en un diccionario en memoria RAM (O(1) lookup)
        const summaryMap = new Map(
          weeklySummaries.map((s) => [s.vehicleId, s]),
        );

        const tripsMap = new Map(
          weeklyTripsCount.map(
            (t) => [t.vehicleId, t._count.id] as [string, number],
          ),
        );

        // 5. PROCESAMIENTO EN MEMORIA Y PERSISTENCIA
        for (const v of vehicles) {
          const summary = summaryMap.get(v.id);

          // Si no hay resumen, significa que el camión no generó telemetría esta semana
          if (!summary) continue;

          const totalKm = summary._sum.totalKm || 0;
          const idlingHours = summary._sum.idlingHours || 0;
          const realTotalTrips = tripsMap.get(v.id) || 0;

          // Si el vehículo no se movió ni estuvo encendido, lo saltamos
          if (totalKm < this.MIN_KM_THRESHOLD && idlingHours === 0) continue;

          // Evaluamos matemáticamente usando la configuración ya parseada
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

          // Persistencia Transaccional
          await this.prisma.$transaction(async (tx) => {
            // Guardamos el rendimiento específico de esta semana
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

            // Actualizamos las estadísticas globales de vida útil
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
              const newTotalKm = currentStats.totalKm + safeTotalKm;

              // Fusión Ponderada para diluir semanas buenas o malas en el historial largo
              const calcWeighted = (globalScore: number, weeklyScore: number) =>
                parseFloat(
                  (
                    (globalScore * currentStats.totalKm +
                      weeklyScore * safeTotalKm) /
                    newTotalKm
                  ).toFixed(2),
                );

              await tx.vehicleGlobalStats.update({
                where: { vehicleId: v.id },
                data: {
                  totalKm: parseFloat(newTotalKm.toFixed(2)),
                  totalEngineHours: parseFloat(
                    (currentStats.totalEngineHours + safeTotalHours).toFixed(2),
                  ),
                  globalMaintenanceScore: calcWeighted(
                    currentStats.globalMaintenanceScore,
                    metrics.assetScore,
                  ),
                  globalFuelEfficiency: calcWeighted(
                    currentStats.globalFuelEfficiency,
                    metrics.ecoScore,
                  ),
                  globalSafetyScore: calcWeighted(
                    currentStats.globalSafetyScore ?? 100,
                    metrics.safetyScore,
                  ),
                  globalOverallScore: calcWeighted(
                    currentStats.globalOverallScore ?? 100,
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
    // Clonamos la fecha usando métodos UTC para no depender de la zona horaria del servidor
    const date = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    // Forzamos el día a ser del 1 (Lunes) al 7 (Domingo)
    const dayNum = date.getUTCDay() || 7;
    // Ajustamos la fecha al jueves de esta semana (ISO 8601 basa la semana en el jueves)
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    // Calculamos el inicio del año actual de ese jueves
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    // Calculamos la diferencia en días y la dividimos por 7
    return Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
  }
}
