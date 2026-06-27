import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { DeviceModel } from '@prisma/client';

export class CreateDeviceDto {
  @IsString()
  @Length(15, 15, { message: 'El IMEI debe tener exactamente 15 dígitos.' })
  @ApiProperty()
  imei: string;

  @IsEnum(DeviceModel, { message: 'Modelo de dispositivo no válido.' })
  @ApiProperty({ enum: DeviceModel })
  model: DeviceModel;
}
