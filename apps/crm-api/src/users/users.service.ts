import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(data: Prisma.UserCreateInput, tx?: Prisma.TransactionClient) {
    // 1. Desestructuramos para NO mutar el objeto original (Inmutabilidad)
    const { password, ...userFields } = data;

    const parsedRounds = Number(
      this.configService.get('ENCRYPTION_ROUNDS') ?? 10,
    );
    const hashedPassword = await bcrypt.hash(password, parsedRounds);

    // 2. Inyección del cliente: usamos la transacción si se provee,
    // o el cliente global por defecto.
    const client = tx ?? this.prisma;

    return client.user.create({
      data: {
        ...userFields,
        password: hashedPassword,
      },
      select: {
        id: true,
      },
    });
  }

  findOneByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        driver: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  findOneById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  findAll(orgId?: string) {
    return this.prisma.user.findMany({
      where: orgId ? { orgId } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        driver: {
          select: {
            id: true,
            nationalId: true,
            phone: true,
          },
        },
      },
    });
  }

  findProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionStatus: true,
            paymentMethod: true,
            subscriptionExpiresAt: true,
            freeMatchCredits: true,
            vehicles: {
              select: {
                id: true,
                plateNumber: true,
                alias: true,
                subscriptionTier: true,
              },
            },
          },
        },
        driver: {
          select: {
            id: true,
            nationalId: true,
            phone: true,
            licenseType: true,
            shareScoresPublicly: true,
          },
        },
      },
    });
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) {
      throw new ForbiddenException('La contraseña actual es incorrecta');
    }

    const parsedRounds = Number(
      this.configService.get('ENCRYPTION_ROUNDS') ?? 10,
    );
    const hashedPassword = await bcrypt.hash(newPass, parsedRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    // Desestructuramos el password para verificar si se incluyó en la actualización
    const { password, ...userFields } = data;
    const updateData: Prisma.UserUpdateInput = { ...userFields };

    if (password && typeof password === 'string') {
      const parsedRounds = Number(
        this.configService.get('ENCRYPTION_ROUNDS') ?? 10,
      );
      updateData.password = await bcrypt.hash(password, parsedRounds);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Eliminar sesiones activas del usuario para evitar violaciones de clave foránea
      await tx.session.deleteMany({
        where: { userId: id },
      });

      // 2. Desvincular conductor (poner userId a null) si existe
      await tx.driver.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      // 3. Eliminar el usuario
      return tx.user.delete({
        where: { id },
      });
    });
  }
}
