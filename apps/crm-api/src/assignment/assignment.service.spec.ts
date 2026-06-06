import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentService } from './assignment.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('AssignmentService', () => {
  let service: AssignmentService;
  let prisma: any;

  const mockPrisma = {
    assignment: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AssignmentService>(AssignmentService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('unassignVehicle', () => {
    it('should throw BadRequestException if no active assignment exists', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      await expect(service.unassignVehicle('vehicle-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should terminate assignment successfully', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        from: new Date(),
        to: null,
      };

      mockPrisma.assignment.findFirst.mockResolvedValue(mockAssignment);
      mockPrisma.assignment.update.mockResolvedValue({
        ...mockAssignment,
        to: new Date(),
      });

      const result = await service.unassignVehicle('vehicle-1');

      expect(result.to).toBeDefined();
      expect(mockPrisma.assignment.update).toHaveBeenCalledWith({
        where: { id: 'assignment-1' },
        data: { to: expect.any(Date) },
      });
    });
  });

  describe('getPreviousDrivers', () => {
    it('should return unique previously assigned drivers with no active assignments', async () => {
      const mockAssignments = [
        {
          driver: {
            id: 'driver-1',
            nationalId: '1-111-1111',
            firstName: 'Juan',
            lastName: 'Perez',
          },
        },
        {
          driver: {
            id: 'driver-2',
            nationalId: '2-222-2222',
            firstName: 'Maria',
            lastName: 'Gomez',
          },
        },
        {
          driver: {
            id: 'driver-1',
            nationalId: '1-111-1111',
            firstName: 'Juan',
            lastName: 'Perez',
          },
        },
      ];

      mockPrisma.assignment.findMany.mockResolvedValue(mockAssignments);

      const result = await service.getPreviousDrivers('vehicle-1');

      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'vehicle-1',
          driver: {
            assignments: {
              none: {
                to: null,
              },
            },
          },
        },
        select: {
          driver: {
            select: {
              id: true,
              nationalId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          from: 'desc',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('driver-1');
      expect(result[1].id).toBe('driver-2');
    });
  });
});
