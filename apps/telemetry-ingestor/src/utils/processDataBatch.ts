/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaClient } from "@vantx/database";
import { v7 as uuidv7 } from "uuid";
import { notifyApi } from "./notifyApi";
import {
  DEVICE_PROFILES,
  Logger,
  parseEcoAxesValue,
  mapObdFuelType,
} from "@vantx/telemetry-parser";
import { snapTelemetryRecords } from "./snapTelemetry";
import { saveTelemetryBatchData } from "./dbTelemetryWriter";

const prisma = new PrismaClient();
const logger = new Logger("Ingestor");

// Caché enriquecido: almacena id + startTime para evitar lecturas extra a la DB
const activeTripsCache = new Map<string, { id: string; startTime: Date }>();

// Guard 2: caché del último viaje cerrado por vehículo (para reapertura/debounce)
const lastClosedTripCache = new Map<
  string,
  { id: string; startTime: Date; closeTime: number }
>();

const MIN_TRIP_DURATION_MS = 60_000; // 1 minuto mínimo para que un viaje sea válido
const POST_CLOSE_DEBOUNCE_MS = 90_000; // 90 s de silencio tras el cierre

export async function processDataBatch(records: any[], imei: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { imei },
    select: {
      id: true,
      orgId: true,
      alias: true,
      deviceProfile: true,
      vin: true,
      fuelType: true,
    },
  });

  if (!vehicle) {
    logger.warn(`⚠️ Dropping packet. Unknown IMEI: ${imei}`);
    return;
  }

  // 1. Resolve mapping configuration using deviceProfile from database
  const mapping =
    DEVICE_PROFILES[vehicle.deviceProfile] ||
    DEVICE_PROFILES.TELTONIKA_STANDARD;

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

  let localActiveTrip = activeTripsCache.get(vehicle.id);
  let localLastClosedTrip = lastClosedTripCache.get(vehicle.id);
  let currentTrip = localActiveTrip;

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
    // Resolve dynamic values from mapping config
    const rawRpm =
      mapping.rpm !== undefined ? (rec.ioData[mapping.rpm] ?? 0) : 0;
    const rawVoltage =
      mapping.voltage !== undefined ? (rec.ioData[mapping.voltage] ?? 0) : 0;
    const rawIgnitionPin =
      mapping.ignition !== undefined
        ? rec.ioData[mapping.ignition] === 1
        : false;
    const movement =
      mapping.movement !== undefined
        ? rec.ioData[mapping.movement] === 1
        : false;
    const obdSpeed =
      mapping.obdSpeed !== undefined
        ? (rec.ioData[mapping.obdSpeed] ?? null)
        : null;
    const speedToUse = obdSpeed ?? rec.gpsSpeed;
    const isHardwareExcessiveIdling =
      mapping.excessiveIdling !== undefined
        ? rec.eventId === mapping.excessiveIdling ||
          rec.ioData[mapping.excessiveIdling] === 1
        : false;
    const engineLoad =
      mapping.engineLoad !== undefined
        ? (rec.ioData[mapping.engineLoad] ?? null)
        : null;

    let coolantTemp =
      mapping.coolantTemp !== undefined
        ? (rec.ioData[mapping.coolantTemp] ?? null)
        : null;

    // Scale LVCAN Engine Temperature (AVL ID 115) from 1/10 °C to Celsius degrees
    if (mapping.coolantTemp === 115 && coolantTemp !== null) {
      coolantTemp = coolantTemp / 10.0;
    }

    const odometer =
      mapping.odometer !== undefined && rec.ioData[mapping.odometer] != null
        ? rec.ioData[mapping.odometer] / 1000.0
        : null;
    const vin =
      mapping.vin !== undefined ? (rec.ioData[mapping.vin] ?? null) : null;
    const dtcCount =
      mapping.dtcCount !== undefined ? (rec.ioData[mapping.dtcCount] ?? 0) : 0;
    const faultCodes =
      mapping.faultCodes !== undefined
        ? (rec.ioData[mapping.faultCodes] ?? null)
        : null;
    const powerSupply = rawVoltage / 1000;
    const isUnplugged =
      mapping.unplugged !== undefined
        ? rec.ioData[mapping.unplugged] === 1
        : false;

    // Detect if device reports a new VIN and the vehicle does not currently have one set
    if (
      !vehicle.vin &&
      vin &&
      typeof vin === "string" &&
      vin.trim() !== "" &&
      !newVinDetected
    ) {
      newVinDetected = vin.trim();
    }

    // Detectar si el dispositivo reporta un nuevo tipo de combustible y el vehículo no lo tiene configurado aún
    const rawFuelType =
      mapping.fuelType !== undefined ? rec.ioData[mapping.fuelType] : null;
    const detectedFuelType = mapObdFuelType(rawFuelType);
    if (!vehicle.fuelType && detectedFuelType && !newFuelTypeDetected) {
      newFuelTypeDetected = detectedFuelType;
    }

    // Eco Driving
    const ecoDrivingType =
      mapping.ecoDrivingType !== undefined
        ? rec.ioData[mapping.ecoDrivingType]
        : undefined;
    const rawSeverity =
      mapping.ecoDrivingValueMax !== undefined
        ? rec.ioData[mapping.ecoDrivingValueMax]
        : undefined;
    const ecoDrivingSeverity = parseEcoAxesValue(rawSeverity) ?? 10;
    const ecoDrivingDuration =
      mapping.ecoDrivingDuration !== undefined
        ? (rec.ioData[mapping.ecoDrivingDuration] ?? null)
        : null;
    const rawAverage =
      mapping.ecoDrivingAverage !== undefined
        ? rec.ioData[mapping.ecoDrivingAverage]
        : undefined;
    const ecoDrivingAverage = parseEcoAxesValue(rawAverage);

    let harshAcceleration = 0;
    let harshBraking = 0;
    let harshCornering = 0;
    let harshAccelerationDuration: number | null = null;
    let harshBrakingDuration: number | null = null;
    let harshCorneringDuration: number | null = null;
    let harshAccelerationAverage: number | null = null;
    let harshBrakingAverage: number | null = null;
    let harshCorneringAverage: number | null = null;

    if (ecoDrivingType === 1) {
      harshAcceleration = ecoDrivingSeverity;
      harshAccelerationDuration = ecoDrivingDuration;
      harshAccelerationAverage = ecoDrivingAverage;
    } else if (ecoDrivingType === 2) {
      harshBraking = ecoDrivingSeverity;
      harshBrakingDuration = ecoDrivingDuration;
      harshBrakingAverage = ecoDrivingAverage;
    } else if (ecoDrivingType === 3) {
      harshCornering = ecoDrivingSeverity;
      harshCorneringDuration = ecoDrivingDuration;
      harshCorneringAverage = ecoDrivingAverage;
    }

    const trueIgnition =
      rawIgnitionPin ||
      rawRpm > 400 ||
      (mapping.ignition === undefined && rawVoltage > 13200) ||
      isHardwareExcessiveIdling;

    // Movement Status
    let status = "STOPPED";
    if (isUnplugged) {
      status = "UNPLUGGED";
    } else if (trueIgnition) {
      if (movement || speedToUse > 2) {
        status = "MOVING";
      } else if (isHardwareExcessiveIdling) {
        status = "EXCESSIVE_IDLING";
      } else {
        status = "IDLING";
      }
    }

    // Dynamic Extra Payload Deduplication
    const extraIoData = { ...rec.ioData };
    Object.values(mapping).forEach((avlId) => {
      if (avlId !== undefined) {
        delete extraIoData[avlId];
      }
    });

    // Hardware-based Trip Detection (AVL ID 250) or Ignition Fallback
    const tripActive =
      mapping.tripStatus !== undefined &&
      rec.ioData[mapping.tripStatus] !== undefined
        ? rec.ioData[mapping.tripStatus] === 1
        : trueIgnition;

    // Lógica de Viajes (Trips)
    // Guard: Si el viaje actual en memoria inició después del timestamp de este registro,
    // significa que este registro pertenece al pasado (diferido) y no al viaje activo actual.
    const isRecordBeforeCurrentTrip =
      currentTrip &&
      (rec.timestamp as Date).getTime() < currentTrip.startTime.getTime();
    const effectiveTrip = isRecordBeforeCurrentTrip ? undefined : currentTrip;

    if (!effectiveTrip && tripActive) {
      // Guard 2: verificar si podemos reabrir un viaje cerrado recientemente (dentro del debounce)
      const lastClosed = localLastClosedTrip;
      const recTimeMs = (rec.timestamp as Date).getTime();

      if (
        lastClosed &&
        recTimeMs - lastClosed.closeTime < POST_CLOSE_DEBOUNCE_MS
      ) {
        const reopenedTripId = lastClosed.id;
        currentTrip = { id: reopenedTripId, startTime: lastClosed.startTime };
        localActiveTrip = currentTrip;

        // Restaurar estado si fue marcado como eliminado o descartado
        tripsToDelete.delete(reopenedTripId);

        if (newTripsCreatedInBatch.has(reopenedTripId)) {
          // Si se creó en este mismo lote, lo volvemos a poner para creación
          tripsToCreate.set(reopenedTripId, {
            id: reopenedTripId,
            startTime: lastClosed.startTime,
          });
        } else {
          // Si ya existía en la DB, limpiamos su endTime
          tripsToUpdate.set(reopenedTripId, {
            id: reopenedTripId,
            endTime: null,
          });
        }

        // Remover del caché de cierre ya que vuelve a estar activo
        localLastClosedTrip = undefined;
        logger.log(`🚗 Viaje Reabierto (Diferido): ${vehicle.alias}`);
      } else {
        const newTripId = uuidv7();
        currentTrip = { id: newTripId, startTime: rec.timestamp };
        localActiveTrip = currentTrip;
        newTripsCreatedInBatch.add(newTripId);
        tripsToCreate.set(newTripId, {
          id: newTripId,
          startTime: rec.timestamp,
        });
        logger.log(`🚗 Viaje Iniciado (Diferido): ${vehicle.alias}`);
      }
    } else if (effectiveTrip && !tripActive) {
      // Guard 1: calcular duración desde caché — sin lectura extra a la DB
      const durationMs =
        (rec.timestamp as Date).getTime() - effectiveTrip.startTime.getTime();
      const tripId = effectiveTrip.id;

      if (durationMs < MIN_TRIP_DURATION_MS) {
        // Viaje fantasma
        if (newTripsCreatedInBatch.has(tripId)) {
          // Si se creó en este lote, simplemente se descarta en memoria
          tripsToCreate.delete(tripId);
          logger.log(
            `👻 Viaje fantasma descartado en memoria: ${vehicle.alias} (${durationMs}ms)`,
          );
        } else {
          // Si ya existía en la DB, se programa para eliminación física
          tripsToDelete.add(tripId);
          tripsToUpdate.delete(tripId);
          logger.log(
            `👻 Viaje fantasma en DB programado para eliminación: ${vehicle.alias} (${durationMs}ms)`,
          );
        }

        // Limpiar el tripId de cualquier log de telemetría agregado en este lote con este tripId
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
        logger.log(`🛑 Viaje Finalizado (Diferido): ${vehicle.alias}`);
      }

      // Registrar info de cierre para el debounce / posible reapertura
      localLastClosedTrip = {
        id: tripId,
        startTime: effectiveTrip.startTime,
        closeTime: (rec.timestamp as Date).getTime(),
      };
      currentTrip = undefined;
      localActiveTrip = undefined;
    }

    const recordTripId =
      currentTrip &&
      (rec.timestamp as Date).getTime() >= currentTrip.startTime.getTime()
        ? currentTrip.id
        : null;

    telemetryLogs.push({
      vehicleId: vehicle.id,
      tripId: recordTripId,
      timestamp: rec.timestamp,
      latitude: rec.latitude,
      longitude: rec.longitude,
      angle: rec.angle,
      speed: speedToUse,
      gpsSpeed: rec.gpsSpeed,
      ignition: trueIgnition,
      movement,
      unplugged: isUnplugged,
      status,
      rpm: rawRpm === 0 ? null : rawRpm,
      engineLoad,
      coolantTemp,
      odometer,
      dtcCount,
      faultCodes,
      altitude: rec.altitude,
      satellites: rec.satellites,
      powerSupply,
      harshAcceleration,
      harshBraking,
      harshCornering,
      harshAccelerationDuration,
      harshBrakingDuration,
      harshCorneringDuration,
      harshAccelerationAverage,
      harshBrakingAverage,
      harshCorneringAverage,
      extra: {
        ...extraIoData,
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
  if (localActiveTrip) {
    activeTripsCache.set(vehicle.id, localActiveTrip);
  } else {
    activeTripsCache.delete(vehicle.id);
  }

  if (localLastClosedTrip) {
    lastClosedTripCache.set(vehicle.id, localLastClosedTrip);
  } else {
    lastClosedTripCache.delete(vehicle.id);
  }

  // El WebSocket ahora escupirá EXCESSIVE_IDLING sin titubear
  notifyApi(vehicle, lastRecord).catch((err) =>
    logger.error(`[Webhook] Error: ${err.message}`),
  );
}
