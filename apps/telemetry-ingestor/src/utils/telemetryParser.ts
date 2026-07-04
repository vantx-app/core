import { parseEcoAxesValue, mapObdFuelType } from "@vantx/telemetry-parser";

export interface PreviousState {
  ignition?: boolean;
  rpm?: number;
  excessiveIdling?: boolean;
  unplugged?: boolean;
  odometer?: number | null;
  fuelLevel?: number | null;
  angle?: number;
}

export interface ParsedTelemetry {
  rawRpm: number;
  rawVoltage: number;
  rawIgnitionPin: boolean;
  movement: boolean;
  obdSpeed: number | null;
  speedToUse: number;
  isHardwareExcessiveIdling: boolean;
  engineLoad: number | null;
  coolantTemp: number | null;
  odometer: number | null;
  vin: string | null;
  dtcCount: number;
  faultCodes: any;
  powerSupply: number;
  isUnplugged: boolean;
  harshAcceleration: number;
  harshBraking: number;
  harshCornering: number;
  harshAccelerationDuration: number | null;
  harshBrakingDuration: number | null;
  harshCorneringDuration: number | null;
  harshAccelerationAverage: number | null;
  harshBrakingAverage: number | null;
  harshCorneringAverage: number | null;
  trueIgnition: boolean;
  status: string;
  extraIoData: any;
  tripActive: boolean;
  detectedFuelType: "GASOLINE" | "DIESEL" | "ELECTRIC" | "HYBRID" | null;

  // Nuevos campos normalizados
  fuelLevel: number | null;
  fuelConsumption: number | null;
  fuelRate: number | null;
}

// Función auxiliar para obtener el valor de un AVL ID aplicando su multiplicador si existe
export function getAvlValue(
  ioData: Record<number | string, number>,
  config: number | { id: number; multiplier?: number } | undefined,
): number | null {
  if (config === undefined || config === null) return null;
  
  if (typeof config === "number") {
    return ioData[config] ?? null;
  }
  
  const rawValue = ioData[config.id];
  if (rawValue === undefined || rawValue === null) return null;
  
  return config.multiplier !== undefined ? rawValue * config.multiplier : rawValue;
}

/**
 * Decodifica y procesa los campos de telemetría de un registro crudo según el perfil del dispositivo.
 * Todos los comentarios y logs deben mantenerse en español.
 */
export function parseTelemetryRecord(
  rec: any,
  mapping: any,
  previous?: PreviousState,
): ParsedTelemetry {
  // Resolución de valores dinámicos
  let rawRpm = 0;
  const mappedRpm = getAvlValue(rec.ioData, mapping.rpm);
  if (mappedRpm !== null) {
    rawRpm = mappedRpm;
  } else if (previous?.rpm !== undefined) {
    rawRpm = previous.rpm;
  }

  const rawVoltage = getAvlValue(rec.ioData, mapping.voltage) ?? 0;

  let rawIgnitionPin = false;
  const mappedIgnition = getAvlValue(rec.ioData, mapping.ignition);
  if (mappedIgnition !== null) {
    rawIgnitionPin = mappedIgnition === 1;
  } else if (previous?.ignition !== undefined) {
    rawIgnitionPin = previous.ignition;
  }

  const movement = getAvlValue(rec.ioData, mapping.movement) === 1;
  const obdSpeed = getAvlValue(rec.ioData, mapping.obdSpeed);
  const speedToUse = obdSpeed ?? rec.gpsSpeed;

  let isHardwareExcessiveIdling = false;
  const mappedExcessiveIdling = getAvlValue(rec.ioData, mapping.excessiveIdling);
  if (mappedExcessiveIdling !== null) {
    const id = typeof mapping.excessiveIdling === "number" ? mapping.excessiveIdling : mapping.excessiveIdling?.id;
    isHardwareExcessiveIdling = rec.eventId === id || mappedExcessiveIdling === 1;
  } else if (previous?.excessiveIdling !== undefined) {
    isHardwareExcessiveIdling = previous.excessiveIdling;
  }

  const engineLoad = getAvlValue(rec.ioData, mapping.engineLoad);
  const coolantTemp = getAvlValue(rec.ioData, mapping.coolantTemp);

  // Cálculo de odómetro (el valor highResOdometer ya está en km, odometer estándar se divide entre 1000.0)
  let odometer: number | null = null;
  const highResOdom = getAvlValue(rec.ioData, mapping.highResOdometer);
  const stdOdom = getAvlValue(rec.ioData, mapping.odometer);
  if (highResOdom !== null) {
    odometer = highResOdom;
  } else if (stdOdom !== null) {
    odometer = stdOdom / 1000.0;
  } else if (previous?.odometer !== undefined && previous.odometer !== null) {
    odometer = previous.odometer;
  }

  // Parsear VIN con fallbacks
  let vin: string | null = null;
  const mappedVin = getAvlValue(rec.ioData, mapping.vin);
  if (mappedVin !== null) {
    vin = String(mappedVin);
  } else {
    const fallbackVin = rec.ioData[256] ?? rec.ioData[325] ?? rec.ioData[528] ?? null;
    if (fallbackVin !== null) {
      vin = String(fallbackVin);
    }
  }

  const dtcCount = getAvlValue(rec.ioData, mapping.dtcCount) ?? 0;
  const faultCodes = getAvlValue(rec.ioData, mapping.faultCodes);
  const powerSupply = rawVoltage / 1000;

  let isUnplugged = false;
  if (mapping.unplugged !== undefined) {
    const mappedUnplugged = getAvlValue(rec.ioData, mapping.unplugged);
    if (mappedUnplugged !== null) {
      isUnplugged = mappedUnplugged === 1;
    } else if (previous?.unplugged !== undefined) {
      isUnplugged = previous.unplugged;
    }
  }

  // Detectar tipo de combustible
  const rawFuelType = getAvlValue(rec.ioData, mapping.fuelType);
  const detectedFuelType = mapObdFuelType(rawFuelType);

  // Conducción Ecológica (Eco Driving)
  const ecoDrivingType = getAvlValue(rec.ioData, mapping.ecoDrivingType) ?? undefined;
  const rawSeverity = getAvlValue(rec.ioData, mapping.ecoDrivingValueMax) ?? undefined;
  const ecoDrivingSeverity = parseEcoAxesValue(rawSeverity) ?? 10;
  const ecoDrivingDuration = getAvlValue(rec.ioData, mapping.ecoDrivingDuration);
  const rawAverage = getAvlValue(rec.ioData, mapping.ecoDrivingAverage) ?? undefined;
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

  // Determinación de ignición real
  const trueIgnition =
    rawIgnitionPin ||
    rawRpm > 400 ||
    (mapping.ignition === undefined && rawVoltage > 13200) ||
    isHardwareExcessiveIdling;

  // Estado de movimiento
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

  // Nuevos campos dinámicos
  let fuelLevel = getAvlValue(rec.ioData, mapping.fuelLevel);
  if (fuelLevel !== null) {
    if (previous?.fuelLevel !== undefined && previous.fuelLevel !== null) {
      const diff = Math.abs(fuelLevel - previous.fuelLevel);
      const isMoving = status === "MOVING";
      // Si el vehículo no se está moviendo y hay un cambio brusco > 10% (refuerzo o robo),
      // omitimos el filtro para registrar el valor real de inmediato.
      if (!isMoving && diff > 10) {
        // Se acepta el valor real directamente
      } else {
        // Aplicamos suavizado exponencial basado en el estado de movimiento
        const alpha = isMoving ? 0.05 : 0.2;
        fuelLevel = alpha * fuelLevel + (1 - alpha) * previous.fuelLevel;
      }
    }
  } else if (previous?.fuelLevel !== undefined && previous.fuelLevel !== null) {
    fuelLevel = previous.fuelLevel;
  }

  const fuelConsumption = getAvlValue(rec.ioData, mapping.fuelConsumption);
  const fuelRate = getAvlValue(rec.ioData, mapping.fuelRate);

  // Deduplicación dinámica de I/O extra (se eliminan las claves ya mapeadas)
  const extraIoData = { ...rec.ioData };
  Object.values(mapping).forEach((config: any) => {
    if (config !== undefined && config !== null) {
      const id = typeof config === "number" ? config : config.id;
      if (id !== undefined) {
        delete extraIoData[id];
      }
    }
  });

  // Asegurar que las IDs de VIN no queden en extraIoData
  delete extraIoData[256];
  delete extraIoData[325];
  delete extraIoData[528];

  // Detección de viaje
  const mappedTripStatus = getAvlValue(rec.ioData, mapping.tripStatus);
  const tripActive = mappedTripStatus !== null ? mappedTripStatus === 1 : trueIgnition;

  return {
    rawRpm,
    rawVoltage,
    rawIgnitionPin,
    movement,
    obdSpeed,
    speedToUse,
    isHardwareExcessiveIdling,
    engineLoad,
    coolantTemp,
    odometer,
    vin,
    dtcCount,
    faultCodes,
    powerSupply,
    isUnplugged,
    harshAcceleration,
    harshBraking,
    harshCornering,
    harshAccelerationDuration,
    harshBrakingDuration,
    harshCorneringDuration,
    harshAccelerationAverage,
    harshBrakingAverage,
    harshCorneringAverage,
    trueIgnition,
    status,
    extraIoData,
    tripActive,
    detectedFuelType,
    fuelLevel,
    fuelConsumption,
    fuelRate,
  };
}
