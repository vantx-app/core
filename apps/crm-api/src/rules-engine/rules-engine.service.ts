import { Injectable } from '@nestjs/common';
import {
  RuleEngineConfig,
  ScoringResult,
  DetailedScoringResult,
  RuleDeductionDetail,
} from 'src/scoring-cron/scoring.interfaces';
import { WeeklySummaryAggregate } from 'src/scoring-cron/scoring.types';

@Injectable()
export class RulesEngineService {
  // Si no hay datos suficientes, devolvemos 100 perfectos
  public defaultScore(
    totalKm = 0,
    totalHours = 0,
    idlingHours = 0,
  ): ScoringResult {
    return {
      totalKm,
      totalHours,
      idlingHours,
      safetyScore: 100,
      ecoScore: 100,
      assetScore: 100,
      overallScore: 100,
    };
  }

  /**
   * Evalúa los resúmenes semanales obtenidos de la tabla DailyTelemetryRollup
   * @param weeklySummary Resultado del Prisma groupBy (_sum)
   * @param config El JSON de reglas aplicable a este vehículo/perfil
   */
  public evaluateAggregatedRollup(
    weeklySummary: WeeklySummaryAggregate,
    config: RuleEngineConfig,
  ): ScoringResult {
    return this.evaluateAggregatedRollupWithDetails(weeklySummary, config)
      .scores;
  }

  /**
   * Evalúa los resúmenes semanales obtenidos de la tabla DailyTelemetryRollup
   * y devuelve el desglose de deducciones por regla.
   */
  public evaluateAggregatedRollupWithDetails(
    weeklySummary: WeeklySummaryAggregate,
    config: RuleEngineConfig,
  ): DetailedScoringResult {
    const totalKm = parseFloat((weeklySummary._sum.totalKm || 0).toFixed(2));
    const totalHours = parseFloat(
      (weeklySummary._sum.totalEngineHours || 0).toFixed(2),
    );
    const idlingHours = parseFloat(
      (weeklySummary._sum.idlingHours || 0).toFixed(2),
    );

    if (totalKm < 1.0) {
      const def = this.defaultScore(totalKm, totalHours, idlingHours);
      return {
        scores: def,
        ruleDeductions: [],
        pillarDeductions: { SAFETY: 0, EFFICIENCY: 0, ASSET_CARE: 0 },
      };
    }

    const deductions = { SAFETY: 0, EFFICIENCY: 0, ASSET_CARE: 0 };
    const ruleDeductions: RuleDeductionDetail[] = [];

    // DICCIONARIO DE MAPEO: Conecta los códigos exactos del JSON con las columnas de Prisma
    const propertyMap: Record<string, string> = {
      OVERSPEEDING: 'overspeed',
      HARSH_BRAKING: 'braking',
      HARSH_CORNERING: 'cornering',
      HARSH_ACCELERATION: 'acceleration',
      HIGH_RPM: 'highRpm',
      COLD_ENGINE_STRAIN: 'coldEngineStrain',
      COASTING_IN_NEUTRAL: 'coastingInNeutral',
      ENGINE_LUGGING: 'engineLugging',
      HIGH_LOAD_STRAIN: 'highLoadStrain',
      CRITICAL_OVERHEATING: 'criticalOverheating',
      ACTIVE_FAULT_CODES: 'activeFaultCodes',
      DEVICE_UNPLUGGED: 'deviceUnplugged',
    };

    const spanishLabels: Record<string, string> = {
      OVERSPEEDING: 'Exceso de velocidad',
      HARSH_BRAKING: 'Frenado brusco',
      HARSH_CORNERING: 'Giro brusco',
      HARSH_ACCELERATION: 'Aceleración brusca',
      HIGH_RPM: 'Altas RPM',
      EXCESSIVE_IDLING: 'Ralentí excesivo',
      DEVICE_UNPLUGGED: 'Dispositivo desconectado',
      COLD_ENGINE_STRAIN: 'Esfuerzo con motor frío',
      COASTING_IN_NEUTRAL: 'Conducción en neutro (coasting)',
      ENGINE_LUGGING: 'Sobreesfuerzo a bajas RPM (lugging)',
      HIGH_LOAD_STRAIN: 'Esfuerzo con alta carga',
      CRITICAL_OVERHEATING: 'Sobrecalentamiento crítico',
      ACTIVE_FAULT_CODES: 'Códigos de falla activos',
    };

    for (const rule of config.rules) {
      let deduction = 0;
      let occurrences = 0;
      let severity = 0;

      // --- 1. EXTRACCIÓN DE DATOS ---
      if (rule.code === 'EXCESSIVE_IDLING') {
        // Ralentí: convertimos a unidades equivalentes (15 min por unidad)
        occurrences = Math.floor(idlingHours * 4);
      } else {
        // Para el resto de eventos, usamos el mapeo seguro
        const baseKey = propertyMap[rule.code];
        if (baseKey) {
          occurrences = Number(weeklySummary._sum[`${baseKey}Count`] || 0);
          severity = Number(weeklySummary._sum[`${baseKey}Severity`] || 0);
        }
      }

      // --- 2. CÁLCULO DE DEDUCCIONES ---
      if (rule.deductionPerSeverityUnit && severity > 0) {
        const severityPer100Km = (severity / totalKm) * 100.0;
        deduction = severityPer100Km * rule.deductionPerSeverityUnit;
      } else if (rule.deductionPer100Km) {
        const ratePer100Km = (occurrences / totalKm) * 100.0;
        deduction = ratePer100Km * rule.deductionPer100Km;
      } else if (rule.deductionPerEvent) {
        deduction = occurrences * rule.deductionPerEvent;
      } else if (rule.deductionFixed && occurrences > 0) {
        deduction = rule.deductionFixed;
      }

      // --- 3. APLICACIÓN DE TOPES ---
      const appliedDeduction = Math.min(deduction, rule.maxDeduction);
      deductions[rule.pillar] += appliedDeduction;

      ruleDeductions.push({
        code: rule.code,
        pillar: rule.pillar,
        label: spanishLabels[rule.code] || rule.code,
        occurrences,
        severity,
        rawDeduction: parseFloat(deduction.toFixed(2)),
        appliedDeduction: parseFloat(appliedDeduction.toFixed(2)),
      });
    }

    // Calculamos las puntuaciones base asegurando que nunca bajen de 0
    const safetyScore = parseFloat(
      Math.max(0, config.pillars.SAFETY.baseScore - deductions.SAFETY).toFixed(
        2,
      ),
    );
    const ecoScore = parseFloat(
      Math.max(
        0,
        config.pillars.EFFICIENCY.baseScore - deductions.EFFICIENCY,
      ).toFixed(2),
    );
    const assetScore = parseFloat(
      Math.max(
        0,
        config.pillars.ASSET_CARE.baseScore - deductions.ASSET_CARE,
      ).toFixed(2),
    );

    // Fórmula global ponderada del perfil
    const overallScore = parseFloat(
      (
        safetyScore * config.pillars.SAFETY.weight +
        ecoScore * config.pillars.EFFICIENCY.weight +
        assetScore * config.pillars.ASSET_CARE.weight
      ).toFixed(2),
    );

    return {
      scores: {
        totalKm,
        totalHours,
        idlingHours,
        overallScore,
        safetyScore,
        ecoScore,
        assetScore,
      },
      ruleDeductions,
      pillarDeductions: {
        SAFETY: parseFloat(deductions.SAFETY.toFixed(2)),
        EFFICIENCY: parseFloat(deductions.EFFICIENCY.toFixed(2)),
        ASSET_CARE: parseFloat(deductions.ASSET_CARE.toFixed(2)),
      },
    };
  }
}
