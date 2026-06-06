import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma.service';
import { REQUIRES_SUBSCRIPTION_KEY } from '../decorators/requires-subscription.decorator';
import { AccessTokenPayload } from 'src/auth/types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Si la ruta tiene la metadata de @Public(), hacemos bypass directo
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Si la ruta o el controlador no tienen la metadata de @RequiresSubscription(),
    // hacemos bypass del check.
    const requiresSubscription = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresSubscription) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AccessTokenPayload = request.user;

    // 3. SUPER_ADMIN y DRIVER no son pagadores de suscripción — bypass directo.
    // Los conductores no tienen orgId; sus organizaciones empleadoras son las que pagan.
    if (user && (user.role === 'SUPER_ADMIN' || user.role === 'DRIVER')) {
      return true;
    }

    // 4. Si no está autenticado o no tiene orgId, no tiene una suscripción activa
    if (!user || !user.orgId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Se requiere una suscripción activa para esta acción.',
          error: 'Payment Required',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Validamos formato UUID para orgId para evitar fallos de base de datos
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user.orgId)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Se requiere una suscripción activa para esta acción.',
          error: 'Payment Required',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 5. Extraer vehicleId de los parámetros, query o body del request
    const vehicleId =
      request.params?.id ||
      request.params?.vehicleId ||
      request.query?.vehicleId ||
      request.body?.vehicleId;

    if (vehicleId) {
      // Validamos formato UUID para vehicleId
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(vehicleId)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Identificador de vehículo no válido.',
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: { organization: true },
      });

      if (!vehicle) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Vehículo no encontrado.',
            error: 'Not Found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (user.role !== 'SUPER_ADMIN' && vehicle.orgId !== user.orgId) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            message: 'No tienes permisos de flota para esta acción.',
            error: 'Forbidden',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // Validamos si la suscripción del vehículo está activa
      const isTrialActive =
        vehicle.trialActivated &&
        vehicle.trialExpiresAt &&
        new Date() < new Date(vehicle.trialExpiresAt);

      const isOrgSubActive =
        vehicle.organization?.subscriptionStatus === 'ACTIVE' &&
        (!vehicle.organization?.subscriptionExpiresAt ||
          new Date() < new Date(vehicle.organization.subscriptionExpiresAt));

      const isSubscribedActive =
        vehicle.subscriptionTier === 'ACTIVE' && isOrgSubActive;

      if (!isTrialActive && !isSubscribedActive) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: 'Se requiere una suscripción activa para esta acción.',
            error: 'Payment Required',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    } else {
      // 6. Buscamos la organización en la base de datos con sus vehículos
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId },
        include: {
          vehicles: {
            select: {
              subscriptionTier: true,
              trialActivated: true,
              trialExpiresAt: true,
            },
          },
        },
      });

      if (!org) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: 'Se requiere una suscripción activa para esta acción.',
            error: 'Payment Required',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      // Validamos el estado y la fecha de expiración de la suscripción principal
      const isSubscriptionActive = org.subscriptionStatus === 'ACTIVE';
      const isExpired = org.subscriptionExpiresAt
        ? new Date() > new Date(org.subscriptionExpiresAt)
        : false;
      const hasActiveMainSubscription = isSubscriptionActive && !isExpired;

      // Validamos si tiene al menos un vehículo con prueba o plan activo
      const hasActiveVehicle =
        org.vehicles?.some(
          (v) =>
            (v.subscriptionTier === 'ACTIVE' && hasActiveMainSubscription) ||
            (v.trialActivated &&
              v.trialExpiresAt &&
              new Date() < new Date(v.trialExpiresAt)),
        ) ?? false;

      if (!hasActiveMainSubscription && !hasActiveVehicle) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: 'Se requiere una suscripción activa para esta acción.',
            error: 'Payment Required',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    return true;
  }
}
