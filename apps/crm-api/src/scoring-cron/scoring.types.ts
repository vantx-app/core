/**
 * Forma del resultado de Prisma groupBy con _sum sobre DailyTelemetryRollup.
 * Usado por el RulesEngineService para evaluar métricas semanales.
 */
export interface RollupSumFields {
  totalKm?: number | null;
  totalEngineHours?: number | null;
  idlingHours?: number | null;
  overspeedCount?: number | null;
  overspeedSeverity?: number | null;
  brakingCount?: number | null;
  brakingSeverity?: number | null;
  corneringCount?: number | null;
  corneringSeverity?: number | null;
  accelerationCount?: number | null;
  accelerationSeverity?: number | null;
  highRpmCount?: number | null;
  highRpmSeverity?: number | null;
  coldEngineStrainCount?: number | null;
  coastingInNeutralCount?: number | null;
  engineLuggingCount?: number | null;
  highLoadStrainCount?: number | null;
  criticalOverheatingCount?: number | null;
  activeFaultCodesCount?: number | null;
  deviceUnpluggedCount?: number | null;
}

export interface WeeklySummaryAggregate {
  vehicleId?: string;
  driverId?: string | null;
  _sum: RollupSumFields;
}
