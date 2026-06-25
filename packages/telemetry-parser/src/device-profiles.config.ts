export interface AvlMapping {
  rpm?: number;
  voltage?: number;
  ignition?: number;
  movement?: number;
  obdSpeed?: number;
  odometer?: number;
  engineLoad?: number;
  coolantTemp?: number;
  dtcCount?: number;
  faultCodes?: number;
  vin?: number;
  tripStatus?: number; // AVL ID 250 (1 = Active, 0 = Inactive)
  ecoDrivingType?: number; // AVL ID 253
  ecoDrivingValueMax?: number; // AVL ID 254
  ecoDrivingDuration?: number; // AVL ID 243
  ecoDrivingAverage?: number; // AVL ID 259
  excessiveIdling?: number; // AVL ID 251
  crashTrace?: number;
  unplugged?: number; // AVL ID 252
  fuelType?: number; // AVL ID 759
}

export const DEVICE_PROFILES: Record<string, AvlMapping> = {
  TELTONIKA_STANDARD: {
    rpm: 36,
    voltage: 66,
    ignition: 239,
    movement: 240,
    obdSpeed: 37,
    odometer: 16,
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
  },
  TELTONIKA_FMC150: {
    rpm: 85,           // LVCAN Engine RPM
    voltage: 66,       // Physical voltage
    ignition: 239,     // Physical ignition pin
    movement: 240,     // Physical movement status
    obdSpeed: 81,      // LVCAN Speed
    odometer: 87,      // LVCAN Total Mileage
    engineLoad: 31,    // Standard engine load (remains fallback)
    coolantTemp: 115,  // LVCAN Engine Temperature
    dtcCount: 30,
    faultCodes: 281,
    vin: 82,           // LVCAN VIN
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
  },
  TELTONIKA_FMC650: {
    rpm: 85,           // LVCAN Engine RPM
    voltage: 66,       // Physical voltage
    ignition: 239,     // Physical ignition pin
    movement: 240,     // Physical movement status
    obdSpeed: 81,      // LVCAN Speed
    odometer: 87,      // LVCAN Total Mileage
    engineLoad: 31,    // Standard engine load
    coolantTemp: 115,  // LVCAN Engine Temperature
    dtcCount: 30,
    faultCodes: 281,
    vin: 82,           // LVCAN VIN
    tripStatus: 250,
    ecoDrivingType: 253,
    ecoDrivingValueMax: 258,
    ecoDrivingAverage: 259,
    ecoDrivingDuration: 260,
    excessiveIdling: 251,
    crashTrace: 257,
    unplugged: 252,
    fuelType: 759,
  },
};
