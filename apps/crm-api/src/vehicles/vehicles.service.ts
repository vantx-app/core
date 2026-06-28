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
import { Vehicle, VehicleLiveState, VehicleCategory } from '@prisma/client';
import PDFDocument from 'pdfkit';
import AdmZip from 'adm-zip';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import {
  RuleEngineConfig,
  DEFAULT_RULE_ENGINE_CONFIG,
} from 'src/scoring-cron/scoring.interfaces';
import {
  decodeFlexiblePolyline,
  haversineDistance,
} from 'src/scoring-cron/route-utils';

@Injectable()
export class VehiclesService {
  private readonly DEFAULT_CONFIG: RuleEngineConfig =
    DEFAULT_RULE_ENGINE_CONFIG;

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private rulesEngineService: RulesEngineService,
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
    return baseUrl;
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
      const decoded = decodeFlexiblePolyline(trip.polyline);
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
        return decoded.polyline.map((p) => {
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
}
