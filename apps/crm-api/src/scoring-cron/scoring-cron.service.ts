import { Injectable, Logger } from '@nestjs/common';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import { PrismaService } from 'src/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HereRoutesClientService } from './here-routes-client.service';
import { TelemetryRollupService } from './telemetry-rollup.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { VehicleCategory } from '@prisma/client';
import { OverspeedCalculationService } from './overspeed-calculation.service';

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
    private overspeedCalculationService: OverspeedCalculationService,
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
        ? await this.overspeedCalculationService.evaluateOverspeedingWithHereRoutes(
            logs,
            fallbackThreshold,
            category,
          )
        : this.overspeedCalculationService.calculateOverspeedingFallback(
            logs,
            fallbackThreshold,
          );

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

  // Retorna los perfiles de scoring por defecto/públicos (sin orgId)
  async getPublicRules() {
    return this.prisma.scoringProfile.findMany({
      where: { orgId: null },
      orderBy: { name: 'asc' },
    });
  }
}
