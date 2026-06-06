import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignedDriver(vehicleId: string) {
    return this.prisma.assignment.findFirst({
      where: { vehicleId, to: null },
      select: {
        driver: {
          select: {
            nationalId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getPreviousDrivers(vehicleId: string) {
    // Buscar asignaciones anteriores excluyendo conductores con asignación activa
    const assignments = await this.prisma.assignment.findMany({
      where: {
        vehicleId,
        driver: {
          assignments: {
            none: {
              to: null,
            },
          },
        },
      },
      select: {
        driver: {
          select: {
            id: true,
            nationalId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        from: 'desc',
      },
    });

    // Eliminar duplicados por identificación nacional
    const seen = new Set<string>();
    const uniqueDrivers: {
      id: string;
      nationalId: string;
      firstName: string | null;
      lastName: string | null;
    }[] = [];

    for (const a of assignments) {
      if (a.driver && !seen.has(a.driver.nationalId)) {
        seen.add(a.driver.nationalId);
        uniqueDrivers.push(a.driver);
      }
    }

    return uniqueDrivers;
  }

  async assignVehicleToDriver(vehicleId: string, newNationalId: string) {
    return this.prisma.$transaction(async (tx) => {
      const currentAssignment = await tx.assignment.findFirst({
        where: { vehicleId, to: null },
        select: {
          id: true,
          driver: {
            select: {
              nationalId: true,
            },
          },
        },
      });

      if (
        currentAssignment &&
        currentAssignment.driver.nationalId === newNationalId
      ) {
        return currentAssignment;
      }

      const now = new Date();

      if (currentAssignment) {
        await tx.assignment.update({
          where: { id: currentAssignment.id },
          data: { to: now },
        });
      }

      const newDriver = await tx.driver.findFirst({
        where: { nationalId: newNationalId },
        select: {
          id: true,
        },
      });

      if (!newDriver) {
        throw new BadRequestException('El chofer no existe');
      }

      const newAssignment = await tx.assignment.create({
        data: {
          vehicleId,
          driverId: newDriver.id,
          from: now,
        },
      });

      return newAssignment;
    });
  }

  async unassignVehicle(vehicleId: string) {
    const currentAssignment = await this.prisma.assignment.findFirst({
      where: { vehicleId, to: null },
    });

    if (!currentAssignment) {
      throw new BadRequestException(
        'El vehículo no tiene una asignación activa',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Terminar la asignación actual
      const updatedAssignment = await tx.assignment.update({
        where: { id: currentAssignment.id },
        data: { to: now },
      });

      return updatedAssignment;
    });
  }
}
