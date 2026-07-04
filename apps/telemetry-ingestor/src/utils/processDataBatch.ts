/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaClient } from "@vantx/database";
import { notifyApi } from "./notifyApi";
import {
  DEVICE_PROFILES,
  Logger,
  getTelemetryProfile,
} from "@vantx/telemetry-parser";
import { snapTelemetryRecords } from "./snapTelemetry";
import { saveTelemetryBatchData } from "./dbTelemetryWriter";
import { parseTelemetryRecord, PreviousState } from "./telemetryParser";
import { v7 as uuidv7 } from "uuid";

const prisma = new PrismaClient();
const logger = new Logger("Ingestor");

const MIN_TRIP_DURATION_MS = 60_000; // 1 minuto mínimo para que un viaje sea válido
const POST_CLOSE_DEBOUNCE_MS = 90_000; // 90 s de silencio tras el cierre

// Caché enriquecido: almacena id + startTime para evitar lecturas extra a la DB
const activeTripsCache = new Map<string, { id: string; startTime: Date }>();

// Guard 2: caché del último viaje cerrado por vehículo (para reapertura/debounce)
const lastClosedTripCache = new Map<
  string,
  { id: string; startTime: Date; closeTime: number }
>();

// Active promise chain queue per IMEI to serialize concurrent ingestion requests locally
const ingestionQueue = new Map<string, Promise<void>>();

export interface IngestionState {
  activeTrip?: { id: string; startTime: Date };
  lastClosedTrip?: { id: string; startTime: Date; closeTime: number };
}

export async function processDataBatch(
  records: any[],
  imei: string,
): Promise<void> {
  const previousPromise = ingestionQueue.get(imei) || Promise.resolve();

  const executeNext = async () => {
    try {
      await previousPromise;
    } catch (err) {
      // Ignore previous execution failure to let the next request run
    }
    try {
      await processDataBatchInternal(records, imei);
    } finally {
      if (ingestionQueue.get(imei) === currentPromise) {
        ingestionQueue.delete(imei);
      }
    }
  };

  const currentPromise = executeNext();
  ingestionQueue.set(imei, currentPromise);

  return currentPromise;
}

// Función pura de transición de estado de viaje con detector de solapamientos/fusiones
function transitionTripState({
  rec,
  tripActive,
  vehicleAlias,
  state,
  newTripsCreatedInBatch,
  tripsToCreate,
  tripsToUpdate,
  tripsToDelete,
  tripsToMerge,
  telemetryLogs,
  isHistorical,
  dbOverlappingTrips,
}: {
  rec: any;
  tripActive: boolean;
  vehicleAlias: string;
  state: IngestionState;
  newTripsCreatedInBatch: Set<string>;
  tripsToCreate: Map<string, { id: string; startTime: Date; endTime?: Date }>;
  tripsToUpdate: Map<string, { id: string; endTime: Date | null }>;
  tripsToDelete: Set<string>;
  tripsToMerge: Map<string, string>;
  telemetryLogs: any[];
  isHistorical: boolean;
  dbOverlappingTrips: any[];
}): string | null {
  const recTimeMs = (rec.timestamp as Date).getTime();

  // 1. Detección de solapamiento: buscar si el timestamp actual cae dentro de algún viaje existente en la base de datos
  const overlappingDbTrip = dbOverlappingTrips.find(
    (t) =>
      t.startTime.getTime() <= recTimeMs &&
      (t.endTime === null || t.endTime.getTime() >= recTimeMs),
  );

  // Si hay un viaje activo en memoria, y encontramos un viaje solapado en la BD con ID diferente
  if (
    state.activeTrip &&
    overlappingDbTrip &&
    overlappingDbTrip.id !== state.activeTrip.id
  ) {
    // FUSIONAR: Registrar el viaje de la BD para ser fusionado con nuestro viaje activo actual
    tripsToMerge.set(overlappingDbTrip.id, state.activeTrip.id);
    tripsToDelete.add(overlappingDbTrip.id);
    tripsToUpdate.delete(overlappingDbTrip.id);

    logger.log(
      `🔄 Fusionando viaje duplicado ${overlappingDbTrip.id} en viaje activo ${state.activeTrip.id} para ${vehicleAlias}`,
    );
  }

  // 2. Si no tenemos un viaje activo, pero el registro tiene tripActive = true
  if (!state.activeTrip && tripActive) {
    // Si caímos dentro de un viaje de la BD, lo reutilizamos como nuestro viaje activo
    if (overlappingDbTrip) {
      state.activeTrip = {
        id: overlappingDbTrip.id,
        startTime: overlappingDbTrip.startTime,
      };
      logger.log(
        `🚗 Reutilizando viaje existente de la BD: ${overlappingDbTrip.id} para ${vehicleAlias}`,
      );
    } else {
      // Si no cae en ningún viaje, revisamos el debounce de reapertura
      const lastClosed = state.lastClosedTrip;
      if (
        lastClosed &&
        recTimeMs >= lastClosed.closeTime &&
        recTimeMs - lastClosed.closeTime < POST_CLOSE_DEBOUNCE_MS
      ) {
        const reopenedTripId = lastClosed.id;
        state.activeTrip = {
          id: reopenedTripId,
          startTime: lastClosed.startTime,
        };

        tripsToDelete.delete(reopenedTripId);
        tripsToMerge.delete(reopenedTripId);

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
        logger.log(
          isHistorical
            ? `🚗 Viaje Reabierto (Diferido): ${vehicleAlias}`
            : `🚗 Viaje Reabierto: ${vehicleAlias}`,
        );
      } else {
        const newTripId = uuidv7();
        state.activeTrip = { id: newTripId, startTime: rec.timestamp };
        newTripsCreatedInBatch.add(newTripId);
        tripsToCreate.set(newTripId, {
          id: newTripId,
          startTime: rec.timestamp,
        });
        logger.log(
          isHistorical
            ? `🚗 Viaje Iniciado (Diferido): ${vehicleAlias}`
            : `🚗 Viaje Iniciado: ${vehicleAlias}`,
        );
      }
    }
  }
  // 3. Si tenemos un viaje activo, pero el registro tiene tripActive = false
  else if (state.activeTrip && !tripActive) {
    const durationMs = recTimeMs - state.activeTrip.startTime.getTime();
    const tripId = state.activeTrip.id;

    if (durationMs < MIN_TRIP_DURATION_MS) {
      if (newTripsCreatedInBatch.has(tripId)) {
        tripsToCreate.delete(tripId);
        logger.log(
          isHistorical
            ? `👻 Viaje fantasma (Diferido) descartado en memoria: ${vehicleAlias} (${durationMs}ms)`
            : `👻 Viaje fantasma descartado en memoria: ${vehicleAlias} (${durationMs}ms)`,
        );
      } else {
        tripsToDelete.add(tripId);
        tripsToUpdate.delete(tripId);
        logger.log(
          isHistorical
            ? `👻 Viaje fantasma (Diferido) en DB programado para eliminación: ${vehicleAlias} (${durationMs}ms)`
            : `👻 Viaje fantasma en DB programado para eliminación: ${vehicleAlias} (${durationMs}ms)`,
        );
      }

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
      logger.log(
        isHistorical
          ? `🛑 Viaje Finalizado (Diferido): ${vehicleAlias}`
          : `🛑 Viaje Finalizado: ${vehicleAlias}`,
      );

      state.lastClosedTrip = {
        id: tripId,
        startTime: state.activeTrip.startTime,
        closeTime: recTimeMs,
      };
    }

    state.activeTrip = undefined;
  }

  return state.activeTrip && recTimeMs >= state.activeTrip.startTime.getTime()
    ? state.activeTrip.id
    : null;
}

async function processDataBatchInternal(records: any[], imei: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { device: { imei } },
    select: {
      id: true,
      orgId: true,
      alias: true,
      vin: true,
      fuelType: true,
      isOdometerAbsolute: true,
      odometerSource: true,
      capabilities: true,
      device: {
        select: {
          model: true,
        },
      },
      liveState: {
        select: {
          lastIgnition: true,
          unplugged: true,
          currentStatus: true,
          lastOdometer: true,
          lastFuelLevel: true,
          lastAngle: true,
        },
      },
    },
  });

  if (!vehicle) {
    logger.warn(`⚠️ Dropping packet. Unknown IMEI: ${imei}`);
    return;
  }

  const profileName = getTelemetryProfile(vehicle.device?.model);
  const mapping =
    DEVICE_PROFILES[profileName] || DEVICE_PROFILES.TELTONIKA_STANDARD;

  const snappedRecords = await snapTelemetryRecords(records, prisma, mapping);

  if (!activeTripsCache.has(vehicle.id)) {
    const activeTrip = await prisma.trip.findFirst({
      where: { vehicleId: vehicle.id, endTime: null },
      orderBy: { startTime: "desc" },
      select: { id: true, startTime: true },
    });

    if (activeTrip) {
      activeTripsCache.set(vehicle.id, {
        id: activeTrip.id,
        startTime: activeTrip.startTime,
      });
      lastClosedTripCache.delete(vehicle.id);
    }
  }

  if (
    !activeTripsCache.has(vehicle.id) &&
    !lastClosedTripCache.has(vehicle.id)
  ) {
    const lastClosed = await prisma.trip.findFirst({
      where: {
        vehicleId: vehicle.id,
        endTime: { not: null },
      },
      orderBy: { endTime: "desc" },
      select: { id: true, startTime: true, endTime: true },
    });

    if (lastClosed && lastClosed.endTime) {
      lastClosedTripCache.set(vehicle.id, {
        id: lastClosed.id,
        startTime: lastClosed.startTime,
        closeTime: lastClosed.endTime.getTime(),
      });
    }
  }

  const localActiveTrip = activeTripsCache.get(vehicle.id);
  const localLastClosedTrip = lastClosedTripCache.get(vehicle.id);

  const liveTripState: IngestionState = {
    activeTrip: localActiveTrip
      ? { id: localActiveTrip.id, startTime: localActiveTrip.startTime }
      : undefined,
    lastClosedTrip: localLastClosedTrip
      ? {
          id: localLastClosedTrip.id,
          startTime: localLastClosedTrip.startTime,
          closeTime: localLastClosedTrip.closeTime,
        }
      : undefined,
  };

  const historicalTripState: IngestionState = {
    activeTrip: undefined,
    lastClosedTrip: undefined,
  };

  const newTripsCreatedInBatch = new Set<string>();
  const tripsToCreate = new Map<
    string,
    { id: string; startTime: Date; endTime?: Date }
  >();
  const tripsToUpdate = new Map<string, { id: string; endTime: Date | null }>();
  const tripsToDelete = new Set<string>();
  const tripsToMerge = new Map<string, string>();
  let newVinDetected: string | null = null;
  let newFuelTypeDetected:
    | "GASOLINE"
    | "DIESEL"
    | "ELECTRIC"
    | "HYBRID"
    | null = null;

  const sortedRecords = [...snappedRecords].sort(
    (a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime(),
  );

  const batchStart = sortedRecords[0].timestamp as Date;
  const batchEnd = sortedRecords[sortedRecords.length - 1].timestamp as Date;

  // Pre-cargar todos los viajes solapados para evitar consultas dentro del bucle
  const dbOverlappingTrips = await prisma.trip.findMany({
    where: {
      vehicleId: vehicle.id,
      startTime: { lte: batchEnd },
      OR: [{ endTime: null }, { endTime: { gte: batchStart } }],
    },
    orderBy: { startTime: "asc" },
  });

  const latestLiveTime = liveTripState.activeTrip
    ? liveTripState.activeTrip.startTime.getTime()
    : liveTripState.lastClosedTrip
      ? liveTripState.lastClosedTrip.closeTime
      : 0;

  const firstHistoricalRecord = sortedRecords.find((rec) => {
    return (rec.timestamp as Date).getTime() < latestLiveTime;
  });

  if (firstHistoricalRecord) {
    const firstHistTimestamp = firstHistoricalRecord.timestamp as Date;

    const activeHistTrip = dbOverlappingTrips.find(
      (t) =>
        t.startTime.getTime() <= firstHistTimestamp.getTime() &&
        (t.endTime === null ||
          t.endTime.getTime() >= firstHistTimestamp.getTime()),
    );

    if (activeHistTrip) {
      historicalTripState.activeTrip = {
        id: activeHistTrip.id,
        startTime: activeHistTrip.startTime,
      };
    } else {
      const lastClosedHistTrip = [...dbOverlappingTrips]
        .reverse()
        .find(
          (t) =>
            t.endTime !== null &&
            t.endTime.getTime() < firstHistTimestamp.getTime(),
        );

      if (lastClosedHistTrip && lastClosedHistTrip.endTime) {
        historicalTripState.lastClosedTrip = {
          id: lastClosedHistTrip.id,
          startTime: lastClosedHistTrip.startTime,
          closeTime: lastClosedHistTrip.endTime.getTime(),
        };
      }
    }
  }

  let previousState: PreviousState = {
    ignition: vehicle.liveState?.lastIgnition ?? false,
    unplugged: vehicle.liveState?.unplugged ?? false,
    rpm: 0,
    excessiveIdling: vehicle.liveState?.currentStatus === "EXCESSIVE_IDLING",
    odometer: vehicle.liveState?.lastOdometer ?? null,
    fuelLevel: vehicle.liveState?.lastFuelLevel ?? null,
    angle: vehicle.liveState?.lastAngle ?? 0,
  };

  const telemetryLogs: any = [];

  for (const rec of sortedRecords) {
    const parsed = parseTelemetryRecord(rec, mapping, previousState);

    let recordAngle = rec.angle ?? 0;
    // LKV para ángulo: si el ángulo reportado es 0 (o nulo) y el estado es STOPPED,
    // y tenemos un ángulo previo que es distinto de 0, mantenemos el ángulo previo.
    const isStopped = parsed.status === "STOPPED";
    if ((recordAngle === 0 || recordAngle === null || recordAngle === undefined) && isStopped && previousState.angle) {
      recordAngle = previousState.angle;
    }

    previousState = {
      ignition: parsed.trueIgnition,
      unplugged: parsed.isUnplugged,
      rpm: parsed.rawRpm,
      excessiveIdling: parsed.isHardwareExcessiveIdling,
      odometer: parsed.odometer,
      fuelLevel: parsed.fuelLevel,
      angle: recordAngle,
    };

    if (
      !vehicle.vin &&
      parsed.vin &&
      typeof parsed.vin === "string" &&
      parsed.vin.trim() !== "" &&
      !newVinDetected
    ) {
      newVinDetected = parsed.vin.trim();
    }

    if (!vehicle.fuelType && parsed.detectedFuelType && !newFuelTypeDetected) {
      newFuelTypeDetected = parsed.detectedFuelType;
    }

    const isRecordBeforeCurrentTrip =
      (rec.timestamp as Date).getTime() < latestLiveTime;

    let recordTripId: string | null = null;

    if (isRecordBeforeCurrentTrip) {
      recordTripId = transitionTripState({
        rec,
        tripActive: parsed.tripActive,
        vehicleAlias: vehicle.alias || "",
        state: historicalTripState,
        newTripsCreatedInBatch,
        tripsToCreate,
        tripsToUpdate,
        tripsToDelete,
        tripsToMerge,
        telemetryLogs,
        isHistorical: true,
        dbOverlappingTrips,
      });
    } else {
      recordTripId = transitionTripState({
        rec,
        tripActive: parsed.tripActive,
        vehicleAlias: vehicle.alias || "",
        state: liveTripState,
        newTripsCreatedInBatch,
        tripsToCreate,
        tripsToUpdate,
        tripsToDelete,
        tripsToMerge,
        telemetryLogs,
        isHistorical: false,
        dbOverlappingTrips,
      });
    }

    telemetryLogs.push({
      vehicleId: vehicle.id,
      tripId: recordTripId,
      timestamp: rec.timestamp,
      latitude: rec.latitude,
      longitude: rec.longitude,
      angle: recordAngle,
      speed: parsed.speedToUse,
      gpsSpeed: rec.gpsSpeed,
      ignition: parsed.trueIgnition,
      movement: parsed.movement,
      unplugged: parsed.isUnplugged,
      status: parsed.status,
      rpm: parsed.rawRpm === 0 ? null : parsed.rawRpm,
      engineLoad: parsed.engineLoad,
      coolantTemp: parsed.coolantTemp,
      odometer: parsed.odometer,
      dtcCount: parsed.dtcCount,
      faultCodes: parsed.faultCodes,
      fuelLevel: parsed.fuelLevel,
      fuelConsumption: parsed.fuelConsumption,
      fuelRate: parsed.fuelRate,
      altitude: rec.altitude,
      satellites: rec.satellites,
      powerSupply: parsed.powerSupply,
      harshAcceleration: parsed.harshAcceleration,
      harshBraking: parsed.harshBraking,
      harshCornering: parsed.harshCornering,
      harshAccelerationDuration: parsed.harshAccelerationDuration,
      harshBrakingDuration: parsed.harshBrakingDuration,
      harshCorneringDuration: parsed.harshCorneringDuration,
      harshAccelerationAverage: parsed.harshAccelerationAverage,
      harshBrakingAverage: parsed.harshBrakingAverage,
      harshCorneringAverage: parsed.harshCorneringAverage,
      extra: {
        ...parsed.extraIoData,
        priority: rec.priority,
      },
    });
  }

  if (telemetryLogs.length === 0) return;

  const lastRecord = telemetryLogs[telemetryLogs.length - 1];

  await saveTelemetryBatchData({
    prisma,
    vehicle,
    telemetryLogs,
    tripsToCreate,
    tripsToUpdate,
    tripsToDelete,
    tripsToMerge,
    newVinDetected,
    newFuelTypeDetected,
  });

  if (liveTripState.activeTrip) {
    activeTripsCache.set(vehicle.id, {
      id: liveTripState.activeTrip.id,
      startTime: liveTripState.activeTrip.startTime,
    });
    lastClosedTripCache.delete(vehicle.id);
  } else {
    activeTripsCache.delete(vehicle.id);
    if (liveTripState.lastClosedTrip) {
      lastClosedTripCache.set(vehicle.id, {
        id: liveTripState.lastClosedTrip.id,
        startTime: liveTripState.lastClosedTrip.startTime,
        closeTime: liveTripState.lastClosedTrip.closeTime,
      });
    }
  }

  notifyApi(vehicle, lastRecord).catch((err) =>
    logger.error(`[Webhook] Error: ${err.message}`),
  );
}
