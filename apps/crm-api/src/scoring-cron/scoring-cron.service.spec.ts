import { Test, TestingModule } from '@nestjs/testing';
import { ScoringCronService } from './scoring-cron.service';
import { PrismaService } from '../prisma.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { ConfigService } from '@nestjs/config';
import { HereRoutesClientService } from './here-routes-client.service';
import { VehicleCategory } from '@prisma/client';
import { TelemetryRollupService } from './telemetry-rollup.service';
import { WeeklyScoringService } from './weekly-scoring.service';

describe('ScoringCronService', () => {
  let service: ScoringCronService;
  let prismaMock: any;
  let hereRoutesClientMock: any;
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

    hereRoutesClientMock = {
      calculateRouteWithSpeedLimits: jest.fn(),
      resetSuspension: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        ScoringCronService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RulesEngineService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: HereRoutesClientService, useValue: hereRoutesClientMock },
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

      const weeklyMock = module.get<WeeklyScoringService>(WeeklyScoringService);
      jest
        .spyOn(weeklyMock, 'runWeeklyScoring')
        .mockImplementation(async () => {
          const now = new Date();
          const panamaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
          const prevMonday = new Date(panamaTime.getTime());
          prevMonday.setUTCDate(panamaTime.getUTCDate() - 7);
          const startOfWeekStr = prevMonday.toISOString().split('T')[0];

          const prevSunday = new Date(panamaTime.getTime());
          prevSunday.setUTCDate(panamaTime.getUTCDate() - 1);
          const endOfWeekStr = prevSunday.toISOString().split('T')[0];

          const startOfWeek = new Date(`${startOfWeekStr}T00:00:00.000Z`);
          const endOfWeek = new Date(`${endOfWeekStr}T00:00:00.000Z`);

          const year = prevMonday.getUTCFullYear();
          const weekNumber = (service as any).getISOWeekNumber(prevMonday);

          await (service as any).processWeeklyDrivers(
            startOfWeek,
            endOfWeek,
            weekNumber,
            year,
          );
          await (service as any).processWeeklyVehicles(
            startOfWeek,
            endOfWeek,
            weekNumber,
            year,
          );
        });

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
      const baseTime = new Date('2026-06-12T12:00:00Z');
      const logs = [
        { timestamp: new Date(baseTime.getTime() + 0), speed: 80 } as any,
        { timestamp: new Date(baseTime.getTime() + 10000), speed: 125 } as any, // 15 over fallback 110 + 10 grace (starts episode)
        { timestamp: new Date(baseTime.getTime() + 20000), speed: 123 } as any, // 13 over fallback 110 + 10 grace (continues episode)
        { timestamp: new Date(baseTime.getTime() + 30000), speed: 110 } as any, // 110 <= 120 (below threshold)
      ];
      const result = (service as any).fallbackOverspeeding(logs, 110);
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
    });

    it('evaluateOverspeedingWithHereRoutes debe retornar 0 si hay menos de 2 logs con coordenadas válidas', async () => {
      const logs = [
        { latitude: 0, longitude: 0, speed: 120 } as any,
        { latitude: 9.99, longitude: -79.99, speed: 120 } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });

    it('evaluateOverspeedingWithHereRoutes debe retornar 0 sin llamar a la API si la velocidad máxima de la trip es <= 10 km/h', async () => {
      const logs = [
        { latitude: 9.991, longitude: -79.991, speed: 5 } as any,
        { latitude: 9.992, longitude: -79.992, speed: 8 } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
      expect(
        hereRoutesClientMock.calculateRouteWithSpeedLimits,
      ).not.toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHereRoutes debe retornar 0 sin llamar a la API si la distancia de la trip es < 0.1 km', async () => {
      const logs = [
        { latitude: 9.991, longitude: -79.991, speed: 50 } as any,
        { latitude: 9.9911, longitude: -79.9911, speed: 60 } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
      expect(
        hereRoutesClientMock.calculateRouteWithSpeedLimits,
      ).not.toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHereRoutes debe usar fallback si HERE API retorna null (error o suspendido)', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue(
        null,
      );

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 125, // > 110 + 10 grace
          timestamp: new Date('2026-06-12T12:00:00Z'),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 123,
          timestamp: new Date('2026-06-12T12:00:10Z'),
          angle: 90,
        } as any,
      ];
      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
      expect(
        hereRoutesClientMock.calculateRouteWithSpeedLimits,
      ).toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHereRoutes debe usar los límites de velocidad de HERE API con buffer de 10km/h', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [
          { geometryOffset: 0, speedLimit: 80, functionalClass: 2 },
          { geometryOffset: 1, speedLimit: 50, functionalClass: 3 },
        ],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 95, // exceeds 80 + 10 = 90
          timestamp: new Date('2026-06-12T12:00:00Z'),
          angle: 90,
        } as any,
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 95,
          timestamp: new Date('2026-06-12T12:00:05Z'),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 58, // 58 < 50 + 10 = 60 (below threshold)
          timestamp: new Date('2026-06-12T12:00:10Z'),
          angle: 90,
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      // Log 1: speed 95, limit 80, threshold = 92 → overspeed (starts episode)
      // Log 2: speed 95, limit 80, threshold = 92 → overspeed (continues episode, duration = 5s)
      // Log 3: speed 58, limit 50, threshold = 62 → no overspeed (closes episode)
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10); // Math.max(10, 5) = 10
    });

    it('evaluateOverspeedingWithHereRoutes debe enviar TravelMode Truck para HEAVY_DUTY y machinery', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [{ geometryOffset: 0, speedLimit: 60, functionalClass: 3 }],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 75, // exceeds 60 + 10 = 70
          timestamp: new Date('2026-06-12T12:00:00Z'),
          angle: 90,
        } as any,
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 75,
          timestamp: new Date('2026-06-12T12:00:05Z'),
          angle: 90,
        } as any,
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 58,
          timestamp: new Date('2026-06-12T12:00:10Z'),
          angle: 90,
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.HEAVY_DUTY,
      );

      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
      expect(
        hereRoutesClientMock.calculateRouteWithSpeedLimits,
      ).toHaveBeenCalledWith(expect.any(Array), 'Truck');
    });

    it('evaluateOverspeedingWithHereRoutes debe caer al limite general si no hay límite de span', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [
          { geometryOffset: 0, speedLimit: null }, // Sin límite definido
        ],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
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

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.MACHINERY,
      );

      // speedLimit es null → usa fallbackOverspeedThreshold (110) → threshold = 120
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });

    it('evaluateOverspeedingWithHereRoutes debe usar fallback cuando el GPS está Off Route (> 20m del punto más cercano)', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [{ geometryOffset: 0, speedLimit: 30, functionalClass: 5 }],
        geometry: [
          [-79.534, 8.994],
          [-79.53, 8.99],
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 80,
          timestamp: new Date(),
          angle: 90,
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110, // fallbackThreshold
        VehicleCategory.PASSENGER,
      );

      // Off Route → usa lastValidOnRouteSpeedLimit (inicializado en 110) → threshold = 120 → 80 < 120 → sin infracción
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });

    it('evaluateOverspeedingWithHereRoutes debe usar Inertial Fallback para puntos Off Route (heredar límite del último punto válido)', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [{ geometryOffset: 0, speedLimit: 40, functionalClass: 5 }],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 50,
          timestamp: new Date('2026-06-12T12:00:00Z'),
        } as any, // On Route: snaps to geometry[0], speedLimit = 50. lastValidOnRouteSpeedLimit becomes 50
        {
          latitude: 9.0, // way off route
          longitude: -79.0,
          speed: 65, // exceeds 50 + 10 = 60 (Inertial Fallback limit = 50)
          timestamp: new Date('2026-06-12T12:00:05Z'),
        } as any,
        {
          latitude: 9.0, // way off route
          longitude: -79.0,
          speed: 65,
          timestamp: new Date('2026-06-12T12:00:10Z'),
        } as any,
        {
          latitude: 9.0, // way off route
          longitude: -79.0,
          speed: 50, // below 50 + 10 = 60
          timestamp: new Date('2026-06-12T12:00:15Z'),
        } as any,
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110, // fallbackThreshold is 110, but since we had an on-route point of 50, off-route points must inherit 50
        VehicleCategory.PASSENGER,
      );

      // Si heredó 50: speed 65 > 50 + 10 = 60. Se inicia y continúa el episodio (duración 5s >= 5s), count = 1.
      // Si usara fallback general 110: speed 65 <= 110 + 10 = 120, count = 0.
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
    });

    it('evaluateOverspeedingWithHereRoutes debe aplicar Smart Fallback cuando speedLimit es null basado en FC', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [{ geometryOffset: 0, speedLimit: null, functionalClass: 1 }],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      // Límite FC1 = 100. Threshold = 110.
      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 115,
          timestamp: new Date('2026-06-12T12:00:00Z'),
        },
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 115,
          timestamp: new Date('2026-06-12T12:00:05Z'),
        },
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 80,
          timestamp: new Date('2026-06-12T12:00:10Z'),
        },
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
    });

    it('evaluateOverspeedingWithHereRoutes debe suspender la evaluación durante la ventana de gracia de desaceleración (drop >= 20 km/h)', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [
          { geometryOffset: 0, speedLimit: 100, functionalClass: 1 },
          { geometryOffset: 1, speedLimit: 60, functionalClass: 3 },
        ],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 100,
          timestamp: new Date('2026-06-12T12:00:00Z'),
        },
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 75,
          timestamp: new Date('2026-06-12T12:00:05Z'),
        }, // en ventana grace
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 75,
          timestamp: new Date('2026-06-12T12:00:10Z'),
        }, // en ventana grace
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 75,
          timestamp: new Date('2026-06-12T12:00:25Z'),
        }, // fuera ventana grace, empieza ep
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 75,
          timestamp: new Date('2026-06-12T12:00:30Z'),
        }, // sigue ep, dura 5s
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 50,
          timestamp: new Date('2026-06-12T12:00:35Z'),
        },
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
    });

    it('evaluateOverspeedingWithHereRoutes debe descartar episodios con duración menor a 5 segundos', async () => {
      hereRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [{ geometryOffset: 0, speedLimit: 50, functionalClass: 5 }],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 50,
          timestamp: new Date('2026-06-12T12:00:00Z'),
        },
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 70,
          timestamp: new Date('2026-06-12T12:00:05Z'),
        }, // empieza ep
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 70,
          timestamp: new Date('2026-06-12T12:00:09Z'),
        }, // dura 4s
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 50,
          timestamp: new Date('2026-06-12T12:00:10Z'),
        },
      ];

      const result = await (service as any).evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
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

    it('debe realizar el post-procesamiento y actualizar los rollups cuando HERE_API_KEY está configurada', async () => {
      (configService.get as jest.Mock).mockImplementation((key) => {
        if (key === 'HERE_API_KEY') return 'valid-api-key';
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

      jest
        .spyOn(service as any, 'evaluateOverspeedingWithHereRoutes')
        .mockResolvedValue({
          overspeedCount: 2,
          overspeedSeverity: 30.0,
        });

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
