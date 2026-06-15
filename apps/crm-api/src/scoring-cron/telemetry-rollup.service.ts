import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  VehicleCategory,
  VehicleCategory as PrismaVehicleCategory,
} from '@prisma/client';
import { RuleEngineConfig } from './scoring.interfaces';

@Injectable()
export class TelemetryRollupService {
  private readonly logger = new Logger(TelemetryRollupService.name);
  private readonly BATCH_SIZE = 50;

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
        deductionPer100Km: 5.0,
        maxDeduction: 20.0,
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

  constructor(private prisma: PrismaService) {}

  async runDailyRollup(targetDate?: string) {
    this.logger.log(
      'Iniciando Rollup Diario de Telemetría Orientado a Viajes...',
    );

    let dateStr: string;

    if (targetDate) {
      dateStr = targetDate;
    } else {
      const now = new Date();
      const panamaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      panamaTime.setUTCDate(panamaTime.getUTCDate() - 1);
      dateStr = panamaTime.toISOString().split('T')[0];
    }

    // --- 1. OBTENCIÓN DE PERFILES ---
    const profiles = await this.prisma.scoringProfile.findMany({
      select: { id: true, rulesEngine: true },
    });

    profiles.push({
      id: 'DEFAULT_ORPHAN_PROFILE',
      rulesEngine: this.DEFAULT_CONFIG as unknown as Prisma.JsonValue,
    });

    this.logger.log(
      'Paso 1: Purgando viajes fantasma del hardware (fuerza < 3 registros)...',
    );
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

      let cursor: string | undefined = undefined;
      let hasMore = true;

      // --- 3. BUCLE INTERNO: PAGINAMOS LOS VEHÍCULOS ---
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
          select: { id: true, category: true },
        });

        if (vehicles.length === 0) break;
        hasMore = vehicles.length === this.BATCH_SIZE;
        cursor = vehicles[vehicles.length - 1].id;

        const vehicleIds = vehicles.map((v) => v.id);

        this.logger.log(
          `Paso 2: Procesando lote de ${vehicleIds.length} vehículos para perfil ${profile.id}...`,
        );

        // --- 4. EJECUCIÓN DEL SQL CRUDO: DIVISION EN DOS QUERIES (TRIP Y NO-TRIP) ---

        // QUERY 1: Viajes Activos (tripId IS NOT NULL)
        await this.prisma.$executeRaw`
          WITH TelemetryLag AS (
            SELECT
              t."vehicleId",
              a."driverId" AS driver_or_unassigned,
              t."tripId",
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
              "tripId",
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
              AND "tripId" IS NOT NULL
          )
          INSERT INTO "DailyTelemetryRollup" (
            "id",
            "date",
            "vehicleId",
            "driverId",
            "tripId",
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
            "tripId",
            ROUND(COALESCE(SUM(odo_diff) FILTER (WHERE odo_diff > 0 AND odo_diff < (time_diff_sec * 0.05)), 0)::numeric, 3),
            ROUND((COALESCE(SUM(
              CASE 
                WHEN time_diff_sec <= 3600 THEN time_diff_sec
                WHEN odo_diff > 0 AND odo_diff < (time_diff_sec * 0.05) THEN LEAST(odo_diff * 60.0, time_diff_sec)
                ELSE 0
              END
            ) FILTER (WHERE "status" != 'STOPPED'), 0) / 3600.0)::numeric, 3),
            ROUND((COALESCE(SUM(
              CASE 
                WHEN time_diff_sec <= 3600 THEN time_diff_sec
                ELSE 0
              END
            ) FILTER (WHERE "status" = 'EXCESSIVE_IDLING'), 0) / 3600.0)::numeric, 3),
            
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > ${th.overspeed}),
            ROUND(COALESCE(SUM("speed" - ${th.overspeed}) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > ${th.overspeed}), 0)::numeric, 3),
            
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshBraking" >= ${th.braking}),
            ROUND(COALESCE(SUM(("harshBraking"::numeric / ${th.braking}::numeric) * (COALESCE("harshBrakingAverage", "harshBraking")::numeric / ${th.braking}::numeric) * (COALESCE("harshBrakingDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshBraking" >= ${th.braking}), 0)::numeric, 3),
 
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshCornering" >= ${th.cornering}),
            ROUND(COALESCE(SUM(("harshCornering"::numeric / ${th.cornering}::numeric) * (COALESCE("harshCorneringAverage", "harshCornering")::numeric / ${th.cornering}::numeric) * (COALESCE("harshCorneringDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshCornering" >= ${th.cornering}), 0)::numeric, 3),
 
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshAcceleration" >= ${th.accel}),
            ROUND(COALESCE(SUM(("harshAcceleration"::numeric / ${th.accel}::numeric) * (COALESCE("harshAccelerationAverage", "harshAcceleration")::numeric / ${th.accel}::numeric) * (COALESCE("harshAccelerationDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshAcceleration" >= ${th.accel}), 0)::numeric, 3),
 
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
          GROUP BY "vehicleId", driver_or_unassigned, "tripId"
          ON CONFLICT ("date", "vehicleId", "driverId", "tripId") WHERE "tripId" IS NOT NULL DO UPDATE SET
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

        // QUERY 2: Registros huérfanos / sin viaje asociado (tripId IS NULL)
        await this.prisma.$executeRaw`
          WITH TelemetryLag AS (
            SELECT
              t."vehicleId",
              a."driverId" AS driver_or_unassigned,
              t."tripId",
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
              "tripId",
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
              AND "tripId" IS NULL
          )
          INSERT INTO "DailyTelemetryRollup" (
            "id",
            "date",
            "vehicleId",
            "driverId",
            "tripId",
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
            NULL,
            ROUND(COALESCE(SUM(odo_diff) FILTER (WHERE odo_diff > 0 AND odo_diff < (time_diff_sec * 0.05)), 0)::numeric, 3),
            ROUND((COALESCE(SUM(
              CASE 
                WHEN time_diff_sec <= 3600 THEN time_diff_sec
                WHEN odo_diff > 0 AND odo_diff < (time_diff_sec * 0.05) THEN LEAST(odo_diff * 60.0, time_diff_sec)
                ELSE 0
              END
            ) FILTER (WHERE "status" != 'STOPPED'), 0) / 3600.0)::numeric, 3),
            ROUND((COALESCE(SUM(
              CASE 
                WHEN time_diff_sec <= 3600 THEN time_diff_sec
                ELSE 0
              END
            ) FILTER (WHERE "status" = 'EXCESSIVE_IDLING'), 0) / 3600.0)::numeric, 3),
            
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > ${th.overspeed}),
            ROUND(COALESCE(SUM("speed" - ${th.overspeed}) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "speed" > ${th.overspeed}), 0)::numeric, 3),
            
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshBraking" >= ${th.braking}),
            ROUND(COALESCE(SUM(("harshBraking"::numeric / ${th.braking}::numeric) * (COALESCE("harshBrakingAverage", "harshBraking")::numeric / ${th.braking}::numeric) * (COALESCE("harshBrakingDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshBraking" >= ${th.braking}), 0)::numeric, 3),
 
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshCornering" >= ${th.cornering}),
            ROUND(COALESCE(SUM(("harshCornering"::numeric / ${th.cornering}::numeric) * (COALESCE("harshCorneringAverage", "harshCornering")::numeric / ${th.cornering}::numeric) * (COALESCE("harshCorneringDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshCornering" >= ${th.cornering}), 0)::numeric, 3),
 
            COUNT(*) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshAcceleration" >= ${th.accel}),
            ROUND(COALESCE(SUM(("harshAcceleration"::numeric / ${th.accel}::numeric) * (COALESCE("harshAccelerationAverage", "harshAcceleration")::numeric / ${th.accel}::numeric) * (COALESCE("harshAccelerationDuration", 1000)::numeric / 1000.0)) FILTER (WHERE ("ignition" = true OR "rpm" > 400) AND "harshAcceleration" >= ${th.accel}), 0)::numeric, 3),
 
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
          ON CONFLICT ("date", "vehicleId", "driverId") WHERE "tripId" IS NULL DO UPDATE SET
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

    this.logger.log('✅ Rollup Diario orientado a viajes finalizado.');
  }
}
