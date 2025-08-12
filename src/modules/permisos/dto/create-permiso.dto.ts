import { IsInt, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePermisoDto {
  @ApiProperty({ description: 'ID del rol' })
  @IsInt()
  rolId: number;

  @ApiProperty({ description: 'ID del módulo' })
  @IsInt()
  moduloId: number;

  @ApiProperty({ description: 'Permiso para crear', default: false })
  @IsBoolean()
  crear: boolean;

  @ApiProperty({ description: 'Permiso para leer', default: false })
  @IsBoolean()
  leer: boolean;

  @ApiProperty({ description: 'Permiso para actualizar', default: false })
  @IsBoolean()
  actualizar: boolean;

  @ApiProperty({ description: 'Permiso para eliminar', default: false })
  @IsBoolean()
  eliminar: boolean;
} 