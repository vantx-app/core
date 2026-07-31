import { Test, TestingModule } from '@nestjs/testing';
import { OverspeedCalculationService } from './overspeed-calculation.service';
import { ValhallaRoutesClientService } from './valhalla-routes-client.service';
import { VehicleCategory } from '@prisma/client';

describe('OverspeedCalculationService', () => {
  let service: OverspeedCalculationService;
  let valhallaRoutesClientMock: any;

  beforeEach(async () => {
    valhallaRoutesClientMock = {
      calculateRouteWithSpeedLimits: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverspeedCalculationService,
        {
          provide: ValhallaRoutesClientService,
          useValue: valhallaRoutesClientMock,
        },
      ],
    }).compile();

    service = module.get<OverspeedCalculationService>(
      OverspeedCalculationService,
    );
  });

  describe('overspeeding calculations', () => {
    it('calculateOverspeedingFallback debe calcular el exceso de velocidad fallback correctamente', () => {
      const baseTime = new Date('2026-06-12T12:00:00Z');
      const logs = [
        { timestamp: new Date(baseTime.getTime() + 0), speed: 80 } as any,
        { timestamp: new Date(baseTime.getTime() + 10000), speed: 125 } as any, // 15 over fallback 110 + 10 grace (starts episode)
        { timestamp: new Date(baseTime.getTime() + 20000), speed: 123 } as any, // 13 over fallback 110 + 10 grace (continues episode)
        { timestamp: new Date(baseTime.getTime() + 30000), speed: 110 } as any, // 110 <= 120 (below threshold)
      ];
      const result = service.calculateOverspeedingFallback(logs, 110);
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
    });

    it('evaluateOverspeedingWithHereRoutes debe retornar 0 si hay menos de 2 logs con coordenadas válidas', async () => {
      const logs = [{ latitude: 0, longitude: 0, speed: 120 } as any];
      const result = await service.evaluateOverspeedingWithHereRoutes(
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
        { latitude: 9.998, longitude: -79.998, speed: 8 } as any,
      ];
      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
      expect(
        valhallaRoutesClientMock.calculateRouteWithSpeedLimits,
      ).not.toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHereRoutes debe retornar 0 sin llamar a la API si la distancia de la trip es < 0.1 km', async () => {
      const logs = [
        { latitude: 9.991, longitude: -79.991, speed: 120 } as any,
        { latitude: 9.9911, longitude: -79.9911, speed: 120 } as any, // very close
      ];
      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
      expect(
        valhallaRoutesClientMock.calculateRouteWithSpeedLimits,
      ).not.toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHereRoutes debe usar fallback si HERE API retorna null (error o suspendido)', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue(
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
      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10);
      expect(
        valhallaRoutesClientMock.calculateRouteWithSpeedLimits,
      ).toHaveBeenCalled();
    });

    it('evaluateOverspeedingWithHereRoutes debe usar los límites de velocidad de HERE API con buffer de 10km/h', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.PASSENGER,
      );
      // Log 1: speed 95, limit 80, threshold = 90 → overspeed (starts episode)
      // Log 2: speed 95, limit 80, threshold = 90 → overspeed (continues episode, duration = 5s)
      // Log 3: speed 58, limit 50, threshold = 60 → no overspeed (closes episode)
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(10); // Math.max(10, 5) = 10
    });

    it('evaluateOverspeedingWithHereRoutes debe enviar TravelMode Truck para HEAVY_DUTY y machinery', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.HEAVY_DUTY,
      );

      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(15);
      expect(
        valhallaRoutesClientMock.calculateRouteWithSpeedLimits,
      ).toHaveBeenCalledWith(expect.any(Array), 'Truck');
    });

    it('evaluateOverspeedingWithHereRoutes debe caer al limite general si no hay límite de span', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110,
        VehicleCategory.MACHINERY,
      );

      // speedLimit es null → usa fallbackOverspeedThreshold (110) → threshold = 120
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });

    it('evaluateOverspeedingWithHereRoutes debe usar fallback cuando el GPS está Off Route (> 20m del punto más cercano)', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110, // fallbackThreshold
        VehicleCategory.PASSENGER,
      );

      // Off Route → usa lastValidOnRouteSpeedLimit (inicializado en 110) → threshold = 120 → 80 < 120 → sin infracción
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });

    it('evaluateOverspeedingWithHereRoutes debe usar Inertial Fallback para puntos Off Route (heredar límite del último punto válido)', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs,
        110, // fallbackThreshold is 110, but since we had an on-route point of 50, off-route points must inherit 50
        VehicleCategory.PASSENGER,
      );

      // Si heredó 50: speed 65 > 50 + 10 = 60. Se inicia y continúa el episodio (duración 5s >= 5s), count = 1.
      // Si usara fallback general 110: speed 65 <= 110 + 10 = 120, count = 0.
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(30);
    });

    it('evaluateOverspeedingWithHereRoutes debe aplicar Smart Fallback cuando speedLimit es null basado en FC', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
        spans: [{ geometryOffset: 0, speedLimit: null, functionalClass: 1 }],
        geometry: [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
      });

      // Límite FC1 = 110. Threshold = 120.
      const logs = [
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 125,
          timestamp: new Date('2026-06-12T12:00:00Z'),
        },
        {
          latitude: 9.991,
          longitude: -79.991,
          speed: 125,
          timestamp: new Date('2026-06-12T12:00:05Z'),
        },
        {
          latitude: 9.998,
          longitude: -79.998,
          speed: 80,
          timestamp: new Date('2026-06-12T12:00:10Z'),
        },
      ];

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs as any,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
    });

    it('evaluateOverspeedingWithHereRoutes debe suspender la evaluación durante la ventana de gracia de desaceleración (drop >= 20 km/h)', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs as any,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(1);
      expect(result.overspeedSeverity).toBe(15);
    });

    it('evaluateOverspeedingWithHereRoutes debe descartar episodios con duración menor a 5 segundos', async () => {
      valhallaRoutesClientMock.calculateRouteWithSpeedLimits.mockResolvedValue({
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

      const result = await service.evaluateOverspeedingWithHereRoutes(
        logs as any,
        110,
        VehicleCategory.PASSENGER,
      );
      expect(result.overspeedCount).toBe(0);
      expect(result.overspeedSeverity).toBe(0);
    });
  });
});
