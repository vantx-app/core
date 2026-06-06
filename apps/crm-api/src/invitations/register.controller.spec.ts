import { Test, TestingModule } from '@nestjs/testing';
import { RegisterController } from './register.controller';
import { InvitationsService } from './invitations.service';

describe('RegisterController', () => {
  let controller: RegisterController;
  let service: InvitationsService;

  const mockInvitationsService = {
    registerOwnerWithOrg: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegisterController],
      providers: [
        { provide: InvitationsService, useValue: mockInvitationsService },
      ],
    }).compile();

    controller = module.get<RegisterController>(RegisterController);
    service = module.get<InvitationsService>(InvitationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call registerOwnerWithOrg in service', async () => {
    const dto = {
      token: 'some-token',
      email: 'owner@test.com',
      password: 'password123',
      isDriver: false,
      name: 'Owner User',
      orgName: 'New Fleet',
    };

    mockInvitationsService.registerOwnerWithOrg.mockResolvedValue({
      success: true,
    });

    const result = await controller.registerOwnerWithOrg(dto);
    expect(result).toEqual({ success: true });
    expect(service.registerOwnerWithOrg).toHaveBeenCalledWith(dto);
  });
});
