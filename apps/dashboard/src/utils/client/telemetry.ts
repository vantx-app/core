import { DailyTelemetryRollup } from "@/types";

/**
 * Condenses and groups a list of daily telemetry rollups by date and driver ID.
 * If a vehicle was driven by multiple drivers on the same day, they will have separate entries.
 *
 * @param raw Array of raw DailyTelemetryRollup items.
 * @returns Array of condensed DailyTelemetryRollup items, sorted from newest to oldest.
 */
export function condenseDailyRollupsByDriver(
  raw: DailyTelemetryRollup[],
): DailyTelemetryRollup[] {
  const groups: Record<string, DailyTelemetryRollup[]> = {};

  raw.forEach((r) => {
    const dateKey = typeof r.date === "string"
      ? r.date.split("T")[0]
      : new Date(r.date).toISOString().split("T")[0];
    const driverId = r.driver?.id || "unassigned";
    const key = `${dateKey}_${driverId}`;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(r);
  });

  const condensed: DailyTelemetryRollup[] = Object.entries(groups).map(
    ([groupKey, groupRollups]) => {
      const first = groupRollups[0];
      const totalKm = groupRollups.reduce((acc, r) => acc + (r.totalKm || 0), 0);
      const totalEngineHours = groupRollups.reduce(
        (acc, r) => acc + (r.totalEngineHours || 0),
        0,
      );
      const idlingHours = groupRollups.reduce(
        (acc, r) => acc + (r.idlingHours || 0),
        0,
      );
      const overspeedCount = groupRollups.reduce(
        (acc, r) => acc + (r.overspeedCount || 0),
        0,
      );
      const overspeedSeverity = groupRollups.reduce(
        (acc, r) => acc + (r.overspeedSeverity || 0),
        0,
      );
      const brakingCount = groupRollups.reduce(
        (acc, r) => acc + (r.brakingCount || 0),
        0,
      );
      const brakingSeverity = groupRollups.reduce(
        (acc, r) => acc + (r.brakingSeverity || 0),
        0,
      );
      const corneringCount = groupRollups.reduce(
        (acc, r) => acc + (r.corneringCount || 0),
        0,
      );
      const corneringSeverity = groupRollups.reduce(
        (acc, r) => acc + (r.corneringSeverity || 0),
        0,
      );
      const accelerationCount = groupRollups.reduce(
        (acc, r) => acc + (r.accelerationCount || 0),
        0,
      );
      const accelerationSeverity = groupRollups.reduce(
        (acc, r) => acc + (r.accelerationSeverity || 0),
        0,
      );
      const highRpmCount = groupRollups.reduce(
        (acc, r) => acc + (r.highRpmCount || 0),
        0,
      );
      const highRpmSeverity = groupRollups.reduce(
        (acc, r) => acc + (r.highRpmSeverity || 0),
        0,
      );
      const coldEngineStrainCount = groupRollups.reduce(
        (acc, r) => acc + (r.coldEngineStrainCount || 0),
        0,
      );
      const coastingInNeutralCount = groupRollups.reduce(
        (acc, r) => acc + (r.coastingInNeutralCount || 0),
        0,
      );
      const engineLuggingCount = groupRollups.reduce(
        (acc, r) => acc + (r.engineLuggingCount || 0),
        0,
      );
      const highLoadStrainCount = groupRollups.reduce(
        (acc, r) => acc + (r.highLoadStrainCount || 0),
        0,
      );
      const criticalOverheatingCount = groupRollups.reduce(
        (acc, r) => acc + (r.criticalOverheatingCount || 0),
        0,
      );
      const activeFaultCodesCount = groupRollups.reduce(
        (acc, r) => acc + (r.activeFaultCodesCount || 0),
        0,
      );
      const deviceUnpluggedCount = groupRollups.reduce(
        (acc, r) => acc + (r.deviceUnpluggedCount || 0),
        0,
      );

      const driver = first.driver || null;

      return {
        ...first,
        id: `${first.vehicleId}-${groupKey}`,
        date: first.date,
        driver,
        totalKm,
        totalEngineHours,
        idlingHours,
        overspeedCount,
        overspeedSeverity,
        brakingCount,
        brakingSeverity,
        corneringCount,
        corneringSeverity,
        accelerationCount,
        accelerationSeverity,
        highRpmCount,
        highRpmSeverity,
        coldEngineStrainCount,
        coastingInNeutralCount,
        engineLuggingCount,
        highLoadStrainCount,
        criticalOverheatingCount,
        activeFaultCodesCount,
        deviceUnpluggedCount,
      } as DailyTelemetryRollup;
    },
  );

  return condensed.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
