import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: PrismaService;
  let usersService: UsersService;

  const mockTxClient = {
    orgInvitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      create: jest.fn(),
    },
    driver: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    orgInvitation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    driver: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockUsersService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    prisma = module.get<PrismaService>(PrismaService);
    usersService = module.get<UsersService>(UsersService);

    // Setup transaction mock to execute callback immediately with mockTxClient
    mockPrismaService.$transaction.mockImplementation(
      (cb: (tx: typeof mockTxClient) => Promise<unknown>) => cb(mockTxClient),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate a valid token', async () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    mockPrismaService.orgInvitation.findUnique.mockResolvedValue({
      id: 'some-uuid',
      token: 'valid-token',
      expiresAt: futureDate,
      usedAt: null,
    });

    const result = await service.validateToken('valid-token');
    expect(result).toEqual({ valid: true });
    expect(prisma.orgInvitation.findUnique).toHaveBeenCalledWith({
      where: { token: 'valid-token' },
    });
  });

  it('should throw BadRequestException if token does not exist', async () => {
    mockPrismaService.orgInvitation.findUnique.mockResolvedValue(null);

    await expect(service.validateToken('invalid-token')).rejects.toThrow(
      new BadRequestException('Enlace de invitación no válido.'),
    );
  });

  it('should throw BadRequestException if token is already used', async () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    mockPrismaService.orgInvitation.findUnique.mockResolvedValue({
      id: 'some-uuid',
      token: 'used-token',
      expiresAt: futureDate,
      usedAt: new Date(),
    });

    await expect(service.validateToken('used-token')).rejects.toThrow(
      new BadRequestException('El enlace de invitación ya ha sido utilizado.'),
    );
  });

  it('should throw BadRequestException if token is expired', async () => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 2);

    mockPrismaService.orgInvitation.findUnique.mockResolvedValue({
      id: 'some-uuid',
      token: 'expired-token',
      expiresAt: pastDate,
      usedAt: null,
    });

    await expect(service.validateToken('expired-token')).rejects.toThrow(
      new BadRequestException('El enlace de invitación ha expirado.'),
    );
  });

  it('should create a new invitation token valid for 24h', async () => {
    const creatorId = 'creator-uuid';
    const mockCreatedInvitation = {
      id: 'new-uuid',
      token: 'generated-hex-token',
      expiresAt: new Date(),
      usedAt: null,
      createdBy: creatorId,
    };

    mockPrismaService.orgInvitation.create.mockResolvedValue(
      mockCreatedInvitation,
    );

    const result = await service.createInvitation(creatorId);
    expect(result).toEqual(mockCreatedInvitation);
    expect(prisma.orgInvitation.create).toHaveBeenCalledWith({
      data: {
        token: expect.any(String),
        expiresAt: expect.any(Date),
        createdBy: creatorId,
      },
    });
  });

  it('should return all invitations ordered by createdAt desc', async () => {
    const mockList = [
      { id: 'uuid-1', token: 'token-1', createdAt: new Date() },
      { id: 'uuid-2', token: 'token-2', createdAt: new Date() },
    ];

    mockPrismaService.orgInvitation.findMany.mockResolvedValue(mockList);

    const result = await service.getInvitations();
    expect(result).toEqual(mockList);
    expect(prisma.orgInvitation.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  describe('registerOwnerWithOrg', () => {
    const validDto = {
      token: 'some-valid-token',
      email: 'owner@test.com',
      password: 'password123',
      isDriver: false,
      name: 'Owner User',
      phone: '6123-4567',
      orgName: 'New Fleet',
    };

    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    it('should successfully register Owner and Organization without driver profile', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockTxClient.orgInvitation.findUnique.mockResolvedValue({
        token: 'some-valid-token',
        expiresAt: futureDate,
        usedAt: null,
      });
      mockTxClient.organization.create.mockResolvedValue({
        id: 'org-uuid',
        name: 'New Fleet',
      });
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid' });

      const result = await service.registerOwnerWithOrg(validDto);

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'owner@test.com' },
      });
      expect(mockTxClient.orgInvitation.findUnique).toHaveBeenCalledWith({
        where: { token: 'some-valid-token' },
      });
      expect(mockTxClient.organization.create).toHaveBeenCalledWith({
        data: { name: 'New Fleet' },
      });
      expect(mockUsersService.create).toHaveBeenCalledWith(
        {
          email: 'owner@test.com',
          password: 'password123',
          name: 'Owner User',
          role: Role.OWNER,
          phone: '6123-4567',
          organization: {
            connect: { id: 'org-uuid' },
          },
        },
        mockTxClient,
      );
      expect(mockTxClient.orgInvitation.update).toHaveBeenCalledWith({
        where: { token: 'some-valid-token' },
        data: { usedAt: expect.any(Date) as unknown as Date },
      });
      expect(mockTxClient.driver.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.registerOwnerWithOrg(validDto)).rejects.toThrow(
        new BadRequestException('El correo electrónico ya está registrado.'),
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if token is missing/invalid in db', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockTxClient.orgInvitation.findUnique.mockResolvedValue(null);

      await expect(service.registerOwnerWithOrg(validDto)).rejects.toThrow(
        new BadRequestException('Enlace de invitación no válido.'),
      );
    });

    it('should throw BadRequestException if token is already used', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockTxClient.orgInvitation.findUnique.mockResolvedValue({
        token: 'some-valid-token',
        expiresAt: futureDate,
        usedAt: new Date(),
      });

      await expect(service.registerOwnerWithOrg(validDto)).rejects.toThrow(
        new BadRequestException(
          'El enlace de invitación ya ha sido utilizado.',
        ),
      );
    });

    it('should throw BadRequestException if token has expired', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      mockTxClient.orgInvitation.findUnique.mockResolvedValue({
        token: 'some-valid-token',
        expiresAt: pastDate,
        usedAt: null,
      });

      await expect(service.registerOwnerWithOrg(validDto)).rejects.toThrow(
        new BadRequestException('El enlace de invitación ha expirado.'),
      );
    });

    it('should throw BadRequestException if isDriver is true but conditional fields are missing', async () => {
      const invalidDriverDto = {
        ...validDto,
        isDriver: true,
      };

      await expect(
        service.registerOwnerWithOrg(invalidDriverDto),
      ).rejects.toThrow(
        new BadRequestException(
          'El nombre, apellido y cédula son requeridos para el perfil de conductor.',
        ),
      );
    });

    it('should throw BadRequestException if isDriver is false but name is missing', async () => {
      const invalidNameDto = {
        ...validDto,
        name: '',
      };

      await expect(
        service.registerOwnerWithOrg(invalidNameDto),
      ).rejects.toThrow(
        new BadRequestException('El nombre completo es requerido.'),
      );
    });

    it('should successfully register Owner with a new Driver profile', async () => {
      const driverDto = {
        token: 'some-valid-token',
        email: 'owner@test.com',
        password: 'password123',
        isDriver: true,
        firstName: 'Juan',
        lastName: 'Pérez',
        nationalId: '12345678',
        phone: '1234567',
        orgName: 'New Fleet',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.driver.findUnique.mockResolvedValue(null);
      mockTxClient.orgInvitation.findUnique.mockResolvedValue({
        token: 'some-valid-token',
        expiresAt: futureDate,
        usedAt: null,
      });
      mockTxClient.driver.findUnique.mockResolvedValue(null);
      mockTxClient.organization.create.mockResolvedValue({ id: 'org-uuid' });
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid' });

      const result = await service.registerOwnerWithOrg(driverDto);

      expect(result).toEqual({ success: true });
      expect(mockUsersService.create).toHaveBeenCalledWith(
        {
          email: 'owner@test.com',
          password: 'password123',
          name: 'Juan Pérez',
          role: Role.OWNER,
          phone: '1234567',
          organization: {
            connect: { id: 'org-uuid' },
          },
        },
        mockTxClient,
      );
      expect(mockTxClient.driver.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid',
          firstName: 'Juan',
          lastName: 'Pérez',
          nationalId: '12345678',
          phone: '1234567',
          status: 'ACTIVE',
        },
      });
      expect(mockTxClient.driver.update).not.toHaveBeenCalled();
    });

    it('should successfully register Owner and link to an existing unclaimed Driver profile', async () => {
      const driverDto = {
        token: 'some-valid-token',
        email: 'owner@test.com',
        password: 'password123',
        isDriver: true,
        firstName: 'Juan',
        lastName: 'Pérez',
        nationalId: '12345678',
        phone: '1234567',
        orgName: 'New Fleet',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.driver.findUnique.mockResolvedValue({
        id: 'existing-driver-id',
        userId: null,
      });
      mockTxClient.orgInvitation.findUnique.mockResolvedValue({
        token: 'some-valid-token',
        expiresAt: futureDate,
        usedAt: null,
      });
      mockTxClient.driver.findUnique.mockResolvedValue({
        id: 'existing-driver-id',
        userId: null,
      });
      mockTxClient.organization.create.mockResolvedValue({ id: 'org-uuid' });
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid' });

      const result = await service.registerOwnerWithOrg(driverDto);

      expect(result).toEqual({ success: true });
      expect(mockTxClient.driver.update).toHaveBeenCalledWith({
        where: { id: 'existing-driver-id' },
        data: {
          userId: 'user-uuid',
          firstName: 'Juan',
          lastName: 'Pérez',
          phone: '1234567',
          status: 'ACTIVE',
        },
      });
      expect(mockTxClient.driver.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if nationalId is already claimed', async () => {
      const driverDto = {
        token: 'some-valid-token',
        email: 'owner@test.com',
        password: 'password123',
        isDriver: true,
        firstName: 'Juan',
        lastName: 'Pérez',
        nationalId: '12345678',
        phone: '1234567',
        orgName: 'New Fleet',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.driver.findUnique.mockResolvedValue({
        id: 'driver-id',
        userId: 'another-user-id',
      });

      await expect(service.registerOwnerWithOrg(driverDto)).rejects.toThrow(
        new BadRequestException(
          'Este número de documento ya está vinculado a otro usuario.',
        ),
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
