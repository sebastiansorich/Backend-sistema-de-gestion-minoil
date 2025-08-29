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

  @ApiPropertyOptional({ description: 'ID del rol (por defecto: 3)', default: 3 })
  @IsOptional()
  @IsInt()
  rolID?: number;

  @ApiPropertyOptional({ description: 'ID del empleado en SAP' })
  @IsOptional()
  @IsInt()
  empID?: number;

  @ApiPropertyOptional({ description: 'ID del jefe directo en SAP' })
  @IsOptional()
  @IsInt()
  jefeDirectoSapId?: number;

  @ApiPropertyOptional({ description: 'Nombre completo en SAP' })
  @IsOptional()
  @IsString()
  nombreCompletoSap?: string;
} 