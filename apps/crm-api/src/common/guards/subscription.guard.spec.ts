import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import { PrismaService } from 'src/prisma.service';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let reflector: Reflector;
  let prismaMock: {
    organization: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      organization: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    guard = module.get<SubscriptionGuard>(SubscriptionGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (
    user?: any,
    url = '/vehicles',
  ): Partial<ExecutionContext> => {
    const request = { user, url, path: url };
    return {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => jest.fn(),
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access if route is marked @Public()', async () => {
      // Mock reflector: first call is for IS_PUBLIC_KEY
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'isPublic');

      const context = createMockContext();
      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });

    it('should allow access if route does not require a subscription', async () => {
      // Mock reflector: returns false for both keys
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = createMockContext();
      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });

    it('should allow access if user is SUPER_ADMIN even if subscription is required', async () => {
      // Mock reflector: requires subscription and is not public
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      const context = createMockContext({ role: 'SUPER_ADMIN', orgId: null });
      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });

    it('should allow access if user is DRIVER even if subscription is required (drivers have no orgId)', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      const context = createMockContext({ role: 'DRIVER', orgId: null });
      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });

    it('should throw Payment Required exception if user is missing or orgId is missing', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      const contextNoUser = createMockContext();
      await expect(
        guard.canActivate(contextNoUser as ExecutionContext),
      ).rejects.toThrow(HttpException);

      const contextNoOrgId = createMockContext({ role: 'ADMIN', orgId: null });
      await expect(
        guard.canActivate(contextNoOrgId as ExecutionContext),
      ).rejects.toThrow(HttpException);
    });

    it('should throw Payment Required exception if orgId is not a valid UUID format', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      const contextInvalidOrgId = createMockContext({
        role: 'ADMIN',
        orgId: 'invalid-uuid-format',
      });
      await expect(
        guard.canActivate(contextInvalidOrgId as ExecutionContext),
      ).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: 'Se requiere una suscripción activa para esta acción.',
            error: 'Payment Required',
          },
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );
    });

    it('should throw Payment Required exception if organization does not exist in DB', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      prismaMock.organization.findUnique.mockResolvedValue(null);

      const context = createMockContext({
        role: 'ADMIN',
        orgId: 'a0000000-b000-c000-d000-e00000000000',
      });

      await expect(
        guard.canActivate(context as ExecutionContext),
      ).rejects.toThrow(HttpException);
    });

    it('should throw Payment Required exception if organization subscription status is INACTIVE', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'a0000000-b000-c000-d000-e00000000000',
        subscriptionStatus: 'INACTIVE',
        subscriptionExpiresAt: new Date(Date.now() + 100000),
      });

      const context = createMockContext({
        role: 'ADMIN',
        orgId: 'a0000000-b000-c000-d000-e00000000000',
      });

      await expect(
        guard.canActivate(context as ExecutionContext),
      ).rejects.toThrow(HttpException);
    });

    it('should throw Payment Required exception if organization subscription is expired', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'a0000000-b000-c000-d000-e00000000000',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date(Date.now() - 100000), // Expired in the past
      });

      const context = createMockContext({
        role: 'ADMIN',
        orgId: 'a0000000-b000-c000-d000-e00000000000',
      });

      await expect(
        guard.canActivate(context as ExecutionContext),
      ).rejects.toThrow(HttpException);
    });

    it('should return true if organization subscription is active and not expired', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'a0000000-b000-c000-d000-e00000000000',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date(Date.now() + 100000), // Active in the future
        vehicles: [],
      });

      const context = createMockContext({
        role: 'ADMIN',
        orgId: 'a0000000-b000-c000-d000-e00000000000',
      });

      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });

    it('should return true if organization has at least one vehicle with active tier', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'a0000000-b000-c000-d000-e00000000000',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date(Date.now() + 100000),
        vehicles: [{ subscriptionTier: 'ACTIVE' }],
      });

      const context = createMockContext({
        role: 'ADMIN',
        orgId: 'a0000000-b000-c000-d000-e00000000000',
      });

      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });

    it('should return true if organization is INACTIVE but has a vehicle with active trial', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => key === 'requiresSubscription');

      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'a0000000-b000-c000-d000-e00000000000',
        subscriptionStatus: 'INACTIVE',
        vehicles: [
          {
            subscriptionTier: 'NONE',
            trialActivated: true,
            trialExpiresAt: new Date(Date.now() + 100000),
          },
        ],
      });

      const context = createMockContext({
        role: 'ADMIN',
        orgId: 'a0000000-b000-c000-d000-e00000000000',
      });

      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);
    });
  });
});
