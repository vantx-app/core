import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AccessTokenPayload } from 'src/auth/types';
import { Response } from 'express';

import { VehiclesService } from './vehicles.service';
import { AssignmentService } from 'src/assignment/assignment.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CreateTrackingLinkDto } from './dto/create-tracking-link.dto';
import { CalibrateTankDto } from './dto/calibrate-tank.dto';
import { ROLES } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CacheService } from 'src/common/cache.service';
import { RequiresSubscription } from 'src/common/decorators/requires-subscription.decorator';

@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly assignmentService: AssignmentService,
    private readonly cacheService: CacheService,
  ) {}

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Post()
  async create(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() createVehicleDto: CreateVehicleDto,
  ) {
    const user = req.user;

    if (user.role !== ROLES.SUPER_ADMIN) {
      createVehicleDto.orgId = user.orgId;
    } else if (!createVehicleDto.orgId) {
      throw new BadRequestException(
        'Se requiere orgId al crear un vehículo como SUPER_ADMIN.',
      );
    }

    const result = await this.vehiclesService.create(createVehicleDto);
    this.cacheService.delByPattern('vehicles:');
    return result;
  }

  @Get(':id/driver')
  async getAssignedDriver(@Param('id', ParseUUIDPipe) vehicleId: string) {
    return this.assignmentService.getAssignedDriver(vehicleId);
  }

  @Get(':id/previous-drivers')
  async getPreviousDrivers(
    @Param('id', ParseUUIDPipe) vehicleId: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyVehicleAccess(vehicleId, req.user);
    return this.assignmentService.getPreviousDrivers(vehicleId);
  }

  @Patch(':id')
  async updateVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyVehicleAccess(id, req.user);
    const result = await this.vehiclesService.update(id, updateVehicleDto);
    this.cacheService.delByPattern('vehicles:');
    return result;
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Get('fleet-stats')
  async getFleetStats(
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('targetOrgId') targetOrgId?: string,
  ) {
    const user = req.user;
    const orgId = user.role === ROLES.SUPER_ADMIN ? targetOrgId : user.orgId;
    if (!orgId) {
      throw new BadRequestException(
        'Se requiere el ID de la organización (orgId) para obtener estadísticas de flota.',
      );
    }
    return this.vehiclesService.getFleetStats(orgId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyVehicleAccess(id, req.user);
    return this.vehiclesService.findOne(id);
  }

  @Get()
  async findAll(
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('liveState', new ParseBoolPipe({ optional: true }))
    liveState?: boolean,
    @Query('targetOrgId') targetOrgId?: string,
  ) {
    const user = req.user;

    // Si es SUPER_ADMIN, puede buscar todos o una organización específica
    if (user.role === ROLES.SUPER_ADMIN) {
      return this.vehiclesService.findAllByOrgId(targetOrgId, liveState);
    }

    if (!user.orgId && user.role !== 'DRIVER') {
      throw new Error('The orgId is missing');
    }

    if (user.role === 'DRIVER') {
      return this.vehiclesService.findByUserId(user.sub, liveState);
    }

    return this.vehiclesService.findAllByOrgId(user.orgId, liveState);
  }

  // Intención clara: "Asignar un chofer a este vehículo"
  @Post(':id/assign')
  async assignDriver(
    @Param('id', ParseUUIDPipe) vehicleId: string,
    @Body() dto: AssignDriverDto,
  ) {
    const result = await this.assignmentService.assignVehicleToDriver(
      vehicleId,
      dto.nationalId,
    );
    this.cacheService.delByPattern('vehicles:');
    this.cacheService.delByPattern('drivers:');
    return result;
  }

  // Intención clara: "Liberar el vehículo"
  @Post(':id/unassign')
  async unassignVehicle(@Param('id', ParseUUIDPipe) vehicleId: string) {
    const result = await this.assignmentService.unassignVehicle(vehicleId);
    this.cacheService.delByPattern('vehicles:');
    this.cacheService.delByPattern('drivers:');
    return result;
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN, ROLES.DRIVER)
  @RequiresSubscription()
  @Get(':id/trips')
  async getVehicleTrips(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyVehicleAccess(id, req.user);
    return this.vehiclesService.findTripsForVehicle(id);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN, ROLES.DRIVER)
  @RequiresSubscription()
  @Get(':id/trips/:tripId/route')
  async getVehicleTripRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyTripAccess(id, tripId, req.user);
    return this.vehiclesService.findRouteForTrip(id, tripId);
  }

  @RequiresSubscription()
  @Post(':id/tracking-links')
  async createTrackingLink(
    @Param('id', ParseUUIDPipe) vehicleId: string,
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() dto: CreateTrackingLinkDto,
  ) {
    await this.vehiclesService.verifyVehicleAccess(vehicleId, req.user);
    return this.vehiclesService.createTrackingLink(vehicleId, dto.clientName);
  }

  @RequiresSubscription()
  @Get(':id/tracking-links')
  async getTrackingLinks(
    @Param('id', ParseUUIDPipe) vehicleId: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyVehicleAccess(vehicleId, req.user);
    return this.vehiclesService.getActiveTrackingLinks(vehicleId);
  }

  @RequiresSubscription()
  @Post(':id/tracking-links/:linkId/revoke')
  async revokeTrackingLink(
    @Param('id', ParseUUIDPipe) vehicleId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    await this.vehiclesService.verifyVehicleAccess(vehicleId, req.user);
    return this.vehiclesService.revokeTrackingLink(vehicleId, linkId);
  }

  @RequiresSubscription()
  @Get(':id/crash-reconstruction')
  async getCrashReconstruction(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('timestamp') timestamp: string,
    @Res() res: Response,
  ) {
    const zipBuffer = await this.vehiclesService.generateCrashReconstructionZip(
      id,
      timestamp,
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename=Caja_Negra_Vehiculo_${id}.zip`,
      'Content-Length': zipBuffer.length.toString(),
    });
    res.end(zipBuffer);
  }

  @RequiresSubscription()
  @Get(':id/fuel-analysis')
  async getFuelAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('days') days?: string,
  ) {
    await this.vehiclesService.verifyVehicleAccess(id, req.user);
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.vehiclesService.getFuelAnalysis(
      id,
      isNaN(daysNum) ? 7 : daysNum,
    );
  }

  @RequiresSubscription()
  @Post(':id/calibrate-tank')
  async calibrateTank(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() dto: CalibrateTankDto,
  ) {
    await this.vehiclesService.verifyVehicleAccess(id, req.user);
    return this.vehiclesService.calibrateTank(id, dto);
  }

  @Public()
  @Get('tracking-links/public/:linkId')
  async getPublicTrackingDetails(
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.vehiclesService.getPublicTrackingDetails(linkId);
  }

  @Public()
  @Get('tracking-links/public/:linkId/route')
  async getPublicTrackingRoute(
    @Param('linkId') linkId: string,
    @Query('userLat') userLatStr: string,
    @Query('userLng') userLngStr: string,
  ) {
    const cleanLinkId = (linkId || '').split('?')[0].trim();
    const userLat = parseFloat(userLatStr);
    const userLng = parseFloat(userLngStr);
    if (!cleanLinkId || isNaN(userLat) || isNaN(userLng)) {
      throw new BadRequestException(
        'Parámetros de ruta o coordenadas inválidos.',
      );
    }
    return this.vehiclesService.getPublicTrackingRoute(
      cleanLinkId,
      userLat,
      userLng,
    );
  }
}
