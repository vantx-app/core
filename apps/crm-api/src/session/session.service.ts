import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Metadata } from './types';
import { TIME_TO_LIVE_IN_MS } from 'src/common/constants';

@Injectable()
export class SessionService {
  private readonly logger = new Logger('SessionService');

  constructor(private prisma: PrismaService) {}

  async create(userId: string, metadata?: Metadata) {
    const expiresAt = new Date(Date.now() + TIME_TO_LIVE_IN_MS);

    const session = await this.prisma.session.create({
      data: {
        expiresAt,
        ipAddress: metadata?.ip,
        userAgent: metadata?.userAgent,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

    return session;
  }

  async validate(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new ForbiddenException('Session not found');
    }

    if (session.expiresAt < new Date()) {
      // Si la sesión expiró por inactividad prolongada (ej. 7 días), la marcamos como revocada por limpieza
      await this.revoke(sessionId);
      throw new ForbiddenException('Session expired');
    }

    if (session.isRevoked) {
      // Como ya no estamos rotando el ID de la sesión en cada refresh,
      // si está revocada, es porque se cerró sesión manualmente (logout) o por el admin.
      // Ya no necesitamos el Grace Period aquí.
      throw new ForbiddenException('Session revoked');
    }

    return session;
  }

  // Nuevo método para mantener viva la sesión sin crear basura en la BD
  async extendSession(sessionId: string, metadata: Metadata) {
    this.logger.log(
      `Sesión extendida: ${sessionId} desde IP: ${metadata?.ip || 'Desconocida'}`,
    );
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Ejemplo: Extender por 7 días más
        // Opcional: Actualizar IP o UserAgent si cambiaron
        // ipAddress: metadata.ip,
      },
    });
  }

  async revoke(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  async revokeAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}
