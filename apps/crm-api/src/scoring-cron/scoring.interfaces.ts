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
