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
    it('should always allow access (return true) under any circumstances', async () => {
      const context = createMockContext();
      await expect(
        guard.canActivate(context as ExecutionContext),
      ).resolves.toBe(true);

      const contextWithUser = createMockContext({
        role: 'ADMIN',
        orgId: 'some-org',
      });
      await expect(
        guard.canActivate(contextWithUser as ExecutionContext),
      ).resolves.toBe(true);
    });
  });
});
