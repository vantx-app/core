export interface RulePillar {
  weight: number;
  baseScore: number;
}

export interface RuleConfig {
  code: string;
  pillar: 'SAFETY' | 'EFFICIENCY' | 'ASSET_CARE';
  threshold?: number;
  maxThreshold?: number;
  deductionPer100Km?: number;
  deductionPerSeverityUnit?: number; // Nueva métrica para castigar excesos proporcionales
  deductionPerEvent?: number;
  deductionFixed?: number;
  maxDeduction: number;
}

export interface RuleEngineConfig {
  engineVersion: string;
  priorDistanceForNormalization?: number;
  pillars: {
    SAFETY: RulePillar;
    EFFICIENCY: RulePillar;
    ASSET_CARE: RulePillar;
  };
  rules: RuleConfig[];
}

export interface ScoringResult {
  totalKm: number;
  totalHours: number;
  idlingHours: number;
  safetyScore: number;
  ecoScore: number;
  assetScore: number;
  overallScore: number;
}

export interface RuleDeductionDetail {
  code: string;
  pillar: 'SAFETY' | 'EFFICIENCY' | 'ASSET_CARE';
  label: string;
  occurrences: number;
  severity: number;
  rawDeduction: number;
  appliedDeduction: number;
}

export interface DetailedScoringResult {
  scores: ScoringResult;
  ruleDeductions: RuleDeductionDetail[];
  pillarDeductions: {
    SAFETY: number;
    EFFICIENCY: number;
    ASSET_CARE: number;
  };
}

export const DEFAULT_RULE_ENGINE_CONFIG: RuleEngineConfig = {
  engineVersion: '1.0',
  pillars: {
    SAFETY: { weight: 0.45, baseScore: 100 },
    EFFICIENCY: { weight: 0.3, baseScore: 100 },
    ASSET_CARE: { weight: 0.25, baseScore: 100 },
  },
  rules: [
    {
      code: 'OVERSPEEDING',
      pillar: 'SAFETY',
      deductionPer100Km: 6.0,
      maxDeduction: 20.0,
    },
    {
      code: 'EXCESSIVE_IDLING',
      pillar: 'EFFICIENCY',
      deductionPer100Km: 5.0,
      maxDeduction: 15.0,
    },
    {
      code: 'HIGH_RPM',
      pillar: 'ASSET_CARE',
      deductionPer100Km: 5.0,
      maxDeduction: 20.0,
    },
    {
      code: 'DEVICE_UNPLUGGED',
      pillar: 'ASSET_CARE',
      deductionPerEvent: 10.0,
      maxDeduction: 30.0,
    },
  ],
};
