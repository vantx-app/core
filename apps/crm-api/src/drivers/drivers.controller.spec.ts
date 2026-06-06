import { Test, TestingModule } from '@nestjs/testing';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { CacheService } from '../common/cache.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';

describe('DriversController', () => {
  let controller: DriversController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriversController],
      providers: [
        DriversService,
        { provide: PrismaService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: RulesEngineService, useValue: {} },
        {
          provide: CacheService,
          useValue: { delByPattern: jest.fn(), get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<DriversController>(DriversController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyNationalId', () => {
    it('should return exists false if driver is not found', async () => {
      jest
        .spyOn(controller['driversService'], 'findOneByNationalId')
        .mockResolvedValue(null);
      const result = await controller.verifyNationalId('123');
      expect(result).toEqual({ exists: false });
    });

    it('should return driver info if driver is found', async () => {
      const mockDriver = {
        id: 'driver-uuid',
        userId: 'user-uuid',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        nationalId: '8-888-8888',
        phone: '6666-6666',
        status: 'ACTIVE' as any,
        licenseType: 'B',
        shareScoresPublicly: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest
        .spyOn(controller['driversService'], 'findOneByNationalId')
        .mockResolvedValue(mockDriver as any);

      const result = await controller.verifyNationalId('8-888-8888');
      expect(result).toEqual({
        exists: true,
        id: 'driver-uuid',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        nationalId: '8-888-8888',
        hasUser: true,
      });
    });
  });
});
