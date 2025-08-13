import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, IsOptional, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class RespuestaChecklistDto {
  @ApiProperty()
  @IsInt()
  itemId: number;

  @ApiProperty()
  @IsString()
  valor: string;
}

export class RespuestaSensorialDto {
  @ApiProperty()
  @IsInt()
  grifo: number;

  @ApiProperty()
  @IsString()
  cerveza: string;

  @ApiProperty()
  @IsString()
  criterio: string;

  @ApiProperty()
  @IsString()
  valor: string;
}

export class CreateMantenimientoDto {
  @ApiProperty({ example: '2025-07-26' })
  @IsDateString()
  fechaVisita: string;

  @ApiProperty({ example: 'CLP03480' })
  @IsString()
  clienteCodigo: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  choperaId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  tipoMantenimientoId: number;

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

  @ApiProperty({ type: [RespuestaChecklistDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaChecklistDto)
  @ArrayMinSize(1)
  respuestasChecklist: RespuestaChecklistDto[];

  @ApiProperty({ type: [RespuestaSensorialDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaSensorialDto)
  @ArrayMinSize(1)
  respuestasSensorial: RespuestaSensorialDto[];
}