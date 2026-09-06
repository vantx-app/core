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

// Detección basada en ESTADO Y ASENTAMIENTO (Waiting & Settling) anti-rebote:
// En lugar de umbrales rígidos elevados (que ignoran robos reales de 3L a 5L),
// la detección automotriz real monitorea el ESTADO del tanque y ESPERA la estabilización.
// Un evento genuino (robo o recarga) es un cambio PERMANENTE de estado que se asienta y NO rebota.
// Las pendientes, rampas y frenadas rebotan en minutos hacia el nivel previo.
const MIN_NOISE_FLOOR_PERCENT = 2.5; // Ruido eléctrico del convertidor analógico-digital (ADC)
const MIN_NOISE_FLOOR_LITERS = 1.0;   // Mínimo 1.0 L para ignorar micro-oscilaciones
const CONFIRM_WINDOW_MS = 8 * 60 * 1000; // Ventana de 8 minutos para verificar persistencia del nuevo estado

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2;
}

// Ventana de verificación hacia adelante: confirma que el salto o caída se mantenga y no sea rebote por pendiente/rampa
function getForwardMedian(
  logs: any[],
  startIndex: number,
  windowMs: number = CONFIRM_WINDOW_MS,
): number | null {
  const baseTime = logs[startIndex].timestamp.getTime();
  const samples: number[] = [];
  for (let i = startIndex + 1; i < logs.length; i++) {
    const elapsed = logs[i].timestamp.getTime() - baseTime;
    if (elapsed > windowMs) break;
    samples.push(logs[i].fuelLevel);
    if (samples.length >= 60) break;
  }
  if (samples.length === 0) return null;
  return calculateMedian(samples);
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
  const effectiveCapacity = capacity;

  console.log(
    `\n================================================================================`,
  );
  console.log(
    `[INFO] Procesando historial para: ${vehicle.alias || vehicle.plateNumber || vehicle.id}`,
  );
  console.log(
    `[INFO] Capacidad de tanque: ${capacity} L`,
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
      odometer: true,
    },
  });

  console.log(
    `[INFO] Registros de telemetría con combustible encontrados: ${logs.length}`,
  );
  if (logs.length === 0) return;

  // 3. Procesar eventos con filtrado cinemático estricto y confirmación de persistencia
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

  const initialSample = logs.slice(0, Math.min(10, logs.length)).map((l) => l.fuelLevel!);
  let lastConfirmedAnchor = calculateMedian(initialSample);
  let stationaryReadings: number[] = [];

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const rawFuel = log.fuelLevel!;
    const isMoving = (log.speed ?? 0) > 3;
    const isInTrip = log.tripId !== null;

    if (isMoving || isInTrip) {
      // VEHÍCULO EN MOVIMIENTO O VIAJE ACTIVO:
      // Cualquier descenso es consumo normal de combustible, NUNCA un robo/drenado.
      stationaryReadings = [];
      // Seguir suavemente el consumo hacia abajo durante conducción
      if (rawFuel < lastConfirmedAnchor) {
        lastConfirmedAnchor = 0.02 * rawFuel + 0.98 * lastConfirmedAnchor;
      }
      continue;
    }

    // VEHÍCULO ESTACIONADO / DETENIDO:
    stationaryReadings.push(rawFuel);
    if (stationaryReadings.length > 30) {
      stationaryReadings.shift();
    }

    // Requiere al menos 6 lecturas consecutivas detenido para asentar el oleaje inicial de frenado
    if (stationaryReadings.length < 6) continue;

    const currentMed = calculateMedian(stationaryReadings);
    const delta = currentMed - lastConfirmedAnchor;

    // A. REGLA DE RECARGA (REFUEL):
    // Nivel sube más que el ruido de sensor (>= 2.5% y >= 1.0 L)
    if (delta >= MIN_NOISE_FLOOR_PERCENT) {
      const liters = Math.round(((delta / 100.0) * effectiveCapacity) * 100) / 100;
      if (liters >= MIN_NOISE_FLOOR_LITERS) {
        // Confirmación de persistencia: esperar y verificar que el nuevo nivel se asiente y NO sea rebote por pendiente/rampa
        const forwardMed = getForwardMedian(logs, i, CONFIRM_WINDOW_MS);
        // Si el nivel futuro regresa hacia el ancla anterior, fue un rebote/inclinación transitoria
        const isPersistent =
          forwardMed === null || forwardMed >= lastConfirmedAnchor + delta * 0.6;

        if (isPersistent) {
          const lastEvent =
            fuelEventsToInsert.length > 0
              ? fuelEventsToInsert[fuelEventsToInsert.length - 1]
              : null;
          const timeSinceLastEventMs = lastEvent
            ? log.timestamp.getTime() - lastEvent.timestamp.getTime()
            : Infinity;

          // Si ocurrió otra recarga en los últimos 15 min en la misma parada (ej. bomba despacha en etapas), consolidar
          if (
            lastEvent &&
            lastEvent.type === FuelEventType.REFUEL &&
            timeSinceLastEventMs <= 15 * 60 * 1000
          ) {
            const consolidatedDelta = currentMed - lastEvent.startLevel;
            const consolidatedLiters =
              Math.round(((consolidatedDelta / 100.0) * effectiveCapacity) * 100) / 100;
            lastEvent.endLevel = Math.round(currentMed * 10) / 10;
            lastEvent.percentageDelta = Math.round(consolidatedDelta * 10) / 10;
            lastEvent.liters = consolidatedLiters;
            lastEvent.timestamp = log.timestamp;
            lastEvent.latitude = log.latitude ?? lastEvent.latitude;
            lastEvent.longitude = log.longitude ?? lastEvent.longitude;
          } else {
            fuelEventsToInsert.push({
              id: uuidv7(),
              vehicleId: vehicle.id,
              tripId: log.tripId ?? null,
              type: FuelEventType.REFUEL,
              liters,
              percentageDelta: Math.round(delta * 10) / 10,
              startLevel: Math.round(lastConfirmedAnchor * 10) / 10,
              endLevel: Math.round(currentMed * 10) / 10,
              latitude: log.latitude,
              longitude: log.longitude,
              timestamp: log.timestamp,
            });
          }
          lastConfirmedAnchor = currentMed;
          stationaryReadings = [currentMed];
        }
      }
    }
    // B. REGLA DE DRENADO / ROBO (DRAIN):
    // Nivel baja mientras está estacionado con ignición apagada (o detenido sin moverse)
    else if (
      delta <= -MIN_NOISE_FLOOR_PERCENT &&
      !isInTrip &&
      (!log.ignition || (log.speed ?? 0) === 0)
    ) {
      const liters =
        Math.round(((Math.abs(delta) / 100.0) * effectiveCapacity) * 100) / 100;
      if (liters >= MIN_NOISE_FLOOR_LITERS) {
        // Confirmación de persistencia: esperar y verificar que el nivel permanezca abajo y no sea una rampa transitoria
        const forwardMed = getForwardMedian(logs, i, CONFIRM_WINDOW_MS);
        // Si el nivel futuro sube de vuelta cerca del ancla original, fue una inclinación temporal (rebote)
        const isPersistent =
          forwardMed === null ||
          forwardMed <= lastConfirmedAnchor - Math.abs(delta) * 0.6;

        if (isPersistent) {
          fuelEventsToInsert.push({
            id: uuidv7(),
            vehicleId: vehicle.id,
            tripId: null,
            type: FuelEventType.DRAIN,
            liters,
            percentageDelta: Math.round(delta * 10) / 10,
            startLevel: Math.round(lastConfirmedAnchor * 10) / 10,
            endLevel: Math.round(currentMed * 10) / 10,
            latitude: log.latitude,
            longitude: log.longitude,
            timestamp: log.timestamp,
          });
          lastConfirmedAnchor = currentMed;
          stationaryReadings = [currentMed];
        }
      }
    }
    // C. VARIACIONES MÍNIMAS: Absorber suavemente micro-deriva de reposo (< 2.5%)
    else {
      if (Math.abs(delta) < MIN_NOISE_FLOOR_PERCENT) {
        lastConfirmedAnchor = 0.05 * currentMed + 0.95 * lastConfirmedAnchor;
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
      const sign = e.type === FuelEventType.REFUEL ? '+' : '-';
      console.log(
        `  -> [${e.type}] ${e.timestamp.toISOString().substring(0, 19)}: ${sign}${e.liters}L (${sign}${Math.abs(e.percentageDelta)}%) de ${e.startLevel}% a ${e.endLevel}%`,
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

    // Mediana inicial y final sobre muestras para eliminar ruido puntual de boya en arranque/parada
    const startSample = tripLogs
      .slice(0, Math.min(10, tripLogs.length))
      .map((l) => l.fuelLevel!);
    const endSample = tripLogs
      .slice(-Math.min(10, tripLogs.length))
      .map((l) => l.fuelLevel!);
    const startFuel = calculateMedian(startSample);
    const endFuel = calculateMedian(endSample);

    // Buscar eventos de recarga dentro de este viaje
    const tripRefuelEvents = fuelEventsToInsert.filter(
      (e) => e.tripId === trip.id && e.type === FuelEventType.REFUEL,
    );
    const midTripRefuels = tripRefuelEvents.reduce(
      (sum, e) => sum + e.liters,
      0,
    );

    const netLiters = ((startFuel - endFuel) / 100.0) * effectiveCapacity + midTripRefuels;
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

  // 6. Actualizar VehicleLiveState con el nivel final verificado
  const lastLog = logs[logs.length - 1];
  await prisma.vehicleLiveState.upsert({
    where: { vehicleId: vehicle.id },
    update: {
      lastFuelLevel: Math.round(lastConfirmedAnchor * 100) / 100,
      virtualState: {
        currentDisplayPercent: lastConfirmedAnchor,
        lastValidAnchorPercent: lastConfirmedAnchor,
        vehicleState: 'PARKED',
      } as any,
    },
    create: {
      vehicleId: vehicle.id,
      lastLat: lastLog.latitude ?? 0,
      lastLng: lastLog.longitude ?? 0,
      lastFuelLevel: Math.round(lastConfirmedAnchor * 100) / 100,
      virtualState: {
        currentDisplayPercent: lastConfirmedAnchor,
        lastValidAnchorPercent: lastConfirmedAnchor,
        vehicleState: 'PARKED',
      } as any,
      lastUpdate: new Date(),
    },
  });
  console.log(
    `[SUCCESS] VehicleLiveState actualizado con nivel verificado: ${lastConfirmedAnchor.toFixed(1)}%`,
  );
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
