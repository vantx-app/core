import { Test, TestingModule } from '@nestjs/testing';
import { WeeklyScoringService } from './weekly-scoring.service';
import { PrismaService } from 'src/prisma.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';

describe('WeeklyScoringService', () => {
  let service: WeeklyScoringService;
  let prismaMock: any;
  let module: TestingModule;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prismaMock);
        }
        return cb;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        WeeklyScoringService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RulesEngineService, useValue: {} },
      ],
    }).compile();

    service = module.get<WeeklyScoringService>(WeeklyScoringService);
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
});
