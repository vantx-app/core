import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CalibrateTankDto {
  @ApiProperty({
    description:
      'Litros reales surtidos según el recibo/factura de la estación de combustible',
    example: 45.0,
  })
  @IsNumber()
  @IsPositive()
  pumpedLiters: number;

  @ApiPropertyOptional({
    description: 'ID del evento FuelEvent asociado a la recarga',
    example: '01a07886-aa86-748e-b9e8-b484494b830c',
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({
    description:
      'Delta porcentual (+%) registrado por el sensor si no se provee eventId',
    example: 75.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  percentageDelta?: number;
}
