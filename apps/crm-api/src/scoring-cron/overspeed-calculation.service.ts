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

    // Manejar el último episodio activo si el viaje terminó mientras excedía la velocidad
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
}
