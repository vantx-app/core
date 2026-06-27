import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import {
  VehicleStatus,
  SubscriptionTier,
  VehicleCategory,
  FuelType,
} from '@prisma/client';

export class CreateVehicleDto {
  @IsUUID()
  @IsOptional()
  @ApiProperty()
  orgId: string;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  alias?: string;

  @IsString()
  @ApiProperty()
  plateNumber: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  vin?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  make?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  model?: string;

  @IsInt()
  @IsOptional()
  @ApiPropertyOptional()
  year?: number;

  @IsOptional()
  @ApiPropertyOptional({ enum: VehicleStatus })
  status?: VehicleStatus;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional()
  scoringProfileId?: string;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional()
  initialOdometer?: number;

  @IsOptional()
  @ApiPropertyOptional({ enum: SubscriptionTier })
  subscriptionTier?: SubscriptionTier;

  @IsOptional()
  @IsEnum(VehicleCategory, { message: 'Categoría de vehículo no válida.' })
  @ApiPropertyOptional({ enum: VehicleCategory })
  category?: VehicleCategory;

  @IsOptional()
  @IsEnum(FuelType, { message: 'Tipo de combustible no válido.' })
  @ApiPropertyOptional({ enum: FuelType })
  fuelType?: FuelType;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isListed?: boolean;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional()
  listingPrice?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  listingDescription?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  hasOptionToBuy?: boolean;
}
