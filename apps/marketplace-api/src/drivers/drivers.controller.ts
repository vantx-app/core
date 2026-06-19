import { Controller, Get, Param } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Public()
  @Get('public')
  async findPublicAvailableDrivers() {
    return this.driversService.findPublicAvailableDrivers();
  }

  @Public()
  @Get('public/:id')
  async findOnePublic(@Param('id') id: string) {
    return this.driversService.findOnePublic(id);
  }
}
