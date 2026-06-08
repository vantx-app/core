import { JwtService } from '@nestjs/jwt';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ROLES } from 'src/common/enums/roles.enum';
import { AuthenticatedSocket } from 'src/common/types';
import { PrismaService } from 'src/prisma.service';
import { Logger } from '@nestjs/common';

// cors: '*' allows your Next.js local server to connect without CORS errors
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? (process.env.CORS_ORIGIN.includes(',')
        ? process.env.CORS_ORIGIN.split(',')
        : process.env.CORS_ORIGIN)
      : 'http://localhost:3001',
    credentials: true,
  },
  path: '/api/socket.io/',
  transports: ['websocket'],
})
export class TelemetryGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('TelemetryGateway');

  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use((socket: any, next) => {
      (async () => {
        const token = socket.handshake.auth?.token;
        const trackingLinkId = socket.handshake.auth?.trackingLinkId;

        if (!token && !trackingLinkId) {
          return next(
            new Error('Unauthorized: No token or trackingLinkId provided'),
          );
        }

        if (token) {
          try {
            const payload = await this.jwtService.verifyAsync(token, {
              secret: process.env.JWT_SECRET,
            });
            socket.data.user = payload;
            next();
          } catch (error) {
            next(new Error('Unauthorized: jwt expired'));
          }
        } else {
          // Validate UUID format to prevent database query errors/crashes
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(trackingLinkId)) {
            return next(
              new Error('Unauthorized: Invalid tracking link ID format'),
            );
          }

          try {
            const link = await this.prismaService.trackingLink.findUnique({
              where: { id: trackingLinkId },
            });
            if (!link || !link.isActive || new Date() > link.expiresAt) {
              return next(
                new Error('Unauthorized: Invalid or expired tracking link'),
              );
            }
            socket.data.trackingLinkId = trackingLinkId;
            socket.data.vehicleId = link.vehicleId;
            next();
          } catch (error) {
            next(new Error('Unauthorized: DB error checking tracking link'));
          }
        }
      })().catch((err) => {
        next(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  handleConnection(client: any) {
    if (client.data?.trackingLinkId) {
      client.join(`tracking_${client.data.trackingLinkId}`);
      this.logger.log(
        `Cliente anónimo se unió a la sala: tracking_${client.data.trackingLinkId}`,
      );
    }
  }

  @SubscribeMessage('subscribe-to-fleet')
  async handleSubscription(
    client: AuthenticatedSocket,
    payload?: { targetOrgId?: string; global?: boolean },
  ) {
    const user = client.data.user;

    if (process.env.NODE_ENV !== 'test') {
      if (user && user.sub) {
        client.join(`user_${user.sub}`);
        this.logger.log(
          `Usuario ${user.sub} se unió a la sala personal: user_${user.sub}`,
        );
      }

      if (user && user.orgId) {
        client.join(`org_${user.orgId}`);
        this.logger.log(
          `Usuario se unió a la sala de la organización: org_${user.orgId}`,
        );
      }
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      if (payload?.targetOrgId) {
        const roomName = `org_${payload.targetOrgId}`;
        client.join(roomName);
      } else if (payload?.global) {
        client.join('admin_global_map');
      }
      return;
    }

    if (user.role === ROLES.OWNER && user.orgId) {
      const roomName = `org_${user.orgId}`;
      client.join(roomName);
      return;
    }

    if (user.role === ROLES.DRIVER) {
      const activeAssignment = await this.prismaService.assignment.findFirst({
        where: { driver: { userId: user.sub }, to: null },
        select: { vehicleId: true },
      });

      if (!activeAssignment) return;

      client.join(`vehicle_${activeAssignment.vehicleId}`);
      return;
    }
  }

  async broadcastToClients(payload: any) {
    if (!payload.orgId || !payload.vehicleId) {
      return;
    }

    try {
      // Validar si el vehículo tiene telemetría activa (trial o suscripción de pago)
      const vehicle = await this.prismaService.vehicle.findUnique({
        where: { id: payload.vehicleId },
        include: { organization: true },
      });

      if (!vehicle) return;

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

      // Si no tiene prueba activa ni plan de pago activo, ignoramos la transmisión
      if (!isTrialActive && !isSubscribedActive) {
        return;
      }

      // 1. Emit to internal authenticated rooms
      this.server
        .to(`org_${payload.orgId}`)
        .to(`vehicle_${payload.vehicleId}`)
        .to('admin_global_map')
        .emit('live-location', payload);

      // 2. Fetch active tracking links for this vehicle and emit to public rooms
      const links = await this.prismaService.trackingLink.findMany({
        where: {
          vehicleId: payload.vehicleId,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      if (links && links.length > 0) {
        links.forEach((link) => {
          this.server.to(`tracking_${link.id}`).emit('live-location', {
            vehicleId: payload.vehicleId,
            lastLat: payload.latitude,
            lastLng: payload.longitude,
            lastAngle: payload.angle,
            currentStatus: payload.status,
            // For maximum compatibility with any potential consumer
            latitude: payload.latitude,
            longitude: payload.longitude,
            angle: payload.angle,
            status: payload.status,
          });
        });
      }
    } catch (err) {
      this.logger.error('Error en broadcastToClients:', err);
    }
  }
}
