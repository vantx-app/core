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
import { parseTelemetryRecord } from "./telemetryParser";
import { transitionTripState, TripState } from "./tripStateMachine";

const prisma = new PrismaClient();
const logger = new Logger("Ingestor");

// Caché enriquecido: almacena id + startTime para evitar lecturas extra a la DB
const activeTripsCache = new Map<string, { id: string; startTime: Date }>();

// Guard 2: caché del último viaje cerrado por vehículo (para reapertura/debounce)
const lastClosedTripCache = new Map<
  string,
  { id: string; startTime: Date; closeTime: number }
>();

// Active promise chain queue per IMEI to serialize concurrent ingestion requests locally
const ingestionQueue = new Map<string, Promise<void>>();

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
      device: {
        select: {
          model: true,
        },
      },
    },
  });

  if (!vehicle) {
    logger.warn(`⚠️ Dropping packet. Unknown IMEI: ${imei}`);
    return;
  }

  // 1. Resolve mapping configuration using deviceModel from database
  const profileName = getTelemetryProfile(vehicle.device?.model);
  const mapping =
    DEVICE_PROFILES[profileName] || DEVICE_PROFILES.TELTONIKA_STANDARD;

  // 2. Perform Local Road Snapping using optimized chunked queries
  const snappedRecords = await snapTelemetryRecords(records, prisma, mapping);

  // Mecanismo anti-reinicio de Docker para los viajes
  if (!activeTripsCache.has(vehicle.id)) {
    const activeTrip = await prisma.trip.findFirst({
      where: {
        vehicleId: vehicle.id,
        endTime: null, // Buscamos si quedó un viaje a la mitad
      },
      orderBy: { startTime: "desc" },
      select: { id: true, startTime: true },
    });

    if (activeTrip) {
      activeTripsCache.set(vehicle.id, {
        id: activeTrip.id,
        startTime: activeTrip.startTime,
      });
    }
  }

  const localActiveTrip = activeTripsCache.get(vehicle.id);
  const localLastClosedTrip = lastClosedTripCache.get(vehicle.id);

  // Wrappers de estado mutables para pasar por referencia
  const liveTripState: TripState = {
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

  const historicalTripState: TripState = {
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
  let newVinDetected: string | null = null;
  let newFuelTypeDetected:
    | "GASOLINE"
    | "DIESEL"
    | "ELECTRIC"
    | "HYBRID"
    | null = null;

  // Sort copies of records rather than mutating the original array
  const sortedRecords = [...snappedRecords].sort(
    (a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime(),
  );
  const telemetryLogs: any = [];

  // MÁQUINA DE ESTADOS PURA (Mapeo dinámico y hardware trip status)
  for (const rec of sortedRecords) {
    const parsed = parseTelemetryRecord(rec, mapping);

    // Detect if device reports a new VIN and the vehicle does not currently have one set
    if (
      !vehicle.vin &&
      parsed.vin &&
      typeof parsed.vin === "string" &&
      parsed.vin.trim() !== "" &&
      !newVinDetected
    ) {
      newVinDetected = parsed.vin.trim();
    }

    // Detectar si el dispositivo reporta un nuevo tipo de combustible y el vehículo no lo tiene configurado aún
    if (!vehicle.fuelType && parsed.detectedFuelType && !newFuelTypeDetected) {
      newFuelTypeDetected = parsed.detectedFuelType;
    }

    // Lógica de Viajes (Trips)
    // Guard: Si el viaje actual en memoria inició después del timestamp de este registro,
    // significa que este registro pertenece al pasado (diferido) y no al viaje activo actual.
    const isRecordBeforeCurrentTrip =
      liveTripState.activeTrip &&
      (rec.timestamp as Date).getTime() <
        liveTripState.activeTrip.startTime.getTime();

    let recordTripId: string | null = null;

    if (isRecordBeforeCurrentTrip) {
      // PROCESAMIENTO HISTÓRICO (DIFERIDO) PASIVO
      recordTripId = transitionTripState({
        rec,
        tripActive: parsed.tripActive,
        vehicleAlias: vehicle.alias || "",
        state: historicalTripState,
        newTripsCreatedInBatch,
        tripsToCreate,
        tripsToUpdate,
        tripsToDelete,
        telemetryLogs,
        isHistorical: true,
      });
    } else {
      // PROCESAMIENTO LIVE / ESTÁNDAR
      recordTripId = transitionTripState({
        rec,
        tripActive: parsed.tripActive,
        vehicleAlias: vehicle.alias || "",
        state: liveTripState,
        newTripsCreatedInBatch,
        tripsToCreate,
        tripsToUpdate,
        tripsToDelete,
        telemetryLogs,
        isHistorical: false,
      });
    }

    telemetryLogs.push({
      vehicleId: vehicle.id,
      tripId: recordTripId,
      timestamp: rec.timestamp,
      latitude: rec.latitude,
      longitude: rec.longitude,
      angle: rec.angle,
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

  // 3. Persist the parsed logs and status states in a Postgres transaction
  await saveTelemetryBatchData({
    prisma,
    vehicle,
    telemetryLogs,
    tripsToCreate,
    tripsToUpdate,
    tripsToDelete,
    newVinDetected,
    newFuelTypeDetected,
  });

  // Actualizar cachés globales solo tras escritura exitosa en DB
  if (liveTripState.activeTrip) {
    activeTripsCache.set(vehicle.id, {
      id: liveTripState.activeTrip.id,
      startTime: liveTripState.activeTrip.startTime,
    });
  } else {
    activeTripsCache.delete(vehicle.id);
  }

  if (liveTripState.lastClosedTrip) {
    lastClosedTripCache.set(vehicle.id, {
      id: liveTripState.lastClosedTrip.id,
      startTime: liveTripState.lastClosedTrip.startTime,
      closeTime: liveTripState.lastClosedTrip.closeTime,
    });
  } else {
    lastClosedTripCache.delete(vehicle.id);
  }

  // El WebSocket ahora escupirá EXCESSIVE_IDLING sin titubear
  notifyApi(vehicle, lastRecord).catch((err) =>
    logger.error(`[Webhook] Error: ${err.message}`),
  );
}
