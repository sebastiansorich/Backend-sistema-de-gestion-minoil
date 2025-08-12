import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModuloDto {
  @ApiProperty({ description: 'Nombre del módulo', example: 'Empleados' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del módulo', example: 'Gestión de empleados del sistema' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ description: 'Ruta del módulo', example: '/usuarios/empleados' })
  @IsString()
  ruta: string;

  @ApiPropertyOptional({ description: 'Estado activo del módulo', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // 🆕 CAMPOS PARA JERARQUÍA
  @ApiPropertyOptional({ description: 'ID del módulo padre (para submódulos)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  padreId?: number;

  @ApiPropertyOptional({ description: 'Nivel jerárquico (calculado automáticamente)', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  nivel?: number;

  @ApiPropertyOptional({ description: 'Si aparece clickeable en el sidebar', default: true })
  @IsOptional()
  @IsBoolean()
  esMenu?: boolean;

  @ApiPropertyOptional({ description: 'Icono para el sidebar', example: 'user' })
  @IsOptional()
  @IsString()
  icono?: string;

  @ApiPropertyOptional({ description: 'Orden de aparición en sidebar', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
} 