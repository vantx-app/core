import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { CreateSimCardDto } from './dto/create-simcard.dto';
import { DeviceStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/enums/roles.enum';

@Controller('devices')
@Roles(ROLES.SUPER_ADMIN)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async createDevice(@Body() dto: CreateDeviceDto) {
    return this.devicesService.createDevice(dto);
  }

  @Get()
  async findAllDevices(@Query('status') status?: DeviceStatus) {
    return this.devicesService.findAllDevices(status);
  }

  @Get('sim-cards')
  async findAllSimCards() {
    return this.devicesService.findAllSimCards();
  }

  @Get(':id')
  async findOneDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.findOneDevice(id);
  }

  @Patch(':id/link-sim')
  async linkSimCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('simCardId') simCardId: string | null,
  ) {
    return this.devicesService.linkSimCard(id, simCardId);
  }

  @Patch(':id/link-vehicle')
  async linkVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('vehicleId') vehicleId: string | null,
  ) {
    return this.devicesService.linkVehicle(id, vehicleId);
  }

  @Post('sim-cards')
  async createSimCard(@Body() dto: CreateSimCardDto) {
    return this.devicesService.createSimCard(dto);
  }

  @Post('sync-fota')
  async syncFotaDevices() {
    return this.devicesService.syncFotaDevices();
  }

  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo no subido o inválido.');
    }
    return this.devicesService.importDevicesFromCsv(file.buffer);
  }
}
