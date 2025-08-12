import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ description: 'Nombre del área', example: 'Ventas' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del área', example: 'Área responsable de las ventas' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Estado activo del área', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ description: 'ID de la sede a la que pertenece el área' })
  @IsInt()
  sedeId: number;
} 