import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { DocumentStorageService } from '../driver-documents/document-storage.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: {} },
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

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
