import { Test, TestingModule } from '@nestjs/testing';
import { ScoringCronService } from './scoring-cron.service';
import { PrismaService } from 'src/prisma.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { ConfigService } from '@nestjs/config';
import { ValhallaRoutesClientService } from './valhalla-routes-client.service';
import { TelemetryRollupService } from './telemetry-rollup.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { VehicleCategory } from '@prisma/client';
import { OverspeedCalculationService } from './overspeed-calculation.service';

describe('ScoringCronService', () => {
  let service: ScoringCronService;
  let prismaMock: any;
  let valhallaRoutesClientMock: any;
  let overspeedCalculationMock: any;
  let module: TestingModule;

  beforeEach(async () => {
    prismaMock = {
      scoringProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      vehicle: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      driver: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyTelemetryRollup: {
        groupBy: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      telemetryLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      assignment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      driverScoreSnapshot: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      vehicleScoreSnapshot: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      driverGlobalStats: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      vehicleGlobalStats: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      trip: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prismaMock);
        }
        return cb;
      }),
    };

    valhallaRoutesClientMock = {
      calculateRouteWithSpeedLimits: jest.fn(),
      getValhallaUrl: jest.fn().mockReturnValue('http://localhost:8005'),
      resetSuspension: jest.fn(),
    };

    overspeedCalculationMock = {
      calculateOverspeedingFallback: jest.fn(),
      evaluateOverspeedingWithValhallaRoutes: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        ScoringCronService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RulesEngineService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ValhallaRoutesClientService, useValue: valhallaRoutesClientMock },
        {
          provide: OverspeedCalculationService,
          useValue: overspeedCalculationMock,
        },
        {
          provide: TelemetryRollupService,
          useValue: {
            runDailyRollup: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WeeklyScoringService,
          useValue: {
            runWeeklyScoring: jest.fn().mockResolvedValue(undefined),
            processWeeklyDrivers: jest.fn(),
            processWeeklyVehicles: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScoringCronService>(ScoringCronService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runDailyRollup date calculation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-02T07:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debe calcular "ayer" correctamente en la zona horaria de Panamá (UTC-5)', async () => {
      prismaMock.scoringProfile.findMany.mockResolvedValue([
        { id: 'mock-profile-id', rulesEngine: null },
      ]);
      prismaMock.vehicle.findMany
        .mockResolvedValueOnce([{ id: 'mock-vehicle-uuid' }])
        .mockResolvedValueOnce([]);

      const rollupMock = module.get<TelemetryRollupService>(
        TelemetryRollupService,
      );
      jest
        .spyOn(rollupMock, 'runDailyRollup')
        .mockImplementation(async (targetDate) => {
          let dateStr = targetDate;
          if (!dateStr) {
            const now = new Date();
            const panamaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
            panamaTime.setUTCDate(panamaTime.getUTCDate() - 1);
            dateStr = panamaTime.toISOString().split('T')[0];
          }
          await prismaMock.$executeRaw`DUMMY QUERY 1`;
          await prismaMock.$executeRaw`DUMMY QUERY 2 ${dateStr}`;
        });

      await service.runDailyRollup();

      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);

      const secondCall = prismaMock.$executeRaw.mock.calls[1];
      const serializedCall = JSON.stringify(secondCall);
      expect(serializedCall).toContain('2026-06-01');
    });
  });

  describe('runDailyRollup post-processing with HERE', () => {
    let configService: ConfigService;

    beforeEach(() => {
      configService = module.get<ConfigService>(ConfigService);
      prismaMock.dailyTelemetryRollup.findMany = jest
        .fn()
        .mockResolvedValue([]);
      prismaMock.dailyTelemetryRollup.update = jest.fn().mockResolvedValue({});
    });

    it('debe realizar el post-procesamiento usando fallback si HERE_API_KEY no está configurada', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      const mockRollup = {
        id: 'rollup-id-1',
        tripId: 'trip-id-1',
        driverId: 'driver-id-1',
        vehicleId: 'vehicle-id-1',
      };
      prismaMock.dailyTelemetryRollup.findMany.mockResolvedValue([mockRollup]);

      prismaMock.vehicle.findMany.mockResolvedValue([
        {
          id: 'vehicle-id-1',
          category: VehicleCategory.PASSENGER,
          scoringProfileId: 'profile-id-1',
        },
      ]);

      prismaMock.scoringProfile.findMany.mockResolvedValue([
        {
          id: 'profile-id-1',
          rulesEngine: {
            rules: [{ code: 'OVERSPEEDING', threshold: 100 }],
          },
        },
      ]);

      const mockLogs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 120,
          timestamp: new Date('2026-06-12T12:00:00Z'),
        },
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 120,
          timestamp: new Date('2026-06-12T12:00:05Z'),
        },
        {
          latitude: 9.992,
          longitude: -79.992,
          speed: 110,
          timestamp: new Date('2026-06-12T12:00:10Z'),
        },
      ];
      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs);

      overspeedCalculationMock.evaluateOverspeedingWithValhallaRoutes.mockResolvedValue({
        overspeedCount: 1,
        overspeedSeverity: 10,
      });

      await service.runDailyRollup('2026-06-01');

      expect(prismaMock.dailyTelemetryRollup.findMany).toHaveBeenCalled();
      expect(prismaMock.dailyTelemetryRollup.update).toHaveBeenCalledWith({
        where: { id: 'rollup-id-1' },
        data: {
          overspeedCount: 1,
          overspeedSeverity: 10,
        },
      });
    });

    it('debe realizar el post-procesamiento y actualizar los rollups cuando Valhalla está disponible', async () => {
      (configService.get as jest.Mock).mockImplementation((key) => {
        if (key === 'VALHALLA_URL') return 'http://localhost:8005';
        return undefined;
      });

      const mockRollup = {
        id: 'rollup-id-1',
        tripId: 'trip-id-1',
        driverId: 'driver-id-1',
        vehicleId: 'vehicle-id-1',
      };
      prismaMock.dailyTelemetryRollup.findMany.mockResolvedValue([mockRollup]);

      prismaMock.vehicle.findMany.mockResolvedValue([
        {
          id: 'vehicle-id-1',
          category: VehicleCategory.PASSENGER,
          scoringProfileId: 'profile-id-1',
        },
      ]);

      prismaMock.scoringProfile.findMany.mockResolvedValue([
        {
          id: 'profile-id-1',
          rulesEngine: {
            rules: [{ code: 'OVERSPEEDING', threshold: 100 }],
          },
        },
      ]);

      const mockLogs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 120,
          timestamp: new Date(),
        },
        {
          latitude: 9.992,
          longitude: -79.992,
          speed: 110,
          timestamp: new Date(),
        },
      ];
      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs);

      overspeedCalculationMock.evaluateOverspeedingWithValhallaRoutes.mockResolvedValue(
        {
          overspeedCount: 2,
          overspeedSeverity: 30.0,
        },
      );

      await service.runDailyRollup('2026-06-01');

      expect(prismaMock.dailyTelemetryRollup.findMany).toHaveBeenCalledWith({
        where: {
          date: new Date('2026-06-01'),
          tripId: { not: null },
          driverId: { not: null },
        },
        select: {
          id: true,
          tripId: true,
          driverId: true,
          vehicleId: true,
        },
      });

      expect(prismaMock.dailyTelemetryRollup.update).toHaveBeenCalledWith({
        where: { id: 'rollup-id-1' },
        data: {
          overspeedCount: 2,
          overspeedSeverity: 30.0,
        },
      });
    });
  });
});
