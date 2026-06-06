import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { DocumentStorageService } from 'src/driver-documents/document-storage.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly storageService: DocumentStorageService,
  ) {}

  async createOrganizationAndOwner(data: {
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword?: string;
  }) {
    const existingUser = await this.usersService.findOneByEmail(
      data.ownerEmail,
    );
    if (existingUser) {
      throw new BadRequestException(
        'El correo del propietario ya está registrado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.name,
        },
      });

      const user = await this.usersService.create(
        {
          email: data.ownerEmail,
          password: data.ownerPassword || 'Temporal123!',
          name: data.ownerName,
          role: 'OWNER',
          organization: {
            connect: { id: organization.id },
          },
        },
        tx,
      );

      return {
        organization,
        owner: user,
      };
    });
  }

  async findAll() {
    const orgs = await this.prisma.organization.findMany({
      include: {
        users: {
          where: { role: { in: ['OWNER', 'ADMIN'] } },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        _count: {
          select: {
            vehicles: true,
          },
        },
      },
    });

    return Promise.all(
      orgs.map(async (org) => {
        if (!org.paymentReceiptKey) {
          return { ...org, paymentReceiptUrl: null };
        }
        try {
          const paymentReceiptUrl = await this.storageService.generateReadUrl(
            org.paymentReceiptKey,
            900,
          );
          return { ...org, paymentReceiptUrl };
        } catch (err) {
          return { ...org, paymentReceiptUrl: null };
        }
      }),
    );
  }

  async update(
    id: string,
    data: {
      name?: string;
      subscriptionStatus?: string;
      subscriptionExpiresAt?: string | null;
    },
  ) {
    const updateData: Prisma.OrganizationUpdateInput = {};

    if (data.name) {
      updateData.name = data.name;
    }
    if (data.subscriptionStatus) {
      updateData.subscriptionStatus = data.subscriptionStatus;
    }
    if (data.hasOwnProperty('subscriptionExpiresAt')) {
      updateData.subscriptionExpiresAt = data.subscriptionExpiresAt
        ? new Date(data.subscriptionExpiresAt)
        : null;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.organization.update({
        where: { id },
        data: updateData,
      });
    }

    return { success: true };
  }
}
