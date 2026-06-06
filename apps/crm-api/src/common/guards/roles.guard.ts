import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from 'src/auth/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta no tiene el decorador @Roles, la dejamos pasar
    // (asumiendo que JwtAuthGuard ya verificó que el usuario existe)
    if (!requiredRoles) {
      return true;
    }

    const request: AuthenticatedRequest = context.switchToHttp().getRequest();

    // Verificamos si el rol del JWT está dentro de los roles permitidos
    const hasRole = requiredRoles.includes(request.user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        'No tienes permisos de flota para esta acción.',
      );
    }

    return true;
  }
}
