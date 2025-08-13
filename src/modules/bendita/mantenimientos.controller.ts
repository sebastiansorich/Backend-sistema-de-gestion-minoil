import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MantenimientosService } from './mantenimientos.service';
import { CreateMantenimientoDto } from './dto/create-mantenimiento.dto.';
import { UpdateMantenimientoDto } from './dto/update-mantenimiento.dto';

@ApiTags('bendita/mantenimientos')
@Controller('bendita/mantenimientos')
@ApiBearerAuth()
export class MantenimientosController {
  constructor(private readonly mantenimientosService: MantenimientosService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nuevo mantenimiento de chopera' })
  @ApiResponse({ status: 201, description: 'Mantenimiento registrado exitosamente' })
  create(@Request() req, @Body() createMantenimientoDto: CreateMantenimientoDto) {
    return this.mantenimientosService.create(createMantenimientoDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los mantenimientos' })
  @ApiResponse({ status: 200, description: 'Lista de mantenimientos obtenida exitosamente' })
  findAll() {
    return this.mantenimientosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un mantenimiento por ID' })
  @ApiResponse({ status: 200, description: 'Mantenimiento encontrado' })
  @ApiResponse({ status: 404, description: 'Mantenimiento no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mantenimientosService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un mantenimiento por ID' })
  @ApiResponse({ status: 200, description: 'Mantenimiento actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Mantenimiento no encontrado' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMantenimientoDto: UpdateMantenimientoDto) {
    return this.mantenimientosService.update(id, updateMantenimientoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un mantenimiento por ID' })
  @ApiResponse({ status: 200, description: 'Mantenimiento eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Mantenimiento no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.mantenimientosService.remove(id);
  }
}