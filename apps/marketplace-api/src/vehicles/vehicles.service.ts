import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export type AccessTokenPayload = {
  sub: string;
  role: string;
  orgId: string;
};

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findMarketplaceListings(user?: AccessTokenPayload) {
    // 1. Si es un chofer, verificar si ya tiene un vehículo asignado
    if (user && user.role === "DRIVER") {
      const activeAssignment = await this.prisma.assignment.findFirst({
        where: {
          driver: {
            userId: user.sub,
          },
          to: null,
        },
      });

      if (activeAssignment) {
        throw new ForbiddenException(
          "Los conductores con un vehículo asignado no pueden explorar otros vehículos en el mercado.",
        );
      }
    }

    // 2. Buscar vehículos listados para el mercado (isListed: true y sin asignación activa)
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isListed: true,
        assignments: {
          none: {
            to: null,
          },
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        category: true,
        fuelType: true,
        listingPrice: true,
        listingDescription: true,
        hasOptionToBuy: true,
        organization: {
          select: {
            name: true,
            users: {
              where: {
                role: "OWNER",
              },
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return vehicles.map((v) => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        category: v.category,
        fuelType: v.fuelType,
        listingPrice: v.listingPrice,
        listingDescription: v.listingDescription,
        hasOptionToBuy: v.hasOptionToBuy,
        isLocked: true,
        organization: v.organization
          ? { name: v.organization.name, users: [] }
          : null,
      }));
    }

    // 3. Si el rol es DRIVER, verificar su estado de activación
    if (user.role === "DRIVER") {
      const driver = await this.prisma.driver.findUnique({
        where: { userId: user.sub },
        select: { status: true },
      });

      const isDriverActive = driver?.status === "ACTIVE";

      // Si no está activo, ocultamos los detalles de la oferta/contacto
      return vehicles.map((v) => {
        if (!isDriverActive) {
          return {
            id: v.id,
            make: v.make,
            model: v.model,
            year: v.year,
            category: v.category,
            fuelType: v.fuelType,
            listingPrice: v.listingPrice,
            listingDescription:
              "Debes completar tu verificación de documentos para ver la descripción completa y contactar al dueño.",
            hasOptionToBuy: v.hasOptionToBuy,
            isLocked: true, // Flag frontend
          };
        }
        return {
          ...v,
          isLocked: false,
        };
      });
    }

    return vehicles;
  }
}
