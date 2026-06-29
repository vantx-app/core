import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  IsPhoneNumber,
} from 'class-validator';

export class RegisterOwnerWithOrgDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  token?: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @ApiProperty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @ApiProperty()
  password: string;

  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty()
  isDriver: boolean;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  nationalId?: string;

  @IsString({ message: 'El número de teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio' })
  @IsPhoneNumber('PA', { message: 'El número de teléfono no es válido' })
  @ApiProperty()
  phone: string;

  @IsString({ message: 'El nombre de la organización debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la organización es obligatorio' })
  @ApiProperty()
  orgName: string;
}
