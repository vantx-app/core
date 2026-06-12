import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  // Delete,
  Req,
  Query,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
// import { CreateDriverDto } from './dto/create-driver.dto';
// import { UpdateDriverDto } from './dto/update-driver.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { VerifyDriverDto } from './dto/verify-driver.dto';
import { OnboardDriverDto } from './dto/onboard-driver.dto';
import { ROLES } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AccessTokenPayload } from 'src/auth/types';
import { CacheService } from 'src/common/cache.service';
import { ClaimDriverDto } from './dto/claim-driver.dto';

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly cacheService: CacheService,
  ) {}

  // @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  // @Post()
  // async create(@Body() createDriverDto: CreateDriverDto) {
  //   const result = await this.driversService.create(createDriverDto);
  //   this.cacheService.delByPattern('drivers:');
  //   this.cacheService.delByPattern('vehicles:');
  //   return result;
  // }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Get()
  async findAll(
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('targetOrgId') targetOrgId?: string,
    @Query('available') availableStr?: string,
  ) {
    const user = req.user;
    const onlyAvailable = availableStr === 'true';

    if (user.role === ROLES.SUPER_ADMIN) {
      if (targetOrgId) {
        return this.driversService.findAllByOrgId(targetOrgId);
      }
      return this.driversService.findAll(onlyAvailable);
    }

    if (onlyAvailable) {
      return this.driversService.findAll(true);
    }

    return this.driversService.findAllByOrgId(user.orgId);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN)
  @Get('me/stats')
  async getMyStats(@Req() req: Request & { user: AccessTokenPayload }) {
    return this.driversService.findStatsByUserId(req.user.sub);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get('me/daily-reports')
  async getMyDailyReports(
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 30;
    return this.driversService.findDailyReports('me', limit, req.user);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get('me/score-breakdown')
  async getMyScoreBreakdown(
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('year') yearStr: string,
    @Query('week') weekStr: string,
  ) {
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    if (isNaN(year) || isNaN(week)) {
      throw new BadRequestException('Parámetros de año y semana inválidos.');
    }
    return this.driversService.findScoreBreakdown('me', year, week, req.user);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get('me/trips')
  async getMyTrips(@Req() req: Request & { user: AccessTokenPayload }) {
    // Obtener los viajes del conductor autenticado
    return this.driversService.findTripsForDriver('me', req.user);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Get(':id')
  findOne(
    @Req() req: Request & { user: AccessTokenPayload },
    @Param('id') id: string,
  ) {
    return this.driversService.findOne(id, req.user);
  }

  @Public()
  @Patch('onboard')
  async onboard(@Body() onboardDriverDto: OnboardDriverDto) {
    const result = await this.driversService.onboard(onboardDriverDto);
    this.cacheService.delByPattern('drivers:');
    this.cacheService.delByPattern('vehicles:');
    return result;
  }

  // @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER)
  // @Patch(':id')
  // async update(
  //   @Param('id') id: string,
  //   @Body() updateDriverDto: UpdateDriverDto,
  // ) {
  //   const result = await this.driversService.update(id, updateDriverDto);
  //   this.cacheService.delByPattern('drivers:');
  //   this.cacheService.delByPattern('vehicles:');
  //   return result;
  // }

  @Public()
  @Post('verify')
  async verify(@Body() verifyDriverDto: VerifyDriverDto) {
    return this.driversService.verify(verifyDriverDto);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Get('verify-id/:nationalId')
  async verifyNationalId(@Param('nationalId') nationalId: string) {
    const driver = await this.driversService.findOneByNationalId(nationalId);
    if (!driver) {
      return { exists: false };
    }
    return {
      exists: true,
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      nationalId: driver.nationalId,
      hasUser: driver.userId !== null,
    };
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Post('claim')
  async claim(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() claimDriverDto: ClaimDriverDto,
  ) {
    const result = await this.driversService.claim(req.user, claimDriverDto);
    this.cacheService.delByPattern('drivers:');
    this.cacheService.delByPattern('vehicles:');
    return result;
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Post('unclaim')
  async unclaim(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() body: { userId: string },
  ) {
    const result = await this.driversService.unclaim(req.user, body.userId);
    this.cacheService.delByPattern('drivers:');
    this.cacheService.delByPattern('vehicles:');
    return result;
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get(':id/daily-reports')
  async getDailyReports(
    @Req() req: Request & { user: AccessTokenPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 30;
    return this.driversService.findDailyReports(id, limit, req.user);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get(':id/score-breakdown')
  async getScoreBreakdown(
    @Req() req: Request & { user: AccessTokenPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('year') yearStr: string,
    @Query('week') weekStr: string,
  ) {
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    if (isNaN(year) || isNaN(week)) {
      throw new BadRequestException('Parámetros de año y semana inválidos.');
    }
    return this.driversService.findScoreBreakdown(id, year, week, req.user);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get(':id/trips')
  async getDriverTrips(
    @Req() req: Request & { user: AccessTokenPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Obtener los viajes del conductor especificado
    return this.driversService.findTripsForDriver(id, req.user);
  }

  // @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER)
  // @Delete(':id')
  // async remove(@Param('id') id: string) {
  //   const result = await this.driversService.remove(id);
  //   this.cacheService.delByPattern('drivers:');
  //   this.cacheService.delByPattern('vehicles:');
  //   return result;
  // }
}
