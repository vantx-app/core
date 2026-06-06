import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { DocumentStorageService } from '../driver-documents/document-storage.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organization: {
      update: jest.fn().mockResolvedValue({ id: 'org-id', name: 'Test Org' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: {} },
        {
          provide: DocumentStorageService,
          useValue: {
            generateReadUrl: jest
              .fn()
              .mockResolvedValue('http://mock-receipt-url'),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should update name only', async () => {
      mockPrismaService.organization.update.mockClear();
      const res = await service.update('org-id', { name: 'New Name' });
      expect(res).toEqual({ success: true });
      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-id' },
        data: { name: 'New Name' },
      });
    });

    it('should update subscription status and expiration', async () => {
      mockPrismaService.organization.update.mockClear();
      const dateStr = '2027-05-28T20:52:54.000Z';
      const res = await service.update('org-id', {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: dateStr,
      });
      expect(res).toEqual({ success: true });
      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-id' },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: new Date(dateStr),
        },
      });
    });

    it('should handle null expiration date', async () => {
      mockPrismaService.organization.update.mockClear();
      const res = await service.update('org-id', {
        subscriptionStatus: 'INACTIVE',
        subscriptionExpiresAt: null,
      });
      expect(res).toEqual({ success: true });
      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-id' },
        data: {
          subscriptionStatus: 'INACTIVE',
          subscriptionExpiresAt: null,
        },
      });
    });
  });
});
