import { Test, TestingModule } from '@nestjs/testing';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { AssignmentService } from '../assignment/assignment.service';
import { PrismaService } from '../prisma.service';
import { AccessTokenPayload } from 'src/auth/types';
import { CacheService } from '../common/cache.service';

describe('VehiclesController', () => {
  let controller: VehiclesController;
  let vehiclesServiceMock: {
    create: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    findAllByOrgId: jest.Mock;
    findByUserId: jest.Mock;
    findTripsForVehicle: jest.Mock;
    findRouteForTrip: jest.Mock;
    verifyVehicleAccess: jest.Mock;
    createTrackingLink: jest.Mock;
    getActiveTrackingLinks: jest.Mock;
    revokeTrackingLink: jest.Mock;
    getPublicTrackingDetails: jest.Mock;
  };
  let assignmentServiceMock: {
    getPreviousDrivers: jest.Mock;
  };

  beforeEach(async () => {
    vehiclesServiceMock = {
      create: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findAllByOrgId: jest.fn(),
      findByUserId: jest.fn(),
      findTripsForVehicle: jest.fn(),
      findRouteForTrip: jest.fn(),
      verifyVehicleAccess: jest.fn(),
      createTrackingLink: jest.fn(),
      getActiveTrackingLinks: jest.fn(),
      revokeTrackingLink: jest.fn(),
      getPublicTrackingDetails: jest.fn(),
    };
    assignmentServiceMock = {
      getPreviousDrivers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehiclesController],
      providers: [
        { provide: VehiclesService, useValue: vehiclesServiceMock },
        { provide: PrismaService, useValue: {} },
        { provide: AssignmentService, useValue: assignmentServiceMock },
        { provide: CacheService, useValue: { delByPattern: jest.fn() } },
      ],
    }).compile();

    controller = module.get<VehiclesController>(VehiclesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('tracking links endpoints', () => {
    const mockUser: AccessTokenPayload = {
      sub: 'user-uuid',
      role: 'ADMIN',
      orgId: 'org-uuid',
    };
    const mockReq = { user: mockUser } as unknown as Request & {
      user: AccessTokenPayload;
    };

    describe('createTrackingLink', () => {
      it('should verify access and create a tracking link', async () => {
        const dto = { clientName: 'Client XYZ' };
        const mockResult = {
          id: 'link-uuid',
          trackingUrl: 'http://localhost:3000/dashboard/track/link-uuid',
        };
        vehiclesServiceMock.verifyVehicleAccess.mockResolvedValue(undefined);
        vehiclesServiceMock.createTrackingLink.mockResolvedValue(mockResult);

        const result = await controller.createTrackingLink(
          'vehicle-uuid',
          mockReq,
          dto,
        );

        expect(vehiclesServiceMock.verifyVehicleAccess).toHaveBeenCalledWith(
          'vehicle-uuid',
          mockUser,
        );
        expect(vehiclesServiceMock.createTrackingLink).toHaveBeenCalledWith(
          'vehicle-uuid',
          'Client XYZ',
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('getTrackingLinks', () => {
      it('should verify access and get active tracking links', async () => {
        const mockResult = [
          {
            id: 'link-uuid',
            trackingUrl: 'http://localhost:3000/dashboard/track/link-uuid',
          },
        ];
        vehiclesServiceMock.verifyVehicleAccess.mockResolvedValue(undefined);
        vehiclesServiceMock.getActiveTrackingLinks.mockResolvedValue(
          mockResult,
        );

        const result = await controller.getTrackingLinks(
          'vehicle-uuid',
          mockReq,
        );

        expect(vehiclesServiceMock.verifyVehicleAccess).toHaveBeenCalledWith(
          'vehicle-uuid',
          mockUser,
        );
        expect(vehiclesServiceMock.getActiveTrackingLinks).toHaveBeenCalledWith(
          'vehicle-uuid',
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('revokeTrackingLink', () => {
      it('should verify access and revoke tracking link', async () => {
        const mockResult = {
          id: 'link-uuid',
          isActive: false,
          trackingUrl: 'http://localhost:3000/dashboard/track/link-uuid',
        };
        vehiclesServiceMock.verifyVehicleAccess.mockResolvedValue(undefined);
        vehiclesServiceMock.revokeTrackingLink.mockResolvedValue(mockResult);

        const result = await controller.revokeTrackingLink(
          'vehicle-uuid',
          'link-uuid',
          mockReq,
        );

        expect(vehiclesServiceMock.verifyVehicleAccess).toHaveBeenCalledWith(
          'vehicle-uuid',
          mockUser,
        );
        expect(vehiclesServiceMock.revokeTrackingLink).toHaveBeenCalledWith(
          'vehicle-uuid',
          'link-uuid',
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('getPublicTrackingDetails', () => {
      it('should call getPublicTrackingDetails on the service without authentication checks', async () => {
        const mockResult = {
          alias: 'Truck 1',
          plateNumber: 'P-123',
          lastLat: 8.98,
          lastLng: -79.52,
          lastAngle: 90,
          currentStatus: 'MOVING',
        };
        vehiclesServiceMock.getPublicTrackingDetails.mockResolvedValue(
          mockResult,
        );

        const result = await controller.getPublicTrackingDetails('link-uuid');

        expect(
          vehiclesServiceMock.getPublicTrackingDetails,
        ).toHaveBeenCalledWith('link-uuid');
        expect(result).toEqual(mockResult);
      });
    });
  });

  describe('getPreviousDrivers', () => {
    it('should verify access and call getPreviousDrivers on AssignmentService', async () => {
      const mockUser: AccessTokenPayload = {
        sub: 'user-uuid',
        role: 'ADMIN',
        orgId: 'org-uuid',
      };
      const mockReq = { user: mockUser } as unknown as Request & {
        user: AccessTokenPayload;
      };
      const mockDrivers = [
        {
          id: 'driver-1',
          nationalId: '1-111-1111',
          firstName: 'Juan',
          lastName: 'Perez',
        },
      ];

      vehiclesServiceMock.verifyVehicleAccess.mockResolvedValue(undefined);
      assignmentServiceMock.getPreviousDrivers.mockResolvedValue(mockDrivers);

      const result = await controller.getPreviousDrivers(
        'vehicle-uuid',
        mockReq,
      );

      expect(vehiclesServiceMock.verifyVehicleAccess).toHaveBeenCalledWith(
        'vehicle-uuid',
        mockUser,
      );
      expect(assignmentServiceMock.getPreviousDrivers).toHaveBeenCalledWith(
        'vehicle-uuid',
      );
      expect(result).toEqual(mockDrivers);
    });
  });
});
