import { IsString, IsOptional, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSedeDto {
  @ApiProperty({ description: 'Nombre de la sede', example: 'Sede Central' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Dirección de la sede', example: 'Av. Principal 123' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ description: 'Teléfono de la sede', example: '+54 11 1234-5678' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ description: 'Email de contacto de la sede', example: 'sede@minoil.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Estado activo de la sede', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
} 