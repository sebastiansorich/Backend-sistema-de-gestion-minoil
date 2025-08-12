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
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@ApiTags('sedes')
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva sede' })
  @ApiResponse({ status: 201, description: 'Sede creada exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe una sede con ese nombre' })
  create(@Body() createSedeDto: CreateSedeDto) {
    return this.sedesService.create(createSedeDto);
  }

  @Post('inicializar')
  @ApiOperation({ summary: '🚀 Crear sedes iniciales necesarias para sincronización SAP' })
  @ApiResponse({ status: 201, description: 'Sedes iniciales creadas exitosamente' })
  async crearSedesIniciales() {
    return this.sedesService.crearSedesIniciales();
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las sedes activas' })
  @ApiResponse({ status: 200, description: 'Lista de sedes obtenida exitosamente' })
  findAll() {
    return this.sedesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una sede por ID' })
  @ApiParam({ name: 'id', description: 'ID de la sede' })
  @ApiResponse({ status: 200, description: 'Sede encontrada' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sedesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sede' })
  @ApiParam({ name: 'id', description: 'ID de la sede' })
  @ApiResponse({ status: 200, description: 'Sede actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe una sede con ese nombre' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSedeDto: UpdateSedeDto,
  ) {
    return this.sedesService.update(id, updateSedeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sede (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID de la sede' })
  @ApiResponse({ status: 200, description: 'Sede eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sedesService.remove(id);
  }
} 