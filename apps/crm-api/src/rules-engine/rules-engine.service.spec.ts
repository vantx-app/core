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
});
