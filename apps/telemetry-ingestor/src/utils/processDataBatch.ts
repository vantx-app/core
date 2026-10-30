/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaClient } from "@vantx/database";
import { notifyApi } from "./notifyApi";
import {
  DEVICE_PROFILES,
  Logger,
  getTelemetryProfile,
  haversineDistance,
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

export interface FuelVirtualState {
  currentDisplayPercent: number | null;
  lastValidAnchorPercent: number | null;
  vehicleState: "PARKED" | "MOVING";
  segmentReadings: number[];
  distanceAccumulator: number;
  timeAccumulator: number;
  ignitionOnTime: number | null;
  ignitionOnReadings: number[];
  session?: {
    type: "REFUEL" | "DRAIN" | "NONE";
    startAnchor: number | null;
    stableCounter: number;
    lastMedian: number | null;
    anchorLat?: number | null;
    anchorLng?: number | null;
    anchorTimestamp?: Date | null;
  };
}

const fuelVirtualStateCache = new Map<string, FuelVirtualState>();

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2;
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
      (t.endTime === null || t.endTime.getTime() >= recTimeMs) &&
      !tripsToDelete.has(t.id),
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
      tankCapacity: true,
      isOdometerAbsolute: true,
      odometerSource: true,
      capabilities: true,
      category: true,
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
          lastEngineHours: true,
          virtualState: true,
          lastAngle: true,
          lastLat: true,
          lastLng: true,
          lastUpdate: true,
        },
      },
    },
  });

  if (!vehicle) {
    logger.warn(`⚠️ Dropping packet. Unknown IMEI: ${imei}`);
    return;
  }

  const profileName = getTelemetryProfile(vehicle.device?.model);
  const baseMapping =
    DEVICE_PROFILES[profileName] || DEVICE_PROFILES.TELTONIKA_STANDARD;

  // Resolve dynamic moving alpha based on vehicle category
  const defaultMovingAlpha =
    vehicle.category === "HEAVY_DUTY" || vehicle.category === "MACHINERY"
      ? 0.005
      : 0.02;

  const mapping = {
    ...baseMapping,
    movingFuelAlpha: baseMapping.movingFuelAlpha ?? defaultMovingAlpha,
  };

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
    engineHours: vehicle.liveState?.lastEngineHours ?? null,
    fuelLevel: vehicle.liveState?.lastFuelLevel ?? null,
    angle: vehicle.liveState?.lastAngle ?? 0,
    latitude: vehicle.liveState?.lastLat ?? undefined,
    longitude: vehicle.liveState?.lastLng ?? undefined,
    timestamp: vehicle.liveState?.lastUpdate ?? undefined,
    tripActive:
      vehicle.liveState?.currentStatus !== "STOPPED" &&
      vehicle.liveState?.currentStatus !== "UNPLUGGED",
  };

  let virtualState = fuelVirtualStateCache.get(vehicle.id);
  if (!virtualState) {
    if (
      vehicle.liveState?.virtualState &&
      typeof vehicle.liveState.virtualState === "object"
    ) {
      const vs = vehicle.liveState.virtualState as any;
      virtualState = {
        currentDisplayPercent:
          typeof vs.currentDisplayPercent === "number"
            ? vs.currentDisplayPercent
            : (vehicle.liveState.lastFuelLevel ?? null),
        lastValidAnchorPercent:
          typeof vs.lastValidAnchorPercent === "number"
            ? vs.lastValidAnchorPercent
            : (vehicle.liveState.lastFuelLevel ?? null),
        vehicleState: vs.vehicleState === "MOVING" ? "MOVING" : "PARKED",
        segmentReadings: Array.isArray(vs.segmentReadings)
          ? vs.segmentReadings
          : [],
        distanceAccumulator:
          typeof vs.distanceAccumulator === "number" ? vs.distanceAccumulator : 0,
        timeAccumulator:
          typeof vs.timeAccumulator === "number" ? vs.timeAccumulator : 0,
        ignitionOnTime:
          typeof vs.ignitionOnTime === "number" ? vs.ignitionOnTime : null,
        ignitionOnReadings: Array.isArray(vs.ignitionOnReadings)
          ? vs.ignitionOnReadings
          : [],
        session: vs.session ?? {
          type: "NONE",
          startAnchor: null,
          stableCounter: 0,
          lastMedian: null,
        },
      };
    } else {
      const initialLevel = vehicle.liveState?.lastFuelLevel ?? null;
      virtualState = {
        currentDisplayPercent: initialLevel,
        lastValidAnchorPercent: initialLevel,
        vehicleState:
          vehicle.liveState?.currentStatus === "MOVING" ? "MOVING" : "PARKED",
        segmentReadings: [],
        distanceAccumulator: 0,
        timeAccumulator: 0,
        ignitionOnTime: null,
        ignitionOnReadings: [],
        session: {
          type: "NONE",
          startAnchor: null,
          stableCounter: 0,
          lastMedian: null,
        },
      };
    }
    fuelVirtualStateCache.set(vehicle.id, virtualState);
  }

  // Defensive fallback ensuring arrays and accumulators are never undefined
  if (!Array.isArray(virtualState.segmentReadings)) {
    virtualState.segmentReadings = [];
  }
  if (!Array.isArray(virtualState.ignitionOnReadings)) {
    virtualState.ignitionOnReadings = [];
  }
  if (typeof virtualState.distanceAccumulator !== "number") {
    virtualState.distanceAccumulator = 0;
  }
  if (typeof virtualState.timeAccumulator !== "number") {
    virtualState.timeAccumulator = 0;
  }
  if (!virtualState.session) {
    virtualState.session = {
      type: "NONE",
      startAnchor: null,
      stableCounter: 0,
      lastMedian: null,
    };
  }

  const fuelEventsToCreate: any[] = [];
  const tripMidRefuels = new Map<string, number>();
  const vehicleTankCapacity = vehicle.tankCapacity ?? 60;
  const vehicleUsableCapacity = vehicleTankCapacity;

  const telemetryLogs: any = [];

  for (const rec of sortedRecords) {
    const parsed = parseTelemetryRecord(rec, mapping, previousState);

    let recordAngle = rec.angle ?? 0;
    // LKV para ángulo: si el ángulo reportado es 0 (o nulo) y el estado es STOPPED,
    // y tenemos un ángulo previo que es distinto de 0, mantenemos el ángulo previo.
    const isStopped = parsed.status === "STOPPED";
    if (
      (recordAngle === 0 ||
        recordAngle === null ||
        recordAngle === undefined) &&
      isStopped &&
      previousState.angle
    ) {
      recordAngle = previousState.angle;
    }

    let distanceDeltaMeters = 0;
    if (!isStopped) {
      if (
        parsed.odometer !== null &&
        previousState.odometer !== null &&
        previousState.odometer !== undefined
      ) {
        distanceDeltaMeters = Math.max(
          0,
          (parsed.odometer - previousState.odometer) * 1000,
        );
      } else if (
        previousState.latitude !== undefined &&
        previousState.longitude !== undefined
      ) {
        distanceDeltaMeters =
          haversineDistance(
            previousState.latitude,
            previousState.longitude,
            rec.latitude,
            rec.longitude,
          ) * 1000;
      }
    }

    let timeDeltaSeconds = 0;
    if (previousState.timestamp) {
      timeDeltaSeconds = Math.max(
        0,
        ((rec.timestamp as Date).getTime() -
          previousState.timestamp.getTime()) /
          1000,
      );
    }

    // Engine Hours Accumulator & Normalization
    let recordEngineHours: number | null = parsed.engineHours;
    if (recordEngineHours === null || recordEngineHours === undefined) {
      const prevEH =
        previousState.engineHours ?? vehicle.liveState?.lastEngineHours ?? 0;
      if (parsed.trueIgnition) {
        const cappedSeconds = Math.min(timeDeltaSeconds, 120); // Cap gap at 120s to prevent disconnect spikes
        recordEngineHours = prevEH + cappedSeconds / 3600.0;
      } else {
        recordEngineHours = prevEH;
      }
    }
    if (recordEngineHours !== null) {
      parsed.engineHours = Math.round(recordEngineHours * 10000) / 10000;
    }

    // Odometer Fallback Accumulator
    let recordOdometer: number | null = parsed.odometer;
    if (recordOdometer === null || recordOdometer === undefined) {
      const prevOdo =
        previousState.odometer ?? vehicle.liveState?.lastOdometer ?? 0;
      recordOdometer = prevOdo + distanceDeltaMeters / 1000.0;
    }
    if (recordOdometer !== null) {
      parsed.odometer = Math.round(recordOdometer * 100) / 100;
    }

    // Process Virtual Tank State Machine
    const rawFuelPercent = parsed.fuelLevel;
    if (rawFuelPercent !== null) {
      if (virtualState.currentDisplayPercent === null) {
        virtualState.currentDisplayPercent = rawFuelPercent;
        virtualState.lastValidAnchorPercent = rawFuelPercent;
      }

      // 1. Ignition-On Anchor Observation Window
      const isTransitionIgnition =
        parsed.trueIgnition && !previousState.ignition;
      if (isTransitionIgnition) {
        virtualState.ignitionOnTime = (rec.timestamp as Date).getTime();
        virtualState.ignitionOnReadings = [rawFuelPercent];
      } else if (virtualState.ignitionOnTime !== null) {
        const elapsedMs =
          (rec.timestamp as Date).getTime() - virtualState.ignitionOnTime;
        if (elapsedMs <= 60000) {
          if (parsed.speedToUse <= 5) {
            virtualState.ignitionOnReadings.push(rawFuelPercent);
          }
        } else {
          // Observation window finished
          if (virtualState.ignitionOnReadings.length > 0) {
            const calibratedAnchor = calculateMedian(
              virtualState.ignitionOnReadings,
            );
            const anchorDiff =
              calibratedAnchor -
              (virtualState.lastValidAnchorPercent ?? calibratedAnchor);

            if (anchorDiff >= 8.0) {
              const liters =
                Math.round(((anchorDiff / 100.0) * vehicleUsableCapacity) * 100) /
                100;
              if (liters >= 4.0) {
                fuelEventsToCreate.push({
                  id: uuidv7(),
                  vehicleId: vehicle.id,
                  tripId: liveTripState.activeTrip?.id ?? null,
                  type: "REFUEL",
                  liters,
                  percentageDelta: Math.round(anchorDiff * 100) / 100,
                  startLevel:
                    Math.round(
                      (virtualState.lastValidAnchorPercent ?? calibratedAnchor) *
                        100,
                    ) / 100,
                  endLevel: Math.round(calibratedAnchor * 100) / 100,
                  latitude: rec.latitude,
                  longitude: rec.longitude,
                  timestamp: rec.timestamp as Date,
                });
                if (liveTripState.activeTrip) {
                  const tId = liveTripState.activeTrip.id;
                  tripMidRefuels.set(
                    tId,
                    (tripMidRefuels.get(tId) ?? 0) + liters,
                  );
                }
              }
            } else if (
              anchorDiff <= -8.0 &&
              !liveTripState.activeTrip &&
              !parsed.trueIgnition
            ) {
              const liters =
                Math.round(
                  ((Math.abs(anchorDiff) / 100.0) * vehicleUsableCapacity) *
                    100,
                ) / 100;
              if (liters >= 4.0) {
                fuelEventsToCreate.push({
                  id: uuidv7(),
                  vehicleId: vehicle.id,
                  tripId: null,
                  type: "DRAIN",
                  liters,
                  percentageDelta: Math.round(anchorDiff * 100) / 100,
                  startLevel:
                    Math.round(
                      (virtualState.lastValidAnchorPercent ?? calibratedAnchor) *
                        100,
                    ) / 100,
                  endLevel: Math.round(calibratedAnchor * 100) / 100,
                  latitude: rec.latitude,
                  longitude: rec.longitude,
                  timestamp: rec.timestamp as Date,
                });
              }
            }

            virtualState.currentDisplayPercent = calibratedAnchor;
            virtualState.lastValidAnchorPercent = calibratedAnchor;
          }
          virtualState.ignitionOnTime = null;
          virtualState.ignitionOnReadings = [];
        }
      }

      // 2. Kinematic Gating Rule
      const accelX_G = parsed.accelX !== null ? Math.abs(parsed.accelX) : 0;
      const accelY_G = parsed.accelY !== null ? Math.abs(parsed.accelY) : 0;
      const isSloshing = accelX_G > 0.15 || accelY_G > 0.15;

      // 3. Dynamic State Transitions
      const isMoving = parsed.speedToUse > 5;
      if (isMoving && virtualState.vehicleState === "PARKED") {
        if (
          virtualState.session &&
          virtualState.session.type !== "NONE" &&
          virtualState.segmentReadings.length >= 6
        ) {
          const currentMed = calculateMedian(virtualState.segmentReadings);
          const startAnchor =
            virtualState.session.startAnchor ??
            virtualState.lastValidAnchorPercent ??
            currentMed;
          const delta = currentMed - startAnchor;
          // Verificación de rebote al reanudar marcha: si regresó cerca del ancla, fue inclinación/rampa
          const isRebound = Math.abs(delta) < 2.0;

          if (!isRebound) {
            if (virtualState.session.type === "REFUEL" && delta >= 8.0) {
              const liters =
                Math.round(((delta / 100.0) * vehicleUsableCapacity) * 100) / 100;
              if (liters >= 4.0) {
                fuelEventsToCreate.push({
                  id: uuidv7(),
                  vehicleId: vehicle.id,
                  tripId: liveTripState.activeTrip?.id ?? null,
                  type: "REFUEL",
                  liters,
                  percentageDelta: Math.round(delta * 100) / 100,
                  startLevel: Math.round(startAnchor * 100) / 100,
                  endLevel: Math.round(currentMed * 100) / 100,
                  latitude: virtualState.session.anchorLat ?? rec.latitude,
                  longitude: virtualState.session.anchorLng ?? rec.longitude,
                  timestamp:
                    virtualState.session.anchorTimestamp ??
                    (rec.timestamp as Date),
                });
                if (liveTripState.activeTrip) {
                  const tId = liveTripState.activeTrip.id;
                  tripMidRefuels.set(tId, (tripMidRefuels.get(tId) ?? 0) + liters);
                }
                virtualState.lastValidAnchorPercent = currentMed;
                virtualState.currentDisplayPercent = currentMed;
              }
            } else if (
              virtualState.session.type === "DRAIN" &&
              delta <= -8.0 &&
              !liveTripState.activeTrip &&
              !parsed.trueIgnition
            ) {
              const liters =
                Math.round(
                  ((Math.abs(delta) / 100.0) * vehicleUsableCapacity) * 100,
                ) / 100;
              if (liters >= 4.0) {
                fuelEventsToCreate.push({
                  id: uuidv7(),
                  vehicleId: vehicle.id,
                  tripId: null,
                  type: "DRAIN",
                  liters,
                  percentageDelta: Math.round(delta * 100) / 100,
                  startLevel: Math.round(startAnchor * 100) / 100,
                  endLevel: Math.round(currentMed * 100) / 100,
                  latitude: virtualState.session.anchorLat ?? rec.latitude,
                  longitude: virtualState.session.anchorLng ?? rec.longitude,
                  timestamp:
                    virtualState.session.anchorTimestamp ??
                    (rec.timestamp as Date),
                });
                virtualState.lastValidAnchorPercent = currentMed;
                virtualState.currentDisplayPercent = currentMed;
              }
            }
          }
          virtualState.session = {
            type: "NONE",
            startAnchor: null,
            stableCounter: 0,
            lastMedian: null,
          };
        }

        virtualState.vehicleState = "MOVING";
        virtualState.distanceAccumulator = 0;
        virtualState.timeAccumulator = 0;
        virtualState.segmentReadings = [];
      } else if (!isMoving && virtualState.vehicleState === "MOVING") {
        virtualState.vehicleState = "PARKED";
        virtualState.segmentReadings = [];
        virtualState.distanceAccumulator = 0;
        virtualState.timeAccumulator = 0;
      }

      // 4. Execution Path Based on Operational State
      if (virtualState.vehicleState === "MOVING") {
        if (!isSloshing) {
          virtualState.segmentReadings.push(rawFuelPercent);
        }
        virtualState.distanceAccumulator += distanceDeltaMeters;
        virtualState.timeAccumulator += timeDeltaSeconds;

        // Process segment calculation every 2.0 km (2000m) or 10 minutes (600s)
        const isDistanceLimit = virtualState.distanceAccumulator >= 2000;
        const isTimeLimit = virtualState.timeAccumulator >= 600;

        if (isDistanceLimit || isTimeLimit) {
          if (virtualState.segmentReadings.length > 0) {
            const currentMedian = calculateMedian(virtualState.segmentReadings);
            const fuelDelta =
              virtualState.currentDisplayPercent! - currentMedian;

            // Strictly enforce down-only consumption during movement
            if (fuelDelta > 0) {
              const alpha = mapping.movingFuelAlpha ?? 0.02;
              virtualState.currentDisplayPercent =
                alpha * currentMedian +
                (1 - alpha) * virtualState.currentDisplayPercent!;
            }
          }
          virtualState.distanceAccumulator = 0;
          virtualState.timeAccumulator = 0;
          virtualState.segmentReadings = [];
        }
      } else {
        // Stationary Logic: Settle data over a rolling buffer of 20 elements
        virtualState.segmentReadings.push(rawFuelPercent);
        if (virtualState.segmentReadings.length > 20) {
          virtualState.segmentReadings.shift();
        }

        const stableMedian = calculateMedian(virtualState.segmentReadings);
        const currentAnchor =
          virtualState.lastValidAnchorPercent ?? stableMedian;

        // Evaluate starting a session when no active session exists (requiring at least 6 settled readings to calm stopping slosh)
        if (!virtualState.session || virtualState.session.type === "NONE") {
          const parkedDelta = stableMedian - currentAnchor;
          const isSettled = virtualState.segmentReadings.length >= 6;

          if (isSettled && parkedDelta >= 8.0) {
            virtualState.session = {
              type: "REFUEL",
              startAnchor: currentAnchor,
              stableCounter: 0,
              lastMedian: stableMedian,
              anchorLat: rec.latitude,
              anchorLng: rec.longitude,
              anchorTimestamp: rec.timestamp as Date,
            };
          } else if (
            isSettled &&
            parkedDelta <= -8.0 &&
            !liveTripState.activeTrip &&
            !parsed.trueIgnition
          ) {
            virtualState.session = {
              type: "DRAIN",
              startAnchor: currentAnchor,
              stableCounter: 0,
              lastMedian: stableMedian,
              anchorLat: rec.latitude,
              anchorLng: rec.longitude,
              anchorTimestamp: rec.timestamp as Date,
            };
          }
        }

        // Process active Refuel/Drain session
        if (virtualState.session && virtualState.session.type !== "NONE") {
          virtualState.currentDisplayPercent = stableMedian;

          const startAnchor =
            virtualState.session.startAnchor ??
            virtualState.lastValidAnchorPercent ??
            stableMedian;
          const delta = stableMedian - startAnchor;

          // Rebound check: if reading moves back towards startAnchor, cancel candidate
          if (
            (virtualState.session.type === "DRAIN" && delta >= -3.0) ||
            (virtualState.session.type === "REFUEL" && delta <= 3.0)
          ) {
            virtualState.session = {
              type: "NONE",
              startAnchor: null,
              stableCounter: 0,
              lastMedian: null,
            };
          } else {
            const prevMed = virtualState.session.lastMedian ?? stableMedian;
            if (Math.abs(stableMedian - prevMed) <= 0.5) {
              virtualState.session.stableCounter++;
            } else {
              virtualState.session.stableCounter = 0;
            }
            virtualState.session.lastMedian = stableMedian;

            // Confirm and settle session after 4 consecutive stable readings (as soon as settled and verified)
            if (virtualState.session.stableCounter >= 4) {
              const sessionType = virtualState.session.type;

              if (sessionType === "REFUEL" && delta >= 8.0) {
                const liters =
                  Math.round(((delta / 100.0) * vehicleUsableCapacity) * 100) /
                  100;
                if (liters >= 4.0) {
                  fuelEventsToCreate.push({
                    id: uuidv7(),
                    vehicleId: vehicle.id,
                    tripId: liveTripState.activeTrip?.id ?? null,
                    type: "REFUEL",
                    liters,
                    percentageDelta: Math.round(delta * 100) / 100,
                    startLevel: Math.round(startAnchor * 100) / 100,
                    endLevel: Math.round(stableMedian * 100) / 100,
                    latitude: virtualState.session.anchorLat ?? rec.latitude,
                    longitude: virtualState.session.anchorLng ?? rec.longitude,
                    timestamp:
                      virtualState.session.anchorTimestamp ??
                      (rec.timestamp as Date),
                  });
                  if (liveTripState.activeTrip) {
                    const tId = liveTripState.activeTrip.id;
                    tripMidRefuels.set(
                      tId,
                      (tripMidRefuels.get(tId) ?? 0) + liters,
                    );
                  }
                }
              } else if (
                sessionType === "DRAIN" &&
                delta <= -8.0 &&
                !liveTripState.activeTrip &&
                !parsed.trueIgnition
              ) {
                const liters =
                  Math.round(
                    ((Math.abs(delta) / 100.0) * vehicleUsableCapacity) * 100,
                  ) / 100;
                if (liters >= 4.0) {
                  fuelEventsToCreate.push({
                    id: uuidv7(),
                    vehicleId: vehicle.id,
                    tripId: null,
                    type: "DRAIN",
                    liters,
                    percentageDelta: Math.round(delta * 100) / 100,
                    startLevel: Math.round(startAnchor * 100) / 100,
                    endLevel: Math.round(stableMedian * 100) / 100,
                    latitude: virtualState.session.anchorLat ?? rec.latitude,
                    longitude: virtualState.session.anchorLng ?? rec.longitude,
                    timestamp:
                      virtualState.session.anchorTimestamp ??
                      (rec.timestamp as Date),
                  });
                }
              }

              virtualState.lastValidAnchorPercent = stableMedian;
              virtualState.session = {
                type: "NONE",
                startAnchor: null,
                stableCounter: 0,
                lastMedian: null,
              };
            }
          }
        }
      }
    }

    previousState = {
      ignition: parsed.trueIgnition,
      unplugged: parsed.isUnplugged,
      rpm: parsed.rawRpm,
      excessiveIdling: parsed.isHardwareExcessiveIdling,
      odometer: parsed.odometer,
      engineHours: parsed.engineHours,
      fuelLevel: virtualState.currentDisplayPercent ?? parsed.fuelLevel,
      angle: recordAngle,
      latitude: rec.latitude,
      longitude: rec.longitude,
      timestamp: rec.timestamp as Date,
      tripActive: parsed.tripActive,
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
      rawLatitude: rec.rawLatitude ?? rec.latitude,
      rawLongitude: rec.rawLongitude ?? rec.longitude,
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
      maf: parsed.maf,
      throttlePosition: parsed.throttlePosition,
      intakeAirTemp: parsed.intakeAirTemp,
      intakeMap: parsed.intakeMap,
      ambientAirTemp: parsed.ambientAirTemp,
      barometricPressure: parsed.barometricPressure,
      oilTemp: parsed.oilTemp,
      fuelPressure: parsed.fuelPressure,
      shortFuelTrim: parsed.shortFuelTrim,
      vehicleWeight: parsed.vehicleWeight,
      odometer: parsed.odometer,
      engineHours: parsed.engineHours,
      dtcCount: parsed.dtcCount,
      faultCodes: parsed.faultCodes,
      fuelLevel: parsed.fuelLevel,
      fuelLevelLiters: parsed.fuelLevelLiters,
      fuelConsumption: parsed.fuelConsumption,
      fuelRate: parsed.fuelRate,
      accelX: parsed.accelX,
      accelY: parsed.accelY,
      accelZ: parsed.accelZ,
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
      eventId: rec.eventId ?? null,
      rawIoData: parsed.rawIoData,
      extra: {
        ...parsed.extraIoData,
        priority: rec.priority,
      },
    });
  }

  if (telemetryLogs.length === 0) return;

  // Calculate trip-level metrics for created or updated trips that have ended
  const allTripsToFinalize = new Map<string, any>();
  for (const [id, data] of tripsToCreate) {
    if (data.endTime) allTripsToFinalize.set(id, data);
  }
  for (const [id, data] of tripsToUpdate) {
    if (data.endTime) allTripsToFinalize.set(id, data);
  }

  for (const [tripId, tripObj] of allTripsToFinalize) {
    const batchLogs = telemetryLogs.filter((l: any) => l.tripId === tripId);
    let dbLogs: any[] = [];
    try {
      dbLogs = await prisma.telemetryLog.findMany({
        where: { tripId },
        select: {
          latitude: true,
          longitude: true,
          odometer: true,
          engineHours: true,
          fuelLevel: true,
          fuelConsumption: true,
        },
        orderBy: { timestamp: "asc" },
      });
    } catch (err: any) {
      // In case of query error, fall back to batch logs
    }

    const tripLogs = dbLogs.length > 0 ? [...dbLogs, ...batchLogs] : batchLogs;
    if (tripLogs.length > 0) {
      const firstLog = tripLogs[0];
      const lastLog = tripLogs[tripLogs.length - 1];

      let dist = Math.max(
        0,
        (lastLog.odometer ?? 0) - (firstLog.odometer ?? 0),
      );

      // Fallback: If odometer delta is 0 or null, calculate total polyline Haversine distance
      if (dist === 0 && tripLogs.length > 1) {
        let totalHaversineMeters = 0;
        for (let i = 0; i < tripLogs.length - 1; i++) {
          const p1 = tripLogs[i];
          const p2 = tripLogs[i + 1];
          if (
            p1.latitude != null &&
            p1.longitude != null &&
            p2.latitude != null &&
            p2.longitude != null
          ) {
            totalHaversineMeters +=
              haversineDistance(
                p1.latitude,
                p1.longitude,
                p2.latitude,
                p2.longitude,
              ) * 1000;
          }
        }
        dist = totalHaversineMeters / 1000.0;
      }

      const eh = Math.max(
        0,
        (lastLog.engineHours ?? 0) - (firstLog.engineHours ?? 0),
      );
      const startFuel = firstLog.fuelLevel;
      const endFuel = lastLog.fuelLevel;
      const capacity = vehicle.tankCapacity ?? 60;
      const usableCapacity = capacity * 0.9;

      let consumedLiters: number | null = null;
      if (
        startFuel !== null &&
        endFuel !== null &&
        startFuel !== undefined &&
        endFuel !== undefined
      ) {
        let midRefuels = tripMidRefuels.get(tripId) ?? 0;
        try {
          const prevEvents = await prisma.fuelEvent.findMany({
            where: { tripId, type: "REFUEL" },
            select: { liters: true },
          });
          for (const ev of prevEvents) {
            midRefuels += ev.liters;
          }
        } catch (err: any) {
          // En caso de error de consulta, usar los acumulados del lote
        }

        consumedLiters = Math.max(
          0,
          ((startFuel - endFuel) / 100.0) * usableCapacity + midRefuels,
        );
      }

      const efficiency =
        consumedLiters && consumedLiters > 0 ? dist / consumedLiters : null;

      tripObj.distanceKm = Math.round(dist * 100) / 100;
      tripObj.engineHours = Math.round(eh * 100) / 100;
      tripObj.startFuelLevel = startFuel;
      tripObj.endFuelLevel = endFuel;
      tripObj.fuelConsumedLiters =
        consumedLiters !== null ? Math.round(consumedLiters * 100) / 100 : null;
      tripObj.fuelEfficiencyKmL =
        efficiency !== null ? Math.round(efficiency * 100) / 100 : null;
    }
  }

  const lastRecord = telemetryLogs[telemetryLogs.length - 1];

  // 7. Defensive validation: Clean up logs pointing to concurrently deleted trips to prevent P2003
  await ensureReferencedTripsExist({
    prisma,
    vehicleId: vehicle.id,
    telemetryLogs,
    tripsToCreate,
    tripsToUpdate,
    tripsToDelete,
    tripsToMerge,
    liveTripState,
  });

  if (fuelEventsToCreate.length > 0) {
    for (const evt of fuelEventsToCreate) {
      const evtTime = new Date(evt.timestamp).getTime();
      const fallbackLat = evt.latitude;
      const fallbackLng = evt.longitude;

      // 1. Si ya contamos con una coordenada válida en fallback (estacionaria/ancla), la preservamos
      if (
        fallbackLat !== null &&
        fallbackLng !== null &&
        fallbackLat !== 0 &&
        fallbackLng !== 0 &&
        Math.abs(fallbackLat) > 0.0001
      ) {
        continue;
      }

      // 2. Prioridad 2: Buscar último punto con GPS válido en el lote actual anterior o igual al evento
      const arrival = [...telemetryLogs].reverse().find(
        (l: any) =>
          new Date(l.timestamp).getTime() <= evtTime &&
          l.latitude !== 0 &&
          l.longitude !== 0 &&
          Math.abs(l.latitude) > 0.0001,
      );

      if (arrival) {
        evt.latitude = arrival.latitude;
        evt.longitude = arrival.longitude;
      } else {
        // 3. Prioridad 3: Buscar en la base de datos el último registro con GPS válido anterior o igual al evento
        try {
          const dbArrival = await prisma.telemetryLog.findFirst({
            where: {
              vehicleId: vehicle.id,
              timestamp: {
                lte: new Date(evtTime),
              },
              latitude: { not: 0 },
              longitude: { not: 0 },
            },
            orderBy: { timestamp: "desc" },
            select: { latitude: true, longitude: true },
          });
          if (
            dbArrival &&
            dbArrival.latitude !== 0 &&
            dbArrival.longitude !== 0 &&
            Math.abs(dbArrival.latitude) > 0.0001
          ) {
            evt.latitude = dbArrival.latitude;
            evt.longitude = dbArrival.longitude;
          }
        } catch {
          // fallback a las coordenadas de evt
        }
      }
    }
  }

  await saveTelemetryBatchData({
    prisma,
    vehicle,
    telemetryLogs,
    tripsToCreate,
    tripsToUpdate,
    tripsToDelete,
    tripsToMerge,
    fuelEvents: fuelEventsToCreate,
    virtualState,
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

  notifyApi(vehicle, lastRecord, virtualState).catch((err) =>
    logger.error(`[Webhook] Error: ${err.message}`),
  );
}

interface ValidateTripsParams {
  prisma: PrismaClient;
  vehicleId: string;
  telemetryLogs: any[];
  tripsToCreate: Map<string, any>;
  tripsToUpdate: Map<string, any>;
  tripsToDelete: Set<string>;
  tripsToMerge: Map<string, string>;
  liveTripState: IngestionState;
}

/**
 * Valida de manera defensiva que todos los tripId referenciados en los registros (que no estén siendo creados en este lote)
 * realmente existan en la base de datos para evitar errores de restricción de clave foránea (P2003).
 */
async function ensureReferencedTripsExist({
  prisma,
  vehicleId,
  telemetryLogs,
  tripsToCreate,
  tripsToUpdate,
  tripsToDelete,
  tripsToMerge,
  liveTripState,
}: ValidateTripsParams) {
  // 1. Limpiar o reasignar en memoria los registros que apunten a viajes eliminados físicamente o fusionados en este lote
  for (const log of telemetryLogs) {
    if (log.tripId) {
      let currentTripId: string | undefined = log.tripId;
      const visited = new Set<string>();

      // Resolver cadenas de fusión recursivamente (evitando bucles infinitos)
      while (
        currentTripId &&
        tripsToMerge.has(currentTripId) &&
        !visited.has(currentTripId)
      ) {
        visited.add(currentTripId);
        currentTripId = tripsToMerge.get(currentTripId);
      }

      // Si el viaje destino final está programado para ser eliminado (viaje fantasma), no podemos usarlo
      if (currentTripId && tripsToDelete.has(currentTripId)) {
        log.tripId = null;
      } else {
        log.tripId = currentTripId ?? null;
      }
    }
  }

  const referencedTripIds: string[] = Array.from(
    new Set(
      telemetryLogs
        .map((log: any) => log.tripId)
        .filter((id): id is string => !!id && !tripsToCreate.has(id)),
    ),
  );

  if (referencedTripIds.length === 0) return;

  const existingTrips = await prisma.trip.findMany({
    where: { id: { in: referencedTripIds } },
    select: { id: true },
  });
  const existingTripIds = new Set(existingTrips.map((t) => t.id));

  // Limpiar tripId en los logs que apunten a viajes inexistentes en la base de datos o en tripsToDelete
  for (const log of telemetryLogs) {
    if (
      log.tripId &&
      !tripsToCreate.has(log.tripId) &&
      (!existingTripIds.has(log.tripId) || tripsToDelete.has(log.tripId))
    ) {
      log.tripId = null;
    }
  }

  // Limpiar los mapas de actualización/eliminación y las variables del estado actual/caché
  for (const tripId of referencedTripIds) {
    if (!existingTripIds.has(tripId)) {
      tripsToUpdate.delete(tripId);
      tripsToDelete.delete(tripId);

      if (liveTripState.activeTrip?.id === tripId) {
        liveTripState.activeTrip = undefined;
        activeTripsCache.delete(vehicleId);
      }
      if (liveTripState.lastClosedTrip?.id === tripId) {
        liveTripState.lastClosedTrip = undefined;
        lastClosedTripCache.delete(vehicleId);
      }
    }
  }
}
