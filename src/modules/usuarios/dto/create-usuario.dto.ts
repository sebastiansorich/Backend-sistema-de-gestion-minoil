import { IsString, IsOptional, IsEmail, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUsuarioDto {
  @ApiProperty({ description: 'Nombre de usuario', example: 'juan.perez' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Email del usuario', example: 'juan.perez@minoil.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Nombre del usuario', example: 'Juan' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Apellido del usuario', example: 'Pérez' })
  @IsString()
  apellido: string;

  @ApiPropertyOptional({ description: 'Contraseña del usuario (opcional si es LDAP)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Tipo de autenticación', default: 'local', enum: ['local', 'ldap'] })
  @IsOptional()
  @IsString()
  autenticacion?: string;

  @ApiPropertyOptional({ description: 'Estado activo del usuario', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ description: 'ID de la sede' })
  @IsInt()
  sedeId: number;

  @ApiProperty({ description: 'ID del área' })
  @IsInt()
  areaId: number;

  @ApiProperty({ description: 'ID del cargo' })
  @IsInt()
  cargoId: number;
} 