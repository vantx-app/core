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
  fuelLevelLiters?: number | AvlPropertyConfig;
  fuelConsumption?: number | AvlPropertyConfig;
  fuelRate?: number | AvlPropertyConfig;
  maf?: number | AvlPropertyConfig;
  throttlePosition?: number | AvlPropertyConfig;
  intakeAirTemp?: number | AvlPropertyConfig;
  intakeMap?: number | AvlPropertyConfig;
  ambientAirTemp?: number | AvlPropertyConfig;
  barometricPressure?: number | AvlPropertyConfig;
  oilTemp?: number | AvlPropertyConfig;
  fuelPressure?: number | AvlPropertyConfig;
  shortFuelTrim?: number | AvlPropertyConfig;
  vehicleWeight?: number | AvlPropertyConfig;
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
    coolantTemp: { id: 32, signed: true },
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
    engineHours: { id: 42, multiplier: 0.0002777777777777778 }, // OBD Runtime since engine start (seconds to hours)
    fuelLevel: 48,
    fuelLevelLiters: { id: 390, multiplier: 0.1 }, // OBD OEM Fuel Level (0.1 L to Liters)
    fuelConsumption: { id: 12, multiplier: 0.001 }, // Fuel Used GPS (ml to Liters)
    fuelRate: { id: 60, multiplier: 0.01 }, // OBD Engine Fuel Rate (L/h*100 to L/h)
    maf: { id: 40, multiplier: 0.01 }, // 0.01 g/s to g/s
    throttlePosition: 41, // OBD Throttle position (0-100 %)
    intakeAirTemp: { id: 39, signed: true }, // OBD Intake air temperature (-128 to 127 °C)
    intakeMap: 35, // OBD Intake manifold absolute pressure (0-255 kPa)
    ambientAirTemp: { id: 53, signed: true }, // OBD Ambient air temperature (-128 to 127 °C)
    barometricPressure: 50, // OBD Barometric pressure (0-255 kPa)
    oilTemp: 58, // OBD Engine oil temperature (0-215 °C)
    fuelPressure: 34, // OBD Fuel pressure (0-765 kPa)
    shortFuelTrim: { id: 33, signed: true }, // OBD Short term fuel trim 1 (-100 to 99 %)
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
    coolantTemp: { id: 115, multiplier: 0.1, signed: true }, // CAN Engine Temperature (1/10 °C to Celsius)
    dtcCount: 30,
    faultCodes: 281,
    vin: 325, // CAN VIN is AVL 325
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: { id: 102, multiplier: 0.016666666666666666 }, // CAN Engine Worktime (minutes to hours)
    fuelLevel: 89,
    fuelLevelLiters: { id: 84, multiplier: 0.1 }, // CAN Fuel Level (0.1 Liters to Liters)
    fuelConsumption: { id: 83, multiplier: 0.1 }, // CAN Fuel Consumed (0.1 Liters to Liters)
    fuelRate: { id: 60, multiplier: 0.01 }, // CAN/OBD Fuel Rate (L/h*100 to L/h)
    maf: { id: 40, multiplier: 0.01 }, // OBD MAF (0.01 g/s to g/s)
    throttlePosition: 82, // CAN Throttle position (0-102 %)
    intakeAirTemp: { id: 1353, signed: true }, // CAN Engine intake air temperature (-40 to 210 °C)
    intakeMap: 1352, // CAN Engine Air Intake Pressure (kPa)
    ambientAirTemp: { id: 1396, signed: true }, // CAN Ambient Air Temperature (-60 to 127 °C)
    barometricPressure: 50, // Barometric Pressure (0-255 kPa)
    oilTemp: { id: 1270, signed: true }, // CAN Engine Oil Temperature (-60 to 127 °C)
    fuelPressure: 34, // OBD Fuel Pressure (0-765 kPa)
    shortFuelTrim: { id: 33, signed: true }, // OBD Short Fuel Trim (-100 to 99 %)
    vehicleWeight: 1220, // CAN Load Weight / Combination vehicle weight (kg)
    accelX: { id: 17, multiplier: 0.001, signed: true },
    accelY: { id: 18, multiplier: 0.001, signed: true },
    accelZ: { id: 19, multiplier: 0.001, signed: true },
  },
  TELTONIKA_FMC650: {
    rpm: 35, // LVCAN Engine RPM (0-16384 rpm)
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 30, // Vehicle speed (km/h)
    odometer: 36, // LVCAN Total Mileage (m)
    engineLoad: 23, // LVCAN Engine Load (0-130 %)
    coolantTemp: { id: 25, multiplier: 0.1, signed: true }, // LVCAN Engine Temperature (1/10 °C)
    dtcCount: 176, // LVCAN DTC Errors
    faultCodes: 525, // LVCAN Fault Codes
    vin: 528,
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 243, // FMC650 Idling
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: { id: 14, multiplier: 0.016666666666666666 }, // LVCAN Engine Worktime (minutes to hours)
    fuelLevel: 37, // LVCAN Fuel Level Percent (%)
    fuelLevelLiters: { id: 34, multiplier: 0.1 }, // LVCAN Fuel Level Liters (0.1 L to L)
    fuelConsumption: { id: 33, multiplier: 0.1 }, // LVCAN Fuel Consumed (0.1 L to L)
    fuelRate: { id: 18, multiplier: 0.1 }, // LVCAN Fuel Rate (0.1 L/h to L/h)
    throttlePosition: 31, // LVCAN Accelerator Pedal Position (%)
    ambientAirTemp: { id: 128, signed: true }, // Ambient Air Temperature (°C)
    vehicleWeight: 521, // LVCAN Load Weight (kg)
    accelX: { id: 236, multiplier: 0.001, signed: true },
    accelY: { id: 237, multiplier: 0.001, signed: true },
    accelZ: { id: 238, multiplier: 0.001, signed: true },
  },
  TELTONIKA_FMC650_FMS: {
    rpm: 88, // FMS Engine Speed (0-8032 rpm)
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 80, // FMS Wheel based speed (km/h)
    odometer: 192, // FMS / Tacho Odometer (m)
    engineLoad: 85, // FMS Engine Current Load (0-125 %)
    coolantTemp: { id: 127, signed: true }, // FMS Engine Coolant Temperature (-40 to 210 °C)
    dtcCount: 10493, // FMS DTC DM1
    faultCodes: 10494, // FMS DTC DM1 List
    vin: 528,
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 243, // FMC650 Idling
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
    engineHours: 104, // FMS Engine Total Hours Of Operation
    fuelLevel: 87, // FMS Fuel Level (0-102 %)
    fuelConsumption: 86, // FMS Engine total fuel used (L)
    fuelRate: { id: 135, multiplier: 0.1 }, // FMS Fuel rate (L/h)
    throttlePosition: 84, // FMS Acceleration Pedal Position (0-102 %)
    ambientAirTemp: { id: 128, signed: true }, // Ambient Air Temperature (°C)
    vehicleWeight: 139, // FMS Gross Combination Vehicle Weight (kg)
    accelX: { id: 236, multiplier: 0.001, signed: true },
    accelY: { id: 237, multiplier: 0.001, signed: true },
    accelZ: { id: 238, multiplier: 0.001, signed: true },
  },
};
