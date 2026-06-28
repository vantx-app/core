import { parseEcoAxesValue, mapObdFuelType } from "@vantx/telemetry-parser";

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
}

/**
 * Decodifica y procesa los campos de telemetría de un registro crudo según el perfil del dispositivo.
 * Todos los comentarios y logs deben mantenerse en español.
 */
export function parseTelemetryRecord(rec: any, mapping: any): ParsedTelemetry {
  // Resolución de valores dinámicos a partir de la configuración de mapeo
  const rawRpm = mapping.rpm !== undefined ? (rec.ioData[mapping.rpm] ?? 0) : 0;
  const rawVoltage =
    mapping.voltage !== undefined ? (rec.ioData[mapping.voltage] ?? 0) : 0;
  const rawIgnitionPin =
    mapping.ignition !== undefined ? rec.ioData[mapping.ignition] === 1 : false;
  const movement =
    mapping.movement !== undefined ? rec.ioData[mapping.movement] === 1 : false;
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

  // Escalar la temperatura del refrigerante del motor LVCAN (AVL ID 115) de 1/10 °C a grados Celsius
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

  // Detectar tipo de combustible
  const rawFuelType =
    mapping.fuelType !== undefined ? rec.ioData[mapping.fuelType] : null;
  const detectedFuelType = mapObdFuelType(rawFuelType);

  // Conducción Ecológica (Eco Driving)
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

  // Deduplicación dinámica de I/O extra (se eliminan las claves ya mapeadas)
  const extraIoData = { ...rec.ioData };
  Object.values(mapping).forEach((avlId: any) => {
    if (avlId !== undefined && avlId !== null) {
      delete extraIoData[avlId as string | number];
    }
  });

  // Detección de viaje por hardware (AVL ID 250) o fallback de ignición
  const tripActive =
    mapping.tripStatus !== undefined &&
    rec.ioData[mapping.tripStatus] !== undefined
      ? rec.ioData[mapping.tripStatus] === 1
      : trueIgnition;

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
  };
}
