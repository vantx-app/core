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
  ) { }

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

  /**
   * Analiza el historial de telemetría de un vehículo para determinar
   * cómo se consumió o drenó el combustible en un rango de días.
   */
  async getFuelAnalysis(vehicleId: string, days = 7) {
    // Limitar el análisis a un rango razonable para proteger la base de datos
    const safeDays = Math.min(30, Math.max(1, days));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - safeDays);

    // Obtener registros de telemetría con nivel de combustible no nulo
    const logs = await this.prisma.telemetryLog.findMany({
      where: {
        vehicleId,
        timestamp: { gte: startDate },
        fuelLevel: { not: null },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        fuelLevel: true,
        fuelConsumption: true,
        fuelRate: true,
        ignition: true,
        speed: true,
        latitude: true,
        longitude: true,
      },
    });

    if (logs.length === 0) {
      return {
        summary: {
          totalConsumed: 0,
          totalDrained: 0,
          totalRefueled: 0,
          currentLevel: null,
        },
        events: [],
        history: [],
      };
    }

    let totalConsumed = 0;
    let totalDrained = 0;
    let totalRefueled = 0;
    const events: any[] = [];

    // Función auxiliar para registrar eventos consolidados
    const finalizeEvent = (
      evt: { type: 'REFUEL' | 'DRAIN'; startTime: Date; startLevel: number; lat: number; lng: number },
      finalLevel: number,
      endTimestamp: Date,
    ) => {
      const delta = finalLevel - evt.startLevel;
      const durationMs = endTimestamp.getTime() - evt.startTime.getTime();

      if (evt.type === 'REFUEL') {
        // Las recargas de combustible en camiones reales requieren volumen y tiempo significativos (min 5% y 60 segundos)
        if (delta >= 5.0 && durationMs >= 60000) {
          totalRefueled += delta;
          events.push({
            type: 'REFUEL',
            timestamp: endTimestamp,
            beforeLevel: evt.startLevel,
            afterLevel: finalLevel,
            delta: delta,
            latitude: evt.lat,
            longitude: evt.lng,
          });
        }
      } else if (evt.type === 'DRAIN') {
        // Los drenados/robos pueden ser pequeños y rápidos, mantenemos el umbral de 3%
        if (delta <= -3.0) {
          const drop = Math.abs(delta);
          totalDrained += drop;
          events.push({
            type: 'DRAIN',
            timestamp: endTimestamp,
            beforeLevel: evt.startLevel,
            afterLevel: finalLevel,
            delta: -drop,
            latitude: evt.lat,
            longitude: evt.lng,
          });
        }
      }
    };

    let lastStableLevel = logs[0].fuelLevel ?? 0;
    let peakLevel = lastStableLevel;
    let eventInProgress: { type: 'REFUEL' | 'DRAIN'; startTime: Date; startLevel: number; lat: number; lng: number } | null = null;
    let wasMoving = false;

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];

      if (prev.fuelLevel === null || curr.fuelLevel === null) continue;

      let totalDiff = curr.fuelLevel - lastStableLevel;
      const stepDiff = curr.fuelLevel - prev.fuelLevel;
      // Se considera en movimiento si tiene velocidad superior a 2 km/h
      const isMoving = (curr.speed ?? 0) > 2 || (prev.speed ?? 0) > 2;

      if (isMoving) {
        // Si había un evento en progreso, lo finalizamos inmediatamente al iniciar movimiento
        if (eventInProgress) {
          finalizeEvent(eventInProgress, prev.fuelLevel, prev.timestamp);
          eventInProgress = null;
        }

        lastStableLevel = curr.fuelLevel;
        peakLevel = curr.fuelLevel; // Restablecer nivel de pico durante movimiento
        wasMoving = true;
        continue;
      }

      // Si el vehículo se detiene, reseteamos el nivel de referencia al nivel actual detenido
      // para evitar comparar con el nivel inestable o ruidoso del movimiento.
      if (wasMoving) {
        lastStableLevel = curr.fuelLevel;
        peakLevel = curr.fuelLevel; // Restablecer nivel de pico al detenerse
        totalDiff = 0; // Recalculamos la diferencia con la nueva referencia estable
        wasMoving = false;
      }

      // Lógica de estado estacionario
      if (eventInProgress) {
        // Verificar si continúa la tendencia del evento
        const isSameDirection =
          (eventInProgress.type === 'REFUEL' && stepDiff >= -0.5) ||
          (eventInProgress.type === 'DRAIN' && stepDiff <= 0.5);

        if (!isSameDirection) {
          // Si cambia la dirección, finalizamos el evento previo
          finalizeEvent(eventInProgress, prev.fuelLevel, prev.timestamp);
          eventInProgress = null;
          lastStableLevel = prev.fuelLevel;
          peakLevel = prev.fuelLevel; // Restablecer nivel de pico al nivel finalizado
          totalDiff = curr.fuelLevel - lastStableLevel; // Recalcular totalDiff con la nueva referencia
        }
      }

      // Si no hay evento en progreso, evaluamos iniciar uno nuevo
      if (!eventInProgress) {
        if (totalDiff >= 3.0 && (curr.fuelLevel - peakLevel) >= 2.0) {
          // Inicio de recarga (exigimos que el nivel no sea una mera recuperación de una caída por sloshing)
          eventInProgress = {
            type: 'REFUEL',
            startTime: prev.timestamp,
            startLevel: lastStableLevel,
            lat: curr.latitude ?? 0,
            lng: curr.longitude ?? 0,
          };
          peakLevel = curr.fuelLevel; // Resetear nivel de pico al iniciar evento
        } else if (totalDiff <= -3.0 && !curr.ignition && !prev.ignition) {
          // Inicio de drenado/robo (solo con ignición apagada)
          eventInProgress = {
            type: 'DRAIN',
            startTime: prev.timestamp,
            startLevel: lastStableLevel,
            lat: curr.latitude ?? 0,
            lng: curr.longitude ?? 0,
          };
          peakLevel = curr.fuelLevel; // Resetear nivel de pico al iniciar evento
        } else {
          // Pequeñas fluctuaciones o consumo normal, actualizamos nivel de referencia
          lastStableLevel = curr.fuelLevel;

          // Registrar el nivel de pico cuando no hay evento en progreso
          if (stepDiff < 0 && stepDiff >= -0.5) {
            // Descenso lento (consumo normal), el pico acompaña al nivel
            peakLevel = curr.fuelLevel;
          } else {
            peakLevel = Math.max(peakLevel, curr.fuelLevel);
          }
        }
      }
    }

    // Finalizar cualquier evento que haya quedado abierto al final de los logs
    if (eventInProgress) {
      finalizeEvent(
        eventInProgress,
        logs[logs.length - 1].fuelLevel ?? 0,
        logs[logs.length - 1].timestamp,
      );
    }

    // Calcular el consumo total de combustible de forma matemática para evitar la acumulación de ruido (tanto por sloshing como por ruido eléctrico)
    const startLevel = logs[0].fuelLevel ?? 0;
    const endLevel = logs[logs.length - 1].fuelLevel ?? 0;
    totalConsumed = Math.max(0, startLevel - endLevel + totalRefueled - totalDrained);

    // Obtener el último nivel de combustible registrado
    const currentLevel = logs[logs.length - 1].fuelLevel;

    // Reducir la cantidad de puntos de la gráfica (downsampling) para optimizar el rendimiento de red y cliente
    const history: any[] = [];
    const step = Math.max(1, Math.floor(logs.length / 300));

    // Guardar timestamps de eventos detectados para asegurar su presencia en la gráfica
    const eventTimes = new Set<number>(
      events.map((e) => new Date(e.timestamp).getTime()),
    );

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const timeMs = new Date(log.timestamp).getTime();

      // Forzar la inclusión de puntos de inicio, fin, muestras periódicas y eventos exactos
      if (
        i === 0 ||
        i === logs.length - 1 ||
        i % step === 0 ||
        eventTimes.has(timeMs)
      ) {
        history.push({
          timestamp: log.timestamp,
          fuelLevel: log.fuelLevel,
          fuelConsumption: log.fuelConsumption,
          fuelRate: log.fuelRate,
          ignition: log.ignition,
        });
      }
    }

    // Suavizar el historial para la gráfica aplicando una media móvil (window size = 5)
    // para atenuar los picos de sloshing en la visualización del usuario
    const smoothedHistory = history.map((item, index) => {
      let sum = 0;
      let count = 0;
      const windowSize = 5;
      const half = Math.floor(windowSize / 2);
      for (let w = -half; w <= half; w++) {
        const neighbor = history[index + w];
        if (neighbor && neighbor.fuelLevel !== null) {
          sum += neighbor.fuelLevel;
          count++;
        }
      }
      return {
        ...item,
        fuelLevel: count > 0 ? Math.round((sum / count) * 10) / 10 : item.fuelLevel,
      };
    });

    return {
      summary: {
        totalConsumed: Math.round(totalConsumed * 100) / 100,
        totalDrained: Math.round(totalDrained * 100) / 100,
        totalRefueled: Math.round(totalRefueled * 100) / 100,
        currentLevel: currentLevel !== null ? Math.round(currentLevel * 100) / 100 : null,
      },
      events,
      history: smoothedHistory,
    };
  }
}

