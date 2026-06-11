import { Test, TestingModule } from '@nestjs/testing';
import { RulesEngineService } from './rules-engine.service';

describe('RulesEngineService', () => {
  let service: RulesEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RulesEngineService],
    }).compile();

    service = module.get<RulesEngineService>(RulesEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should deduct score correctly for DEVICE_UNPLUGGED rule', () => {
    const weeklySummary = {
      _sum: {
        totalKm: 100,
        totalEngineHours: 10,
        idlingHours: 0,
        deviceUnpluggedCount: 1,
      },
    };

    const config: any = {
      engineVersion: '1.0',
      pillars: {
        SAFETY: { weight: 0.4, baseScore: 100 },
        EFFICIENCY: { weight: 0.2, baseScore: 100 },
        ASSET_CARE: { weight: 0.4, baseScore: 100 },
      },
      rules: [
        {
          code: 'DEVICE_UNPLUGGED',
          pillar: 'ASSET_CARE',
          deductionFixed: 20,
          maxDeduction: 60,
        },
      ],
    };

    const result = service.evaluateAggregatedRollup(weeklySummary, config);

    expect(result.assetScore).toBe(80);
    // Overall score = safetyScore (100) * 0.4 + ecoScore (100) * 0.2 + assetScore (80) * 0.4 = 40 + 20 + 32 = 92
    expect(result.overallScore).toBe(92);
  });

  it('should deduct score correctly using deductionPerSeverityUnit', () => {
    const weeklySummary = {
      _sum: {
        totalKm: 200,
        totalEngineHours: 10,
        idlingHours: 0,
        brakingCount: 1,
        brakingSeverity: 5.0,
      },
    };

    const config: any = {
      engineVersion: '1.0',
      priorDistanceForNormalization: 0,
      pillars: {
        SAFETY: { weight: 0.5, baseScore: 100 },
        EFFICIENCY: { weight: 0.2, baseScore: 100 },
        ASSET_CARE: { weight: 0.3, baseScore: 100 },
      },
      rules: [
        {
          code: 'HARSH_BRAKING',
          pillar: 'SAFETY',
          deductionPerSeverityUnit: 12.0,
          maxDeduction: 40,
        },
      ],
    };

    const result = service.evaluateAggregatedRollup(weeklySummary, config);

    expect(result.safetyScore).toBe(70); // 100 - 30
    // Overall score = safetyScore (70) * 0.5 + ecoScore (100) * 0.2 + assetScore (100) * 0.3 = 35 + 20 + 30 = 85
    expect(result.overallScore).toBe(85);
  });

  it('should apply default prior of 100km when priorDistanceForNormalization is omitted', () => {
    const weeklySummary = {
      _sum: {
        totalKm: 5,
        totalEngineHours: 1,
        idlingHours: 0,
        overspeedCount: 1,
        overspeedSeverity: 0,
      },
    };

    const config: any = {
      engineVersion: '1.0',
      pillars: {
        SAFETY: { weight: 1.0, baseScore: 100 },
        EFFICIENCY: { weight: 0.0, baseScore: 100 },
        ASSET_CARE: { weight: 0.0, baseScore: 100 },
      },
      rules: [
        {
          code: 'OVERSPEEDING',
          pillar: 'SAFETY',
          deductionPer100Km: 15.0,
          maxDeduction: 50,
        },
      ],
    };

    const result = service.evaluateAggregatedRollup(weeklySummary, config);

    // den = 5 + 100 = 105 km
    // ratePer100Km = (1 / 105) * 100 = 0.95238
    // deduction = 0.95238 * 15 = 14.2857 -> rounded to 14.29
    // safetyScore = 100 - 14.29 = 85.71
    expect(result.safetyScore).toBe(85.71);
  });

  it('should respect custom priorDistanceForNormalization value if configured', () => {
    const weeklySummary = {
      _sum: {
        totalKm: 5,
        totalEngineHours: 1,
        idlingHours: 0,
        overspeedCount: 1,
        overspeedSeverity: 0,
      },
    };

    const config: any = {
      engineVersion: '1.0',
      priorDistanceForNormalization: 250.0,
      pillars: {
        SAFETY: { weight: 1.0, baseScore: 100 },
        EFFICIENCY: { weight: 0.0, baseScore: 100 },
        ASSET_CARE: { weight: 0.0, baseScore: 100 },
      },
      rules: [
        {
          code: 'OVERSPEEDING',
          pillar: 'SAFETY',
          deductionPer100Km: 15.0,
          maxDeduction: 50,
        },
      ],
    };

    const result = service.evaluateAggregatedRollup(weeklySummary, config);

    // den = 5 + 250 = 255 km
    // ratePer100Km = (1 / 255) * 100 = 0.39216
    // deduction = 0.39216 * 15 = 5.8824 -> rounded to 5.88
    // safetyScore = 100 - 5.88 = 94.12
    expect(result.safetyScore).toBe(94.12);
  });

  it('should compute correct progressive scores for low-mileage trips under Bayesian Prior Smoothing', () => {
    const weeklySummary = {
      _sum: {
        totalKm: 5,
        totalEngineHours: 1,
        idlingHours: 0,
        corneringCount: 1,
        corneringSeverity: 2.0,
      },
    };

    const config: any = {
      engineVersion: '1.0',
      pillars: {
        SAFETY: { weight: 1.0, baseScore: 100 },
        EFFICIENCY: { weight: 0.0, baseScore: 100 },
        ASSET_CARE: { weight: 0.0, baseScore: 100 },
      },
      rules: [
        {
          code: 'HARSH_CORNERING',
          pillar: 'SAFETY',
          deductionPerSeverityUnit: 10.0,
          maxDeduction: 40,
        },
      ],
    };

    const result = service.evaluateAggregatedRollup(weeklySummary, config);

    // den = 5 + 100 = 105 km
    // severityPer100Km = (2.0 / 105) * 100 = 1.90476
    // deduction = 1.90476 * 10.0 = 19.0476 -> rounded to 19.05
    // safetyScore = 100 - 19.05 = 80.95
    expect(result.safetyScore).toBe(80.95);
  });
});
