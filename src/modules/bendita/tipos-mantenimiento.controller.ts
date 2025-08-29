import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TiposMantenimientoService } from './tipos-mantenimiento.service';

@ApiTags('bendita/tipos-mantenimiento')
@Controller('bendita/tipos-mantenimiento')
@ApiBearerAuth()
export class TiposMantenimientoController {
  constructor(private readonly tiposMantenimientoService: TiposMantenimientoService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Obtener todos los tipos de mantenimiento',
    description: 'Retorna la lista completa de tipos de mantenimiento disponibles'
  })
  @ApiResponse({ status: 200, description: 'Lista de tipos de mantenimiento obtenida exitosamente' })
  findAll() {
    return this.tiposMantenimientoService.findAll();
  }

  @Get('prioridad/:prioridad')
  @ApiOperation({ 
    summary: 'Obtener tipos de mantenimiento por prioridad',
    description: 'Filtra los tipos de mantenimiento por prioridad (BAJA, MEDIA, ALTA)'
  })
  @ApiResponse({ status: 200, description: 'Tipos de mantenimiento filtrados por prioridad' })
  findByPrioridad(@Param('prioridad') prioridad: string) {
    return this.tiposMantenimientoService.findByPrioridad(prioridad);
  }

  @Get('estadisticas')
  @ApiOperation({ 
    summary: 'Obtener estadísticas de tipos de mantenimiento',
    description: 'Retorna estadísticas generales de los tipos de mantenimiento'
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  getEstadisticas() {
    return this.tiposMantenimientoService.getEstadisticas();
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Obtener un tipo de mantenimiento por ID',
    description: 'Retorna los detalles de un tipo de mantenimiento específico'
  })
  @ApiResponse({ status: 200, description: 'Tipo de mantenimiento encontrado' })
  @ApiResponse({ status: 404, description: 'Tipo de mantenimiento no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tiposMantenimientoService.findOne(id);
  }

  @Post()
  @ApiOperation({ 
    summary: 'Crear un nuevo tipo de mantenimiento',
    description: 'Crea un nuevo tipo de mantenimiento en el sistema'
  })
  @ApiResponse({ status: 201, description: 'Tipo de mantenimiento creado exitosamente' })
  create(@Body() createTipoMantenimientoDto: any) {
    return this.tiposMantenimientoService.create(createTipoMantenimientoDto);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Actualizar un tipo de mantenimiento',
    description: 'Actualiza los datos de un tipo de mantenimiento existente'
  })
  @ApiResponse({ status: 200, description: 'Tipo de mantenimiento actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Tipo de mantenimiento no encontrado' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTipoMantenimientoDto: any) {
    return this.tiposMantenimientoService.update(id, updateTipoMantenimientoDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Eliminar un tipo de mantenimiento',
    description: 'Marca como inactivo un tipo de mantenimiento (eliminación lógica)'
  })
  @ApiResponse({ status: 200, description: 'Tipo de mantenimiento eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Tipo de mantenimiento no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tiposMantenimientoService.remove(id);
  }
}
