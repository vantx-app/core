import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { PrismaService } from 'src/prisma.service';
import { VERIFICATION_STATUS } from 'src/common/enums/verificationStatus.enum';
import { UsersService } from 'src/users/users.service';
import { VerifyDriverDto } from './dto/verify-driver.dto';
import { OnboardDriverDto } from './dto/onboard-driver.dto';
import { CacheService } from 'src/common/cache.service';
import { AccessTokenPayload } from 'src/auth/types';
import { ClaimDriverDto } from './dto/claim-driver.dto';
import { ROLES } from 'src/common/enums/roles.enum';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import { RuleEngineConfig } from 'src/scoring-cron/scoring.interfaces';
import {
  FormattableDriver,
  FormattedDriver,
  DriverWithGlobalStats,
  DriverWithOrgAssignments,
  DriverWithStats,
  MaskedDriverGlobalStats,
} from './drivers.types';

@Injectable()
export class DriversService {
  private readonly DEFAULT_CONFIG: RuleEngineConfig = {
    engineVersion: '1.0',
    pillars: {
      SAFETY: { weight: 0.45, baseScore: 100 },
      EFFICIENCY: { weight: 0.3, baseScore: 100 },
      ASSET_CARE: { weight: 0.25, baseScore: 100 },
    },
    rules: [
      {
        code: 'OVERSPEEDING',
        pillar: 'SAFETY',
        deductionPer100Km: 5.0,
        maxDeduction: 20.0,
      },
      {
        code: 'EXCESSIVE_IDLING',
        pillar: 'EFFICIENCY',
        deductionPer100Km: 20.0,
        maxDeduction: 60.0,
      },
      {
        code: 'HIGH_RPM',
        pillar: 'ASSET_CARE',
        deductionPer100Km: 12.0,
        maxDeduction: 50.0,
      },
      {
        code: 'DEVICE_UNPLUGGED',
        pillar: 'ASSET_CARE',
        deductionPerEvent: 20.0,
        maxDeduction: 60.0,
      },
    ],
  };

  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService,
    private cacheService: CacheService,
    private rulesEngineService: RulesEngineService,
  ) {}

  create(_createDriverDto: CreateDriverDto) {
    return 'This action adds a new driver';
  }

  private formatDriver<T extends FormattableDriver>(
    driver: T,
  ): FormattedDriver<T> {
    const name =
      driver.firstName && driver.lastName
        ? `${driver.firstName} ${driver.lastName}`
        : driver.firstName || driver.lastName || driver.nationalId;
    return {
      ...driver,
      name,
      globalStats: driver.globalStats as MaskedDriverGlobalStats | null,
    } as FormattedDriver<T>;
  }

  maskDriverForPublic(driver: any) {
    const fName = driver.firstName || 'Conductor';
    const lInitial = driver.lastName ? `${driver.lastName[0]}.` : '';
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
      nationalId: '***-***-***',
      phone: null,
      status: driver.status,
      licenseType: driver.licenseType,
      shareScoresPublicly: share,
      hasHistory,
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
      documents: driver.documents || [],
    };
  }

  async findAll(onlyAvailable?: boolean) {
    const cacheKey = `drivers:all:${onlyAvailable ? 'available' : 'all'}`;
    let drivers =
      this.cacheService.get<FormattedDriver<DriverWithGlobalStats>[]>(cacheKey);
    if (!drivers) {
      const dbDrivers = await this.prismaService.driver.findMany({
        where: {
          status: 'ACTIVE',
          ...(onlyAvailable
            ? {
                assignments: {
                  none: {
                    to: null,
                  },
                },
              }
            : {}),
        },
        include: {
          globalStats: true,
          documents: {
            select: {
              type: true,
              status: true,
            },
          },
          assignments: {
            where: {
              to: null,
            },
            include: {
              vehicle: {
                select: {
                  orgId: true,
                },
              },
            },
          },
        },
      });
      drivers = dbDrivers.map((d) => this.formatDriver(d));
      this.cacheService.set(cacheKey, drivers, 15 * 60 * 1000);
    }
    return drivers;
  }

  async findOne(id: string, queryingUser?: AccessTokenPayload) {
    const driver = await this.prismaService.driver.findUnique({
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
          orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
          take: 12,
        },
        assignments: {
          orderBy: { from: 'desc' },
          include: {
            vehicle: true,
          },
        },
      },
    });
    if (!driver) return null;

    let shouldMask = true;
    let assignments: { from: Date; to: Date | null }[] = [];

    if (
      !queryingUser ||
      queryingUser.role === ROLES.SUPER_ADMIN ||
      queryingUser.sub === driver.userId
    ) {
      shouldMask = false;
    } else if (driver.shareScoresPublicly) {
      shouldMask = false;
    } else {
      // Fetch all historical and active assignments for this driver within the querying user's organization
      assignments = await this.prismaService.assignment.findMany({
        where: {
          driverId: driver.id,
          vehicle: { orgId: queryingUser.orgId },
        },
        select: {
          from: true,
          to: true,
        },
      });
      if (assignments.length > 0) {
        shouldMask = false;
      }
    }

    const formatted = this.formatDriver(driver);
    if (shouldMask) {
      if (formatted.globalStats) {
        formatted.globalStats.globalSafetyScore = null;
        formatted.globalStats.globalEcoScore = null;
        formatted.globalStats.globalAssetScore = null;
        formatted.globalStats.globalOverallScore = null;
      }
      formatted.scoreSnapshots = [];
    } else if (
      queryingUser &&
      queryingUser.role !== ROLES.SUPER_ADMIN &&
      !driver.shareScoresPublicly
    ) {
      // Filter snapshots to only return weeks that overlap with assignment periods in the owner's organization
      formatted.scoreSnapshots = formatted.scoreSnapshots.filter((snapshot) => {
        const { start, end } = this.getISOWeekRange(
          snapshot.year,
          snapshot.weekNumber,
        );
        return assignments.some((assign) => {
          const assignFrom = new Date(assign.from);
          const assignTo = assign.to ? new Date(assign.to) : null;
          return assignFrom <= end && (assignTo === null || assignTo >= start);
        });
      });
    }

    return formatted;
  }

  async findAllByOrgId(orgId: string) {
    const cacheKey = `drivers:org:${orgId}`;
    let drivers =
      this.cacheService.get<FormattedDriver<DriverWithOrgAssignments>[]>(
        cacheKey,
      );
    if (!drivers) {
      const dbDrivers = await this.prismaService.driver.findMany({
        where: {
          assignments: {
            some: {
              vehicle: {
                orgId,
              },
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
          assignments: {
            where: {
              vehicle: {
                orgId,
              },
              to: null,
            },
            include: {
              vehicle: true,
            },
          },
        },
      });
      drivers = dbDrivers.map((d) => this.formatDriver(d));
      this.cacheService.set(cacheKey, drivers, 15 * 60 * 1000);
    }
    return drivers;
  }

  async findStatsByUserId(userId: string) {
    const cacheKey = `drivers:user:${userId}`;
    let driver =
      this.cacheService.get<FormattedDriver<DriverWithStats>>(cacheKey);
    if (!driver) {
      const dbDriver = await this.prismaService.driver.findUnique({
        where: { userId },
        include: {
          globalStats: true,
          documents: {
            select: {
              type: true,
              status: true,
            },
          },
          scoreSnapshots: {
            orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
            take: 12,
          },
          assignments: {
            where: { to: null },
            include: {
              vehicle: true,
            },
          },
        },
      });
      if (!dbDriver) {
        throw new NotFoundException(
          'No se encontró perfil de conductor asociado a este usuario.',
        );
      }
      driver = this.formatDriver(dbDriver);
      this.cacheService.set(cacheKey, driver, 15 * 60 * 1000);
    }

    return driver;
  }

  findOneByNationalId(nationalId: string) {
    return this.prismaService.driver.findUnique({
      where: { nationalId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  async verify(verifyDriverDto: VerifyDriverDto) {
    const [user, driver] = await Promise.all([
      this.usersService.findOneByEmail(verifyDriverDto.email),
      this.findOneByNationalId(verifyDriverDto.nationalId),
    ]);

    // 1. Validaciones Bloqueantes
    if (user) return { status: VERIFICATION_STATUS.EMAIL_TAKEN };
    if (driver && driver.userId !== null)
      return { status: VERIFICATION_STATUS.DOCUMENT_TAKEN };

    // 2. Rutas Felices
    if (driver && driver.userId === null)
      return { status: VERIFICATION_STATUS.UNCLAIMED_PROFILE };

    return { status: VERIFICATION_STATUS.NO_RECORD_FOUND };
  }

  async onboard(onboardDriverDto: OnboardDriverDto) {
    const { email, password, firstName, lastName, nationalId, phone } =
      onboardDriverDto;

    await this.prismaService.$transaction(async (tx) => {
      const user = await this.usersService.create(
        {
          email,
          password,
          name: `${firstName} ${lastName}`,
        },
        tx,
      );

      const driver = await tx.driver.upsert({
        where: { nationalId },
        update: {
          firstName,
          lastName,
          userId: user.id,
          phone,
        },
        create: {
          firstName,
          lastName,
          nationalId,
          userId: user.id,
          phone,
        },
        select: { id: true },
      });

      if (!driver) {
        throw new Error('Error creating user');
      }
    });

    return { status: 'Onboarded Successfully' };
  }

  update(id: string, _updateDriverDto: UpdateDriverDto) {
    return `This action updates a #${id} driver`;
  }

  async updateShareSettings(userId: string, shareScoresPublicly: boolean) {
    const driver = await this.prismaService.driver.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Perfil de conductor no encontrado.');
    }

    const updated = await this.prismaService.driver.update({
      where: { id: driver.id },
      data: { shareScoresPublicly },
    });

    // Invalidate caches
    this.cacheService.del(`drivers:user:${userId}`);
    this.cacheService.delByPattern('drivers:all:');

    return updated;
  }

  remove(id: string) {
    return `This action removes a #${id} driver`;
  }

  async claim(actor: AccessTokenPayload, dto: ClaimDriverDto) {
    const { userId, nationalId, phone, firstName, lastName } = dto;

    // 1. Obtener el usuario objetivo
    const targetUser = await this.usersService.findOneById(userId);
    if (!targetUser) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // 2. Validaciones jerárquicas (FR-1)
    if (actor.sub === userId) {
      throw new ForbiddenException(
        'No tienes permisos de flota para esta acción.',
      );
    }

    if (targetUser.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No tienes permisos de flota para esta acción.',
      );
    }

    if (targetUser.role === ROLES.OWNER) {
      if (actor.role !== ROLES.SUPER_ADMIN) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }

    if (targetUser.role === ROLES.ADMIN) {
      if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.OWNER) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }

    // Validación de límites de organización
    if (actor.role !== ROLES.SUPER_ADMIN) {
      if (targetUser.orgId && targetUser.orgId !== actor.orgId) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }

    // 3. Validaciones de vinculación
    // Verificar si el usuario ya tiene un conductor vinculado
    const existingDriverForUser = await this.prismaService.driver.findUnique({
      where: { userId },
    });
    if (existingDriverForUser) {
      throw new BadRequestException(
        'El usuario ya está vinculado a un perfil de conductor.',
      );
    }

    // Verificar si el nationalId (cédula) ya está vinculado a otro usuario activo
    const existingDriverByNationalId =
      await this.prismaService.driver.findUnique({
        where: { nationalId },
      });

    if (existingDriverByNationalId) {
      if (
        existingDriverByNationalId.userId !== null &&
        existingDriverByNationalId.userId !== userId
      ) {
        throw new BadRequestException(
          'Este número de documento ya está vinculado a otro usuario.',
        );
      }
    }

    // 4. Procesar nombres para conductor nuevo/existente
    let fName = firstName;
    let lName = lastName;
    if (!fName || !lName) {
      const nameParts = (targetUser.name || '').trim().split(/\s+/);
      if (!fName) fName = nameParts[0] || '';
      if (!lName) lName = nameParts.slice(1).join(' ') || '';
    }

    // 5. Vincular
    if (
      existingDriverByNationalId &&
      existingDriverByNationalId.userId === null
    ) {
      // Perfil existente sin reclamar, se actualiza
      return this.prismaService.driver.update({
        where: { nationalId },
        data: {
          userId,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
        },
      });
    } else {
      // Crear nuevo conductor
      return this.prismaService.driver.create({
        data: {
          userId,
          nationalId,
          firstName: fName,
          lastName: lName,
          phone,
          status: 'ACTIVE',
        },
      });
    }
  }

  async unclaim(actor: AccessTokenPayload, targetUserId: string) {
    // 1. Obtener el usuario objetivo
    const targetUser = await this.usersService.findOneById(targetUserId);
    if (!targetUser) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // 2. Validaciones jerárquicas (FR-1)
    if (actor.sub === targetUserId) {
      throw new ForbiddenException(
        'No tienes permisos de flota para esta acción.',
      );
    }

    if (targetUser.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No tienes permisos de flota para esta acción.',
      );
    }

    if (targetUser.role === ROLES.OWNER) {
      if (actor.role !== ROLES.SUPER_ADMIN) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }

    if (targetUser.role === ROLES.ADMIN) {
      if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.OWNER) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }

    // Validación de límites de organización
    if (actor.role !== ROLES.SUPER_ADMIN) {
      if (targetUser.orgId && targetUser.orgId !== actor.orgId) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }

    // 3. Buscar el perfil de conductor vinculado al usuario
    const driver = await this.prismaService.driver.findUnique({
      where: { userId: targetUserId },
    });

    if (!driver) {
      throw new BadRequestException(
        'El usuario no está vinculado a un perfil de conductor.',
      );
    }

    // 4. Desvincular: poner userId a null
    return this.prismaService.driver.update({
      where: { id: driver.id },
      data: { userId: null },
    });
  }

  // --- REPORTES Y DESGLOSE DE PUNTAJES ---

  private getISOWeekRange(year: number, week: number) {
    // January 4th is always in ISO week 1.
    const simple = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = simple.getUTCDay();
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

    // Get the Monday of week 1
    const mondayOfWeek1 = new Date(simple);
    mondayOfWeek1.setUTCDate(simple.getUTCDate() - isoDay + 1);

    // Add (week - 1) weeks
    const start = new Date(mondayOfWeek1);
    start.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);

    return { start, end };
  }

  private async checkDriverAccess(driverId: string, user: AccessTokenPayload) {
    if (user.role === ROLES.SUPER_ADMIN) return;

    const driver = await this.prismaService.driver.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });

    if (!driver) {
      throw new NotFoundException('Conductor no encontrado.');
    }

    if (user.role === ROLES.DRIVER) {
      if (driver.userId !== user.sub) {
        throw new ForbiddenException(
          'No tienes permisos para ver esta información.',
        );
      }
      return;
    }

    // Para OWNER/ADMIN, verificar que el conductor tiene/tuvo asignaciones en su organización
    const assignment = await this.prismaService.assignment.findFirst({
      where: {
        driverId,
        vehicle: { orgId: user.orgId },
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'El conductor no pertenece a tu organización o no está registrado en tu flota.',
      );
    }
  }

  private async resolveDriverId(
    id: string,
    user: AccessTokenPayload,
  ): Promise<string> {
    if (id === 'me') {
      const driver = await this.prismaService.driver.findUnique({
        where: { userId: user.sub },
        select: { id: true },
      });
      if (!driver) {
        throw new NotFoundException(
          'No se encontró perfil de conductor asociado a este usuario.',
        );
      }
      return driver.id;
    }
    return id;
  }

  async findDailyReports(
    driverIdOrMe: string,
    limit: number,
    queryingUser: AccessTokenPayload,
  ) {
    const driverId = await this.resolveDriverId(driverIdOrMe, queryingUser);
    await this.checkDriverAccess(driverId, queryingUser);

    return this.prismaService.dailyTelemetryRollup.findMany({
      where: { driverId },
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        vehicle: {
          select: {
            alias: true,
            plateNumber: true,
          },
        },
      },
    });
  }

  private mapTripScores(trip: any) {
    const rollups = trip.dailyTelemetryRollups || [];
    if (rollups.length === 0) {
      return {
        overallScore: null,
        safetyScore: null,
        ecoScore: null,
        assetScore: null,
      };
    }

    const sum = {
      totalKm: 0,
      totalEngineHours: 0,
      idlingHours: 0,
      overspeedCount: 0,
      overspeedSeverity: 0,
      brakingCount: 0,
      brakingSeverity: 0,
      corneringCount: 0,
      corneringSeverity: 0,
      accelerationCount: 0,
      accelerationSeverity: 0,
      highRpmCount: 0,
      highRpmSeverity: 0,
      coldEngineStrainCount: 0,
      coastingInNeutralCount: 0,
      engineLuggingCount: 0,
      highLoadStrainCount: 0,
      criticalOverheatingCount: 0,
      activeFaultCodesCount: 0,
      deviceUnpluggedCount: 0,
    };

    for (const r of rollups) {
      sum.totalKm += r.totalKm || 0;
      sum.totalEngineHours += r.totalEngineHours || 0;
      sum.idlingHours += r.idlingHours || 0;
      sum.overspeedCount += r.overspeedCount || 0;
      sum.overspeedSeverity += r.overspeedSeverity || 0;
      sum.brakingCount += r.brakingCount || 0;
      sum.brakingSeverity += r.brakingSeverity || 0;
      sum.corneringCount += r.corneringCount || 0;
      sum.corneringSeverity += r.corneringSeverity || 0;
      sum.accelerationCount += r.accelerationCount || 0;
      sum.accelerationSeverity += r.accelerationSeverity || 0;
      sum.highRpmCount += r.highRpmCount || 0;
      sum.highRpmSeverity += r.highRpmSeverity || 0;
      sum.coldEngineStrainCount += r.coldEngineStrainCount || 0;
      sum.coastingInNeutralCount += r.coastingInNeutralCount || 0;
      sum.engineLuggingCount += r.engineLuggingCount || 0;
      sum.highLoadStrainCount += r.highLoadStrainCount || 0;
      sum.criticalOverheatingCount += r.criticalOverheatingCount || 0;
      sum.activeFaultCodesCount += r.activeFaultCodesCount || 0;
      sum.deviceUnpluggedCount += r.deviceUnpluggedCount || 0;
    }

    const config =
      (trip.vehicle?.scoringProfile
        ?.rulesEngine as unknown as RuleEngineConfig) || this.DEFAULT_CONFIG;

    const summary = {
      _sum: sum,
    };

    const details = this.rulesEngineService.evaluateAggregatedRollupWithDetails(
      summary,
      config,
    );

    return {
      overallScore: details.scores.overallScore,
      safetyScore: details.scores.safetyScore,
      ecoScore: details.scores.ecoScore,
      assetScore: details.scores.assetScore,
    };
  }

  async findTripsForDriver(
    driverIdOrMe: string,
    queryingUser: AccessTokenPayload,
  ) {
    const driverId = await this.resolveDriverId(driverIdOrMe, queryingUser);
    await this.checkDriverAccess(driverId, queryingUser);

    // 1. Obtener todas las asignaciones del conductor
    const assignments = await this.prismaService.assignment.findMany({
      where: { driverId },
      orderBy: { from: 'asc' },
    });

    if (assignments.length === 0) {
      return [];
    }

    // 2. Buscar viajes para los vehículos en los períodos de asignación
    const OR = assignments.map((a) => {
      const condition: any = {
        vehicleId: a.vehicleId,
        startTime: {
          gte: a.from,
        },
      };
      if (a.to) {
        condition.startTime.lte = a.to;
      }
      return condition;
    });

    const trips = await this.prismaService.trip.findMany({
      where: {
        OR,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            alias: true,
            plateNumber: true,
            make: true,
            model: true,
            year: true,
            vin: true,
            scoringProfile: {
              select: {
                rulesEngine: true,
              },
            },
          },
        },
        dailyTelemetryRollups: true,
      },
      orderBy: { startTime: 'desc' },
    });

    // 3. Estandarizar la salida con los metadatos del conductor
    const driver = await this.prismaService.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nationalId: true,
      },
    });

    return trips.map((trip) => {
      const scores = this.mapTripScores(trip);
      const { vehicle, ...tripWithoutVehicle } = trip;
      return {
        ...tripWithoutVehicle,
        ...scores,
        driver,
        vehicle: vehicle
          ? {
              id: vehicle.id,
              alias: vehicle.alias,
              plateNumber: vehicle.plateNumber,
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              vin: vehicle.vin,
            }
          : null,
      };
    });
  }

  async findScoreBreakdown(
    driverIdOrMe: string,
    year: number,
    week: number,
    queryingUser: AccessTokenPayload,
  ) {
    const driverId = await this.resolveDriverId(driverIdOrMe, queryingUser);
    await this.checkDriverAccess(driverId, queryingUser);

    const { start, end } = this.getISOWeekRange(year, week);

    // 1. Fetch rollups with vehicle and trip details
    const rollups = this.prismaService.dailyTelemetryRollup
      ? await this.prismaService.dailyTelemetryRollup.findMany({
          where: {
            driverId,
            date: { gte: start, lte: end },
          },
          include: {
            vehicle: {
              select: {
                id: true,
                alias: true,
                plateNumber: true,
                scoringProfile: {
                  select: {
                    rulesEngine: true,
                  },
                },
              },
            },
            trip: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
              },
            },
          },
        })
      : [];

    // 2. Intentar recuperar breakdown precalculado/congelado del snapshot
    const snapshot = await this.prismaService.driverScoreSnapshot.findUnique({
      where: {
        driverId_weekNumber_year: {
          driverId,
          weekNumber: week,
          year,
        },
      },
    });

    let breakdown: any;
    if (snapshot && snapshot.breakdown) {
      breakdown = JSON.parse(JSON.stringify(snapshot.breakdown));
    }

    if (!breakdown) {
      if (rollups.length === 0) {
        return {
          overallScore: 100,
          safetyScore: 100,
          ecoScore: 100,
          assetScore: 100,
          totalKm: 0,
          totalHours: 0,
          idlingHours: 0,
          vehicles: [],
        };
      }

      // Agrupar por vehículo
      const groupedByVehicle: Record<string, typeof rollups> = {};
      for (const r of rollups) {
        const vId = r.vehicleId;
        if (!groupedByVehicle[vId]) {
          groupedByVehicle[vId] = [];
        }
        groupedByVehicle[vId].push(r);
      }

      let totalDriverKm = 0;
      let totalDriverHours = 0;
      let totalIdlingHours = 0;
      let weightedSafety = 0;
      let weightedEco = 0;
      let weightedAsset = 0;
      let weightedOverall = 0;

      const vehiclesBreakdown: any[] = [];

      for (const [vehicleId, vehicleRollups] of Object.entries(
        groupedByVehicle,
      )) {
        const firstRollup = vehicleRollups[0];
        const vehicle = firstRollup.vehicle;

        // Sumar métricas
        const summary = {
          driverId,
          vehicleId,
          _sum: {
            totalKm: 0,
            totalEngineHours: 0,
            idlingHours: 0,
            overspeedCount: 0,
            overspeedSeverity: 0,
            brakingCount: 0,
            brakingSeverity: 0,
            corneringCount: 0,
            corneringSeverity: 0,
            accelerationCount: 0,
            accelerationSeverity: 0,
            highRpmCount: 0,
            highRpmSeverity: 0,
            coldEngineStrainCount: 0,
            coastingInNeutralCount: 0,
            engineLuggingCount: 0,
            highLoadStrainCount: 0,
            criticalOverheatingCount: 0,
            activeFaultCodesCount: 0,
            deviceUnpluggedCount: 0,
          },
        };

        for (const r of vehicleRollups) {
          summary._sum.totalKm += r.totalKm;
          summary._sum.totalEngineHours += r.totalEngineHours;
          summary._sum.idlingHours += r.idlingHours;
          summary._sum.overspeedCount += r.overspeedCount;
          summary._sum.overspeedSeverity += r.overspeedSeverity;
          summary._sum.brakingCount += r.brakingCount;
          summary._sum.brakingSeverity += r.brakingSeverity;
          summary._sum.corneringCount += r.corneringCount;
          summary._sum.corneringSeverity += r.corneringSeverity;
          summary._sum.accelerationCount += r.accelerationCount;
          summary._sum.accelerationSeverity += r.accelerationSeverity;
          summary._sum.highRpmCount += r.highRpmCount;
          summary._sum.highRpmSeverity += r.highRpmSeverity;
          summary._sum.coldEngineStrainCount += r.coldEngineStrainCount;
          summary._sum.coastingInNeutralCount += r.coastingInNeutralCount;
          summary._sum.engineLuggingCount += r.engineLuggingCount;
          summary._sum.highLoadStrainCount += r.highLoadStrainCount;
          summary._sum.criticalOverheatingCount += r.criticalOverheatingCount;
          summary._sum.activeFaultCodesCount += r.activeFaultCodesCount;
          summary._sum.deviceUnpluggedCount += r.deviceUnpluggedCount || 0;
        }

        const config =
          (vehicle.scoringProfile
            ?.rulesEngine as unknown as RuleEngineConfig) ||
          this.DEFAULT_CONFIG;

        const details =
          this.rulesEngineService.evaluateAggregatedRollupWithDetails(
            summary,
            config,
          );

        totalDriverKm += details.scores.totalKm;
        totalDriverHours += details.scores.totalHours;
        totalIdlingHours += details.scores.idlingHours;

        weightedSafety += details.scores.safetyScore * details.scores.totalKm;
        weightedEco += details.scores.ecoScore * details.scores.totalKm;
        weightedAsset += details.scores.assetScore * details.scores.totalKm;
        weightedOverall += details.scores.overallScore * details.scores.totalKm;

        vehiclesBreakdown.push({
          vehicleId,
          vehicleAlias: vehicle.alias,
          vehiclePlate: vehicle.plateNumber,
          totalKm: parseFloat(details.scores.totalKm.toFixed(2)),
          totalHours: parseFloat(details.scores.totalHours.toFixed(2)),
          idlingHours: parseFloat(details.scores.idlingHours.toFixed(2)),
          scores: details.scores,
          ruleDeductions: details.ruleDeductions,
          pillarDeductions: details.pillarDeductions,
        });
      }

      if (totalDriverKm < 1.0) {
        breakdown = {
          overallScore: 100,
          safetyScore: 100,
          ecoScore: 100,
          assetScore: 100,
          totalKm: parseFloat(totalDriverKm.toFixed(2)),
          totalHours: parseFloat(totalDriverHours.toFixed(2)),
          idlingHours: parseFloat(totalIdlingHours.toFixed(2)),
          vehicles: vehiclesBreakdown,
        };
      } else {
        const finalSafety = parseFloat(
          (weightedSafety / totalDriverKm).toFixed(2),
        );
        const finalEco = parseFloat((weightedEco / totalDriverKm).toFixed(2));
        const finalAsset = parseFloat(
          (weightedAsset / totalDriverKm).toFixed(2),
        );
        const finalOverall = parseFloat(
          (weightedOverall / totalDriverKm).toFixed(2),
        );

        breakdown = {
          overallScore: finalOverall,
          safetyScore: finalSafety,
          ecoScore: finalEco,
          assetScore: finalAsset,
          totalKm: parseFloat(totalDriverKm.toFixed(2)),
          totalHours: parseFloat(totalDriverHours.toFixed(2)),
          idlingHours: parseFloat(totalIdlingHours.toFixed(2)),
          vehicles: vehiclesBreakdown,
        };
      }
    }

    // Attach trip associations
    if (breakdown && breakdown.vehicles) {
      const tripAssociations: Record<
        string,
        Record<
          string,
          Array<{
            tripId: string;
            startTime: Date;
            endTime: Date | null;
            occurrences: number;
            severity: number;
          }>
        >
      > = {};

      const ruleCodeToField: Record<string, string> = {
        OVERSPEEDING: 'overspeed',
        HARSH_BRAKING: 'braking',
        HARSH_CORNERING: 'cornering',
        HARSH_ACCELERATION: 'acceleration',
        HIGH_RPM: 'highRpm',
        COLD_ENGINE_STRAIN: 'coldEngineStrain',
        COASTING_IN_NEUTRAL: 'coastingInNeutral',
        ENGINE_LUGGING: 'engineLugging',
        HIGH_LOAD_STRAIN: 'highLoadStrain',
        CRITICAL_OVERHEATING: 'criticalOverheating',
        ACTIVE_FAULT_CODES: 'activeFaultCodes',
        DEVICE_UNPLUGGED: 'deviceUnplugged',
      };

      const fieldsWithSeverity = [
        'OVERSPEEDING',
        'HARSH_BRAKING',
        'HARSH_CORNERING',
        'HARSH_ACCELERATION',
        'HIGH_RPM',
      ];

      for (const r of rollups) {
        if (!r.tripId || !r.trip) continue;
        const vId = r.vehicleId;
        if (!tripAssociations[vId]) {
          tripAssociations[vId] = {};
        }

        // Check idling
        if (r.idlingHours > 0) {
          if (!tripAssociations[vId]['EXCESSIVE_IDLING']) {
            tripAssociations[vId]['EXCESSIVE_IDLING'] = [];
          }
          tripAssociations[vId]['EXCESSIVE_IDLING'].push({
            tripId: r.tripId,
            startTime: r.trip.startTime,
            endTime: r.trip.endTime,
            occurrences: Math.floor(r.idlingHours * 4),
            severity: 0,
          });
        }

        // Check other rules
        for (const [code, fieldPrefix] of Object.entries(ruleCodeToField)) {
          const count = Number(r[`${fieldPrefix}Count`] || 0);
          const severity = fieldsWithSeverity.includes(code)
            ? Number((r as any)[`${fieldPrefix}Severity`] || 0)
            : 0;
          if (count > 0) {
            if (!tripAssociations[vId][code]) {
              tripAssociations[vId][code] = [];
            }
            tripAssociations[vId][code].push({
              tripId: r.tripId,
              startTime: r.trip.startTime,
              endTime: r.trip.endTime,
              occurrences: count,
              severity,
            });
          }
        }
      }

      // Attach to ruleDeductions
      for (const vBreak of breakdown.vehicles) {
        const vId = vBreak.vehicleId;
        const vehicleTrips = tripAssociations[vId] || {};
        if (vBreak.ruleDeductions) {
          for (const rule of vBreak.ruleDeductions) {
            rule.trips = vehicleTrips[rule.code] || [];
          }
        }
      }
    }

    return breakdown;
  }
}
