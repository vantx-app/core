import { Test, TestingModule } from '@nestjs/testing';
import { ScoringCronService } from './scoring-cron.service';
import { PrismaService } from '../prisma.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { ConfigService } from '@nestjs/config';
import { HereClientService } from './here-client.service';
import { VehicleCategory } from '@prisma/client';

describe('ScoringCronService', () => {
  let service: ScoringCronService;
  let prismaMock: any;
  let hereClientMock: any;

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
      },
      telemetryLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      assignment: {
        findMany: jest.fn().mockResolvedValue([]),
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

    hereClientMock = {
      matchRoute: jest.fn(),
      resetSuspension: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringCronService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RulesEngineService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: HereClientService, useValue: hereClientMock },
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

  describe('getISOWeekNumber', () => {
    it('debe retornar el número de semana ISO correcto de forma independiente de la zona horaria', () => {
      const getWeek = (dateStr: string) => {
        const d = new Date(dateStr);
        return (service as any).getISOWeekNumber(d);
      };

      expect(getWeek('2026-01-01T00:00:00.000Z')).toBe(1);
      expect(getWeek('2025-12-31T00:00:00.000Z')).toBe(1);
      expect(getWeek('2026-06-01T00:00:00.000Z')).toBe(23);
      expect(getWeek('2026-06-07T00:00:00.000Z')).toBe(23);
    });
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

      await service.runDailyRollup();

      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);

      const secondCall = prismaMock.$executeRaw.mock.calls[1];
      const serializedCall = JSON.stringify(secondCall);
      expect(serializedCall).toContain('2026-06-01');
    });
  });

  describe('runWeeklyScoring date calculation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-08T08:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debe calcular el rango de la semana anterior (Lunes a Domingo) correctamente', async () => {
      const processDriversSpy = jest
        .spyOn(service as any, 'processWeeklyDrivers')
        .mockResolvedValue(undefined);
      const processVehiclesSpy = jest
        .spyOn(service as any, 'processWeeklyVehicles')
        .mockResolvedValue(undefined);

      await service.runWeeklyScoring();

      expect(processDriversSpy).toHaveBeenCalled();
      const [start, end, weekNum, year] = processDriversSpy.mock.calls[0] as [
        Date,
        Date,
        number,
        number,
      ];

      expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-06-07T00:00:00.000Z');
      expect(weekNum).toBe(23);
      expect(year).toBe(2026);

      expect(processVehiclesSpy).toHaveBeenCalledWith(
        start,
        end,
        weekNum,
        year,
      );
    });
  });
  describe('overspeeding calculations', () => {
    it('fallbackOverspeeding debe calcular el exceso de velocidad fallback correctamente', () => {
      const logs = [
        { speed: 80 } as any,
        { speed: 120 } as any, // 10 over fallback 110
        { speed: 115 } as any, // 5 over fallback 110
        { speed: 110 } as any,
      ];
      const result = (service as any).fallbackOverspeeding(logs, 110);
      expect(result.overspeedCount).toBe(2);
      expect(result.overspeedSeverity).toBe(15);
    });

    it('evaluateOverspeedingWithHere debe retornar 0 si hay menos de 2 logs con coordenadas válidas', async () => {
      const logs = [
        { latitude: 0, longitude: 0, speed: 120 } as any,
        { latitude: 9.99, longitude: -79.99, speed: 120 } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });

    it('evaluateOverspeedingWithHere debe retornar 0 sin llamar a la API si la velocidad máxima de la trip es <= 10 km/h', async () => {
      const logs = [
        { latitude: 9.991, longitude: -79.991, speed: 5 } as any,
        { latitude: 9.992, longitude: -79.992, speed: 8 } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
      expect(hereClientMock.matchRoute).not.toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHere debe retornar 0 sin llamar a la API si la distancia de la trip es < 0.1 km', async () => {
      const logs = [
        { latitude: 9.991, longitude: -79.991, speed: 50 } as any,
        { latitude: 9.9911, longitude: -79.9911, speed: 60 } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
      expect(hereClientMock.matchRoute).not.toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHere debe usar fallback si HERE API retorna null (error o suspendido)', async () => {
      hereClientMock.matchRoute.mockResolvedValue(null);

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 120,
          timestamp: new Date(),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 115,
          timestamp: new Date(),
          angle: 90,
        } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(2);
      expect(result.overspeedSeverity).toBe(15);
      expect(hereClientMock.matchRoute).toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHere debe usar los límites de velocidad de HERE API con buffer de 10km/h', async () => {
      hereClientMock.matchRoute.mockResolvedValue({
        tracePoints: [
          { linkIdMatched: 123 }, // positive -> FROM_REF_SPEED_LIMIT
          { linkIdMatched: -456 }, // negative -> TO_REF_SPEED_LIMIT
        ],
        RouteLinks: [
          {
            linkId: 123,
            attributes: {
              SPEED_LIMITS_FC1: [
                {
                  FROM_REF_SPEED_LIMIT: '80',
                  TO_REF_SPEED_LIMIT: '50',
                },
              ],
            },
          },
          {
            linkId: -456,
            attributes: {
              SPEED_LIMITS_FC3: [
                {
                  FROM_REF_SPEED_LIMIT: '30',
                  TO_REF_SPEED_LIMIT: '50',
                },
              ],
            },
          },
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 95,
          timestamp: new Date(),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 58,
          timestamp: new Date(),
          angle: 90,
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(15);
      expect(hereClientMock.matchRoute).toHaveBeenCalledWith(
        expect.stringContaining('TIMESTAMP,SPEED_KMH,HEADING'),
        'fastest;car',
        'SPEED_LIMITS_FCn(*)',
      );
    });

    it('evaluateOverspeedingWithHere debe enviar parametros de camion para HEAVY_DUTY y machinery', async () => {
      hereClientMock.matchRoute.mockResolvedValue({
        tracePoints: [{ linkIdMatched: 123 }],
        RouteLinks: [
          {
            linkId: 123,
            attributes: {
              TRUCK_SPEED_LIMITS_FC1: [
                {
                  FROM_REF_SPEED_LIMIT: '60',
                  TO_REF_SPEED_LIMIT: '50',
                },
              ],
            },
          },
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 75,
          timestamp: new Date(),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 58,
          timestamp: new Date(),
          angle: 90,
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.HEAVY_DUTY,
      );

      expect(result.overspeedCount).toBe(1); // 75 > 60 + 10 (70)
      expect(result.overspeedSeverity).toBe(15); // 75 - 60 = 15
      expect(hereClientMock.matchRoute).toHaveBeenCalledWith(
        expect.any(String),
        'fastest;truck',
        'SPEED_LIMITS_FCn(*),TRUCK_SPEED_LIMITS_FCn(*)',
      );
    });

    it('evaluateOverspeedingWithHere debe caer al limite general para camiones si no hay limite de camion especifico', async () => {
      hereClientMock.matchRoute.mockResolvedValue({
        tracePoints: [{ linkIdMatched: 123 }],
        RouteLinks: [
          {
            linkId: 123,
            attributes: {
              SPEED_LIMITS_FC1: [
                {
                  FROM_REF_SPEED_LIMIT: '80',
                  TO_REF_SPEED_LIMIT: '50',
                },
              ],
            },
          },
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 95,
          timestamp: new Date(),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 58,
          timestamp: new Date(),
          angle: 90,
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHere(
        logs,
        110,
        VehicleCategory.MACHINERY,
      );

      expect(result.overspeedCount).toBe(1); // 95 > 80 + 10 (90)
      expect(result.overspeedSeverity).toBe(15); // 95 - 80 = 15
    });
  });
});
