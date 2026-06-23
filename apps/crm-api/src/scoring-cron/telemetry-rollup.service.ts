import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  VehicleCategory,
  VehicleCategory as PrismaVehicleCategory,
} from '@prisma/client';
import {
  RuleEngineConfig,
  DEFAULT_RULE_ENGINE_CONFIG,
} from './scoring.interfaces';

@Injectable()
export class TelemetryRollupService {
  private readonly logger = new Logger(TelemetryRollupService.name);
  private readonly BATCH_SIZE = 50;

  private readonly DEFAULT_CONFIG: RuleEngineConfig =
    DEFAULT_RULE_ENGINE_CONFIG;

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

    this.logger.log(
      `Ejecutando procedimiento almacenado de rollup en base de datos para la fecha: ${dateStr}`,
    );

    await this.prisma.$executeRaw`
      SELECT calculate_daily_telemetry_rollups(${dateStr}::date);
    `;

    this.logger.log('✅ Rollup Diario orientado a viajes finalizado.');
  }
}
