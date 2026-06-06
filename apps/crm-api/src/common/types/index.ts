import { Role } from '@prisma/client';
import { Socket } from 'socket.io';

export type CookieSettings = {
  httpOnly: boolean;
  path: string;
  secure: boolean;
  sameSite: boolean | 'strict' | 'lax' | 'none' | undefined;
  maxAge: number;
};

export interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      sub: string;
      role: Role;
      orgId: string;
    };
  };
}

export interface TelemetryUpdate {
  orgId: string;
}
