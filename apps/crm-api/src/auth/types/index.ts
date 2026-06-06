import { Role } from '@prisma/client';
import type { Request } from 'express';
import { UserWithoutPassword } from 'src/users/entities/user.entity';

export type AuthenticatedRequest = Request & {
  user: UserWithoutPassword;
};

export type AccessTokenPayload = {
  sub: string;
  role: Role;
  orgId: string;
};

export type RefreshTokenPayload = AccessTokenPayload & {
  sessionId: string;
};
