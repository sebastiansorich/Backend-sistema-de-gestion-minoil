import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, IsOptional, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class RespuestaChecklistDto {
  @ApiPropertyOptional()
  @IsInt()
  itemId: number;

  @ApiPropertyOptional()
  @IsString()
  valor: string;
}

export class RespuestaSensorialDto {
  @ApiPropertyOptional()
  @IsInt()
  grifo: number;

  @ApiPropertyOptional()
  @IsString()
  cerveza: string;

  @ApiPropertyOptional()
  @IsString()
  criterio: string;

  @ApiPropertyOptional()
  @IsString()
  valor: string;
}

export class UpdateMantenimientoDto {
  @ApiPropertyOptional({ example: '2025-07-26' })
  @IsDateString()
  @IsOptional()
  fechaVisita?: string;

  @ApiPropertyOptional({ example: 'CLP03480' })
  @IsString()
  @IsOptional()
  clienteCodigo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  choperaId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  tipoMantenimientoId?: number;

  @ApiPropertyOptional({ example: 'BUENA' })
  @IsString()
  @IsOptional()
  estadoGeneral?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comentarioEstado?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comentarioCalidadCerveza?: string;

  @ApiPropertyOptional({ type: [RespuestaChecklistDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaChecklistDto)
  @ArrayMinSize(1)
  @IsOptional()
  respuestasChecklist?: RespuestaChecklistDto[];

  @ApiPropertyOptional({ type: [RespuestaSensorialDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaSensorialDto)
  @ArrayMinSize(1)
  @IsOptional()
  respuestasSensorial?: RespuestaSensorialDto[];
}
