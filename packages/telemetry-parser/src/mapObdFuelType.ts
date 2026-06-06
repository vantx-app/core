const FUEL_TYPES: Record<string, number[]> = {
  GASOLINE: [1, 2, 3, 9, 10, 11],
  DIESEL: [4, 19],
  ELECTRIC: [8, 15, 20],
  HYBRID: [12, 13, 14, 16, 17, 21, 22, 5, 6, 7],
};

export function mapObdFuelType(
  val: any,
): 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | null {
  if (val === undefined || val === null) return null;
  const numVal = Number(val);
  if (isNaN(numVal)) return null;

  for (const fuelType in FUEL_TYPES) {
    if (FUEL_TYPES[fuelType].includes(numVal)) {
      return fuelType as 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
    }
  }

  return null;
}
