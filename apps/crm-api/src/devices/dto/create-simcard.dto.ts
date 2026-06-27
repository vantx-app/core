import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateSimCardDto {
  @IsString()
  @Length(19, 20, { message: 'El ICCID debe tener entre 19 y 20 dígitos.' })
  @ApiProperty()
  iccid: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  carrier?: string;
}
