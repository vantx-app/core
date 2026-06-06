import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateTrackingLinkDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  clientName?: string;
}
