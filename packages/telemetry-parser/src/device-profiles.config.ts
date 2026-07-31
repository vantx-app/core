export enum DeviceModel {
  FMC003 = "FMC003",
  FMC150 = "FMC150",
  FMC650 = "FMC650",
  FMC650_FMS = "FMC650_FMS",
}

export function getTelemetryProfile(
  model: DeviceModel | string | null | undefined,
): string {
  if (!model) return "TELTONIKA_STANDARD";
  if (model === DeviceModel.FMC150) return "TELTONIKA_FMC150";
  if (model === DeviceModel.FMC650) return "TELTONIKA_FMC650";
  if (model === DeviceModel.FMC650_FMS) return "TELTONIKA_FMC650_FMS";
  // Fallback for custom or test profile names
  return model;
}

export interface AvlPropertyConfig {
  id: number;
  multiplier?: number;
  signed?: boolean;
}

export interface AvlMapping {
  rpm?: number | AvlPropertyConfig;
  voltage?: number | AvlPropertyConfig;
  ignition?: number | AvlPropertyConfig;
  movement?: number | AvlPropertyConfig;
  obdSpeed?: number | AvlPropertyConfig;
  odometer?: number | AvlPropertyConfig;
  engineLoad?: number | AvlPropertyConfig;
  coolantTemp?: number | AvlPropertyConfig;
  dtcCount?: number | AvlPropertyConfig;
  faultCodes?: number | AvlPropertyConfig;
  vin?: number | AvlPropertyConfig;
  highResOdometer?: number | AvlPropertyConfig;
  tripStatus?: number | AvlPropertyConfig;
  ecoDrivingType?: number | AvlPropertyConfig;
  ecoDrivingValueMax?: number | AvlPropertyConfig;
  ecoDrivingDuration?: number | AvlPropertyConfig;
  ecoDrivingAverage?: number | AvlPropertyConfig;
  excessiveIdling?: number | AvlPropertyConfig;
  crashTrace?: number | AvlPropertyConfig;
  unplugged?: number | AvlPropertyConfig;
  fuelType?: number | AvlPropertyConfig;

  // New normalized properties
  engineHours?: number | AvlPropertyConfig;
  fuelLevel?: number | AvlPropertyConfig;
  fuelConsumption?: number | AvlPropertyConfig;
  fuelRate?: number | AvlPropertyConfig;
  movingFuelAlpha?: number;

  // Accelerometer G-force axes
  accelX?: number | AvlPropertyConfig;
  accelY?: number | AvlPropertyConfig;
  accelZ?: number | AvlPropertyConfig;
}

export const DEVICE_PROFILES: Record<string, AvlMapping> = {
  TELTONIKA_STANDARD: {
    rpm: 36,
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 37,
    odometer: 16,
    highResOdometer: 389,
    engineLoad: 31,
    coolantTemp: 32,
    dtcCount: 30,
    faultCodes: 281,
    vin: 256,
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: { id: 102, multiplier: 0.0002777777777777778 }, // seconds to hours
    fuelLevel: 48,
    fuelConsumption: { id: 111, multiplier: 0.001 }, // ml to Liters
    fuelRate: { id: 163, multiplier: 0.1 }, // deciliters/h to L/h
    accelX: { id: 17, multiplier: 0.001, signed: true },
    accelY: { id: 18, multiplier: 0.001, signed: true },
    accelZ: { id: 19, multiplier: 0.001, signed: true },
  },
  TELTONIKA_FMC150: {
    rpm: 85,
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 81,
    odometer: 87,
    engineLoad: 31,
    coolantTemp: { id: 115, multiplier: 0.1 }, // 1/10 °C to Celsius
    dtcCount: 30,
    faultCodes: 281,
    vin: 325, // Corrected clash: CAN VIN is AVL 325
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: { id: 102, multiplier: 0.0002777777777777778 }, // seconds to hours
    fuelLevel: 89,
    fuelConsumption: 83, // Liters directly (no multiplier)
    fuelRate: { id: 110, multiplier: 0.1 }, // deciliters/h to L/h
    accelX: { id: 17, multiplier: 0.001, signed: true },
    accelY: { id: 18, multiplier: 0.001, signed: true },
    accelZ: { id: 19, multiplier: 0.001, signed: true },
  },
  TELTONIKA_FMC650: {
    rpm: 30, // CAN Adapters Engine RPM
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 33, // CAN Adapters Speed
    odometer: 36, // CAN Adapters Total Mileage (m)
    engineLoad: 31,
    coolantTemp: { id: 25, multiplier: 0.1 }, // CAN Adapters Engine Temp (1/10 °C)
    dtcCount: 30,
    faultCodes: 281,
    vin: 528,
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: { id: 102, multiplier: 0.0002777777777777778 }, // seconds to hours
    fuelLevel: 37, // CAN Adapters Fuel Level %
    fuelConsumption: { id: 17, multiplier: 0.1 }, // CAN Adapters Fuel Consumed (deciliters)
    fuelRate: { id: 18, multiplier: 0.1 }, // CAN Adapters Fuel Rate (deciliters/h)
  },
  TELTONIKA_FMC650_FMS: {
    rpm: 85, // FMS Engine RPM
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 81, // FMS Speed
    odometer: 192, // Tachograph Odometer (m)
    engineLoad: 31,
    coolantTemp: { id: 115, multiplier: 0.1 }, // FMS Engine Temp (1/10 °C)
    dtcCount: 30,
    faultCodes: 281,
    vin: 528,
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: { id: 88, multiplier: 0.05 }, // FMS Total Engine Hours (0.05 h resolution)
    fuelLevel: 87, // FMS Fuel Level %
    fuelConsumption: 86, // FMS Total Fuel Consumed (L)
    fuelRate: { id: 110, multiplier: 0.1 }, // FMS Fuel Rate (deciliters/h)
  },
};
