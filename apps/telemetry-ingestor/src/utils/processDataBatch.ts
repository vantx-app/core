/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Prisma, PrismaClient } from '@vantx/database';
import { v7 as uuidv7 } from 'uuid';
import { notifyApi } from './notifyApi';
import { DEVICE_PROFILES, Logger, parseEcoAxesValue, mapObdFuelType } from '@vantx/telemetry-parser';

const prisma = new PrismaClient();
const logger = new Logger('Ingestor');

// Caché enriquecido: almacena id + startTime para evitar lecturas extra a la DB
const activeTripsCache = new Map<string, { id: string; startTime: Date }>();

// Guard 2: timestamp del último cierre por vehículo (para debounce post-apagado)
const tripCloseTimeCache = new Map<string, number>();

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

  // Resolve mapping configuration using deviceProfile from database
  const mapping =
    DEVICE_PROFILES[vehicle.deviceProfile] ||
    DEVICE_PROFILES.TELTONIKA_STANDARD;

  // Mecanismo anti-reinicio de Docker para los viajes
  if (!activeTripsCache.has(vehicle.id)) {
    const activeTrip = await prisma.trip.findFirst({
      where: {
        vehicleId: vehicle.id,
        endTime: null, // Buscamos si quedó un viaje a la mitad
      },
      orderBy: { startTime: 'desc' },
      select: { id: true, startTime: true },
    });

    if (activeTrip) {
      activeTripsCache.set(vehicle.id, {
        id: activeTrip.id,
        startTime: activeTrip.startTime,
      });
    }
  }

  let currentTrip = activeTripsCache.get(vehicle.id);
  const newTripsCreatedInBatch = new Set<string>();
  const tripsToCreate = new Map<
    string,
    { id: string; startTime: Date; endTime?: Date }
  >();
  const tripsToUpdate = new Map<string, { id: string; endTime: Date }>();
  const tripsToDelete = new Set<string>();
  let newVinDetected: string | null = null;
  let newFuelTypeDetected:
    | 'GASOLINE'
    | 'DIESEL'
    | 'ELECTRIC'
    | 'HYBRID'
    | null = null;

  records.sort(
    (a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime(),
  );
  const telemetryLogs: any = [];

  // MÁQUINA DE ESTADOS PURA (Mapeo dinámico y hardware trip status)
  for (const rec of records) {
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
    const coolantTemp =
      mapping.coolantTemp !== undefined
        ? (rec.ioData[mapping.coolantTemp] ?? null)
        : null;
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
      typeof vin === 'string' &&
      vin.trim() !== '' &&
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
    let status = 'STOPPED';
    if (isUnplugged) {
      status = 'UNPLUGGED';
    } else if (trueIgnition) {
      if (movement || speedToUse > 2) {
        status = 'MOVING';
      } else if (isHardwareExcessiveIdling) {
        status = 'EXCESSIVE_IDLING';
      } else {
        status = 'IDLING';
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
    if (!currentTrip && tripActive) {
      // Guard 2: ignorar reaperturas dentro del período de debounce post-apagado
      const lastClose = tripCloseTimeCache.get(vehicle.id);
      const recTimeMs = (rec.timestamp as Date).getTime();

      if (lastClose && recTimeMs - lastClose < POST_CLOSE_DEBOUNCE_MS) {
        logger.log(`🔇 Debounce activo, reapertura ignorada: ${vehicle.alias}`);
      } else {
        const newTripId = uuidv7();
        currentTrip = { id: newTripId, startTime: rec.timestamp };
        activeTripsCache.set(vehicle.id, currentTrip);
        newTripsCreatedInBatch.add(newTripId);
        tripsToCreate.set(newTripId, {
          id: newTripId,
          startTime: rec.timestamp,
        });
        logger.log(`🚗 Viaje Iniciado (Diferido): ${vehicle.alias}`);
      }
    } else if (currentTrip && !tripActive) {
      // Guard 1: calcular duración desde caché — sin lectura extra a la DB
      const durationMs =
        (rec.timestamp as Date).getTime() - currentTrip.startTime.getTime();

      if (durationMs < MIN_TRIP_DURATION_MS) {
        // Viaje fantasma
        const tripId = currentTrip.id;
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
        const tripId = currentTrip.id;
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

      // Registrar tiempo de cierre para el debounce (Guard 2)
      tripCloseTimeCache.set(vehicle.id, (rec.timestamp as Date).getTime());
      currentTrip = undefined;
      activeTripsCache.delete(vehicle.id);
    }

    telemetryLogs.push({
      vehicleId: vehicle.id,
      tripId: currentTrip?.id ?? null,
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

  const transactionPromises: Prisma.PrismaPromise<any>[] = [];

  // 1. Create new trips (must be first so telemetry logs can resolve their FK)
  for (const [_, tripData] of tripsToCreate) {
    transactionPromises.push(
      prisma.trip.create({
        data: {
          id: tripData.id,
          vehicleId: vehicle.id,
          startTime: tripData.startTime,
          endTime: tripData.endTime,
        },
      }),
    );
  }

  // 2. Update existing trips (endTime)
  for (const [_, tripData] of tripsToUpdate) {
    transactionPromises.push(
      prisma.trip.update({
        where: { id: tripData.id },
        data: {
          endTime: tripData.endTime,
        },
      }),
    );
  }

  // 3. Clear tripId on telemetry logs in the DB for deleted ghost trips (to avoid FK constraints)
  for (const tripId of tripsToDelete) {
    transactionPromises.push(
      prisma.telemetryLog.updateMany({
        where: { tripId },
        data: { tripId: null },
      }),
    );
  }

  // 4. Delete the ghost trips physically
  for (const tripId of tripsToDelete) {
    transactionPromises.push(
      prisma.trip.delete({
        where: { id: tripId },
      }),
    );
  }

  // 5. Create the telemetry logs
  transactionPromises.push(
    prisma.telemetryLog.createMany({ data: telemetryLogs }),
  );

  // 6. Update vehicle live state
  transactionPromises.push(
    prisma.vehicleLiveState.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        lastLat: lastRecord.latitude,
        lastLng: lastRecord.longitude,
        lastAngle: lastRecord.angle,
        lastSpeed: lastRecord.speed,
        lastIgnition: lastRecord.ignition,
        unplugged: lastRecord.unplugged,
        currentStatus: lastRecord.status,
        lastOdometer: lastRecord.odometer,
        lastUpdate: lastRecord.timestamp,
      },
      create: {
        vehicleId: vehicle.id,
        lastLat: lastRecord.latitude,
        lastLng: lastRecord.longitude,
        lastAngle: lastRecord.angle,
        lastSpeed: lastRecord.speed,
        lastIgnition: lastRecord.ignition,
        unplugged: lastRecord.unplugged,
        currentStatus: lastRecord.status,
        lastOdometer: lastRecord.odometer,
        lastUpdate: lastRecord.timestamp,
      },
    }),
  );

  const vehicleUpdateData: any = {};
  if (newVinDetected) {
    vehicleUpdateData.vin = newVinDetected;
  }
  if (newFuelTypeDetected) {
    vehicleUpdateData.fuelType = newFuelTypeDetected;
  }

  if (Object.keys(vehicleUpdateData).length > 0) {
    transactionPromises.push(
      prisma.vehicle.update({
        where: { id: vehicle.id },
        data: vehicleUpdateData,
      }),
    );
  }

  // PERSISTENCIA TRANSACCIONAL MASIVA
  await prisma.$transaction(transactionPromises);

  // El WebSocket ahora escupirá EXCESSIVE_IDLING sin titubear
  notifyApi(vehicle, lastRecord).catch((err) =>
    logger.error(`[Webhook] Error: ${err.message}`),
  );
}
