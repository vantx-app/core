import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AccessTokenPayload } from 'src/auth/types';
import { CacheService } from 'src/common/cache.service';
import {
  Vehicle,
  VehicleLiveState,
  VehicleCategory,
  FuelEventType,
} from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CalibrateTankDto } from './dto/calibrate-tank.dto';
import PDFDocument from 'pdfkit';
import AdmZip from 'adm-zip';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import {
  RuleEngineConfig,
  DEFAULT_RULE_ENGINE_CONFIG,
} from 'src/scoring-cron/scoring.interfaces';
import {
  decodePolyline6,
  decodeFlexiblePolyline,
  haversineDistance,
} from 'src/scoring-cron/route-utils';

import { ValhallaRoutesClientService } from 'src/scoring-cron/valhalla-routes-client.service';

@Injectable()
export class VehiclesService {
  private readonly DEFAULT_CONFIG: RuleEngineConfig =
    DEFAULT_RULE_ENGINE_CONFIG;

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private rulesEngineService: RulesEngineService,
    private valhallaRoutesClient: ValhallaRoutesClientService,
  ) {}

  private getFrontendBaseUrl(): string {
    let baseUrl =
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3001';
    if (baseUrl === '*') {
      baseUrl = 'http://localhost:3001';
    } else if (baseUrl.includes(',')) {
      baseUrl = baseUrl.split(',')[0].trim();
    }
    return baseUrl.replace(/\/dashboard\/?$/, '').replace(/\/$/, '');
  }

  async create(createVehicleDto: CreateVehicleDto) {
    if (
      createVehicleDto.category &&
      !Object.values(VehicleCategory).includes(createVehicleDto.category)
    ) {
      throw new BadRequestException('Categoría de vehículo no válida.');
    }

    if (
      createVehicleDto.subscriptionTier === 'ACTIVE' &&
      !createVehicleDto.deviceId
    ) {
      throw new BadRequestException(
        'Se requiere un dispositivo para activar la suscripción del vehículo.',
      );
    }

    let scoringProfileId = createVehicleDto.scoringProfileId;
    if (!scoringProfileId && createVehicleDto.category) {
      let defaultProfile: any = null;
      if (createVehicleDto.fuelType) {
        const defaultProfileNameWithFuel = `DEFAULT_${createVehicleDto.category}_${createVehicleDto.fuelType}`;
        defaultProfile = await this.prisma.scoringProfile.findFirst({
          where: { name: defaultProfileNameWithFuel },
        });
      }
      if (!defaultProfile) {
        const defaultProfileName = `DEFAULT_${createVehicleDto.category}`;
        defaultProfile = await this.prisma.scoringProfile.findFirst({
          where: { name: defaultProfileName },
        });
      }
      if (defaultProfile) {
        scoringProfileId = defaultProfile.id;
      }
    }
    if (!scoringProfileId) {
      const defaultProfile = await this.prisma.scoringProfile.findFirst({
        where: { name: 'DEFAULT' },
      });
      if (defaultProfile) {
        scoringProfileId = defaultProfile.id;
      }
    }

    const { deviceId, ...restDto } = createVehicleDto;

    const vehicle = await this.prisma.vehicle.create({
      data: {
        ...restDto,
        scoringProfileId,
      },
    });

    if (deviceId) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          vehicleId: vehicle.id,
          status: 'ACTIVE',
        },
      });
    }

    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto) {
    if (
      updateVehicleDto.category &&
      !Object.values(VehicleCategory).includes(updateVehicleDto.category)
    ) {
      throw new BadRequestException('Categoría de vehículo no válida.');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { scoringProfile: true, device: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado.');
    }

    const targetTier =
      updateVehicleDto.subscriptionTier !== undefined
        ? updateVehicleDto.subscriptionTier
        : vehicle.subscriptionTier;
    const hasDevice =
      updateVehicleDto.deviceId !== undefined
        ? !!updateVehicleDto.deviceId
        : !!vehicle.device;

    if (targetTier === 'ACTIVE' && !hasDevice) {
      throw new BadRequestException(
        'Se requiere un dispositivo para activar la suscripción del vehículo.',
      );
    }

    const { deviceId, vin, ...rest } = updateVehicleDto;
    const dataToUpdate: any = { ...rest };
    if (updateVehicleDto.vin !== undefined)
      dataToUpdate.vin = updateVehicleDto.vin;

    if (
      dataToUpdate.category !== undefined ||
      dataToUpdate.fuelType !== undefined
    ) {
      const currentProfileName = vehicle.scoringProfile?.name;
      const isDefaultProfile =
        !currentProfileName ||
        [
          'DEFAULT',
          'DEFAULT_HDV',
          'DEFAULT_LCV',
          'DEFAULT_PASSENGER',
          'DEFAULT_MACHINERY',
          'DEFAULT_HDV_DIESEL',
          'DEFAULT_LCV_DIESEL',
          'DEFAULT_PASSENGER_DIESEL',
        ].includes(currentProfileName);

      if (isDefaultProfile && !dataToUpdate.scoringProfileId) {
        const categoryToUse =
          dataToUpdate.category !== undefined
            ? dataToUpdate.category
            : vehicle.category;
        const fuelTypeToUse =
          dataToUpdate.fuelType !== undefined
            ? dataToUpdate.fuelType
            : vehicle.fuelType;

        let defaultProfile: any = null;
        if (fuelTypeToUse) {
          const defaultProfileNameWithFuel = `DEFAULT_${categoryToUse}_${fuelTypeToUse}`;
          defaultProfile = await this.prisma.scoringProfile.findFirst({
            where: { name: defaultProfileNameWithFuel },
          });
        }
        if (!defaultProfile) {
          const defaultProfileName = `DEFAULT_${categoryToUse}`;
          defaultProfile = await this.prisma.scoringProfile.findFirst({
            where: { name: defaultProfileName },
          });
        }
        if (defaultProfile) {
          dataToUpdate.scoringProfileId = defaultProfile.id;
        }
      }
    }

    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id },
      data: dataToUpdate,
    });

    if (deviceId !== undefined) {
      // 1. Desvincular el dispositivo anterior
      if (vehicle.device && vehicle.device.id !== deviceId) {
        await this.prisma.device.update({
          where: { id: vehicle.device.id },
          data: { vehicleId: null, status: 'UNASSIGNED' },
        });
      }
      // 2. Vincular el nuevo dispositivo
      if (deviceId) {
        await this.prisma.device.update({
          where: { id: deviceId },
          data: { vehicleId: id, status: 'ACTIVE' },
        });
      }
    }

    return updatedVehicle;
  }

  async findAllByOrgId(orgId?: string, liveState?: boolean) {
    const cacheKey = `vehicles:org:${orgId || 'all'}`;
    let vehicles =
      this.cacheService.get<
        (Vehicle & { liveState?: VehicleLiveState | null })[]
      >(cacheKey);

    if (!vehicles) {
      // Consultar la base de datos con liveState incluido para guardarlo en caché
      vehicles = (await this.prisma.vehicle.findMany({
        where: orgId ? { orgId } : {},
        include: {
          liveState: true,
          device: true,
          assignments: {
            where: { to: null },
            include: {
              driver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  nationalId: true,
                },
              },
            },
          },
        },
      })) as unknown as (Vehicle & { liveState?: VehicleLiveState | null })[];
      // Guardar en caché por 15 minutos (900000 ms)
      this.cacheService.set(cacheKey, vehicles, 15 * 60 * 1000);
    }

    if (liveState) {
      // Obtener liveStates actualizados en tiempo real
      const vehicleIds = vehicles.map((v) => v.id);
      const liveStates = await this.prisma.vehicleLiveState.findMany({
        where: {
          vehicleId: { in: vehicleIds },
        },
      });
      const liveStateMap = new Map(liveStates.map((s) => [s.vehicleId, s]));
      return vehicles.map((v) => ({
        ...v,
        liveState: liveStateMap.get(v.id) || null,
      }));
    } else {
      return vehicles.map((v) => {
        const { liveState: _liveState, ...rest } = v;
        return rest;
      });
    }
  }

  async findByUserId(userId: string, liveState?: boolean) {
    const cacheKey = `vehicles:user:${userId}`;
    let vehicles =
      this.cacheService.get<
        (Vehicle & { liveState?: VehicleLiveState | null })[]
      >(cacheKey);

    if (!vehicles) {
      vehicles = (await this.prisma.vehicle.findMany({
        where: {
          assignments: {
            some: {
              driver: {
                userId,
              },
              to: null,
            },
          },
        },
        include: {
          liveState: true,
          device: true,
          assignments: {
            where: { to: null },
            include: {
              driver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  nationalId: true,
                },
              },
            },
          },
        },
      })) as unknown as (Vehicle & { liveState?: VehicleLiveState | null })[];
      this.cacheService.set(cacheKey, vehicles, 15 * 60 * 1000);
    }

    if (liveState) {
      const vehicleIds = vehicles.map((v) => v.id);
      const liveStates = await this.prisma.vehicleLiveState.findMany({
        where: {
          vehicleId: { in: vehicleIds },
        },
      });
      const liveStateMap = new Map(liveStates.map((s) => [s.vehicleId, s]));
      return vehicles.map((v) => ({
        ...v,
        liveState: liveStateMap.get(v.id) || null,
      }));
    } else {
      return vehicles.map((v) => {
        const { liveState: _liveState, ...rest } = v;
        return rest;
      });
    }
  }

  async findOne(id: string) {
    return this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        liveState: true,
        VehicleGlobalStats: true,
        device: true,
        vehicleScoreSnapshots: {
          orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
          take: 10,
        },
        DailyTelemetryRollup: {
          orderBy: { date: 'desc' },
          include: {
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nationalId: true,
              },
            },
          },
        },
        assignments: {
          where: { to: null },
          include: {
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nationalId: true,
              },
            },
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

  async findTripsForVehicle(vehicleId: string) {
    const trips = await this.prisma.trip.findMany({
      where: { vehicleId },
      include: {
        dailyTelemetryRollups: true,
        vehicle: {
          select: {
            scoringProfile: {
              select: {
                rulesEngine: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    const assignments = await this.prisma.assignment.findMany({
      where: { vehicleId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nationalId: true,
          },
        },
      },
      orderBy: { from: 'asc' },
    });

    return trips.map((trip) => {
      const tripStart = new Date(trip.startTime).getTime();
      const matchedAssignment = assignments.find((a) => {
        const fromTime = new Date(a.from).getTime();
        const toTime = a.to ? new Date(a.to).getTime() : Infinity;
        return fromTime <= tripStart && toTime >= tripStart;
      });

      const scores = this.mapTripScores(trip);

      // Eliminar el include auxiliar vehicle de la respuesta final
      const { vehicle, ...tripWithoutVehicle } = trip;

      return {
        ...tripWithoutVehicle,
        ...scores,
        driver: matchedAssignment?.driver || null,
      };
    });
  }

  async findRouteForTrip(vehicleId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, vehicleId },
    });

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado para este vehículo');
    }

    if (trip.polyline) {
      let decodedPts: [number, number][] = [];
      try {
        decodedPts = decodePolyline6(trip.polyline);
      } catch {
        try {
          const flex = decodeFlexiblePolyline(trip.polyline);
          decodedPts = flex.polyline;
        } catch {
          decodedPts = [];
        }
      }

      if (decodedPts.length > 0) {
        const rawLogs = await this.prisma.telemetryLog.findMany({
          where: { tripId },
          orderBy: { timestamp: 'asc' },
          select: {
            latitude: true,
            longitude: true,
            speed: true,
          },
        });

        if (rawLogs.length > 0) {
          return decodedPts.map((p) => {
            const lat = p[0];
            const lng = p[1];

            let closestLog = rawLogs[0];
            let minDist = Infinity;

            for (const log of rawLogs) {
              const dist = haversineDistance(
                lat,
                lng,
                log.latitude,
                log.longitude,
              );
              if (dist < minDist) {
                minDist = dist;
                closestLog = log;
              }
            }

            return {
              latitude: lat,
              longitude: lng,
              speed: closestLog.speed,
            };
          });
        }
      }
    }

    const route = await this.prisma.telemetryLog.findMany({
      where: { tripId },
      orderBy: { timestamp: 'asc' },
      select: {
        latitude: true,
        longitude: true,
        speed: true,
      },
    });

    return route;
  }

  async verifyVehicleAccess(
    vehicleId: string,
    user: AccessTokenPayload,
  ): Promise<void> {
    if (user.role === 'SUPER_ADMIN') {
      return;
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    if (user.role === 'DRIVER') {
      const assignment = await this.prisma.assignment.findFirst({
        where: {
          vehicleId,
          driver: {
            userId: user.sub,
          },
          to: null,
        },
      });
      if (!assignment) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    } else {
      // OWNER or ADMIN
      if (vehicle.orgId !== user.orgId) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }
  }

  async verifyTripAccess(
    vehicleId: string,
    tripId: string,
    user: AccessTokenPayload,
  ): Promise<void> {
    if (user.role === 'SUPER_ADMIN') {
      return;
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    if (user.role === 'DRIVER') {
      const trip = await this.prisma.trip.findFirst({
        where: { id: tripId, vehicleId },
      });
      if (!trip) {
        throw new NotFoundException('Viaje no encontrado');
      }

      const driver = await this.prisma.driver.findUnique({
        where: { userId: user.sub },
        select: { id: true },
      });

      if (!driver) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }

      const assignment = await this.prisma.assignment.findFirst({
        where: {
          driverId: driver.id,
          vehicleId,
          from: { lte: trip.startTime },
          OR: [{ to: null }, { to: { gte: trip.startTime } }],
        },
      });

      if (!assignment) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    } else {
      // OWNER or ADMIN
      if (vehicle.orgId !== user.orgId) {
        throw new ForbiddenException(
          'No tienes permisos de flota para esta acción.',
        );
      }
    }
  }

  async createTrackingLink(vehicleId: string, clientName?: string) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const link = await this.prisma.trackingLink.create({
      data: {
        vehicleId,
        clientName,
        isActive: true,
        expiresAt,
      },
    });

    const baseUrl = this.getFrontendBaseUrl();
    return {
      ...link,
      trackingUrl: `${baseUrl}/dashboard/track/${link.id}`,
    };
  }

  async getActiveTrackingLinks(vehicleId: string) {
    const links = await this.prisma.trackingLink.findMany({
      where: {
        vehicleId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const baseUrl = this.getFrontendBaseUrl();
    return links.map((link) => ({
      ...link,
      trackingUrl: `${baseUrl}/dashboard/track/${link.id}`,
    }));
  }

  async revokeTrackingLink(vehicleId: string, linkId: string) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { id: linkId },
    });

    if (!link || link.vehicleId !== vehicleId) {
      throw new NotFoundException('Enlace de rastreo no encontrado');
    }

    const updatedLink = await this.prisma.trackingLink.update({
      where: { id: linkId },
      data: {
        isActive: false,
      },
    });

    const baseUrl = this.getFrontendBaseUrl();
    return {
      ...updatedLink,
      trackingUrl: `${baseUrl}/dashboard/track/${updatedLink.id}`,
    };
  }

  async getPublicTrackingDetails(linkId: string) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { id: linkId },
      include: {
        vehicle: {
          include: {
            liveState: true,
            VehicleGlobalStats: true,
          },
        },
      },
    });

    if (!link || !link.isActive || new Date() > link.expiresAt) {
      throw new NotFoundException(
        'El enlace de rastreo ha expirado o no es válido',
      );
    }

    return {
      clientName: link.clientName,
      alias: link.vehicle.alias,
      plateNumber: link.vehicle.plateNumber,
      lastLat: link.vehicle.liveState?.lastLat ?? null,
      lastLng: link.vehicle.liveState?.lastLng ?? null,
      lastAngle: link.vehicle.liveState?.lastAngle ?? 0,
      currentStatus: link.vehicle.liveState?.currentStatus ?? 'STOPPED',
      globalOverallScore:
        link.vehicle.VehicleGlobalStats?.globalOverallScore ?? null,
    };
  }

  async generateCrashReconstructionZip(
    vehicleId: string,
    timestampStr: string,
  ): Promise<Buffer> {
    const timestamp = new Date(timestampStr);
    if (isNaN(timestamp.getTime())) {
      throw new BadRequestException('El timestamp del evento no es válido.');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        organization: true,
        assignments: {
          where: { to: null },
          include: { driver: true },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado.');
    }

    // Intervalo de +/- 30 segundos
    const fromTime = new Date(timestamp.getTime() - 30 * 1000);
    const toTime = new Date(timestamp.getTime() + 30 * 1000);

    const logs = await this.prisma.telemetryLog.findMany({
      where: {
        vehicleId,
        timestamp: {
          gte: fromTime,
          lte: toTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (logs.length === 0) {
      throw new NotFoundException(
        'No se encontraron registros de telemetría en el rango seleccionado.',
      );
    }

    // 1. Crear el CSV
    let csvContent =
      'Timestamp,Latitude,Longitude,Speed(km/h),RPM,Ignition,HarshAcceleration,HarshBraking,HarshCornering\n';
    logs.forEach((log) => {
      csvContent += `${log.timestamp.toISOString()},${log.latitude},${log.longitude},${log.speed},${log.rpm ?? 0},${log.ignition},${log.harshAcceleration},${log.harshBraking},${log.harshCornering}\n`;
    });

    // 2. Crear el PDF Resumen
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Dibujar borde decorativo
      doc.rect(20, 20, 572, 752).strokeColor('#ef4444').lineWidth(2).stroke();

      doc
        .fillColor('#ef4444')
        .fontSize(22)
        .text('RECONSTRUCCIÓN DE ACCIDENTE (CAJA NEGRA)', { align: 'center' });
      doc.moveDown();

      doc
        .fillColor('#4b5563')
        .fontSize(10)
        .text(`Fecha del Suceso: ${timestamp.toLocaleString('es-ES')}`, {
          align: 'center',
        });
      doc.text(
        `Vehículo: ${vehicle.alias || 'Sin Alias'} (${vehicle.plateNumber})`,
        { align: 'center' },
      );
      const driver = vehicle.assignments?.[0]?.driver;
      if (driver) {
        doc.text(
          `Conductor Asignado: ${driver.firstName} ${driver.lastName} (Cédula: ${driver.nationalId})`,
          { align: 'center' },
        );
      } else {
        doc.text('Conductor Asignado: No registrado en el momento', {
          align: 'center',
        });
      }
      doc.moveDown(2);

      // Tabla de Datos Clave
      doc
        .fillColor('#1f2937')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Resumen del Rango (+/- 30 Segundos)');
      doc.font('Helvetica').moveDown();

      const maxSpeed = Math.max(...logs.map((l) => l.speed));
      const hasHarshEvents = logs.some(
        (l) =>
          l.harshAcceleration > 0 || l.harshBraking > 0 || l.harshCornering > 0,
      );

      doc.fontSize(10);
      doc.text(`Cantidad de Registros Capturados: ${logs.length}`);
      doc.text(`Velocidad Máxima Registrada: ${maxSpeed} km/h`);
      doc.text(
        `¿Se detectaron eventos de desaceleración brusca/G-Sensor?: ${hasHarshEvents ? 'SÍ' : 'NO'}`,
      );
      doc.moveDown(2);

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Detalles Segundo a Segundo:');
      doc.font('Helvetica').moveDown();

      // Column Headers
      const currentY = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Hora', 50, currentY, { width: 100 });
      doc.text('Velocidad', 150, currentY, { width: 80 });
      doc.text('RPM', 230, currentY, { width: 60 });
      doc.text('Aceleración/Frenado', 300, currentY, { width: 120 });
      doc.text('Ubicación', 420, currentY, { width: 120 });
      doc.font('Helvetica');
      doc.moveDown(0.5);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(540, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // Imprimir registros clave
      logs.slice(-20).forEach((log) => {
        const timeStr = log.timestamp
          .toISOString()
          .split('T')[1]
          .replace('Z', '');
        const harshStr =
          log.harshBraking > 0
            ? 'Frenado Brusco'
            : log.harshAcceleration > 0
              ? 'Acel. Brusca'
              : '-';
        doc.text(timeStr, 50, doc.y, { width: 100 });
        doc.text(`${log.speed} km/h`, 150, doc.y, { width: 80 });
        doc.text(`${log.rpm ?? 0}`, 230, doc.y, { width: 60 });
        doc.text(harshStr, 300, doc.y, { width: 120 });
        doc.text(
          `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`,
          420,
          doc.y,
          { width: 120 },
        );
        doc.moveDown();
      });

      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          'Reporte de telemetría inalterable y de alta frecuencia de VantX.',
          { align: 'center' },
        );

      doc.end();
    });

    // 3. Crear el archivo ZIP usando adm-zip
    const zip = new AdmZip();
    zip.addFile('registro_telemetria.csv', Buffer.from(csvContent, 'utf-8'));
    zip.addFile('resumen_accidente.pdf', pdfBuffer);

    return zip.toBuffer();
  }

  /**
   * Genera un archivo de diagnóstico (CSV o JSON) con los registros de
   * telemetría crudos de un vehículo para un rango de fechas dado.
   * Máximo 7 días por descarga.
   */
  async generateDiagnosticsExport(
    vehicleId: string,
    fromStr?: string,
    toStr?: string,
    format: 'csv' | 'json' = 'csv',
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const toDate = toStr ? new Date(toStr) : new Date();
    const defaultFrom = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    const fromDate = fromStr ? new Date(fromStr) : defaultFrom;

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Las fechas proporcionadas no son válidas.');
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 7) {
      throw new BadRequestException(
        'El rango máximo permitido es de 7 días por descarga.',
      );
    }

    if (fromDate >= toDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin.',
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { alias: true, plateNumber: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado.');
    }

    const logs = await this.prisma.telemetryLog.findMany({
      where: {
        vehicleId,
        timestamp: { gte: fromDate, lte: toDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (logs.length === 0) {
      throw new NotFoundException(
        'No se encontraron registros de telemetría en el rango seleccionado.',
      );
    }

    const slug = (vehicle.alias || vehicle.plateNumber)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const dateTag = fromDate.toISOString().slice(0, 10);

    if (format === 'json') {
      const buffer = Buffer.from(JSON.stringify(logs, null, 2), 'utf-8');
      return {
        buffer,
        filename: `diagnostico_${slug}_${dateTag}.json`,
        contentType: 'application/json',
      };
    }

    // CSV
    const headers = [
      'timestamp',
      'latitude',
      'longitude',
      'speed',
      'gpsSpeed',
      'angle',
      'altitude',
      'satellites',
      'rpm',
      'engineLoad',
      'coolantTemp',
      'powerSupply',
      'ignition',
      'movement',
      'unplugged',
      'status',
      'odometer',
      'engineHours',
      'dtcCount',
      'faultCodes',
      'fuelLevel',
      'fuelConsumption',
      'fuelRate',
      'accelX',
      'accelY',
      'accelZ',
    ];

    const escape = (val: unknown): string => {
      if (val == null) return '';
      const str = String(val instanceof Date ? val.toISOString() : val);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv = headers.join(',') + '\n';
    for (const log of logs) {
      csv +=
        headers
          .map((h) => escape((log as Record<string, unknown>)[h]))
          .join(',') + '\n';
    }

    return {
      buffer: Buffer.from(csv, 'utf-8'),
      filename: `diagnostico_${slug}_${dateTag}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * Obtiene registros de telemetría de diagnóstico para visualización directa en el UI.
   */
  async getDiagnosticsLogs(
    vehicleId: string,
    fromStr?: string,
    toStr?: string,
    limit = 50,
  ) {
    const toDate = toStr ? new Date(toStr) : new Date();
    const defaultFrom = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    const fromDate = fromStr ? new Date(fromStr) : defaultFrom;

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Las fechas proporcionadas no son válidas.');
    }

    const [logs, total] = await Promise.all([
      this.prisma.telemetryLog.findMany({
        where: {
          vehicleId,
          timestamp: { gte: fromDate, lte: toDate },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          timestamp: true,
          latitude: true,
          longitude: true,
          speed: true,
          gpsSpeed: true,
          rpm: true,
          engineLoad: true,
          coolantTemp: true,
          powerSupply: true,
          ignition: true,
          movement: true,
          unplugged: true,
          status: true,
          dtcCount: true,
          faultCodes: true,
          fuelLevel: true,
        },
      }),
      this.prisma.telemetryLog.count({
        where: {
          vehicleId,
          timestamp: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    return { logs, total };
  }

  /**
   * Obtiene las estadísticas acumuladas de la flota para una organización
   * basadas en los rollups diarios de telemetría.
   */
  async getFleetStats(orgId: string) {
    const stats = await this.prisma.dailyTelemetryRollup.aggregate({
      where: {
        vehicle: {
          orgId,
        },
      },
      _sum: {
        totalKm: true,
        totalEngineHours: true,
        idlingHours: true,
      },
    });

    return {
      totalKm: stats._sum.totalKm ?? 0,
      totalEngineHours: stats._sum.totalEngineHours ?? 0,
      idlingHours: stats._sum.idlingHours ?? 0,
    };
  }

  /**
   * Analiza el historial de telemetría de un vehículo para determinar
   * cómo se consumió o drenó el combustible en un rango de días.
   */
  async getFuelAnalysis(vehicleId: string, days = 7) {
    // Limitar el análisis a un rango razonable para proteger la base de datos
    const safeDays = Math.min(30, Math.max(1, days));
    const cacheKey = `vehicles:fuel-analysis:${vehicleId}:${safeDays}`;
    const cached = this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - safeDays);

    // Tamaño de bucket para generar ~300 puntos óptimos en safeDays
    const bucketSeconds = Math.max(60, Math.floor((safeDays * 24 * 3600) / 300));

    // Ejecutar todas las consultas independientes en paralelo para minimizar la latencia de BD
    const [vehicle, bucketedRows, fuelEvents, tripStats] = await Promise.all([
      this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: {
          tankCapacity: true,
          isCapacityCalibrated: true,
          liveState: {
            select: { lastFuelLevel: true },
          },
        },
      }),
      this.prisma.$queryRaw<
        Array<{
          bucket: Date;
          fuelLevel: number | null;
          fuelConsumption: number | null;
          fuelRate: number | null;
          ignition: boolean | null;
        }>
      >`
        SELECT
          to_timestamp(floor(extract(epoch from "timestamp") / ${bucketSeconds}) * ${bucketSeconds}) AS "bucket",
          ROUND(AVG("fuelLevel")::numeric, 1) AS "fuelLevel",
          MAX("fuelConsumption") AS "fuelConsumption",
          ROUND(AVG("fuelRate")::numeric, 1) AS "fuelRate",
          BOOL_OR("ignition") AS "ignition"
        FROM "TelemetryLog"
        WHERE "vehicleId" = ${vehicleId}::uuid
          AND "timestamp" >= ${startDate}
          AND "fuelLevel" IS NOT NULL
          AND "fuelLevel" >= 0
          AND "fuelLevel" <= 100
        GROUP BY 1
        ORDER BY 1 ASC;
      `,
      this.prisma.fuelEvent.findMany({
        where: {
          vehicleId,
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          type: true,
          liters: true,
          percentageDelta: true,
          startLevel: true,
          endLevel: true,
          latitude: true,
          longitude: true,
          timestamp: true,
        },
      }),
      this.prisma.trip.aggregate({
        where: {
          vehicleId,
          startTime: { gte: startDate },
        },
        _sum: {
          fuelConsumedLiters: true,
        },
      }),
    ]);

    const tankCapacity = vehicle?.tankCapacity ?? 60;
    const isCapacityCalibrated = vehicle?.isCapacityCalibrated ?? false;
    // Calibración práctica interna: 5% reserva inferior y 5% cuello/sobrellenado (90% rango útil activo)
    const usableCapacity = tankCapacity * 0.9;
    const reserveLiters = tankCapacity * 0.05;

    if (!bucketedRows || bucketedRows.length === 0) {
      const emptyResult = {
        summary: {
          tankCapacity,
          isCapacityCalibrated,
          totalConsumed: 0,
          consumedLiters: 0,
          totalDrained: 0,
          totalRefueled: 0,
          currentLevel: null,
          currentLiters: null,
        },
        events: [],
        history: [],
      };
      this.cacheService.set(cacheKey, emptyResult, 60 * 1000);
      return emptyResult;
    }

    const firstBucket = bucketedRows[0];
    const lastBucket = bucketedRows[bucketedRows.length - 1];
    const startLevel = firstBucket.fuelLevel ?? 0;
    const endLevel = lastBucket.fuelLevel ?? 0;

    let totalRefueled = 0;
    let totalDrained = 0;
    for (const ev of fuelEvents) {
      if (ev.type === 'REFUEL') {
        totalRefueled += ev.liters;
      } else if (ev.type === 'DRAIN') {
        totalDrained += ev.liters;
      }
    }
    totalRefueled = Math.round(totalRefueled * 10) / 10;
    totalDrained = Math.round(totalDrained * 10) / 10;

    // Prioridad 1: Suma de combustible consumido en viajes cerrados del periodo
    let consumedLiters = tripStats._sum?.fuelConsumedLiters ?? 0;

    // Prioridad 2: Contador acumulado OBD/CAN directo en registros de telemetría
    if (consumedLiters === 0 && bucketedRows.length >= 2) {
      const rowsWithConsumption = bucketedRows.filter(
        (b) => b.fuelConsumption !== null && b.fuelConsumption > 0,
      );
      if (rowsWithConsumption.length >= 2) {
        const firstConsumption = rowsWithConsumption[0].fuelConsumption!;
        const lastConsumption =
          rowsWithConsumption[rowsWithConsumption.length - 1].fuelConsumption!;
        if (lastConsumption >= firstConsumption) {
          consumedLiters = lastConsumption - firstConsumption;
        }
      }
    }

    // Prioridad 3: Si no hay viajes ni contador OBD, usar balance de masa de tanque
    if (consumedLiters === 0 && bucketedRows.length > 0) {
      const startLiters = (startLevel / 100) * usableCapacity;
      const endLiters = (endLevel / 100) * usableCapacity;
      const net = startLiters - endLiters + totalRefueled - totalDrained;
      consumedLiters = Math.max(0, net);
    }

    consumedLiters = Math.round(consumedLiters * 10) / 10;
    const totalConsumed =
      Math.round(((consumedLiters / usableCapacity) * 100) * 10) / 10;
    const events = fuelEvents.map((ev) => ({
      ...ev,
      beforeLevel: ev.startLevel,
      afterLevel: ev.endLevel,
      delta: ev.percentageDelta,
    }));

    const currentLevel = vehicle?.liveState?.lastFuelLevel ?? lastBucket.fuelLevel;
    const currentLiters =
      currentLevel !== null
        ? Math.round((reserveLiters + (currentLevel / 100) * usableCapacity) * 10) /
          10
        : null;

    // Mapear los ~300 puntos pre-agrupados
    const history = bucketedRows.map((row) => {
      const smoothedPct = Math.round((row.fuelLevel ?? 0) * 10) / 10;
      const smoothedLiters =
        Math.round((reserveLiters + (smoothedPct / 100) * usableCapacity) * 10) /
        10;

      return {
        timestamp: row.bucket,
        fuelLevel: smoothedPct,
        fuelLiters: smoothedLiters,
        fuelConsumption: row.fuelConsumption,
        fuelRate: row.fuelRate !== null ? Math.round(row.fuelRate * 10) / 10 : null,
        ignition: row.ignition ?? false,
      };
    });

    const result = {
      summary: {
        tankCapacity,
        isCapacityCalibrated,
        totalConsumed,
        consumedLiters,
        totalDrained,
        totalRefueled,
        currentLevel:
          currentLevel !== null ? Math.round(currentLevel * 100) / 100 : null,
        currentLiters,
      },
      events,
      history,
    };

    // Almacenar en caché en memoria por 120 segundos
    this.cacheService.set(cacheKey, result, 120 * 1000);

    return result;
  }

  async getPublicTrackingRoute(
    linkId: string,
    userLat: number,
    userLng: number,
  ) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { id: linkId },
      include: {
        vehicle: {
          include: {
            liveState: true,
          },
        },
      },
    });

    if (!link || !link.isActive || new Date() > link.expiresAt) {
      throw new NotFoundException(
        'El enlace de rastreo ha expirado o no es válido',
      );
    }

    const vehicleLat = link.vehicle.liveState?.lastLat;
    const vehicleLng = link.vehicle.liveState?.lastLng;

    if (vehicleLat == null || vehicleLng == null) {
      throw new BadRequestException(
        'El vehículo no cuenta con coordenadas GPS recientes.',
      );
    }

    const isTruck =
      link.vehicle.category === VehicleCategory.HEAVY_DUTY ||
      link.vehicle.category === VehicleCategory.MACHINERY;
    const travelMode = isTruck ? 'Truck' : 'Car';

    const route = await this.valhallaRoutesClient.calculatePointToPointRoute(
      userLat,
      userLng,
      vehicleLat,
      vehicleLng,
      travelMode,
    );

    if (!route) {
      const distKm = parseFloat(
        haversineDistance(userLat, userLng, vehicleLat, vehicleLng).toFixed(2),
      );
      return {
        distanceKm: distKm,
        durationMinutes: Math.max(1, Math.round((distKm / 35) * 60)),
        coordinates: [
          [vehicleLng, vehicleLat],
          [userLng, userLat],
        ],
      };
    }

    return route;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[half]
      : (sorted[half - 1] + sorted[half]) / 2;
  }

  private getForwardMedian(
    logs: any[],
    startIndex: number,
    windowMs: number = 10 * 60 * 1000,
  ): number | null {
    const baseTime = logs[startIndex].timestamp.getTime();
    const samples: number[] = [];
    for (let i = startIndex + 1; i < logs.length; i++) {
      const elapsed = logs[i].timestamp.getTime() - baseTime;
      if (elapsed > windowMs) break;
      samples.push(logs[i].fuelLevel);
      if (samples.length >= 60) break;
    }
    if (samples.length === 0) return null;
    return this.calculateMedian(samples);
  }

  private checkDrainRebound(logs: any[], startIndex: number, anchor: number): boolean {
    let drivingReadings = 0;
    for (let i = startIndex + 1; i < logs.length; i++) {
      const isDriving = (logs[i].speed ?? 0) > 3 || (logs[i].gpsSpeed ?? 0) > 3;
      if (isDriving) {
        drivingReadings++;
        if (logs[i].fuelLevel >= anchor - 3.0) return true;
        if (drivingReadings >= 30) break;
      }
    }
    return false;
  }

  private checkRefuelRebound(
    logs: any[],
    startIndex: number,
    anchor: number,
    deltaPercent?: number,
  ): boolean {
    let drivingReadings = 0;
    // Un rebote por pendiente o rampa ocurre cuando el nivel cae de vuelta cerca al ancla
    // previa al reanudar la marcha sobre terreno plano.
    const reboundThreshold = anchor + Math.min(2.5, (deltaPercent ?? 5) * 0.4);

    // Examinar hacia adelante: cuando el vehículo reanude la marcha (speed > 3)
    for (let i = startIndex + 1; i < logs.length; i++) {
      const isDriving = (logs[i].speed ?? 0) > 3 || (logs[i].gpsSpeed ?? 0) > 3;
      if (isDriving) {
        drivingReadings++;
        // En los primeros 5 minutos de conducción (~30 lecturas), si el nivel regresa
        // al ancla previa, confirma que fue una falsa subida por inclinación/rampa o boya.
        if (logs[i].fuelLevel <= reboundThreshold) {
          return true; // Rebote confirmado
        }
        // Si ya condujo más de 5 minutos en marcha y el combustible se mantuvo alto,
        // el incremento es 100% genuino y cualquier descenso posterior será consumo de motor.
        if (drivingReadings >= 30) {
          break;
        }
      }
    }
    return false;
  }

  private async resolveEventLocation(
    vehicleId: string,
    eventTimestamp: Date,
    fallbackLat: number | null,
    fallbackLng: number | null,
  ): Promise<{ latitude: number | null; longitude: number | null }> {
    try {
      // 1. Prioridad 1: Salida de la gasolinera (primer movimiento con fix fresco post-recarga)
      const departureLog = await this.prisma.telemetryLog.findFirst({
        where: {
          vehicleId,
          timestamp: {
            gte: eventTimestamp,
            lte: new Date(eventTimestamp.getTime() + 20 * 60 * 1000),
          },
          OR: [{ speed: { gt: 3 } }, { gpsSpeed: { gt: 3 } }],
          latitude: { not: 0 },
          longitude: { not: 0 },
          ...(fallbackLat !== null && fallbackLng !== null
            ? {
                NOT: {
                  AND: [{ latitude: fallbackLat }, { longitude: fallbackLng }],
                },
              }
            : {}),
        },
        orderBy: { timestamp: 'asc' },
        select: { latitude: true, longitude: true },
      });

      if (
        departureLog &&
        departureLog.latitude !== 0 &&
        departureLog.longitude !== 0 &&
        Math.abs(departureLog.latitude) > 0.0001
      ) {
        return {
          latitude: departureLog.latitude,
          longitude: departureLog.longitude,
        };
      }

      // Si no hubo cambio con respecto a fallback, tomar cualquier registro en movimiento post-recarga
      const anyDepartureLog = await this.prisma.telemetryLog.findFirst({
        where: {
          vehicleId,
          timestamp: {
            gte: eventTimestamp,
            lte: new Date(eventTimestamp.getTime() + 20 * 60 * 1000),
          },
          OR: [{ speed: { gt: 3 } }, { gpsSpeed: { gt: 3 } }],
          latitude: { not: 0 },
          longitude: { not: 0 },
        },
        orderBy: { timestamp: 'asc' },
        select: { latitude: true, longitude: true },
      });

      if (
        anyDepartureLog &&
        anyDepartureLog.latitude !== 0 &&
        anyDepartureLog.longitude !== 0 &&
        Math.abs(anyDepartureLog.latitude) > 0.0001
      ) {
        return {
          latitude: anyDepartureLog.latitude,
          longitude: anyDepartureLog.longitude,
        };
      }

      // 2. Prioridad 2: Entrada a la gasolinera (último movimiento antes de detenerse a recargar)
      const arrivalLog = await this.prisma.telemetryLog.findFirst({
        where: {
          vehicleId,
          timestamp: {
            gte: new Date(eventTimestamp.getTime() - 20 * 60 * 1000),
            lte: eventTimestamp,
          },
          OR: [{ speed: { gt: 3 } }, { gpsSpeed: { gt: 3 } }],
          latitude: { not: 0 },
          longitude: { not: 0 },
          ...(fallbackLat !== null && fallbackLng !== null
            ? {
                NOT: {
                  AND: [{ latitude: fallbackLat }, { longitude: fallbackLng }],
                },
              }
            : {}),
        },
        orderBy: { timestamp: 'desc' },
        select: { latitude: true, longitude: true },
      });

      if (
        arrivalLog &&
        arrivalLog.latitude !== 0 &&
        arrivalLog.longitude !== 0 &&
        Math.abs(arrivalLog.latitude) > 0.0001
      ) {
        return {
          latitude: arrivalLog.latitude,
          longitude: arrivalLog.longitude,
        };
      }

      // 3. Prioridad 3: Primer registro con GPS válido post-evento
      const anyPostLog = await this.prisma.telemetryLog.findFirst({
        where: {
          vehicleId,
          timestamp: {
            gte: eventTimestamp,
            lte: new Date(eventTimestamp.getTime() + 20 * 60 * 1000),
          },
          latitude: { not: 0 },
          longitude: { not: 0 },
        },
        orderBy: { timestamp: 'asc' },
        select: { latitude: true, longitude: true },
      });

      if (
        anyPostLog &&
        anyPostLog.latitude !== 0 &&
        anyPostLog.longitude !== 0 &&
        Math.abs(anyPostLog.latitude) > 0.0001
      ) {
        return {
          latitude: anyPostLog.latitude,
          longitude: anyPostLog.longitude,
        };
      }
    } catch {
      // Mantener fallback si ocurre error
    }

    return {
      latitude: fallbackLat,
      longitude: fallbackLng,
    };
  }

  async recalculateVehicleFuel(vehicleId: string): Promise<{
    eventsCount: number;
    updatedTripsCount: number;
  }> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        tankCapacity: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehículo con ID ${vehicleId} no encontrado.`);
    }

    const capacity = vehicle.tankCapacity ?? 60;
    const effectiveCapacity = capacity;
    // Piso de ruido físico del sensor capacitivo: cualquier adición real >= 2.5% y >= 1.5 L
    // es evaluada por la máquina de estados cinemática (sin depender de umbrales mágicos)
    const MIN_EVENT_PERCENT = 2.5;
    const MIN_EVENT_LITERS = 1.5;
    const CONFIRM_WINDOW_MS = 8 * 60 * 1000;

    // 1. Limpiar eventos existentes
    await this.prisma.fuelEvent.deleteMany({
      where: { vehicleId },
    });

    // 2. Obtener registros de telemetría con nivel de combustible
    const logs = await this.prisma.telemetryLog.findMany({
      where: {
        vehicleId,
        fuelLevel: { not: null },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        tripId: true,
        timestamp: true,
        fuelLevel: true,
        speed: true,
        gpsSpeed: true,
        ignition: true,
        latitude: true,
        longitude: true,
        odometer: true,
      },
    });

    if (logs.length === 0) {
      return { eventsCount: 0, updatedTripsCount: 0 };
    }

    const fuelEventsToInsert: Array<{
      id: string;
      vehicleId: string;
      tripId: string | null;
      type: FuelEventType;
      liters: number;
      percentageDelta: number;
      startLevel: number;
      endLevel: number;
      latitude: number | null;
      longitude: number | null;
      timestamp: Date;
    }> = [];

    let initialSample = logs.slice(0, Math.min(10, logs.length)).map((l) => l.fuelLevel!);
    let lastConfirmedAnchor = this.calculateMedian(initialSample);
    let preStopFuelLevel: number | null = lastConfirmedAnchor;
    let stationaryReadings: number[] = [];
    let stationaryStartTime: number | null = null;
    let lastStationaryLog: (typeof logs)[0] | null = null;
    let lastStationaryIndex: number | null = null;
    let cruisingReadings: number[] = [];
    let isSlopeStop = false;
    let isSlopeDrainStop = false;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const rawFuel = log.fuelLevel!;
      const isMoving = (log.speed ?? 0) > 3 || (log.gpsSpeed ?? 0) > 3;

      // 1. VEHÍCULO EN MOVIMIENTO (CONDUCCIÓN):
      // Ningún evento de recarga ni robo puede ocurrir físicamente en marcha.
      if (isMoving) {
        // Recopilar lecturas en crucero estable (velocidad > 10 km/h) para tener una línea base
        // libre del oleaje de frenada al detenerse
        if ((log.speed ?? 0) > 10 || (log.gpsSpeed ?? 0) > 10) {
          cruisingReadings.push(rawFuel);
          if (cruisingReadings.length > 20) {
            cruisingReadings.shift();
          }
        }

        stationaryReadings = [];
        stationaryStartTime = null;
        lastStationaryLog = null;
        lastStationaryIndex = null;
        preStopFuelLevel = null;
        isSlopeStop = false;
        isSlopeDrainStop = false;

        // En marcha el ancla sigue suavemente el consumo real del motor hacia abajo filtrando sloshing.
        // NUNCA salta al fondo de un pozo de oleaje o frenada brusca.
        if (rawFuel < lastConfirmedAnchor) {
          lastConfirmedAnchor = 0.02 * rawFuel + 0.98 * lastConfirmedAnchor;
        }
        continue;
      }

      // 2. VEHÍCULO DETENIDO (PARADA O ESTACIONADO):
      if (stationaryStartTime === null) {
        stationaryStartTime = log.timestamp.getTime();
        const cruisingBaseline =
          cruisingReadings.length >= 3 ? this.calculateMedian(cruisingReadings) : null;
        preStopFuelLevel = cruisingBaseline ?? lastConfirmedAnchor;
      }
      lastStationaryLog = log;
      lastStationaryIndex = i;

      stationaryReadings.push(rawFuel);
      if (stationaryReadings.length > 30) {
        stationaryReadings.shift();
      }

      const elapsedStationaryMs = log.timestamp.getTime() - stationaryStartTime;
      // FÍSICA: Una recarga en gasolinera requiere al menos 60 segundos de parada
      // (descarta el 100% de semáforos y paradas de tráfico de 15 a 45 segundos).
      const isSettled =
        stationaryReadings.length >= 4 && elapsedStationaryMs >= 60_000;

      if (!isSettled) {
        continue;
      }

      // Mediana sobre lecturas recientes para capturar fielmente el nivel alcanzado tras recargar
      const recentReadings = stationaryReadings.slice(-3);
      const settledLevel = this.calculateMedian(recentReadings);
      const baseline = preStopFuelLevel ?? lastConfirmedAnchor;
      const delta = settledLevel - baseline;
      const absDeltaPercent = Math.abs(delta);
      const deltaLiters =
        Math.round(((absDeltaPercent / 100.0) * effectiveCapacity) * 100) / 100;

      // 3. DETECCIÓN DE RECARGA (REFUEL):
      if (!isSlopeStop && delta >= MIN_EVENT_PERCENT && deltaLiters >= MIN_EVENT_LITERS) {
        const isRebound = this.checkRefuelRebound(logs, i, baseline, delta);

        if (isRebound) {
          isSlopeStop = true;
          continue;
        }

        const forwardMed = this.getForwardMedian(logs, i, CONFIRM_WINDOW_MS);
        const finalEndLevel =
          forwardMed !== null ? Math.max(settledLevel, forwardMed) : settledLevel;
        const realDelta = finalEndLevel - baseline;
        const realLiters =
          Math.round(((realDelta / 100.0) * effectiveCapacity) * 100) / 100;

        const lastEvent =
          fuelEventsToInsert.length > 0
            ? fuelEventsToInsert[fuelEventsToInsert.length - 1]
            : null;
        const timeSinceLastEventMs = lastEvent
          ? log.timestamp.getTime() - lastEvent.timestamp.getTime()
          : Infinity;

        // Consolidación de recargas en etapas en la misma parada (<= 15 min):
        if (
          lastEvent &&
          lastEvent.type === FuelEventType.REFUEL &&
          timeSinceLastEventMs <= 15 * 60 * 1000
        ) {
          const consolidatedDelta = finalEndLevel - lastEvent.startLevel;
          lastEvent.endLevel = Math.round(finalEndLevel * 10) / 10;
          lastEvent.percentageDelta = Math.round(consolidatedDelta * 10) / 10;
          lastEvent.liters =
            Math.round(((consolidatedDelta / 100.0) * effectiveCapacity) * 100) / 100;
        } else {
          fuelEventsToInsert.push({
            id: uuidv7(),
            vehicleId,
            tripId: log.tripId ?? null,
            type: FuelEventType.REFUEL,
            liters: realLiters,
            percentageDelta: Math.round(realDelta * 10) / 10,
            startLevel: Math.round(baseline * 10) / 10,
            endLevel: Math.round(finalEndLevel * 10) / 10,
            latitude: log.latitude,
            longitude: log.longitude,
            timestamp: log.timestamp,
          });
        }

        lastConfirmedAnchor = finalEndLevel;
        preStopFuelLevel = finalEndLevel;
        stationaryReadings = [finalEndLevel];
        continue;
      }

      // 4. DETECCIÓN DE DRENADO / ROBO (DRAIN):
      else if (!isSlopeDrainStop && delta <= -MIN_EVENT_PERCENT && deltaLiters >= MIN_EVENT_LITERS) {
        if (!log.ignition) {
          const isRebound = this.checkDrainRebound(logs, i, baseline);
          if (isRebound) {
            isSlopeDrainStop = true;
            continue;
          }

          const forwardMed = this.getForwardMedian(logs, i, CONFIRM_WINDOW_MS);
          const isPersistent =
            forwardMed === null ||
            forwardMed <= baseline - absDeltaPercent * 0.7;

          if (isPersistent) {
            fuelEventsToInsert.push({
              id: uuidv7(),
              vehicleId,
              tripId: log.tripId ?? null,
              type: FuelEventType.DRAIN,
              liters: deltaLiters,
              percentageDelta: Math.round(delta * 10) / 10,
              startLevel: Math.round(baseline * 10) / 10,
              endLevel: Math.round(settledLevel * 10) / 10,
              latitude: log.latitude,
              longitude: log.longitude,
              timestamp: log.timestamp,
            });

            lastConfirmedAnchor = settledLevel;
            preStopFuelLevel = settledLevel;
            stationaryReadings = [settledLevel];
            continue;
          }
        }
      }
    }

    if (fuelEventsToInsert.length > 0) {
      for (const evt of fuelEventsToInsert) {
        const resolved = await this.resolveEventLocation(
          vehicleId,
          evt.timestamp,
          evt.latitude,
          evt.longitude,
        );
        evt.latitude = resolved.latitude;
        evt.longitude = resolved.longitude;
      }

      await this.prisma.fuelEvent.createMany({
        data: fuelEventsToInsert,
      });
    }

    // 3. Recalcular viajes en memoria y en lotes
    const trips = await this.prisma.trip.findMany({
      where: { vehicleId },
      orderBy: { startTime: 'asc' },
      select: { id: true, distanceKm: true },
    });

    // Agrupar los fuelLevel de los logs en memoria por tripId (O(N) en RAM, evitando N+1 consultas a la BD)
    const tripFuelLogsMap = new Map<string, number[]>();
    for (const l of logs) {
      if (l.tripId && l.fuelLevel !== null && l.fuelLevel !== undefined) {
        let arr = tripFuelLogsMap.get(l.tripId);
        if (!arr) {
          arr = [];
          tripFuelLogsMap.set(l.tripId, arr);
        }
        arr.push(l.fuelLevel);
      }
    }

    const tripRefuelMap = new Map<string, number>();
    for (const e of fuelEventsToInsert) {
      if (e.tripId && e.type === FuelEventType.REFUEL) {
        tripRefuelMap.set(e.tripId, (tripRefuelMap.get(e.tripId) ?? 0) + e.liters);
      }
    }

    const updatePromises: any[] = [];
    const BATCH_SIZE = 50;

    for (const trip of trips) {
      const fuelLevels = tripFuelLogsMap.get(trip.id);
      if (!fuelLevels || fuelLevels.length === 0) continue;

      const startSample = fuelLevels.slice(0, Math.min(10, fuelLevels.length));
      const endSample = fuelLevels.slice(-Math.min(10, fuelLevels.length));
      const startFuel = this.calculateMedian(startSample);
      const endFuel = this.calculateMedian(endSample);

      const midTripRefuels = tripRefuelMap.get(trip.id) ?? 0;
      const netLiters = ((startFuel - endFuel) / 100.0) * effectiveCapacity + midTripRefuels;
      const consumedLiters = Math.max(0, Math.round(netLiters * 100) / 100);
      const efficiency =
        consumedLiters > 0 && trip.distanceKm && trip.distanceKm > 0
          ? Math.round((trip.distanceKm / consumedLiters) * 100) / 100
          : null;

      updatePromises.push(
        this.prisma.trip.update({
          where: { id: trip.id },
          data: {
            startFuelLevel: Math.round(startFuel * 100) / 100,
            endFuelLevel: Math.round(endFuel * 100) / 100,
            fuelConsumedLiters: consumedLiters,
            fuelEfficiencyKmL: efficiency,
          },
        }),
      );
    }

    for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
      const chunk = updatePromises.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk);
    }

    const updatedTripsCount = updatePromises.length;

    // 4. Actualizar liveState
    const lastLog = logs[logs.length - 1];
    const roundedFuel = Math.round(lastConfirmedAnchor * 100) / 100;
    const fullVirtualState = {
      currentDisplayPercent: roundedFuel,
      lastValidAnchorPercent: roundedFuel,
      vehicleState: 'PARKED',
      segmentReadings: [roundedFuel],
      distanceAccumulator: 0,
      timeAccumulator: 0,
      ignitionOnTime: null,
      ignitionOnReadings: [],
      session: {
        type: 'NONE',
        startAnchor: null,
        stableCounter: 0,
        lastMedian: null,
      },
    };

    await this.prisma.vehicleLiveState.upsert({
      where: { vehicleId },
      update: {
        lastFuelLevel: roundedFuel,
        virtualState: fullVirtualState as any,
      },
      create: {
        vehicleId,
        lastLat: lastLog.latitude ?? 0,
        lastLng: lastLog.longitude ?? 0,
        lastFuelLevel: roundedFuel,
        virtualState: fullVirtualState as any,
        lastUpdate: new Date(),
      },
    });

    // Invalidar caché de análisis de combustible para este vehículo
    this.cacheService.delByPattern(`vehicles:fuel-analysis:${vehicleId}`);

    return { eventsCount: fuelEventsToInsert.length, updatedTripsCount };
  }

  async calibrateTank(vehicleId: string, dto: CalibrateTankDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, tankCapacity: true, isCapacityCalibrated: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con ID ${vehicleId} no encontrado.`);
    }

    let delta = dto.percentageDelta;
    if (dto.eventId) {
      const event = await this.prisma.fuelEvent.findUnique({
        where: { id: dto.eventId },
        select: { percentageDelta: true, type: true },
      });
      if (event) {
        delta = Math.abs(event.percentageDelta);
      }
    }

    if (!delta || delta <= 0) {
      throw new BadRequestException(
        'El incremento porcentual (delta) debe ser mayor a 0% para calibrar.',
      );
    }
    if (!dto.pumpedLiters || dto.pumpedLiters <= 0) {
      throw new BadRequestException(
        'Los litros despachados en el recibo deben ser un número positivo.',
      );
    }

    // Capacidad real efectiva reemplaza el valor manual previo:
    // Capacidad = Litros Surtidos / (Delta% / 100)
    const rawCapacity = (dto.pumpedLiters / delta) * 100.0;
    const newCapacity = Math.round(rawCapacity * 10) / 10;

    if (newCapacity < 15 || newCapacity > 2000) {
      throw new BadRequestException(
        `La capacidad calculada (${newCapacity} L) está fuera del rango normal (15L - 2000L). Por favor verifique los litros del recibo.`,
      );
    }

    // Actualizar vehículo con el nuevo valor que REEMPLAZA el anterior
    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        tankCapacity: newCapacity,
        isCapacityCalibrated: true,
      },
    });

    // Invalidar caché
    this.cacheService.delByPattern('vehicles:');

    // Recalcular eventos de combustible y consumo de viajes del vehículo con la nueva capacidad
    const result = await this.recalculateVehicleFuel(vehicleId);

    return {
      success: true,
      message: `Capacidad de tanque calibrada exitosamente a ${newCapacity} L.`,
      vehicleId,
      previousCapacity: vehicle.tankCapacity,
      calibratedCapacity: newCapacity,
      isCapacityCalibrated: true,
      eventsRecalculated: result.eventsCount,
      tripsUpdated: result.updatedTripsCount,
    };
  }
}
