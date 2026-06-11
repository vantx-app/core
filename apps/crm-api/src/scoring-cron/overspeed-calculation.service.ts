import { Injectable } from '@nestjs/common';
import { TelemetryLog } from '@prisma/client';

@Injectable()
export class OverspeedCalculationService {
  /**
   * Calcula el exceso de velocidad basándose en el límite fallback (110 km/h o configurado en el perfil)
   */
  calculateOverspeeding(
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
}
