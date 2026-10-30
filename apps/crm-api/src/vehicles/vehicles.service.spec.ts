import { Test, TestingModule } from '@nestjs/testing';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AccessTokenPayload } from 'src/auth/types';
import { CacheService } from '../common/cache.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { ValhallaRoutesClientService } from '../scoring-cron/valhalla-routes-client.service';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prismaMock: {
    vehicle: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    vehicleLiveState: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    assignment: {
      findFirst: jest.Mock;
    };
    trackingLink: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    telemetryLog: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
    fuelEvent: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    trip: {
      findMany: jest.Mock;
      aggregate: jest.Mock;
      update: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };
  let cacheMock: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    delByPattern: jest.Mock;
    clear: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      vehicle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      vehicleLiveState: {
        findMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
      assignment: {
        findFirst: jest.fn(),
      },
      trackingLink: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      telemetryLog: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      fuelEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      trip: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { fuelConsumedLiters: 0 } }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CacheService, useValue: cacheMock },
        { provide: RulesEngineService, useValue: {} },
        { provide: ValhallaRoutesClientService, useValue: {} },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyVehicleAccess', () => {
    it('should allow access for SUPER_ADMIN without checking vehicle org', async () => {
      const payload: AccessTokenPayload = {
        sub: 'user-uuid',
        role: 'SUPER_ADMIN',
        orgId: 'org-uuid',
      };
      await expect(
        service.verifyVehicleAccess('vehicle-uuid', payload),
      ).resolves.not.toThrow();
      expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if vehicle does not exist', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue(null);
      const payload: AccessTokenPayload = {
        sub: 'user-uuid',
        role: 'ADMIN',
        orgId: 'org-uuid',
      };
      await expect(
        service.verifyVehicleAccess('vehicle-uuid', payload),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow access for ADMIN/OWNER of the same organization', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-uuid',
        orgId: 'org-uuid',
      });
      const payload: AccessTokenPayload = {
        sub: 'user-uuid',
        role: 'ADMIN',
        orgId: 'org-uuid',
      };
      await expect(
        service.verifyVehicleAccess('vehicle-uuid', payload),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException for ADMIN/OWNER of a different organization', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-uuid',
        orgId: 'org-uuid-1',
      });
      const payload: AccessTokenPayload = {
        sub: 'user-uuid',
        role: 'ADMIN',
        orgId: 'org-uuid-2',
      };
      await expect(
        service.verifyVehicleAccess('vehicle-uuid', payload),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('should allow access for DRIVER with active assignment', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-uuid',
        orgId: 'org-uuid',
      });
      prismaMock.assignment.findFirst.mockResolvedValue({
        id: 'assignment-uuid',
      });
      const payload: AccessTokenPayload = {
        sub: 'driver-user-uuid',
        role: 'DRIVER',
        orgId: 'org-uuid',
      };
      await expect(
        service.verifyVehicleAccess('vehicle-uuid', payload),
      ).resolves.not.toThrow();
      expect(prismaMock.assignment.findFirst).toHaveBeenCalledWith({
        where: {
          vehicleId: 'vehicle-uuid',
          driver: { userId: 'driver-user-uuid' },
          to: null,
        },
      });
    });

    it('should throw ForbiddenException for DRIVER without active assignment', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-uuid',
        orgId: 'org-uuid',
      });
      prismaMock.assignment.findFirst.mockResolvedValue(null);
      const payload: AccessTokenPayload = {
        sub: 'driver-user-uuid',
        role: 'DRIVER',
        orgId: 'org-uuid',
      };
      await expect(
        service.verifyVehicleAccess('vehicle-uuid', payload),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });
  });

  describe('createTrackingLink', () => {
    it('should create a tracking link and return it with full URL', async () => {
      const mockLink = {
        id: 'link-uuid',
        vehicleId: 'vehicle-uuid',
        clientName: 'Client XYZ',
        isActive: true,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      prismaMock.trackingLink.create.mockResolvedValue(mockLink);

      const result = await service.createTrackingLink(
        'vehicle-uuid',
        'Client XYZ',
      );
      expect(result).toEqual({
        ...mockLink,
        trackingUrl: expect.stringMatching(/\/dashboard\/track\/link-uuid$/),
      });
      expect(prismaMock.trackingLink.create).toHaveBeenCalledWith({
        data: {
          vehicleId: 'vehicle-uuid',
          clientName: 'Client XYZ',
          isActive: true,
          expiresAt: expect.any(Date),
        },
      });
    });
  });

  describe('getActiveTrackingLinks', () => {
    it('should return active tracking links with trackingUrl', async () => {
      const mockLinks = [
        {
          id: 'link-uuid-1',
          vehicleId: 'vehicle-uuid',
          clientName: 'Client 1',
          isActive: true,
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ];
      prismaMock.trackingLink.findMany.mockResolvedValue(mockLinks);

      const result = await service.getActiveTrackingLinks('vehicle-uuid');
      expect(result).toEqual([
        {
          ...mockLinks[0],
          trackingUrl: expect.stringMatching(/\/dashboard\/track\/link-uuid-1$/),
        },
      ]);
      expect(prismaMock.trackingLink.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'vehicle-uuid',
          isActive: true,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('revokeTrackingLink', () => {
    it('should set isActive to false and return updated link', async () => {
      const mockLink = {
        id: 'link-uuid',
        vehicleId: 'vehicle-uuid',
        clientName: 'Client XYZ',
        isActive: true,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      const mockUpdatedLink = { ...mockLink, isActive: false };

      prismaMock.trackingLink.findUnique.mockResolvedValue(mockLink);
      prismaMock.trackingLink.update.mockResolvedValue(mockUpdatedLink);

      const result = await service.revokeTrackingLink(
        'vehicle-uuid',
        'link-uuid',
      );
      expect(result).toEqual({
        ...mockUpdatedLink,
        trackingUrl: expect.stringMatching(/\/dashboard\/track\/link-uuid$/),
      });
      expect(prismaMock.trackingLink.findUnique).toHaveBeenCalledWith({
        where: { id: 'link-uuid' },
      });
      expect(prismaMock.trackingLink.update).toHaveBeenCalledWith({
        where: { id: 'link-uuid' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if link is not found', async () => {
      prismaMock.trackingLink.findUnique.mockResolvedValue(null);
      await expect(
        service.revokeTrackingLink('vehicle-uuid', 'link-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if link is associated with a different vehicle', async () => {
      prismaMock.trackingLink.findUnique.mockResolvedValue({
        id: 'link-uuid',
        vehicleId: 'other-vehicle-uuid',
      });
      await expect(
        service.revokeTrackingLink('vehicle-uuid', 'link-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicTrackingDetails', () => {
    it('should return data-minimized vehicle details for a valid active tracking link', async () => {
      const mockLink = {
        id: 'link-uuid',
        vehicleId: 'vehicle-uuid',
        clientName: 'Client XYZ',
        isActive: true,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // expires in 1 hour
        vehicle: {
          alias: 'Truck 1',
          plateNumber: 'P-123',
          liveState: {
            lastLat: 8.98,
            lastLng: -79.52,
            lastAngle: 90,
            currentStatus: 'MOVING',
          },
        },
      };

      prismaMock.trackingLink.findUnique.mockResolvedValue(mockLink);

      const result = await service.getPublicTrackingDetails('link-uuid');
      expect(result).toEqual({
        clientName: 'Client XYZ',
        alias: 'Truck 1',
        plateNumber: 'P-123',
        lastLat: 8.98,
        lastLng: -79.52,
        lastAngle: 90,
        currentStatus: 'MOVING',
        globalOverallScore: null,
      });
      expect(prismaMock.trackingLink.findUnique).toHaveBeenCalledWith({
        where: { id: 'link-uuid' },
        include: {
          vehicle: {
            include: {
              liveState: true,
              VehicleGlobalStats: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if tracking link does not exist', async () => {
      prismaMock.trackingLink.findUnique.mockResolvedValue(null);

      await expect(
        service.getPublicTrackingDetails('link-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if tracking link is inactive', async () => {
      const mockLink = {
        id: 'link-uuid',
        isActive: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };
      prismaMock.trackingLink.findUnique.mockResolvedValue(mockLink);

      await expect(
        service.getPublicTrackingDetails('link-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if tracking link is expired', async () => {
      const mockLink = {
        id: 'link-uuid',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // expired 1 hour ago
      };
      prismaMock.trackingLink.findUnique.mockResolvedValue(mockLink);

      await expect(
        service.getPublicTrackingDetails('link-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByOrgId with caching', () => {
    it('debe retornar datos desde caché si existen y mezclar liveState en tiempo real si se requiere', async () => {
      const mockVehicles = [
        { id: 'v-1', make: 'Ford', liveState: { lastLat: 10, lastLng: 20 } },
      ];
      const mockLiveStates = [
        {
          vehicleId: 'v-1',
          lastLat: 11,
          lastLng: 21,
          lastAngle: 0,
          currentStatus: 'MOVING',
        },
      ];
      cacheMock.get.mockReturnValue(mockVehicles);
      prismaMock.vehicleLiveState.findMany.mockResolvedValue(mockLiveStates);

      const result = await service.findAllByOrgId('org-uuid', true);

      expect(cacheMock.get).toHaveBeenCalledWith('vehicles:org:org-uuid');
      expect(prismaMock.vehicleLiveState.findMany).toHaveBeenCalled();
      expect((result[0] as any).liveState).toEqual(mockLiveStates[0]);
    });

    it('debe consultar la BD y guardar en caché si hay un cache miss', async () => {
      const mockVehicles = [{ id: 'v-1', make: 'Ford' }];
      cacheMock.get.mockReturnValue(null);
      prismaMock.vehicle.findMany.mockResolvedValue(mockVehicles);

      const result = await service.findAllByOrgId('org-uuid', false);

      expect(prismaMock.vehicle.findMany).toHaveBeenCalled();
      expect(cacheMock.set).toHaveBeenCalledWith(
        'vehicles:org:org-uuid',
        mockVehicles,
        900000,
      );
      expect(result).toEqual(mockVehicles);
    });
  });

  describe('getFuelAnalysis', () => {
    it('debe retornar resumen vacío si no existen registros de telemetría', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({ tankCapacity: 60 });
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.getFuelAnalysis('vehicle-id', 7);

      expect(result).toEqual({
        summary: {
          tankCapacity: 60,
          isCapacityCalibrated: false,
          totalConsumed: 0,
          consumedLiters: 0,
          totalDrained: 0,
          totalRefueled: 0,
          currentLevel: null,
          currentLiters: null,
        },
        events: [],
        history: [],
      });
    });

    it('debe calcular consumo directo usando contador acumulado OBD/CAN', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({ tankCapacity: 60 });
      const mockBuckets = [
        {
          bucket: new Date('2026-07-04T10:00:00Z'),
          fuelLevel: 50.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: false,
        },
        {
          bucket: new Date('2026-07-04T10:10:00Z'),
          fuelLevel: 85.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: false,
        },
        {
          bucket: new Date('2026-07-04T10:20:00Z'),
          fuelLevel: 80.0,
          fuelConsumption: 100,
          fuelRate: 0,
          ignition: false,
        },
        {
          bucket: new Date('2026-07-04T10:30:00Z'),
          fuelLevel: 74.0,
          fuelConsumption: 106,
          fuelRate: 12.0,
          ignition: true,
        },
      ];

      prismaMock.$queryRaw.mockResolvedValue(mockBuckets);

      const result = await service.getFuelAnalysis('vehicle-id', 7);

      expect(result.summary).toMatchObject({
        tankCapacity: 60,
        consumedLiters: 6.0,
        totalDrained: 0,
        totalRefueled: 0,
        currentLevel: 74.0,
      });

      expect(result.events).toHaveLength(0);
      expect(result.history).toHaveLength(4);
      expect(result.history[0]).toHaveProperty('fuelLiters');
    });

    it('debe calcular consumo directo basado en niveles cuando no hay contador OBD', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({ tankCapacity: 60 });
      const mockBuckets = [
        {
          bucket: new Date('2026-07-04T09:40:00Z'),
          fuelLevel: 80.0,
          fuelConsumption: null,
          fuelRate: 2.0,
          ignition: true,
        },
        {
          bucket: new Date('2026-07-04T09:50:00Z'),
          fuelLevel: 65.0,
          fuelConsumption: null,
          fuelRate: 2.0,
          ignition: true,
        },
      ];

      prismaMock.$queryRaw.mockResolvedValue(mockBuckets);

      const result = await service.getFuelAnalysis('vehicle-id', 7);

      expect(result.summary).toEqual({
        tankCapacity: 60,
        isCapacityCalibrated: false,
        totalConsumed: 15.0,
        consumedLiters: 8.1,
        totalRefueled: 0,
        totalDrained: 0,
        currentLevel: 65.0,
        currentLiters: 38.1,
      });
      expect(result.events).toHaveLength(0);
      expect(result.history).toHaveLength(2);
    });

    it('debe entregar historia agregada y limpia para la gráfica SVG', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({ tankCapacity: 60 });
      const mockBuckets = [
        {
          bucket: new Date('2026-07-31T22:25:23Z'),
          fuelLevel: 90.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: true,
        },
        {
          bucket: new Date('2026-07-31T22:25:29Z'),
          fuelLevel: 90.0,
          fuelConsumption: 100,
          fuelRate: 0,
          ignition: true,
        },
      ];

      prismaMock.$queryRaw.mockResolvedValue(mockBuckets);

      const result = await service.getFuelAnalysis('vehicle-id', 7);

      expect(result.summary.totalRefueled).toEqual(0);
      expect(result.summary.totalDrained).toEqual(0);
      expect(result.events).toHaveLength(0);
      expect(result.history[1].fuelLevel).toEqual(90.0);
    });

    it('debe retornar datos desde caché si existen y guardar en caché en cache miss', async () => {
      const mockCached = {
        summary: { tankCapacity: 60 },
        events: [],
        history: [{ timestamp: new Date(), fuelLevel: 80 }],
      };
      cacheMock.get.mockReturnValueOnce(mockCached);

      const cachedResult = await service.getFuelAnalysis('vehicle-cache-1', 7);
      expect(cachedResult).toBe(mockCached);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();

      // Cache miss
      cacheMock.get.mockReturnValueOnce(null);
      prismaMock.vehicle.findUnique.mockResolvedValue({ tankCapacity: 60 });
      prismaMock.$queryRaw.mockResolvedValue([]);

      const liveResult = await service.getFuelAnalysis('vehicle-cache-1', 7);
      expect(liveResult.summary.tankCapacity).toBe(60);
      expect(cacheMock.set).toHaveBeenCalledWith(
        'vehicles:fuel-analysis:vehicle-cache-1:7',
        expect.any(Object),
        expect.any(Number),
      );
    });
  });

  describe('recalculateVehicleFuel', () => {
    it('debe resolver la ubicación exacta de la gasolinera al detectar una recarga', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        tankCapacity: 41,
      });

      const t0 = new Date('2026-09-01T18:00:00Z').getTime();
      const logs: any[] = [];
      // 10 lecturas al 40% (estacionado antes y durante la llegada a la bomba)
      for (let i = 0; i < 10; i++) {
        logs.push({
          id: `log-${i}`,
          tripId: null,
          timestamp: new Date(t0 + i * 10000),
          fuelLevel: 40.0,
          speed: 0,
          gpsSpeed: 0,
          ignition: false,
          latitude: 0, // Sin señal GPS bajo la marquesina
          longitude: 0,
          odometer: 1000,
        });
      }
      // 25 lecturas al 100% (recarga completada, estacionado en bomba con motor encendido)
      for (let i = 10; i < 35; i++) {
        logs.push({
          id: `log-${i}`,
          tripId: null,
          timestamp: new Date(t0 + i * 10000),
          fuelLevel: 100.0,
          speed: 0,
          gpsSpeed: 0,
          ignition: true,
          latitude: 0, // Sin señal GPS bajo la marquesina
          longitude: 0,
          odometer: 1000,
        });
      }

      prismaMock.telemetryLog.findMany.mockResolvedValue(logs);

      // Simular que findFirst encuentra el registro de llegada previo a la gasolinera
      prismaMock.telemetryLog.findFirst.mockResolvedValue({
        latitude: 9.123456,
        longitude: -79.654321,
      });

      const result = await service.recalculateVehicleFuel('vehicle-1');

      expect(result.eventsCount).toBe(1);
      expect(prismaMock.telemetryLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vehicleId: 'vehicle-1',
            latitude: { not: 0 },
            longitude: { not: 0 },
          }),
        }),
      );
      expect(prismaMock.fuelEvent.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            type: 'REFUEL',
            startLevel: 40,
            endLevel: 100,
            latitude: 9.123456,
            longitude: -79.654321,
          }),
        ],
      });
    });

    it('debe detectar una recarga con motor encendido y salida en marcha inmediata, retro-anclando a la bomba', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-pump-1',
        tankCapacity: 41,
      });

      const t0 = new Date('2026-09-04T22:07:00Z').getTime();
      const pumpLat = 9.066126;
      const pumpLng = -79.516831;
      const pumpTime = new Date(t0 + 170 * 1000); // 22:09:50Z

      const logs: any[] = [];
      // 0. Llegando a la estación a 36% de combustible
      for (let i = 0; i < 10; i++) {
        logs.push({
          id: `log-arr-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(t0 - (10 - i) * 20 * 1000),
          fuelLevel: 36.0,
          speed: 30,
          gpsSpeed: 30,
          ignition: true,
          latitude: pumpLat,
          longitude: pumpLng,
        });
      }
      // 1. Detenido en la bomba antes de cargar (36%)
      logs.push({
        id: 'log-p1',
        tripId: 'trip-1',
        timestamp: new Date(t0),
        fuelLevel: 36.0,
        speed: 0,
        gpsSpeed: 0,
        ignition: true,
        latitude: pumpLat,
        longitude: pumpLng,
      });
      logs.push({
        id: 'log-p2',
        tripId: 'trip-1',
        timestamp: new Date(t0 + 40 * 1000),
        fuelLevel: 36.0,
        speed: 0,
        gpsSpeed: 0,
        ignition: true,
        latitude: pumpLat,
        longitude: pumpLng,
      });
      // 2. Cargando en la bomba (39% -> 44% -> 92% -> 100%)
      logs.push({
        id: 'log-p3',
        tripId: 'trip-1',
        timestamp: new Date(t0 + 80 * 1000),
        fuelLevel: 39.0,
        speed: 0,
        gpsSpeed: 0,
        ignition: true,
        latitude: pumpLat,
        longitude: pumpLng,
      });
      logs.push({
        id: 'log-p4',
        tripId: 'trip-1',
        timestamp: new Date(t0 + 90 * 1000),
        fuelLevel: 44.0,
        speed: 0,
        gpsSpeed: 0,
        ignition: true,
        latitude: pumpLat,
        longitude: pumpLng,
      });
      logs.push({
        id: 'log-p5',
        tripId: 'trip-1',
        timestamp: new Date(t0 + 140 * 1000),
        fuelLevel: 92.0,
        speed: 0,
        gpsSpeed: 0,
        ignition: true,
        latitude: pumpLat,
        longitude: pumpLng,
      });
      logs.push({
        id: 'log-p6',
        tripId: 'trip-1',
        timestamp: pumpTime,
        fuelLevel: 100.0,
        speed: 0,
        gpsSpeed: 0,
        ignition: true,
        latitude: pumpLat,
        longitude: pumpLng,
      });
      // 3. Salida inmediata en marcha (speed > 3, carretera a varios km)
      for (let i = 1; i <= 20; i++) {
        logs.push({
          id: `log-moving-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(pumpTime.getTime() + i * 20 * 1000),
          fuelLevel: 100.0,
          speed: 40 + i,
          gpsSpeed: 40 + i,
          ignition: true,
          latitude: pumpLat + i * 0.005, // Coordenada en carretera alejada
          longitude: pumpLng + i * 0.005,
        });
      }

      prismaMock.telemetryLog.findMany.mockResolvedValue(logs);

      const result = await service.recalculateVehicleFuel('vehicle-pump-1');

      expect(result.eventsCount).toBe(1);
      expect(prismaMock.fuelEvent.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            type: 'REFUEL',
            startLevel: 36,
            endLevel: 100,
            latitude: pumpLat,
            longitude: pumpLng,
            timestamp: expect.any(Date),
          }),
        ],
      });
    });

    it('debe detectar una recarga real pequeña (+3.5 L / +8.5%) sin descartarla', async () => {
      const vehicleId = 'vehicle-small-refuel';
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        tankCapacity: 41,
      } as any);

      const logs: any[] = [];
      const baseTime = new Date('2026-09-05T10:00:00.000Z').getTime();

      // Conducción en crucero a 50% (~20.5L)
      for (let i = 0; i < 5; i++) {
        logs.push({
          id: `log-c-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + i * 10 * 1000),
          fuelLevel: 50.0,
          speed: 40,
          gpsSpeed: 40,
          ignition: true,
          latitude: 9.0,
          longitude: -79.0,
        });
      }

      // Parada en gasolinera por 2 minutos (120s): recarga pequeña de +3.5 L (+8.5% -> 58.5%)
      for (let i = 0; i < 12; i++) {
        logs.push({
          id: `log-stop-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + (50 + i * 10) * 1000),
          fuelLevel: 58.5,
          speed: 0,
          gpsSpeed: 0,
          ignition: true,
          latitude: 9.05,
          longitude: -79.05,
        });
      }

      // Reanuda marcha activa por 5 minutos manteniendo el nivel en ~58%
      for (let i = 0; i < 30; i++) {
        logs.push({
          id: `log-drive-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + (170 + i * 10) * 1000),
          fuelLevel: 58.5,
          speed: 35,
          gpsSpeed: 35,
          ignition: true,
          latitude: 9.06 + i * 0.001,
          longitude: -79.06 + i * 0.001,
        });
      }

      prismaMock.telemetryLog.findMany.mockResolvedValue(logs);

      const result = await service.recalculateVehicleFuel(vehicleId);

      expect(result.eventsCount).toBe(1);
      expect(prismaMock.fuelEvent.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            type: 'REFUEL',
            startLevel: 50,
            endLevel: 58.5,
            liters: 3.49,
            percentageDelta: 8.5,
          }),
        ],
      });
    });

    it('debe ignorar una subida falsa por estacionamiento en rampa que rebota al rodar', async () => {
      const vehicleId = 'vehicle-ramp-slope';
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        tankCapacity: 55,
      } as any);

      const logs: any[] = [];
      const baseTime = new Date('2026-09-05T14:00:00.000Z').getTime();

      // Conducción a nivel horizontal previo: 70%
      for (let i = 0; i < 5; i++) {
        logs.push({
          id: `log-c-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + i * 10 * 1000),
          fuelLevel: 70.0,
          speed: 30,
          gpsSpeed: 30,
          ignition: true,
          latitude: 9.0,
          longitude: -79.0,
        });
      }

      // Se estaciona en una calle inclinada por 2 horas: el sensor marca 76% (+6% falso)
      for (let i = 0; i < 20; i++) {
        logs.push({
          id: `log-ramp-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + (50 + i * 60) * 1000),
          fuelLevel: 76.0,
          speed: 0,
          gpsSpeed: 0,
          ignition: false,
          latitude: 9.01,
          longitude: -79.01,
        });
      }

      // Al salir de la rampa a la calle plana, el nivel regresa a su valor real (70%)
      for (let i = 0; i < 15; i++) {
        logs.push({
          id: `log-level-drive-${i}`,
          tripId: 'trip-2',
          timestamp: new Date(baseTime + (1300 + i * 10) * 1000),
          fuelLevel: 70.0,
          speed: 25,
          gpsSpeed: 25,
          ignition: true,
          latitude: 9.02 + i * 0.001,
          longitude: -79.02 + i * 0.001,
        });
      }

      prismaMock.telemetryLog.findMany.mockResolvedValue(logs);

      const result = await service.recalculateVehicleFuel(vehicleId);

      // Debe descartar el falso positivo y no registrar evento de recarga
      expect(result.eventsCount).toBe(0);
      expect(prismaMock.fuelEvent.createMany).not.toHaveBeenCalled();
    });

    it('debe ignorar una detención corta en semáforo con frenada brusca', async () => {
      const vehicleId = 'vehicle-traffic-light';
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        tankCapacity: 41,
      } as any);

      const logs: any[] = [];
      const baseTime = new Date('2026-09-05T18:00:00.000Z').getTime();

      // Conducción en crucero a 80%
      for (let i = 0; i < 5; i++) {
        logs.push({
          id: `log-cruising-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + i * 10 * 1000),
          fuelLevel: 80.0,
          speed: 45,
          gpsSpeed: 45,
          ignition: true,
          latitude: 9.0,
          longitude: -79.0,
        });
      }

      // Frenada hacia semáforo rojo (dip de inercia a 72% y parada de solo 35 segundos)
      for (let i = 0; i < 3; i++) {
        logs.push({
          id: `log-red-light-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + (50 + i * 10) * 1000),
          fuelLevel: 80.0,
          speed: 0,
          gpsSpeed: 0,
          ignition: true,
          latitude: 9.001,
          longitude: -79.001,
        });
      }

      // Reanuda marcha (speed > 3)
      for (let i = 0; i < 5; i++) {
        logs.push({
          id: `log-green-light-${i}`,
          tripId: 'trip-1',
          timestamp: new Date(baseTime + (85 + i * 10) * 1000),
          fuelLevel: 80.0,
          speed: 30,
          gpsSpeed: 30,
          ignition: true,
          latitude: 9.002 + i * 0.001,
          longitude: -79.002 + i * 0.001,
        });
      }

      prismaMock.telemetryLog.findMany.mockResolvedValue(logs);

      const result = await service.recalculateVehicleFuel(vehicleId);

      // No debe emitir eventos en semáforos
      expect(result.eventsCount).toBe(0);
      expect(prismaMock.fuelEvent.createMany).not.toHaveBeenCalled();
    });
  });

  describe('generateDiagnosticsExport & getDiagnosticsLogs', () => {
    const mockVehicleId = 'vehicle-uuid-diag-test';

    it('debe exportar todas las columnas diagnósticas incluyendo rawIoData en CSV por defecto', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: mockVehicleId,
        alias: 'Truck Diag 01',
        plateNumber: 'AB1234',
      } as any);

      const mockLogs = [
        {
          id: 'log-1',
          vehicleId: mockVehicleId,
          timestamp: new Date('2026-10-30T10:00:00Z'),
          powerSupply: 12.8,
          ignition: true,
          movement: true,
          unplugged: false,
          status: 'MOVING',
          speed: 60,
          gpsSpeed: 59,
          rpm: 2100,
          maf: 14.5,
          throttlePosition: 35,
          coolantTemp: 88,
          intakeMap: 105,
          eventId: 40,
          rawIoData: { 239: 1, 85: 2100, 40: 1450 },
          extra: { 999: 'val' },
          vin: '1HGCR2F83HA000000',
          tripId: 'trip-diag-1',
          latitude: 8.98,
          longitude: -79.52,
          rawLatitude: 8.981,
          rawLongitude: -79.521,
          odometer: 15400,
          fuelLevel: 75,
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.generateDiagnosticsExport(
        mockVehicleId,
        '2026-10-30T00:00:00Z',
        '2026-10-30T12:00:00Z',
        'csv',
      );

      expect(result.contentType).toBe('text/csv; charset=utf-8');
      expect(result.filename).toMatch(/^diagnostico_Truck_Diag_01_\d{4}-\d{2}-\d{2}\.csv$/);

      const csvContent = result.buffer.toString('utf-8');
      const headerLine = csvContent.split('\n')[0];
      expect(headerLine).toContain('rawIoData');
      expect(headerLine).toContain('eventId');
      expect(headerLine).toContain('powerSupply');
      expect(headerLine).toContain('maf');
      expect(headerLine).toContain('throttlePosition');
      expect(headerLine).toContain('vin');
      expect(headerLine).toContain('tripId');
      expect(headerLine).toContain('rawLatitude');
      expect(headerLine).toContain('rawLongitude');

      // Verifica que el contenido CSV incluye el JSON escapado de rawIoData
      expect(csvContent).toContain('""239"":1');
      expect(csvContent).toContain('""85"":2100');
      expect(csvContent).toContain('""40"":1450');
    });

    it('debe permitir seleccionar columnas personalizadas incluyendo rawIoData para descarga', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: mockVehicleId,
        alias: 'Truck Custom',
        plateNumber: 'CC9988',
      } as any);

      const mockLogs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-10-30T10:00:00Z'),
          powerSupply: 12.4,
          rawIoData: { 239: 1, 66: 12400 },
          eventId: 239,
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.generateDiagnosticsExport(
        mockVehicleId,
        '2026-10-30T00:00:00Z',
        '2026-10-30T12:00:00Z',
        'csv',
        'timestamp,powerSupply,rawIoData,eventId',
      );

      const csvContent = result.buffer.toString('utf-8');
      const lines = csvContent.trim().split('\n');
      expect(lines[0]).toBe('timestamp,powerSupply,rawIoData,eventId');
      expect(lines[1]).toContain('""239"":1');
      expect(lines[1]).toContain('""66"":12400');
    });

    it('debe filtrar columnas en formato JSON cuando se solicitan columnas específicas', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: mockVehicleId,
        alias: 'Truck JSON',
        plateNumber: 'JSON01',
      } as any);

      const mockLogs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-10-30T10:00:00Z'),
          powerSupply: 13.5,
          rpm: 1800,
          rawIoData: { 85: 1800 },
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.generateDiagnosticsExport(
        mockVehicleId,
        '2026-10-30T00:00:00Z',
        '2026-10-30T12:00:00Z',
        'json',
        ['rawIoData', 'powerSupply'],
      );

      expect(result.contentType).toBe('application/json');
      const parsed = JSON.parse(result.buffer.toString('utf-8'));
      expect(parsed).toEqual([
        {
          rawIoData: { 85: 1800 },
          powerSupply: 13.5,
        },
      ]);
    });

    it('debe obtener registros de diagnóstico con todos los campos seleccionados en getDiagnosticsLogs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-10-30T10:00:00Z'),
          powerSupply: 12.6,
          rawIoData: { 239: 1 },
          maf: 12.3,
          throttlePosition: 20,
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs as any);
      prismaMock.telemetryLog.count.mockResolvedValue(1);

      const res = await service.getDiagnosticsLogs(
        mockVehicleId,
        '2026-10-30T00:00:00Z',
        '2026-10-30T12:00:00Z',
        10,
      );

      expect(res.logs).toEqual(mockLogs);
      expect(res.total).toBe(1);
      expect(prismaMock.telemetryLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            rawIoData: true,
            eventId: true,
            extra: true,
            vin: true,
            tripId: true,
            odometer: true,
            engineHours: true,
          }),
        }),
      );
    });
  });
});

