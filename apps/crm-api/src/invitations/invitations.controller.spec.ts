import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { BadRequestException } from '@nestjs/common';

describe('InvitationsController', () => {
  let controller: InvitationsController;
  let service: InvitationsService;

  const mockInvitationsService = {
    validateToken: jest.fn(),
    createInvitation: jest.fn(),
    getInvitations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        { provide: InvitationsService, useValue: mockInvitationsService },
      ],
    }).compile();

    controller = module.get<InvitationsController>(InvitationsController);
    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should validate a token parameter', async () => {
    mockInvitationsService.validateToken.mockResolvedValue({ valid: true });

    const result = await controller.validate('some-token');
    expect(result).toEqual({ valid: true });
    expect(service.validateToken).toHaveBeenCalledWith('some-token');
  });

  it('should throw BadRequestException if token is missing', () => {
    expect(() => controller.validate('')).toThrow(
      new BadRequestException('El token es requerido.'),
    );
  });

  it('should call createInvitation in service', async () => {
    const mockUser = {
      sub: 'user-uuid',
      email: 'sa@test.com',
      role: 'SUPER_ADMIN',
    };
    const mockRequest = { user: mockUser } as any;
    const mockInvitation = { id: 'inv-uuid', token: 'token-abc' };

    mockInvitationsService.createInvitation.mockResolvedValue(mockInvitation);

    const result = await controller.createInvitation(mockRequest);
    expect(result).toEqual(mockInvitation);
    expect(service.createInvitation).toHaveBeenCalledWith('user-uuid');
  });

  it('should call getInvitations in service', async () => {
    const mockList = [{ id: 'inv-uuid', token: 'token-abc' }];
    mockInvitationsService.getInvitations.mockResolvedValue(mockList);

    const result = await controller.getInvitations();
    expect(result).toEqual(mockList);
    expect(service.getInvitations).toHaveBeenCalled();
  });
});
