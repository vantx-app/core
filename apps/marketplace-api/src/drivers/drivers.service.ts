import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findPublicAvailableDrivers() {
    const dbDrivers = await this.prisma.driver.findMany({
      where: {
        status: "ACTIVE",
        assignments: {
          none: {
            to: null,
          },
        },
      },
      include: {
        globalStats: true,
        documents: {
          select: {
            type: true,
            status: true,
          },
        },
      },
    });

    return dbDrivers.map((d) => this.maskDriverForPublic(d));
  }

  async findOnePublic(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        globalStats: true,
        documents: {
          select: {
            type: true,
            status: true,
          },
        },
        scoreSnapshots: {
          orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
          take: 12,
        },
      },
    });

    if (!driver || driver.status !== "ACTIVE") {
      throw new NotFoundException("Conductor no encontrado o no disponible.");
    }

    return this.maskDriverForPublic(driver);
  }

  private maskDriverForPublic(driver: any) {
    const fName = driver.firstName || "Conductor";
    const lInitial = driver.lastName ? `${driver.lastName[0]}.` : "";
    const maskedName = `${fName} ${lInitial}`.trim();
    const share = driver.shareScoresPublicly ?? true;
    const hasHistory =
      !!driver.globalStats &&
      (driver.globalStats.totalKm > 0 || driver.globalStats.totalSnapshots > 0);

    return {
      id: driver.id,
      name: maskedName,
      firstName: fName,
      lastName: lInitial ? `${lInitial}` : null,
      nationalId: "***-***-***",
      phone: null,
      status: driver.status,
      licenseType: driver.licenseType,
      shareScoresPublicly: share,
      hasHistory,
      documents: driver.documents || [],
      globalStats: driver.globalStats
        ? {
            globalOverallScore: share
              ? (driver.globalStats.globalOverallScore ??
                driver.globalStats.overallScore ??
                null)
              : null,
            globalSafetyScore: share
              ? (driver.globalStats.globalSafetyScore ??
                driver.globalStats.safetyScore ??
                null)
              : null,
            globalEcoScore: share
              ? (driver.globalStats.globalEcoScore ??
                driver.globalStats.ecoScore ??
                null)
              : null,
            globalAssetScore: share
              ? (driver.globalStats.globalAssetScore ??
                driver.globalStats.assetScore ??
                null)
              : null,
          }
        : null,
      scoreSnapshots: share ? driver.scoreSnapshots || [] : [],
    };
  }
}
