import { Prisma, PrismaClient } from "@vantx/database";

export interface TelemetryBatchWriteParams {
  prisma: PrismaClient;
  vehicle: {
    id: string;
    alias: string | null;
    isOdometerAbsolute: boolean;
    odometerSource: string;
    capabilities: any;
  };
  telemetryLogs: any[];
  tripsToCreate: Map<string, { id: string; startTime: Date; endTime?: Date }>;
  tripsToUpdate: Map<string, { id: string; endTime: Date | null }>;
  tripsToDelete: Set<string>;
  tripsToMerge?: Map<string, string>;
  newVinDetected: string | null;
  newFuelTypeDetected: "GASOLINE" | "DIESEL" | "ELECTRIC" | "HYBRID" | null;
}

export async function saveTelemetryBatchData({
  prisma,
  vehicle,
  telemetryLogs,
  tripsToCreate,
  tripsToUpdate,
  tripsToDelete,
  tripsToMerge,
  newVinDetected,
  newFuelTypeDetected,
}: TelemetryBatchWriteParams) {
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
      prisma.trip.updateMany({
        where: { id: tripData.id },
        data: {
          endTime: tripData.endTime,
        },
      }),
    );
  }

  // 2.5 Update telemetry logs of merged trips to point to the primary trip
  if (tripsToMerge) {
    for (const [dupTripId, primaryTripId] of tripsToMerge) {
      transactionPromises.push(
        prisma.telemetryLog.updateMany({
          where: { tripId: dupTripId },
          data: { tripId: primaryTripId },
        }),
      );
    }
  }

  // 3. Clear tripId on telemetry logs in the DB for deleted ghost trips (to avoid FK constraints)
  for (const tripId of tripsToDelete) {
    if (tripsToMerge && tripsToMerge.has(tripId)) {
      continue;
    }
    transactionPromises.push(
      prisma.telemetryLog.updateMany({
        where: { tripId },
        data: { tripId: null },
      }),
    );
  }

  // 3.5 Delete daily telemetry rollups for deleted ghost/merged trips to avoid unique constraint violation on tripId = null
  if (tripsToDelete.size > 0) {
    transactionPromises.push(
      prisma.dailyTelemetryRollup.deleteMany({
        where: {
          tripId: {
            in: Array.from(tripsToDelete),
          },
        },
      }),
    );
  }

  // 4. Delete the ghost trips physically
  for (const tripId of tripsToDelete) {
    transactionPromises.push(
      prisma.trip.deleteMany({
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
        lastFuelLevel: lastRecord.fuelLevel,
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
        lastFuelLevel: lastRecord.fuelLevel,
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

  // Auto-detectar capacidades dinámicas soportadas a partir de las columnas normalizadas
  const detectedKeys = new Set<string>(["gps"]); // GPS siempre está soportado
  telemetryLogs.forEach((log) => {
    if (log.rpm !== null) detectedKeys.add("rpm");
    if (log.odometer !== null) detectedKeys.add("odometer");
    if (log.coolantTemp !== null) detectedKeys.add("coolantTemp");
    if (log.fuelLevel !== null) detectedKeys.add("fuelLevel");
    if (log.fuelConsumption !== null) detectedKeys.add("fuelConsumption");
    if (log.fuelRate !== null) detectedKeys.add("fuelRate");
  });

  // Comparar y mezclar con las capacidades existentes del vehículo
  const currentCapabilities = new Set<string>(
    Array.isArray(vehicle.capabilities) ? vehicle.capabilities : []
  );
  let capabilitiesChanged = false;
  detectedKeys.forEach((key) => {
    if (!currentCapabilities.has(key)) {
      currentCapabilities.add(key);
      capabilitiesChanged = true;
    }
  });

  if (capabilitiesChanged) {
    vehicleUpdateData.capabilities = Array.from(currentCapabilities);
  }

  // Auto-detectar si el dispositivo está enviando el odómetro real del tablero (> 1000 km)
  if (
    lastRecord.odometer !== null &&
    lastRecord.odometer > 1000 &&
    !vehicle.isOdometerAbsolute
  ) {
    vehicleUpdateData.isOdometerAbsolute = true;
  }

  if (Object.keys(vehicleUpdateData).length > 0) {
    transactionPromises.push(
      prisma.vehicle.update({
        where: { id: vehicle.id },
        data: vehicleUpdateData,
      }),
    );
  }

  // Execute database transaction atomically
  await prisma.$transaction(transactionPromises);
}
