import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCargoDto {
  @ApiProperty({ description: 'Nombre del cargo', example: 'Gerente de Ventas' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del cargo', example: 'Responsable de la gestión comercial' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Nivel jerárquico del cargo', example: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  nivel?: number;

  @ApiPropertyOptional({ description: 'Estado activo del cargo', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ description: 'ID del área a la que pertenece el cargo' })
  @IsInt()
  areaId: number;

  @ApiPropertyOptional({ description: 'ID del cargo superior en la jerarquía' })
  @IsOptional()
  @IsInt()
  cargoSuperiorId?: number;

  @ApiProperty({ description: 'ID del rol asociado al cargo' })
  @IsInt()
  rolId: number;
} 