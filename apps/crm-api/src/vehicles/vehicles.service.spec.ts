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
    };
    fuelEvent: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    trip: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
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
      vehicle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      vehicleLiveState: {
        findMany: jest.fn(),
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
      },
      fuelEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      trip: {
        findMany: jest.fn().mockResolvedValue([]),
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
      prismaMock.telemetryLog.findMany.mockResolvedValue([]);

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
      const mockLogs = [
        {
          timestamp: new Date('2026-07-04T10:00:00Z'),
          fuelLevel: 50.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: false,
          speed: 0,
          latitude: 10,
          longitude: 20,
        },
        {
          timestamp: new Date('2026-07-04T10:10:00Z'),
          fuelLevel: 85.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: false,
          speed: 0,
          latitude: 10,
          longitude: 20,
        },
        {
          timestamp: new Date('2026-07-04T10:20:00Z'),
          fuelLevel: 80.0,
          fuelConsumption: 100,
          fuelRate: 0,
          ignition: false,
          speed: 0,
          latitude: 10,
          longitude: 20,
        },
        {
          timestamp: new Date('2026-07-04T10:30:00Z'),
          fuelLevel: 74.0,
          fuelConsumption: 106,
          fuelRate: 12.0,
          ignition: true,
          speed: 50,
          latitude: 10.1,
          longitude: 20.1,
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs);

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
      const mockLogs = [
        {
          timestamp: new Date('2026-07-04T09:40:00Z'),
          fuelLevel: 80.0,
          fuelConsumption: null,
          fuelRate: 2.0,
          ignition: true,
          speed: 0,
          latitude: 10,
          longitude: 20,
        },
        {
          timestamp: new Date('2026-07-04T09:50:00Z'),
          fuelLevel: 65.0,
          fuelConsumption: null,
          fuelRate: 2.0,
          ignition: true,
          speed: 30,
          latitude: 10,
          longitude: 20,
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs);

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

    it('debe suavizar picos de sloshing en la historia para la gráfica', async () => {
      prismaMock.vehicle.findUnique.mockResolvedValue({ tankCapacity: 60 });
      const mockLogs = [
        {
          timestamp: new Date('2026-07-31T22:25:23Z'),
          fuelLevel: 90.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: true,
          speed: 15,
          latitude: 8.99,
          longitude: -79.51,
        },
        {
          timestamp: new Date('2026-07-31T22:25:28Z'),
          fuelLevel: 40.0,
          fuelConsumption: 100,
          fuelRate: 2.0,
          ignition: true,
          speed: 4,
          latitude: 8.99,
          longitude: -79.51,
        },
        {
          timestamp: new Date('2026-07-31T22:25:29Z'),
          fuelLevel: 90.0,
          fuelConsumption: 100,
          fuelRate: 0,
          ignition: true,
          speed: 0,
          latitude: 8.99,
          longitude: -79.51,
        },
      ];

      prismaMock.telemetryLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getFuelAnalysis('vehicle-id', 7);

      expect(result.summary.totalRefueled).toEqual(0);
      expect(result.summary.totalDrained).toEqual(0);
      expect(result.events).toHaveLength(0);
      expect(result.history[1].fuelLevel).toEqual(90.0);
    });
  });
});
