import { Test, TestingModule } from '@nestjs/testing';
import { ScoringCronService } from './scoring-cron.service';
import { PrismaService } from '../prisma.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';

describe('ScoringCronService', () => {
  let service: ScoringCronService;
  let prismaMock: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringCronService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RulesEngineService, useValue: {} },
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

      // 1 de Enero de 2026 es Jueves (debe ser semana 1 de 2026)
      expect(getWeek('2026-01-01T00:00:00.000Z')).toBe(1);

      // 31 de Diciembre de 2025 es Miércoles. El jueves de esa semana es 1 de Enero de 2026.
      // Por ende, el 31 de Dic de 2025 pertenece a la semana 1 del año 2026.
      expect(getWeek('2025-12-31T00:00:00.000Z')).toBe(1);

      // 1 de Junio de 2026 es Lunes (semana 23)
      expect(getWeek('2026-06-01T00:00:00.000Z')).toBe(23);

      // 7 de Junio de 2026 es Domingo (semana 23)
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
      // Mockear perfiles y vehículos para que entre al bucle y ejecute el query principal
      prismaMock.scoringProfile.findMany.mockResolvedValue([
        { id: 'mock-profile-id', rulesEngine: null },
      ]);
      prismaMock.vehicle.findMany
        .mockResolvedValueOnce([{ id: 'mock-vehicle-uuid' }])
        .mockResolvedValueOnce([]); // segunda llamada retorna vacio para cortar el while

      await service.runDailyRollup();

      // Debe haber llamado a $executeRaw dos veces: 1 para purgar y 1 para el rollup diario
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
      // Espiar processWeeklyDrivers para verificar los parámetros recibidos
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

      // El rango del query debe ser exacto a la semana anterior en UTC
      expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-06-07T00:00:00.000Z');
      expect(weekNum).toBe(23); // Semana 23
      expect(year).toBe(2026);

      expect(processVehiclesSpy).toHaveBeenCalledWith(
        start,
        end,
        weekNum,
        year,
      );
    });
  });
});
