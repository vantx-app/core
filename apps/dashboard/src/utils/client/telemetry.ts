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
    const dateKey =
      typeof r.date === "string"
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
      const totalKm = groupRollups.reduce(
        (acc, r) => acc + (r.totalKm || 0),
        0,
      );
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

/**
 * Groups daily telemetry reports by vehicle, aggregating values for duplicate dates.
 *
 * @param dailyReports Array of daily telemetry reports.
 * @returns Array of grouped vehicle reports.
 */
export function groupDailyReportsByVehicle(dailyReports: any[]): any[] {
  const groups: Record<
    string,
    {
      vehicleId: string | null;
      vehicleAlias: string;
      vehiclePlate: string;
      totalKm: number;
      totalHours: number;
      reports: any[];
    }
  > = {};

  dailyReports.forEach((report) => {
    const v = report.vehicle;
    const vId = v?.id || "no-vehicle";
    if (!groups[vId]) {
      groups[vId] = {
        vehicleId: v?.id || null,
        vehicleAlias: v?.alias || "Sin Vehículo",
        vehiclePlate: v?.plateNumber || "",
        totalKm: 0,
        totalHours: 0,
        reports: [],
      };
    }

    // Calculate UTC date-only string for grouping (YYYY-MM-DD)
    const d = new Date(report.date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dayVal = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayVal}`;

    // Look for an existing report for this date in the vehicle group
    let existingReport = groups[vId].reports.find((r) => {
      const rd = new Date(r.date);
      const rYear = rd.getUTCFullYear();
      const rMonth = String(rd.getUTCMonth() + 1).padStart(2, "0");
      const rDay = String(rd.getUTCDate()).padStart(2, "0");
      return `${rYear}-${rMonth}-${rDay}` === dateStr;
    });

    if (existingReport) {
      // Aggregate values
      existingReport.totalKm += report.totalKm || 0;
      existingReport.totalEngineHours += report.totalEngineHours || 0;
      existingReport.idlingHours += report.idlingHours || 0;
      existingReport.overspeedCount += report.overspeedCount || 0;
      existingReport.brakingCount += report.brakingCount || 0;
      existingReport.corneringCount += report.corneringCount || 0;
      existingReport.accelerationCount += report.accelerationCount || 0;
      existingReport.deviceUnpluggedCount += report.deviceUnpluggedCount || 0;
      existingReport.activeFaultCodesCount += report.activeFaultCodesCount || 0;
      existingReport.highRpmCount += report.highRpmCount || 0;
      existingReport.coldEngineStrainCount += report.coldEngineStrainCount || 0;
      existingReport.coastingInNeutralCount +=
        report.coastingInNeutralCount || 0;
      existingReport.engineLuggingCount += report.engineLuggingCount || 0;
      existingReport.highLoadStrainCount += report.highLoadStrainCount || 0;
      existingReport.criticalOverheatingCount +=
        report.criticalOverheatingCount || 0;
    } else {
      // Clone the report object to avoid mutating the original prop data
      groups[vId].reports.push({
        ...report,
      });
    }

    groups[vId].totalKm += report.totalKm || 0;
    groups[vId].totalHours += report.totalEngineHours || 0;
  });

  // Sort reports inside each group by date descending
  Object.values(groups).forEach((g) => {
    g.reports.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  });

  return Object.values(groups);
}

/**
 * Groups daily telemetry rollups by month and year in Spanish.
 *
 * @param rollups Array of DailyTelemetryRollup items.
 * @returns Record mapping month/year label to rollups.
 */
export function groupRollupsByMonth(
  rollups: DailyTelemetryRollup[],
): Record<string, DailyTelemetryRollup[]> {
  const getMonthYearLabel = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const groupedRollups: Record<string, DailyTelemetryRollup[]> = {};
  rollups.forEach((day) => {
    const label = getMonthYearLabel(day.date);
    if (!groupedRollups[label]) {
      groupedRollups[label] = [];
    }
    groupedRollups[label].push(day);
  });

  return groupedRollups;
}
