import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, IsOptional, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class RespuestaChecklistDto {
  @ApiProperty({ 
    example: 1, 
    description: 'ID del item del checklist (1-10 para items estándar)',
    enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  })
  @IsInt()
  itemId: number;

  @ApiProperty({ 
    example: 'SI', 
    description: 'Respuesta del checklist',
    enum: ['SI', 'NO', 'N/A', 'EXCELENTE', 'BUENO', 'REGULAR', 'MALO']
  })
  @IsString()
  valor: string;
}

export class RespuestaSensorialDto {
  @ApiProperty({ 
    example: 1, 
    description: 'Número del grifo (1-4 para choperas estándar)',
    enum: [1, 2, 3, 4]
  })
  @IsInt()
  grifo: number;

  @ApiProperty({ 
    example: 'Brahma', 
    description: 'Nombre de la cerveza',
    enum: ['Brahma', 'Corona', 'Heineken', 'Budweiser', 'Quilmes', 'Stella Artois']
  })
  @IsString()
  cerveza: string;

  @ApiProperty({ 
    example: 'Sabor', 
    description: 'Criterio de evaluación sensorial',
    enum: ['Sabor', 'Aroma', 'Temperatura', 'Espuma', 'Claridad', 'Carbonatación']
  })
  @IsString()
  criterio: string;

  @ApiProperty({ 
    example: 'EXCELENTE', 
    description: 'Valoración del criterio',
    enum: ['EXCELENTE', 'BUENO', 'REGULAR', 'MALO', 'N/A']
  })
  @IsString()
  valor: string;
}

export class CreateMantenimientoDto {
  @ApiProperty({ 
    example: 1, 
    description: 'ID del usuario que realiza el mantenimiento',
    minimum: 1
  })
  @IsInt()
  usuarioId: number;

  @ApiProperty({ 
    example: '2024-12-20', 
    description: 'Fecha de la visita de mantenimiento (formato YYYY-MM-DD)',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$'
  })
  @IsDateString()
  fechaVisita: string;

  @ApiProperty({ 
    example: 'CLP03480', 
    description: 'CardCode del cliente en SAP (código del cliente)',
    pattern: '^[A-Z0-9]+$'
  })
  @IsString()
  clienteCodigo: string;

  @ApiProperty({ 
    example: '903050', 
    description: 'ItemCode de la chopera en SAP (código del artículo)',
    pattern: '^[A-Z0-9]+$'
  })
  @IsString()
  itemCode: string;

  @ApiProperty({ 
    example: 'UPP2092208M', 
    description: 'Serie/Activo de la chopera (número de serie del equipo)',
    pattern: '^[A-Z0-9]+$'
  })
  @IsString()
  choperaCode: string;

  @ApiProperty({ 
    example: 1, 
    description: 'ID del tipo de mantenimiento (consulta GET /bendita/tipos-mantenimiento para ver los disponibles)',
    enum: [1, 2, 3, 4, 5]
  })
  @IsInt()
  tipoMantenimientoId: number;

  @ApiPropertyOptional({ 
    example: 'BUENO', 
    description: 'Estado general del equipo después del mantenimiento',
    enum: ['EXCELENTE', 'BUENO', 'REGULAR', 'MALO', 'CRITICO']
  })
  @IsString()
  @IsOptional()
  estadoGeneral?: string;

  @ApiPropertyOptional({ 
    example: 'Equipo funcionando correctamente, se realizó limpieza general y ajuste de temperatura',
    description: 'Comentarios sobre el estado del equipo'
  })
  @IsString()
  @IsOptional()
  comentarioEstado?: string;

  @ApiPropertyOptional({ 
    example: 'Cerveza con excelente calidad, temperatura óptima y espuma consistente',
    description: 'Comentarios sobre la calidad de la cerveza'
  })
  @IsString()
  @IsOptional()
  comentarioCalidadCerveza?: string;

  @ApiProperty({ 
    type: [RespuestaChecklistDto],
    description: 'Respuestas del checklist de mantenimiento (mínimo 1)',
    example: [
      {
        itemId: 1,
        valor: 'SI'
      },
      {
        itemId: 2,
        valor: 'SI'
      },
      {
        itemId: 3,
        valor: 'NO'
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaChecklistDto)
  @ArrayMinSize(1)
  respuestasChecklist: RespuestaChecklistDto[];

  @ApiProperty({ 
    type: [RespuestaSensorialDto],
    description: 'Respuestas de evaluación sensorial (mínimo 1)',
    example: [
      {
        grifo: 1,
        cerveza: 'Brahma',
        criterio: 'Sabor',
        valor: 'EXCELENTE'
      },
      {
        grifo: 1,
        cerveza: 'Brahma',
        criterio: 'Temperatura',
        valor: 'BUENO'
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaSensorialDto)
  @ArrayMinSize(1)
  respuestasSensorial: RespuestaSensorialDto[];
}