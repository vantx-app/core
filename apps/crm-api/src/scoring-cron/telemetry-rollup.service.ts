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

    this.logger.log(
      `Ejecutando procedimiento almacenado de rollup en base de datos para la fecha: ${dateStr}`,
    );

    await this.prisma.$executeRaw`
      SELECT calculate_daily_telemetry_rollups(${dateStr}::date);
    `;

    this.logger.log('✅ Rollup Diario orientado a viajes finalizado.');
  }
}
