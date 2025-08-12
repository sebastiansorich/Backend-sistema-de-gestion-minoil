import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ModulosService } from './modulos.service';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';

@ApiTags('modulos')
@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulosService: ModulosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo módulo' })
  @ApiResponse({ status: 201, description: 'Módulo creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe un módulo con ese nombre o ruta' })
  create(@Body() createModuloDto: CreateModuloDto) {
    return this.modulosService.create(createModuloDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los módulos activos' })
  @ApiResponse({ status: 200, description: 'Lista de módulos obtenida exitosamente' })
  findAll() {
    return this.modulosService.findAll();
  }

  @Get('sidebar')
  @ApiOperation({ summary: 'Obtener módulos jerárquicos para sidebar' })
  @ApiResponse({ status: 200, description: 'Estructura jerárquica de módulos para construir sidebar dinámico' })
  findAllForSidebar() {
    return this.modulosService.findAllForSidebar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un módulo por ID' })
  @ApiParam({ name: 'id', description: 'ID del módulo' })
  @ApiResponse({ status: 200, description: 'Módulo encontrado' })
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.modulosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un módulo' })
  @ApiParam({ name: 'id', description: 'ID del módulo' })
  @ApiResponse({ status: 200, description: 'Módulo actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un módulo con ese nombre o ruta' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuloDto: UpdateModuloDto,
  ) {
    return this.modulosService.update(id, updateModuloDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un módulo (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del módulo' })
  @ApiResponse({ status: 200, description: 'Módulo eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.modulosService.remove(id);
  }
} 