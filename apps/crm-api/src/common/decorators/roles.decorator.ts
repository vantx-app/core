import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Tu Enum recién salido del horno

export const ROLES_KEY = 'roles';
// Este decorador acepta uno o múltiples roles
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
