import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, FuelEventType } from '@vantx/database';
import { v7 as uuidv7 } from 'uuid';

// Cargar variables de entorno desde .env local o raíz del proyecto
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index === -1) return;
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
      console.log(`[INFO] Archivo .env cargado desde: ${envPath}`);
      return;
    }
  }
}

loadEnv();

const prisma = new PrismaClient();

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2;
}

interface FuelVirtualState {
  currentDisplayPercent: number | null;
  lastValidAnchorPercent: number | null;
  vehicleState: 'PARKED' | 'MOVING';
  segmentReadings: number[];
  distanceAccumulator: number;
  timeAccumulator: number;
  ignitionOnTime: number | null;
  ignitionOnReadings: number[];
  session: {
    type: 'REFUEL' | 'DRAIN' | 'NONE';
    startAnchor: number | null;
    stableCounter: number;
    lastMedian: number | null;
  };
}

async function processVehicleFuelHistory(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      alias: true,
      plateNumber: true,
      tankCapacity: true,
    },
  });

  if (!vehicle) {
    console.error(`[ERROR] Vehículo con ID ${vehicleId} no encontrado.`);
    return;
  }

  const capacity = vehicle.tankCapacity ?? 60;
  const usableCapacity = capacity * 0.9;

  console.log(
    `\n================================================================================`,
  );
  console.log(
    `[INFO] Procesando historial para: ${vehicle.alias || vehicle.plateNumber || vehicle.id}`,
  );
  console.log(
    `[INFO] Capacidad de tanque: ${capacity} L (Útil calculada: ${usableCapacity.toFixed(1)} L)`,
  );

  // 1. Limpiar eventos existentes generados previamente para evitar duplicados
  const deleted = await prisma.fuelEvent.deleteMany({
    where: { vehicleId: vehicle.id },
  });
  console.log(`[INFO] Eventos previos eliminados: ${deleted.count}`);

  // 2. Obtener todos los registros de telemetría con nivel de combustible en orden cronológico
  const logs = await prisma.telemetryLog.findMany({
    where: {
      vehicleId: vehicle.id,
      fuelLevel: { not: null },
    },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      tripId: true,
      timestamp: true,
      fuelLevel: true,
      speed: true,
      ignition: true,
      latitude: true,
      longitude: true,
      accelX: true,
      accelY: true,
      odometer: true,
    },
  });

  console.log(
    `[INFO] Registros de telemetría con combustible encontrados: ${logs.length}`,
  );
  if (logs.length === 0) return;

  // 3. Inicializar la máquina de estados cinemática de combustible
  const initialLevel = logs[0].fuelLevel!;
  const virtualState: FuelVirtualState = {
    currentDisplayPercent: initialLevel,
    lastValidAnchorPercent: initialLevel,
    vehicleState: 'PARKED',
    segmentReadings: [],
    distanceAccumulator: 0,
    timeAccumulator: 0,
    ignitionOnTime: null,
    ignitionOnReadings: [],
    session: {
      type: 'NONE',
      startAnchor: null,
      stableCounter: 0,
      lastMedian: null,
    },
  };

  const fuelEventsToInsert: Array<{
    id: string;
    vehicleId: string;
    tripId: string | null;
    type: FuelEventType;
    liters: number;
    percentageDelta: number;
    startLevel: number;
    endLevel: number;
    latitude: number | null;
    longitude: number | null;
    timestamp: Date;
  }> = [];

  let previousIgnition = false;
  let previousTimestamp = logs[0].timestamp.getTime();

  for (const log of logs) {
    const rawFuel = log.fuelLevel!;
    const logTimeMs = log.timestamp.getTime();
    const timeDeltaSeconds = Math.max(0, (logTimeMs - previousTimestamp) / 1000);
    previousTimestamp = logTimeMs;

    // 3.1 Ventana de observación al encender ignición (60s)
    const isTransitionIgnition = log.ignition && !previousIgnition;
    previousIgnition = log.ignition ?? false;

    if (isTransitionIgnition) {
      virtualState.ignitionOnTime = logTimeMs;
      virtualState.ignitionOnReadings = [rawFuel];
    } else if (virtualState.ignitionOnTime !== null) {
      const elapsedMs = logTimeMs - virtualState.ignitionOnTime;
      if (elapsedMs <= 60000) {
        if ((log.speed ?? 0) <= 5) {
          virtualState.ignitionOnReadings.push(rawFuel);
        }
      } else {
        // Ventana de observación finalizada
        if (virtualState.ignitionOnReadings.length > 0) {
          const calibratedAnchor = calculateMedian(
            virtualState.ignitionOnReadings,
          );
          const anchorDiff =
            calibratedAnchor -
            (virtualState.lastValidAnchorPercent ?? calibratedAnchor);

          if (anchorDiff >= 4.0) {
            const liters =
              Math.round(((anchorDiff / 100.0) * usableCapacity) * 100) / 100;
            fuelEventsToInsert.push({
              id: uuidv7(),
              vehicleId: vehicle.id,
              tripId: log.tripId ?? null,
              type: FuelEventType.REFUEL,
              liters,
              percentageDelta: Math.round(anchorDiff * 100) / 100,
              startLevel:
                Math.round(
                  (virtualState.lastValidAnchorPercent ?? calibratedAnchor) *
                    100,
                ) / 100,
              endLevel: Math.round(calibratedAnchor * 100) / 100,
              latitude: log.latitude,
              longitude: log.longitude,
              timestamp: log.timestamp,
            });
          } else if (anchorDiff <= -4.0) {
            const liters =
              Math.round(
                ((Math.abs(anchorDiff) / 100.0) * usableCapacity) * 100,
              ) / 100;
            fuelEventsToInsert.push({
              id: uuidv7(),
              vehicleId: vehicle.id,
              tripId: log.tripId ?? null,
              type: FuelEventType.DRAIN,
              liters,
              percentageDelta: Math.round(anchorDiff * 100) / 100,
              startLevel:
                Math.round(
                  (virtualState.lastValidAnchorPercent ?? calibratedAnchor) *
                    100,
                ) / 100,
              endLevel: Math.round(calibratedAnchor * 100) / 100,
              latitude: log.latitude,
              longitude: log.longitude,
              timestamp: log.timestamp,
            });
          }

          virtualState.currentDisplayPercent = calibratedAnchor;
          virtualState.lastValidAnchorPercent = calibratedAnchor;
        }
        virtualState.ignitionOnTime = null;
        virtualState.ignitionOnReadings = [];
      }
    }

    // 3.2 Filtro cinemático de aceleración lateral y longitudinal (sloshing)
    const accelX_G = log.accelX !== null ? Math.abs(log.accelX) : 0;
    const accelY_G = log.accelY !== null ? Math.abs(log.accelY) : 0;
    const isSloshing = accelX_G > 0.15 || accelY_G > 0.15;

    // 3.3 Transiciones de movimiento
    const isMoving = (log.speed ?? 0) > 5;
    if (isMoving && virtualState.vehicleState === 'PARKED') {
      if (
        virtualState.session &&
        virtualState.session.type !== 'NONE' &&
        virtualState.segmentReadings.length >= 3
      ) {
        const currentMed = calculateMedian(virtualState.segmentReadings);
        const startAnchor =
          virtualState.session.startAnchor ??
          virtualState.lastValidAnchorPercent ??
          currentMed;
        const delta = currentMed - startAnchor;
        if (virtualState.session.type === 'REFUEL' && delta >= 4.0) {
          const liters =
            Math.round(((delta / 100.0) * usableCapacity) * 100) / 100;
          fuelEventsToInsert.push({
            id: uuidv7(),
            vehicleId: vehicle.id,
            tripId: log.tripId ?? null,
            type: FuelEventType.REFUEL,
            liters,
            percentageDelta: Math.round(delta * 100) / 100,
            startLevel: Math.round(startAnchor * 100) / 100,
            endLevel: Math.round(currentMed * 100) / 100,
            latitude: log.latitude,
            longitude: log.longitude,
            timestamp: log.timestamp,
          });
          virtualState.lastValidAnchorPercent = currentMed;
          virtualState.currentDisplayPercent = currentMed;
        } else if (virtualState.session.type === 'DRAIN' && delta <= -4.0) {
          const liters =
            Math.round(((Math.abs(delta) / 100.0) * usableCapacity) * 100) / 100;
          fuelEventsToInsert.push({
            id: uuidv7(),
            vehicleId: vehicle.id,
            tripId: log.tripId ?? null,
            type: FuelEventType.DRAIN,
            liters,
            percentageDelta: Math.round(delta * 100) / 100,
            startLevel: Math.round(startAnchor * 100) / 100,
            endLevel: Math.round(currentMed * 100) / 100,
            latitude: log.latitude,
            longitude: log.longitude,
            timestamp: log.timestamp,
          });
          virtualState.lastValidAnchorPercent = currentMed;
          virtualState.currentDisplayPercent = currentMed;
        }
        virtualState.session = {
          type: 'NONE',
          startAnchor: null,
          stableCounter: 0,
          lastMedian: null,
        };
      }

      virtualState.vehicleState = 'MOVING';
      virtualState.distanceAccumulator = 0;
      virtualState.timeAccumulator = 0;
      virtualState.segmentReadings = [];
    } else if (!isMoving && virtualState.vehicleState === 'MOVING') {
      virtualState.vehicleState = 'PARKED';
      virtualState.segmentReadings = [];
      virtualState.distanceAccumulator = 0;
      virtualState.timeAccumulator = 0;
    }

    // 3.4 Lógica de operación según estado
    if (virtualState.vehicleState === 'MOVING') {
      if (!isSloshing) {
        virtualState.segmentReadings.push(rawFuel);
      }
      virtualState.timeAccumulator += timeDeltaSeconds;

      if (virtualState.timeAccumulator >= 300) {
        // Cada 5 minutos en movimiento
        if (virtualState.segmentReadings.length > 0) {
          const currentMedian = calculateMedian(virtualState.segmentReadings);
          const fuelDelta = virtualState.currentDisplayPercent! - currentMedian;
          // Estrictamente monótono descendente durante conducción
          if (fuelDelta > 0) {
            const alpha = 0.05;
            virtualState.currentDisplayPercent =
              alpha * currentMedian +
              (1 - alpha) * virtualState.currentDisplayPercent!;
          }
        }
        virtualState.timeAccumulator = 0;
        virtualState.segmentReadings = [];
      }
    } else {
      // Estacionado: buffer rodante de 20 lecturas
      virtualState.segmentReadings.push(rawFuel);
      if (virtualState.segmentReadings.length > 20) {
        virtualState.segmentReadings.shift();
      }

      const stableMedian = calculateMedian(virtualState.segmentReadings);
      const currentAnchor = virtualState.lastValidAnchorPercent ?? stableMedian;

      if (!virtualState.session || virtualState.session.type === 'NONE') {
        const parkedDelta = stableMedian - currentAnchor;
        const isSettled = virtualState.segmentReadings.length >= 3;

        if (isSettled && parkedDelta >= 4.0) {
          virtualState.session = {
            type: 'REFUEL',
            startAnchor: currentAnchor,
            stableCounter: 0,
            lastMedian: stableMedian,
          };
        } else if (isSettled && parkedDelta <= -4.0) {
          virtualState.session = {
            type: 'DRAIN',
            startAnchor: currentAnchor,
            stableCounter: 0,
            lastMedian: stableMedian,
          };
        }
      }

      if (virtualState.session && virtualState.session.type !== 'NONE') {
        virtualState.currentDisplayPercent = stableMedian;
        const prevMed = virtualState.session.lastMedian ?? stableMedian;
        if (Math.abs(stableMedian - prevMed) <= 0.5) {
          virtualState.session.stableCounter++;
        } else {
          virtualState.session.stableCounter = 0;
        }
        virtualState.session.lastMedian = stableMedian;

        if (virtualState.session.stableCounter >= 3) {
          const sessionType = virtualState.session.type;
          const startAnchor =
            virtualState.session.startAnchor ??
            virtualState.lastValidAnchorPercent ??
            stableMedian;
          const delta = stableMedian - startAnchor;

          if (sessionType === 'REFUEL' && delta >= 4.0) {
            const liters =
              Math.round(((delta / 100.0) * usableCapacity) * 100) / 100;
            fuelEventsToInsert.push({
              id: uuidv7(),
              vehicleId: vehicle.id,
              tripId: log.tripId ?? null,
              type: FuelEventType.REFUEL,
              liters,
              percentageDelta: Math.round(delta * 100) / 100,
              startLevel: Math.round(startAnchor * 100) / 100,
              endLevel: Math.round(stableMedian * 100) / 100,
              latitude: log.latitude,
              longitude: log.longitude,
              timestamp: log.timestamp,
            });
          } else if (sessionType === 'DRAIN' && delta <= -4.0) {
            const liters =
              Math.round(((Math.abs(delta) / 100.0) * usableCapacity) * 100) /
              100;
            fuelEventsToInsert.push({
              id: uuidv7(),
              vehicleId: vehicle.id,
              tripId: log.tripId ?? null,
              type: FuelEventType.DRAIN,
              liters,
              percentageDelta: Math.round(delta * 100) / 100,
              startLevel: Math.round(startAnchor * 100) / 100,
              endLevel: Math.round(stableMedian * 100) / 100,
              latitude: log.latitude,
              longitude: log.longitude,
              timestamp: log.timestamp,
            });
          }

          virtualState.lastValidAnchorPercent = stableMedian;
          virtualState.session = {
            type: 'NONE',
            startAnchor: null,
            stableCounter: 0,
            lastMedian: null,
          };
        }
      }
    }
  }

  // 4. Guardar eventos de combustible creados en lotes
  if (fuelEventsToInsert.length > 0) {
    await prisma.fuelEvent.createMany({
      data: fuelEventsToInsert,
    });
    console.log(
      `[SUCCESS] Creados ${fuelEventsToInsert.length} eventos de combustible en la base de datos:`,
    );
    fuelEventsToInsert.forEach((e) => {
      console.log(
        `  -> [${e.type}] ${e.timestamp.toISOString().substring(0, 19)}: +${e.liters}L (${e.percentageDelta}%) de ${e.startLevel}% a ${e.endLevel}%`,
      );
    });
  } else {
    console.log(`[INFO] No se detectaron anomalías ni recargas para este vehículo.`);
  }

  // 5. Recalcular métricas de combustible en todos los viajes del vehículo
  const trips = await prisma.trip.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      distanceKm: true,
    },
  });

  console.log(`[INFO] Recalculando consumo en ${trips.length} viajes...`);
  let updatedTrips = 0;

  for (const trip of trips) {
    const tripLogs = await prisma.telemetryLog.findMany({
      where: { tripId: trip.id, fuelLevel: { not: null } },
      orderBy: { timestamp: 'asc' },
      select: { fuelLevel: true, timestamp: true },
    });

    if (tripLogs.length === 0) continue;

    const startFuel = tripLogs[0].fuelLevel!;
    const endFuel = tripLogs[tripLogs.length - 1].fuelLevel!;

    // Buscar eventos de recarga dentro de este viaje
    const tripRefuelEvents = fuelEventsToInsert.filter(
      (e) => e.tripId === trip.id && e.type === FuelEventType.REFUEL,
    );
    const midTripRefuels = tripRefuelEvents.reduce(
      (sum, e) => sum + e.liters,
      0,
    );

    const netLiters = ((startFuel - endFuel) / 100.0) * usableCapacity + midTripRefuels;
    const consumedLiters = Math.max(0, Math.round(netLiters * 100) / 100);
    const efficiency =
      consumedLiters > 0 && trip.distanceKm && trip.distanceKm > 0
        ? Math.round((trip.distanceKm / consumedLiters) * 100) / 100
        : null;

    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        startFuelLevel: Math.round(startFuel * 100) / 100,
        endFuelLevel: Math.round(endFuel * 100) / 100,
        fuelConsumedLiters: consumedLiters,
        fuelEfficiencyKmL: efficiency,
      },
    });
    updatedTrips++;
  }

  console.log(`[SUCCESS] ${updatedTrips} viajes actualizados correctamente.`);

  // 6. Actualizar VehicleLiveState con el virtualState final
  if (virtualState.currentDisplayPercent !== null) {
    await prisma.vehicleLiveState.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        lastFuelLevel: Math.round(virtualState.currentDisplayPercent * 100) / 100,
        virtualState: virtualState as any,
      },
      create: {
        vehicleId: vehicle.id,
        lastLat: logs[logs.length - 1].latitude ?? 0,
        lastLng: logs[logs.length - 1].longitude ?? 0,
        lastFuelLevel: Math.round(virtualState.currentDisplayPercent * 100) / 100,
        virtualState: virtualState as any,
        lastUpdate: new Date(),
      },
    });
    console.log(
      `[SUCCESS] VehicleLiveState actualizado con nivel virtual: ${virtualState.currentDisplayPercent.toFixed(1)}%`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const vehicleArg = args.find((a) => a.startsWith('--vehicle='));
  const targetVehicleId = vehicleArg ? vehicleArg.split('=')[1] : null;

  try {
    if (targetVehicleId) {
      await processVehicleFuelHistory(targetVehicleId);
    } else {
      const vehicles = await prisma.vehicle.findMany({
        select: { id: true },
      });
      console.log(`[INFO] Iniciando backfill para ${vehicles.length} vehículos...`);
      for (const v of vehicles) {
        await processVehicleFuelHistory(v.id);
      }
    }
    console.log('\n[SUCCESS] Proceso de backfill completado con éxito.');
  } catch (error) {
    console.error('[FATAL] Error en el backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
