import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class OnboardDriverDto {
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @ApiProperty()
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @ApiProperty()
  password: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @ApiProperty()
  firstName: string;

  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @ApiProperty()
  lastName: string;

  @IsString({ message: 'El documento de identidad debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El documento de identidad es obligatorio' })
  @ApiProperty()
  nationalId: string;

  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsPhoneNumber('PA', { message: 'El número de teléfono no es válido' })
  @ApiProperty()
  phone: string;
}
