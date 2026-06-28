import { Logger } from "@vantx/telemetry-parser";
import { v7 as uuidv7 } from "uuid";

const logger = new Logger("Ingestor");

const MIN_TRIP_DURATION_MS = 60_000; // 1 minuto mínimo para que un viaje sea válido
const POST_CLOSE_DEBOUNCE_MS = 90_000; // 90 s de silencio tras el cierre

export interface TripContext {
  id: string;
  startTime: Date;
}

export interface ClosedTripContext {
  id: string;
  startTime: Date;
  closeTime: number;
}

export interface TripState {
  activeTrip?: TripContext;
  lastClosedTrip?: ClosedTripContext;
}

export interface TripTransitionParams {
  rec: any;
  tripActive: boolean;
  vehicleAlias: string;
  state: TripState;
  newTripsCreatedInBatch: Set<string>;
  tripsToCreate: Map<string, { id: string; startTime: Date; endTime?: Date }>;
  tripsToUpdate: Map<string, { id: string; endTime: Date | null }>;
  tripsToDelete: Set<string>;
  telemetryLogs: any[];
  isHistorical: boolean;
}

/**
 * Procesa la transición de estado de viaje de un vehículo para un registro de telemetría específico.
 * Todos los comentarios y logs deben mantenerse en español.
 */
export function transitionTripState({
  rec,
  tripActive,
  vehicleAlias,
  state,
  newTripsCreatedInBatch,
  tripsToCreate,
  tripsToUpdate,
  tripsToDelete,
  telemetryLogs,
  isHistorical,
}: TripTransitionParams): string | null {
  const recTimeMs = (rec.timestamp as Date).getTime();

  if (!state.activeTrip && tripActive) {
    const lastClosed = state.lastClosedTrip;
    if (
      lastClosed &&
      recTimeMs - lastClosed.closeTime < POST_CLOSE_DEBOUNCE_MS
    ) {
      const reopenedTripId = lastClosed.id;
      state.activeTrip = {
        id: reopenedTripId,
        startTime: lastClosed.startTime,
      };

      // Restaurar estado si fue marcado como eliminado o descartado
      tripsToDelete.delete(reopenedTripId);

      if (newTripsCreatedInBatch.has(reopenedTripId)) {
        tripsToCreate.set(reopenedTripId, {
          id: reopenedTripId,
          startTime: lastClosed.startTime,
        });
      } else {
        tripsToUpdate.set(reopenedTripId, {
          id: reopenedTripId,
          endTime: null,
        });
      }

      state.lastClosedTrip = undefined;
      if (isHistorical) {
        logger.log(`🚗 Viaje Reabierto (Diferido): ${vehicleAlias}`);
      } else {
        logger.log(`🚗 Viaje Reabierto: ${vehicleAlias}`);
      }
    } else {
      const newTripId = uuidv7();
      state.activeTrip = { id: newTripId, startTime: rec.timestamp };
      newTripsCreatedInBatch.add(newTripId);
      tripsToCreate.set(newTripId, {
        id: newTripId,
        startTime: rec.timestamp,
      });
      if (isHistorical) {
        logger.log(`🚗 Viaje Iniciado (Diferido): ${vehicleAlias}`);
      } else {
        logger.log(`🚗 Viaje Iniciado: ${vehicleAlias}`);
      }
    }
  } else if (state.activeTrip && !tripActive) {
    const durationMs = recTimeMs - state.activeTrip.startTime.getTime();
    const tripId = state.activeTrip.id;

    if (durationMs < MIN_TRIP_DURATION_MS) {
      if (newTripsCreatedInBatch.has(tripId)) {
        tripsToCreate.delete(tripId);
        if (isHistorical) {
          logger.log(
            `👻 Viaje fantasma (Diferido) descartado en memoria: ${vehicleAlias} (${durationMs}ms)`,
          );
        } else {
          logger.log(
            `👻 Viaje fantasma descartado en memoria: ${vehicleAlias} (${durationMs}ms)`,
          );
        }
      } else {
        tripsToDelete.add(tripId);
        tripsToUpdate.delete(tripId);
        if (isHistorical) {
          logger.log(
            `👻 Viaje fantasma (Diferido) en DB programado para eliminación: ${vehicleAlias} (${durationMs}ms)`,
          );
        } else {
          logger.log(
            `👻 Viaje fantasma en DB programado para eliminación: ${vehicleAlias} (${durationMs}ms)`,
          );
        }
      }

      // Limpiar tripId de los logs de telemetría en este lote
      for (const log of telemetryLogs) {
        if (log.tripId === tripId) {
          log.tripId = null;
        }
      }
    } else {
      if (newTripsCreatedInBatch.has(tripId)) {
        const tripData = tripsToCreate.get(tripId);
        if (tripData) {
          tripData.endTime = rec.timestamp;
        }
      } else {
        tripsToUpdate.set(tripId, { id: tripId, endTime: rec.timestamp });
      }
      if (isHistorical) {
        logger.log(`🛑 Viaje Finalizado (Diferido): ${vehicleAlias}`);
      } else {
        logger.log(`🛑 Viaje Finalizado: ${vehicleAlias}`);
      }
    }

    state.lastClosedTrip = {
      id: tripId,
      startTime: state.activeTrip.startTime,
      closeTime: recTimeMs,
    };
    state.activeTrip = undefined;
  }

  return state.activeTrip && recTimeMs >= state.activeTrip.startTime.getTime()
    ? state.activeTrip.id
    : null;
}
