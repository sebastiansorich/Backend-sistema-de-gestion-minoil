import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRolDto {
  @ApiProperty({ description: 'Nombre del rol', example: 'Administrador' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del rol', example: 'Rol con acceso completo al sistema' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Estado activo del rol', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
} 