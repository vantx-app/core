import { Test, TestingModule } from '@nestjs/testing';
import { DriversService } from './drivers.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { CacheService } from '../common/cache.service';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ROLES } from '../common/enums/roles.enum';
import { RulesEngineService } from '../rules-engine/rules-engine.service';

describe('DriversService', () => {
  let service: DriversService;
  let prismaMock: any;
  let usersMock: {
    findOneById: jest.Mock;
    findOneByEmail: jest.Mock;
    create: jest.Mock;
  };
  let cacheMock: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    delByPattern: jest.Mock;
    clear: jest.Mock;
  };
  let rulesEngineMock: {
    evaluateAggregatedRollupWithDetails: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      driver: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      driverScoreSnapshot: {
        findUnique: jest.fn(),
      },
      assignment: {
        findMany: jest.fn(),
      },
      trip: {
        findMany: jest.fn(),
      },
      dailyTelemetryRollup: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            totalKm: null,
            totalEngineHours: null,
            idlingHours: null,
          },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    usersMock = {
      findOneById: jest.fn(),
      findOneByEmail: jest.fn(),
      create: jest.fn(),
    };

    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      clear: jest.fn(),
    };

    rulesEngineMock = {
      evaluateAggregatedRollupWithDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UsersService, useValue: usersMock },
        { provide: CacheService, useValue: cacheMock },
        { provide: RulesEngineService, useValue: rulesEngineMock },
      ],
    }).compile();

    service = module.get<DriversService>(DriversService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll with caching', () => {
    it('debe retornar datos desde caché si existen', async () => {
      const mockDrivers = [{ id: 'd-1', firstName: 'Juan' }];
      cacheMock.get.mockReturnValue(mockDrivers);

      const result = await service.findAll();

      expect(cacheMock.get).toHaveBeenCalledWith('drivers:all:all');
      expect(prismaMock.driver.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(mockDrivers);
    });

    it('debe consultar la BD y guardar en caché si hay un cache miss', async () => {
      const mockDrivers = [{ id: 'd-1', firstName: 'Juan' }];
      const expectedDrivers = [{ id: 'd-1', firstName: 'Juan', name: 'Juan' }];
      cacheMock.get.mockReturnValue(null);
      prismaMock.driver.findMany.mockResolvedValue(mockDrivers);

      const result = await service.findAll();

      expect(prismaMock.driver.findMany).toHaveBeenCalled();
      expect(cacheMock.set).toHaveBeenCalledWith(
        'drivers:all:all',
        expectedDrivers,
        900000,
      );
      expect(result).toEqual(expectedDrivers);
    });
  });

  describe('findAllByOrgId with caching', () => {
    it('debe retornar datos desde caché si existen', async () => {
      const mockDrivers = [{ id: 'd-1', firstName: 'Juan' }];
      cacheMock.get.mockReturnValue(mockDrivers);

      const result = await service.findAllByOrgId('org-uuid');

      expect(cacheMock.get).toHaveBeenCalledWith('drivers:org:org-uuid');
      expect(prismaMock.driver.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(mockDrivers);
    });

    it('debe consultar la BD y guardar en caché si hay un cache miss', async () => {
      const mockDrivers = [{ id: 'd-1', firstName: 'Juan' }];
      const expectedDrivers = [{ id: 'd-1', firstName: 'Juan', name: 'Juan' }];
      cacheMock.get.mockReturnValue(null);
      prismaMock.driver.findMany.mockResolvedValue(mockDrivers);

      const result = await service.findAllByOrgId('org-uuid');

      expect(prismaMock.driver.findMany).toHaveBeenCalled();
      expect(cacheMock.set).toHaveBeenCalledWith(
        'drivers:org:org-uuid',
        expectedDrivers,
        900000,
      );
      expect(result).toEqual(expectedDrivers);
    });
  });

  describe('findStatsByUserId with caching', () => {
    it('debe retornar datos desde caché si existen', async () => {
      const mockDriver = { id: 'd-1', firstName: 'Juan', globalStats: {} };
      cacheMock.get.mockReturnValue(mockDriver);

      const result = await service.findStatsByUserId('user-uuid');

      expect(cacheMock.get).toHaveBeenCalledWith('drivers:user:user-uuid');
      expect(prismaMock.driver.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockDriver);
    });

    it('debe consultar la BD y guardar en caché si hay un cache miss', async () => {
      const mockDriver = { id: 'd-1', firstName: 'Juan', globalStats: {} };
      const expectedDriver = {
        id: 'd-1',
        firstName: 'Juan',
        name: 'Juan',
        globalStats: {},
        rollupStats: {
          totalKm: 0,
          totalEngineHours: 0,
          idlingHours: 0,
        },
      };
      cacheMock.get.mockReturnValue(null);
      prismaMock.driver.findUnique.mockResolvedValue(mockDriver);

      const result = await service.findStatsByUserId('user-uuid');

      expect(prismaMock.driver.findUnique).toHaveBeenCalled();
      expect(cacheMock.set).toHaveBeenCalledWith(
        'drivers:user:user-uuid',
        expectedDriver,
        900000,
      );
      expect(result).toEqual(expectedDriver);
    });

    it('debe lanzar NotFoundException si no existe el conductor en la BD', async () => {
      cacheMock.get.mockReturnValue(null);
      prismaMock.driver.findUnique.mockResolvedValue(null);

      await expect(service.findStatsByUserId('user-uuid')).rejects.toThrow(
        new NotFoundException(
          'No se encontró perfil de conductor asociado a este usuario.',
        ),
      );
    });
  });

  describe('claim', () => {
    const actorSuper = {
      sub: 'actor-super',
      role: ROLES.SUPER_ADMIN,
      orgId: 'org-1',
    };
    const actorOwner = {
      sub: 'actor-owner',
      role: ROLES.OWNER,
      orgId: 'org-1',
    };
    const actorAdmin = {
      sub: 'actor-admin',
      role: ROLES.ADMIN,
      orgId: 'org-1',
    };

    it('debe lanzar BadRequestException si el usuario objetivo no existe', async () => {
      usersMock.findOneById.mockResolvedValue(null);

      await expect(
        service.claim(actorSuper, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(new BadRequestException('Usuario no encontrado'));
    });

    it('debe lanzar ForbiddenException en caso de autovinculación', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.OWNER,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(
        service.claim(
          { sub: 'target-user', role: ROLES.OWNER, orgId: 'org-1' },
          { userId: 'target-user', nationalId: '123456' },
        ),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar ForbiddenException si el objetivo es SUPER_ADMIN', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.SUPER_ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(
        service.claim(actorSuper, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar ForbiddenException si el objetivo es OWNER y el actor no es SUPER_ADMIN', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.OWNER,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(
        service.claim(actorOwner, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );

      await expect(
        service.claim(actorAdmin, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar ForbiddenException si el objetivo es ADMIN y el actor no es OWNER ni SUPER_ADMIN', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(
        service.claim(actorAdmin, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar ForbiddenException si actor y objetivo pertenecen a organizaciones distintas', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-2',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(
        service.claim(actorOwner, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar BadRequestException si el usuario ya está vinculado a un conductor', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);
      prismaMock.driver.findUnique.mockResolvedValueOnce({
        id: 'driver-1',
        userId: 'target-user',
      });

      await expect(
        service.claim(actorOwner, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'El usuario ya está vinculado a un perfil de conductor.',
        ),
      );
    });

    it('debe lanzar BadRequestException si la cédula ya está vinculada a otro usuario activo', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);
      // findUnique para userId retorna null (no vinculado)
      prismaMock.driver.findUnique.mockResolvedValueOnce(null);
      // findUnique para nationalId retorna conductor vinculado a otro usuario
      prismaMock.driver.findUnique.mockResolvedValueOnce({
        id: 'driver-2',
        userId: 'other-user',
        nationalId: '123456',
      });

      await expect(
        service.claim(actorOwner, {
          userId: 'target-user',
          nationalId: '123456',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Este número de documento ya está vinculado a otro usuario.',
        ),
      );
    });

    it('debe actualizar el perfil de conductor existente y no reclamado si coincide la cédula', async () => {
      const targetUser = {
        id: 'target-user',
        name: 'Pepito Perez',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);
      // no vinculado a otro conductor
      prismaMock.driver.findUnique.mockResolvedValueOnce(null);
      // existe un perfil no reclamado con esa cédula
      prismaMock.driver.findUnique.mockResolvedValueOnce({
        id: 'driver-existing',
        userId: null,
        nationalId: '123456',
      });

      prismaMock.driver.update.mockResolvedValue({
        id: 'driver-existing',
        userId: 'target-user',
      });

      const result = await service.claim(actorOwner, {
        userId: 'target-user',
        nationalId: '123456',
        phone: '987654321',
      });

      expect(prismaMock.driver.update).toHaveBeenCalledWith({
        where: { nationalId: '123456' },
        data: {
          userId: 'target-user',
          firstName: undefined,
          lastName: undefined,
          phone: '987654321',
        },
      });
      expect(result).toEqual({ id: 'driver-existing', userId: 'target-user' });
    });

    it('debe crear un nuevo perfil de conductor si no existe uno con la misma cédula', async () => {
      const targetUser = {
        id: 'target-user',
        name: 'Pepito Perez',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);
      // no vinculado a otro conductor
      prismaMock.driver.findUnique.mockResolvedValueOnce(null);
      // no existe perfil con esa cédula
      prismaMock.driver.findUnique.mockResolvedValueOnce(null);

      prismaMock.driver.create.mockResolvedValue({
        id: 'driver-new',
        userId: 'target-user',
      });

      const result = await service.claim(actorOwner, {
        userId: 'target-user',
        nationalId: '123456',
      });

      expect(prismaMock.driver.create).toHaveBeenCalledWith({
        data: {
          userId: 'target-user',
          nationalId: '123456',
          firstName: 'Pepito',
          lastName: 'Perez',
          phone: undefined,
          status: 'ACTIVE',
        },
      });
      expect(result).toEqual({ id: 'driver-new', userId: 'target-user' });
    });
  });

  describe('unclaim', () => {
    const actorSuper = {
      sub: 'actor-super',
      role: ROLES.SUPER_ADMIN,
      orgId: 'org-1',
    };
    const actorOwner = {
      sub: 'actor-owner',
      role: ROLES.OWNER,
      orgId: 'org-1',
    };
    const actorAdmin = {
      sub: 'actor-admin',
      role: ROLES.ADMIN,
      orgId: 'org-1',
    };

    it('debe lanzar BadRequestException si el usuario objetivo no existe', async () => {
      usersMock.findOneById.mockResolvedValue(null);

      await expect(service.unclaim(actorSuper, 'target-user')).rejects.toThrow(
        new BadRequestException('Usuario no encontrado'),
      );
    });

    it('debe lanzar ForbiddenException si actor y objetivo son el mismo (autodesvinculación)', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.OWNER,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(
        service.unclaim(
          { sub: 'target-user', role: ROLES.OWNER, orgId: 'org-1' },
          'target-user',
        ),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar ForbiddenException por reglas de jerarquía de roles', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.OWNER,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(service.unclaim(actorOwner, 'target-user')).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar ForbiddenException si pertenece a otra organización', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-2',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);

      await expect(service.unclaim(actorOwner, 'target-user')).rejects.toThrow(
        new ForbiddenException('No tienes permisos de flota para esta acción.'),
      );
    });

    it('debe lanzar BadRequestException si el usuario no tiene perfil de conductor', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);
      prismaMock.driver.findUnique.mockResolvedValue(null);

      await expect(service.unclaim(actorOwner, 'target-user')).rejects.toThrow(
        new BadRequestException(
          'El usuario no está vinculado a un perfil de conductor.',
        ),
      );
    });

    it('debe desvincular al conductor exitosamente (poner userId a null)', async () => {
      const targetUser = {
        id: 'target-user',
        role: ROLES.ADMIN,
        orgId: 'org-1',
      };
      usersMock.findOneById.mockResolvedValue(targetUser);
      prismaMock.driver.findUnique.mockResolvedValue({
        id: 'driver-1',
        userId: 'target-user',
      });
      prismaMock.driver.update.mockResolvedValue({
        id: 'driver-1',
        userId: null,
      });

      const result = await service.unclaim(actorOwner, 'target-user');

      expect(prismaMock.driver.update).toHaveBeenCalledWith({
        where: { id: 'driver-1' },
        data: { userId: null },
      });
      expect(result).toEqual({ id: 'driver-1', userId: null });
    });
  });

  describe('findDailyReports', () => {
    const queryingUser = {
      sub: 'user-1',
      role: ROLES.DRIVER,
      orgId: 'org-1',
    };

    it('debe retornar reportes diarios si tiene acceso', async () => {
      const mockReports = [{ id: 'r-1', totalKm: 100 }];
      prismaMock.driver.findUnique.mockResolvedValue({
        id: 'driver-1',
        userId: 'user-1',
      });
      prismaMock.driver.findMany = jest.fn(); // not used here
      prismaMock.dailyTelemetryRollup = {
        findMany: jest.fn().mockResolvedValue(mockReports),
      } as any;

      const result = await service.findDailyReports('me', 30, queryingUser);

      expect(prismaMock.dailyTelemetryRollup.findMany).toHaveBeenCalledWith({
        where: { driverId: 'driver-1' },
        orderBy: { date: 'desc' },
        take: 30,
        include: {
          vehicle: {
            select: {
              alias: true,
              plateNumber: true,
            },
          },
        },
      });
      expect(result).toEqual(mockReports);
    });
  });

  describe('findScoreBreakdown', () => {
    const queryingUser = {
      sub: 'user-1',
      role: ROLES.DRIVER,
      orgId: 'org-1',
    };

    it('debe retornar puntajes y desglose detallado si tiene acceso', async () => {
      prismaMock.driverScoreSnapshot.findUnique.mockResolvedValue(null);
      const mockRollups = [
        {
          vehicleId: 'v-1',
          totalKm: 100,
          totalEngineHours: 5,
          idlingHours: 1,
          overspeedCount: 2,
          overspeedSeverity: 10,
          vehicle: {
            id: 'v-1',
            alias: 'Tractor 1',
            plateNumber: 'ABC-123',
            scoringProfile: { rulesEngine: null },
          },
        },
      ];

      prismaMock.driver.findUnique.mockResolvedValue({
        id: 'driver-1',
        userId: 'user-1',
      });

      prismaMock.dailyTelemetryRollup = {
        findMany: jest.fn().mockResolvedValue(mockRollups),
      } as any;

      rulesEngineMock.evaluateAggregatedRollupWithDetails.mockReturnValue({
        scores: {
          totalKm: 100,
          totalHours: 5,
          idlingHours: 1,
          safetyScore: 90,
          ecoScore: 85,
          assetScore: 95,
          overallScore: 89.5,
        },
        ruleDeductions: [
          { code: 'OVERSPEEDING', rawDeduction: 10, appliedDeduction: 10 },
        ],
        pillarDeductions: { SAFETY: 10, EFFICIENCY: 15, ASSET_CARE: 5 },
      });

      const result: any = await service.findScoreBreakdown(
        'me',
        2026,
        22,
        queryingUser,
      );

      expect(result.overallScore).toBe(89.5);
      expect(result.vehicles).toHaveLength(1);
      expect(result.vehicles[0].vehicleAlias).toBe('Tractor 1');
      expect(result.vehicles[0].ruleDeductions).toHaveLength(1);
    });

    it('should return frozen breakdown directly if it exists in snapshot', async () => {
      const mockBreakdown = {
        overallScore: 99,
        safetyScore: 98,
        ecoScore: 97,
        assetScore: 100,
        totalKm: 250,
        totalHours: 10,
        idlingHours: 0.5,
        vehicles: [
          {
            vehicleId: 'v-1',
            vehicleAlias: 'Tractor 1',
            vehiclePlate: 'ABC-123',
            scores: { overallScore: 99 },
          },
        ],
      };

      prismaMock.driver.findUnique.mockResolvedValue({
        id: 'driver-1',
        userId: 'user-1',
      });

      prismaMock.driverScoreSnapshot.findUnique.mockResolvedValue({
        id: 'snapshot-1',
        breakdown: mockBreakdown,
      });

      const result = await service.findScoreBreakdown(
        'me',
        2026,
        22,
        queryingUser,
      );

      expect(result).toEqual(mockBreakdown);
    });
  });

  describe('findTripsForDriver', () => {
    const queryingUser = {
      sub: 'user-1',
      role: ROLES.DRIVER,
      orgId: 'org-1',
    };

    it('debe retornar lista de viajes con la informacion del vehiculo incluida', async () => {
      // Mock driver resolution, access check, and metadata query
      prismaMock.driver.findUnique
        .mockResolvedValueOnce({ id: 'driver-1' })
        .mockResolvedValueOnce({ userId: 'user-1' })
        .mockResolvedValueOnce({
          id: 'driver-1',
          firstName: 'Juan',
          lastName: 'Perez',
          nationalId: '123456',
        });

      // Mock assignments
      const mockAssignments = [
        {
          id: 'assign-1',
          driverId: 'driver-1',
          vehicleId: 'vehicle-1',
          from: new Date('2026-06-01T00:00:00Z'),
          to: null,
        },
      ];
      prismaMock.assignment.findMany.mockResolvedValueOnce(mockAssignments);

      // Mock trips
      const mockTrips = [
        {
          id: 'trip-1',
          vehicleId: 'vehicle-1',
          startTime: new Date('2026-06-02T10:00:00Z'),
          endTime: new Date('2026-06-02T11:00:00Z'),
          vehicle: {
            id: 'vehicle-1',
            alias: 'Camioneta 1',
            plateNumber: 'HP-9999',
            make: 'Toyota',
            model: 'Hilux',
            year: 2023,
            vin: '1234567890ABCDEF',
            scoringProfile: {
              rulesEngine: null,
            },
          },
          dailyTelemetryRollups: [{ id: 'rollup-1', totalKm: 10 } as any],
        },
      ];
      prismaMock.trip.findMany.mockResolvedValueOnce(mockTrips);

      // Mock rulesEngineService details scoring
      rulesEngineMock.evaluateAggregatedRollupWithDetails.mockReturnValue({
        scores: {
          overallScore: 90,
          safetyScore: 92,
          ecoScore: 88,
          assetScore: 94,
          totalKm: 10,
          totalHours: 1,
          idlingHours: 0.1,
        },
        ruleDeductions: [],
        pillarDeductions: {},
      });

      const result = await service.findTripsForDriver('me', queryingUser);

      expect(prismaMock.driver.findUnique).toHaveBeenNthCalledWith(1, {
        where: { userId: 'user-1' },
        select: { id: true },
      });
      expect(prismaMock.assignment.findMany).toHaveBeenCalledWith({
        where: { driverId: 'driver-1' },
        orderBy: { from: 'asc' },
      });
      expect(prismaMock.trip.findMany).toHaveBeenCalled();

      // Verificar que el conductor y la informacion del vehiculo esten mapeados
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'trip-1',
          vehicleId: 'vehicle-1',
          overallScore: 90,
          safetyScore: 92,
          ecoScore: 88,
          assetScore: 94,
          driver: {
            id: 'driver-1',
            firstName: 'Juan',
            lastName: 'Perez',
            nationalId: '123456',
          },
          vehicle: {
            id: 'vehicle-1',
            alias: 'Camioneta 1',
            plateNumber: 'HP-9999',
            make: 'Toyota',
            model: 'Hilux',
            year: 2023,
            vin: '1234567890ABCDEF',
          },
        }),
      );
    });
  });
});
