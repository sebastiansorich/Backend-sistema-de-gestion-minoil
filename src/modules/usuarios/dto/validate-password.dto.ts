import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ValidatePasswordDto {
  @ApiProperty({
    description: 'Contraseña a validar',
    example: 'MiNuevaPassword123!'
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @ApiProperty({
    description: 'Nombre de usuario (opcional, para validaciones de información personal)',
    example: 'jperez',
    required: false
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'Nombre del usuario (opcional, para validaciones de información personal)',
    example: 'Juan',
    required: false
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({
    description: 'Apellido del usuario (opcional, para validaciones de información personal)', 
    example: 'Pérez',
    required: false
  })
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiProperty({
    description: 'Email del usuario (opcional, para validaciones de información personal)',
    example: 'jperez@minoil.com.bo',
    required: false
  })
  @IsOptional()
  @IsString()
  email?: string;
}