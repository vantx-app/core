import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RegisterOwnerWithOrgDto } from './dto/register-owner-with-org.dto';
import { Role } from '@prisma/client';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  /**
   * Valida que un token de invitación exista, no haya expirado y no haya sido utilizado.
   * @param token Token de invitación cryptográfico recibido desde la URL
   */
  async validateToken(token: string) {
    // 1. Buscamos el token de invitación en la base de datos
    const invitation = await this.prisma.orgInvitation.findUnique({
      where: { token },
    });

    // 2. Si no existe, lanzamos un error de BadRequestException en español
    if (!invitation) {
      throw new BadRequestException('Enlace de invitación no válido.');
    }

    // 3. Si el token ya fue utilizado, lanzamos un error en español
    if (invitation.usedAt) {
      throw new BadRequestException(
        'El enlace de invitación ya ha sido utilizado.',
      );
    }

    // 4. Si la fecha actual supera la de expiración, lanzamos un error en español
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('El enlace de invitación ha expirado.');
    }

    return { valid: true };
  }

  /**
   * Crea un nuevo token de invitación válido por 24 horas.
   * @param createdBy ID del usuario administrador que crea la invitación
   */
  async createInvitation(createdBy: string) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.prisma.orgInvitation.create({
      data: {
        token,
        expiresAt,
        createdBy,
      },
    });
  }

  /**
   * Retorna todas las invitaciones de organización ordenadas por fecha de creación descendente.
   */
  async getInvitations() {
    return this.prisma.orgInvitation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Registra un nuevo propietario de flota y crea su organización de forma atómica.
   */
  async registerOwnerWithOrg(dto: RegisterOwnerWithOrgDto) {
    // 1. Validaciones previas a la transacción (email y cédula duplicada si aplica)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException(
        'El correo electrónico ya está registrado.',
      );
    }

    if (dto.isDriver) {
      if (!dto.firstName || !dto.lastName || !dto.nationalId) {
        throw new BadRequestException(
          'El nombre, apellido y cédula son requeridos para el perfil de conductor.',
        );
      }

      const existingDriver = await this.prisma.driver.findUnique({
        where: { nationalId: dto.nationalId },
      });
      if (existingDriver && existingDriver.userId) {
        throw new BadRequestException(
          'Este número de documento ya está vinculado a otro usuario.',
        );
      }
    } else {
      if (!dto.name) {
        throw new BadRequestException('El nombre completo es requerido.');
      }
    }

    // 2. Ejecución de la transacción atómica
    await this.prisma.$transaction(async (tx) => {
      // A. Validar y verificar el token de invitación si fue provisto
      if (dto.token) {
        const invitation = await tx.orgInvitation.findUnique({
          where: { token: dto.token },
        });

        if (!invitation) {
          throw new BadRequestException('Enlace de invitación no válido.');
        }

        if (invitation.usedAt) {
          throw new BadRequestException(
            'El enlace de invitación ya ha sido utilizado.',
          );
        }

        if (invitation.expiresAt < new Date()) {
          throw new BadRequestException('El enlace de invitación ha expirado.');
        }
      }

      // B. Crear la Organización
      const org = await tx.organization.create({
        data: {
          name: dto.orgName,
        },
      });

      // C. Crear el Usuario Propietario (OWNER)
      const user = await this.usersService.create(
        {
          email: dto.email,
          password: dto.password,
          name: dto.isDriver ? `${dto.firstName} ${dto.lastName}` : dto.name,
          role: Role.OWNER,
          organization: {
            connect: { id: org.id },
          },
        },
        tx,
      );

      // D. Crear/Vincular el perfil de conductor si es dual
      if (dto.isDriver) {
        const existingDriver = await tx.driver.findUnique({
          where: { nationalId: dto.nationalId! },
        });

        if (existingDriver) {
          await tx.driver.update({
            where: { id: existingDriver.id },
            data: {
              userId: user.id,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              status: 'ACTIVE',
            },
          });
        } else {
          await tx.driver.create({
            data: {
              userId: user.id,
              firstName: dto.firstName,
              lastName: dto.lastName,
              nationalId: dto.nationalId!,
              phone: dto.phone,
              status: 'ACTIVE',
            },
          });
        }
      }

      // E. Consumir el token de invitación si fue provisto
      if (dto.token) {
        await tx.orgInvitation.update({
          where: { token: dto.token },
          data: {
            usedAt: new Date(),
          },
        });
      }
    });

    return { success: true };
  }
}
