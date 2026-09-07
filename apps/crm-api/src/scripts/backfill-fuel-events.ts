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

// Detección automotriz basada en ESTADO Y ASENTAMIENTO (Waiting & Settling):
// Principios físicos fundamentales:
// 1. En movimiento (speed > 3 km/h), el combustible chapotea continuamente.
//    NUNCA se evalúa recarga ni drenado mientras el vehículo avanza; las caídas son consumo de motor.
// 2. Las recargas y drenados SOLO ocurren cuando el vehículo está DETENIDO (speed <= 3 km/h).
// 3. Cuando el vehículo se detiene, se ESPERA la estabilización del oleaje (settling).
// 4. Magnitud física: una recarga o robo real supera con creces el ruido del sensor (>= 8.0% y >= 4.0 L).
// 5. Persistencia y anti-rebote (Waiting): el nuevo nivel debe sostenerse en el tiempo y no rebotar
//    al reanudar la marcha (descartando inclinaciones/rampas de estacionamiento).
// 6. Para drenado (robo), el motor DEBE estar apagado (!ignition), pues encendido detenido es ralentí.
const MIN_EVENT_PERCENT = 8.0; // 8% mínimo de variación
const MIN_EVENT_LITERS = 4.0;   // 4.0 L mínimo para descartar cualquier oscilación
const CONFIRM_WINDOW_MS = 8 * 60 * 1000; // 8 minutos para confirmar persistencia

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2;
}

// Ventana de verificación hacia adelante: confirma que el nuevo estado se mantenga
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

// Anti-rampa para drenado: verifica si tras estacionarse inclinado el nivel vuelve al ancla al reanudar la marcha
function checkDrainRebound(logs: any[], startIndex: number, anchor: number): boolean {
  const baseTime = logs[startIndex].timestamp.getTime();
  const maxLookaheadMs = 2 * 60 * 60 * 1000; // 2 horas hacia adelante
  for (let i = startIndex + 1; i < logs.length; i++) {
    const elapsed = logs[i].timestamp.getTime() - baseTime;
    if (elapsed > maxLookaheadMs) break;
    // Si una lectura posterior alcanza o supera el ancla previa (menos 3% de consumo normal),
    // significa que el tanque recuperó su nivel en terreno plano -> Inclinación / Falso drenado
    if (logs[i].fuelLevel >= anchor - 3.0) {
      return true;
    }
  }
  return false;
}

// Anti-pendiente para recarga: verifica si fue un descenso temporal que luego cayó de regreso al ancla
function checkRefuelRebound(logs: any[], startIndex: number, anchor: number): boolean {
  const baseTime = logs[startIndex].timestamp.getTime();
  const maxLookaheadMs = 45 * 60 * 1000; // 45 minutos hacia adelante
  let dropCount = 0;
  for (let i = startIndex + 1; i < logs.length; i++) {
    const elapsed = logs[i].timestamp.getTime() - baseTime;
    if (elapsed > maxLookaheadMs) break;
    if (logs[i].fuelLevel <= anchor + 4.0) {
      dropCount++;
      if (dropCount >= 5) {
        return true; // Rebote confirmado
      }
    }
  }
  return false;
}

// Resuelve la ubicación física real de la gasolinera:
// Bajo marquesinas o techos metálicos de gasolineras, la señal GPS suele perderse o mantener
// la posición previa a ingresar (stale fix).
// Buscamos la posición real examinando:
// 1) El primer punto en movimiento (speed > 3 o gpsSpeed > 3) al salir de la gasolinera (hasta 8 min después).
// 2) El último punto en movimiento al ingresar a la gasolinera (hasta 15 min antes).
// 3) Cualquier punto post-evento con coordenadas válidas.
async function resolveEventLocation(
  prismaClient: typeof prisma,
  vehicleId: string,
  eventTimestamp: Date,
  fallbackLat: number | null,
  fallbackLng: number | null,
): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    // 1. Prioridad 1: Salida de la gasolinera (primer movimiento con fix fresco post-recarga)
    // Intentar primero encontrar un registro en movimiento cuyas coordenadas NO sean el stale fix de la marquesina
    const departureLog = await prismaClient.telemetryLog.findFirst({
      where: {
        vehicleId,
        timestamp: {
          gte: eventTimestamp,
          lte: new Date(eventTimestamp.getTime() + 20 * 60 * 1000),
        },
        OR: [{ speed: { gt: 3 } }, { gpsSpeed: { gt: 3 } }],
        latitude: { not: 0 },
        longitude: { not: 0 },
        ...(fallbackLat !== null && fallbackLng !== null
          ? {
              NOT: {
                AND: [{ latitude: fallbackLat }, { longitude: fallbackLng }],
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'asc' },
      select: { latitude: true, longitude: true },
    });

    if (
      departureLog &&
      departureLog.latitude !== 0 &&
      departureLog.longitude !== 0 &&
      Math.abs(departureLog.latitude) > 0.0001
    ) {
      return {
        latitude: departureLog.latitude,
        longitude: departureLog.longitude,
      };
    }

    // Si no hubo cambio con respecto a fallback, tomar el primer registro en movimiento post-recarga
    const anyDepartureLog = await prismaClient.telemetryLog.findFirst({
      where: {
        vehicleId,
        timestamp: {
          gte: eventTimestamp,
          lte: new Date(eventTimestamp.getTime() + 20 * 60 * 1000),
        },
        OR: [{ speed: { gt: 3 } }, { gpsSpeed: { gt: 3 } }],
        latitude: { not: 0 },
        longitude: { not: 0 },
      },
      orderBy: { timestamp: 'asc' },
      select: { latitude: true, longitude: true },
    });

    if (
      anyDepartureLog &&
      anyDepartureLog.latitude !== 0 &&
      anyDepartureLog.longitude !== 0 &&
      Math.abs(anyDepartureLog.latitude) > 0.0001
    ) {
      return {
        latitude: anyDepartureLog.latitude,
        longitude: anyDepartureLog.longitude,
      };
    }

    // 2. Prioridad 2: Entrada a la gasolinera (último movimiento antes de detenerse a recargar)
    const arrivalLog = await prismaClient.telemetryLog.findFirst({
      where: {
        vehicleId,
        timestamp: {
          gte: new Date(eventTimestamp.getTime() - 20 * 60 * 1000),
          lte: eventTimestamp,
        },
        OR: [{ speed: { gt: 3 } }, { gpsSpeed: { gt: 3 } }],
        latitude: { not: 0 },
        longitude: { not: 0 },
        ...(fallbackLat !== null && fallbackLng !== null
          ? {
              NOT: {
                AND: [{ latitude: fallbackLat }, { longitude: fallbackLng }],
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      select: { latitude: true, longitude: true },
    });

    if (
      arrivalLog &&
      arrivalLog.latitude !== 0 &&
      arrivalLog.longitude !== 0 &&
      Math.abs(arrivalLog.latitude) > 0.0001
    ) {
      return {
        latitude: arrivalLog.latitude,
        longitude: arrivalLog.longitude,
      };
    }

    // 3. Prioridad 3: Primer registro con GPS válido post-evento
    const anyPostLog = await prismaClient.telemetryLog.findFirst({
      where: {
        vehicleId,
        timestamp: {
          gte: eventTimestamp,
          lte: new Date(eventTimestamp.getTime() + 20 * 60 * 1000),
        },
        latitude: { not: 0 },
        longitude: { not: 0 },
      },
      orderBy: { timestamp: 'asc' },
      select: { latitude: true, longitude: true },
    });

    if (
      anyPostLog &&
      anyPostLog.latitude !== 0 &&
      anyPostLog.longitude !== 0 &&
      Math.abs(anyPostLog.latitude) > 0.0001
    ) {
      return {
        latitude: anyPostLog.latitude,
        longitude: anyPostLog.longitude,
      };
    }
  } catch (err) {
    console.warn(`[WARN] Error al resolver ubicación precisa para evento de combustible:`, err);
  }

  return {
    latitude: fallbackLat,
    longitude: fallbackLng,
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
      gpsSpeed: true,
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
  let stationaryStartTime: number | null = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const rawFuel = log.fuelLevel!;
    const isMoving = (log.speed ?? 0) > 3 || (log.gpsSpeed ?? 0) > 3;

    // 1. VEHÍCULO EN MOVIMIENTO (CONDUCCIÓN):
    // Ningún evento de recarga ni robo puede ocurrir físicamente en marcha.
    if (isMoving) {
      stationaryReadings = [];
      stationaryStartTime = null;
      // Seguir suavemente el consumo hacia abajo durante la conducción
      if (rawFuel < lastConfirmedAnchor) {
        lastConfirmedAnchor = 0.02 * rawFuel + 0.98 * lastConfirmedAnchor;
      }
      continue;
    }

    // 2. VEHÍCULO DETENIDO (PARADA O ESTACIONADO):
    if (!stationaryStartTime) {
      stationaryStartTime = log.timestamp.getTime();
    }
    stationaryReadings.push(rawFuel);
    if (stationaryReadings.length > 30) {
      stationaryReadings.shift();
    }

    const elapsedStationaryMs = log.timestamp.getTime() - stationaryStartTime;
    // Esperar al menos 5 lecturas o 45 segundos detenido para asentar el oleaje de frenado
    const isSettled =
      stationaryReadings.length >= 5 ||
      (elapsedStationaryMs >= 45_000 && stationaryReadings.length >= 2);

    if (!isSettled) {
      continue;
    }

    const settledLevel = calculateMedian(stationaryReadings);
    const delta = settledLevel - lastConfirmedAnchor;
    const absDeltaPercent = Math.abs(delta);
    const deltaLiters =
      Math.round(((absDeltaPercent / 100.0) * effectiveCapacity) * 100) / 100;

    // 3. DETECCIÓN DE RECARGA (REFUEL):
    if (delta >= MIN_EVENT_PERCENT && deltaLiters >= MIN_EVENT_LITERS) {
      const forwardMed = getForwardMedian(logs, i, CONFIRM_WINDOW_MS);
      const isPersistent =
        forwardMed === null || forwardMed >= lastConfirmedAnchor + delta * 0.7;
      const isRebound = checkRefuelRebound(logs, i, lastConfirmedAnchor);

      if (isPersistent && !isRebound) {
        const finalEndLevel =
          forwardMed !== null ? Math.max(settledLevel, forwardMed) : settledLevel;
        const realDelta = finalEndLevel - lastConfirmedAnchor;
        const realLiters =
          Math.round(((realDelta / 100.0) * effectiveCapacity) * 100) / 100;

        const lastEvent =
          fuelEventsToInsert.length > 0
            ? fuelEventsToInsert[fuelEventsToInsert.length - 1]
            : null;
        const timeSinceLastEventMs = lastEvent
          ? log.timestamp.getTime() - lastEvent.timestamp.getTime()
          : Infinity;

        // Consolidación de recargas en etapas (ej. despachador en pausas sucesivas en <= 15 min):
        if (
          lastEvent &&
          lastEvent.type === FuelEventType.REFUEL &&
          timeSinceLastEventMs <= 15 * 60 * 1000
        ) {
          const consolidatedDelta = finalEndLevel - lastEvent.startLevel;
          lastEvent.endLevel = Math.round(finalEndLevel * 10) / 10;
          lastEvent.percentageDelta = Math.round(consolidatedDelta * 10) / 10;
          lastEvent.liters =
            Math.round(((consolidatedDelta / 100.0) * effectiveCapacity) * 100) / 100;
        } else {
          fuelEventsToInsert.push({
            id: uuidv7(),
            vehicleId: vehicle.id,
            tripId: log.tripId ?? null,
            type: FuelEventType.REFUEL,
            liters: realLiters,
            percentageDelta: Math.round(realDelta * 10) / 10,
            startLevel: Math.round(lastConfirmedAnchor * 10) / 10,
            endLevel: Math.round(finalEndLevel * 10) / 10,
            latitude: log.latitude,
            longitude: log.longitude,
            timestamp: log.timestamp,
          });
        }

        lastConfirmedAnchor = finalEndLevel;
        stationaryReadings = [finalEndLevel];
        continue;
      }
    }

    // 4. DETECCIÓN DE DRENADO / ROBO (DRAIN):
    else if (delta <= -MIN_EVENT_PERCENT && deltaLiters >= MIN_EVENT_LITERS) {
      // El motor debe estar apagado (!log.ignition). Con ignición encendida y vehículo detenido es ralentí/consumo normal.
      if (!log.ignition) {
        const forwardMed = getForwardMedian(logs, i, CONFIRM_WINDOW_MS);
        const isPersistent =
          forwardMed === null ||
          forwardMed <= lastConfirmedAnchor - absDeltaPercent * 0.7;
        const isRebound = checkDrainRebound(logs, i, lastConfirmedAnchor);

        if (isPersistent && !isRebound) {
          fuelEventsToInsert.push({
            id: uuidv7(),
            vehicleId: vehicle.id,
            tripId: log.tripId ?? null,
            type: FuelEventType.DRAIN,
            liters: deltaLiters,
            percentageDelta: Math.round(delta * 10) / 10,
            startLevel: Math.round(lastConfirmedAnchor * 10) / 10,
            endLevel: Math.round(settledLevel * 10) / 10,
            latitude: log.latitude,
            longitude: log.longitude,
            timestamp: log.timestamp,
          });

          lastConfirmedAnchor = settledLevel;
          stationaryReadings = [settledLevel];
          continue;
        }
      }
    } else {
      // 5. RALENTÍ Y MICRO-VARIACIONES:
      if (absDeltaPercent < MIN_EVENT_PERCENT) {
        if (log.ignition && settledLevel < lastConfirmedAnchor) {
          lastConfirmedAnchor = 0.05 * settledLevel + 0.95 * lastConfirmedAnchor;
        }
      }
    }
  }

  // 4. Guardar eventos de combustible creados en lotes
  if (fuelEventsToInsert.length > 0) {
    // Resolver la ubicación precisa de la gasolinera para cada evento REFUEL
    for (const evt of fuelEventsToInsert) {
      if (evt.type === FuelEventType.REFUEL) {
        const resolved = await resolveEventLocation(
          prisma,
          vehicle.id,
          evt.timestamp,
          evt.latitude,
          evt.longitude,
        );
        evt.latitude = resolved.latitude;
        evt.longitude = resolved.longitude;
      }
    }

    await prisma.fuelEvent.createMany({
      data: fuelEventsToInsert,
    });
    console.log(
      `[SUCCESS] Creados ${fuelEventsToInsert.length} eventos de combustible en la base de datos:`,
    );
    fuelEventsToInsert.forEach((e) => {
      const sign = e.type === FuelEventType.REFUEL ? '+' : '-';
      const gpsInfo =
        e.latitude && e.longitude
          ? ` | GPS: ${e.latitude.toFixed(6)}, ${e.longitude.toFixed(6)}`
          : ' | Sin GPS';
      console.log(
        `  -> [${e.type}] ${e.timestamp.toISOString().substring(0, 19)}: ${sign}${e.liters}L (${sign}${Math.abs(e.percentageDelta)}%) de ${e.startLevel}% a ${e.endLevel}%${gpsInfo}`,
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

    console.log(`[INFO] Recalculando consumo en trip ${trip.id}`);

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
