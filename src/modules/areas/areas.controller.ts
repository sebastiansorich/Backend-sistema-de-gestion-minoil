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
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@ApiTags('areas')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva área' })
  @ApiResponse({ status: 201, description: 'Área creada exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe un área con ese nombre en esta sede' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  create(@Body() createAreaDto: CreateAreaDto) {
    return this.areasService.create(createAreaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las áreas activas' })
  @ApiResponse({ status: 200, description: 'Lista de áreas obtenida exitosamente' })
  findAll() {
    return this.areasService.findAll();
  }

  @Get('sede/:sedeId')
  @ApiOperation({ summary: 'Obtener áreas por sede' })
  @ApiParam({ name: 'sedeId', description: 'ID de la sede' })
  @ApiResponse({ status: 200, description: 'Áreas de la sede obtenidas exitosamente' })
  findBySede(@Param('sedeId', ParseIntPipe) sedeId: number) {
    return this.areasService.findBySede(sedeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un área por ID' })
  @ApiParam({ name: 'id', description: 'ID del área' })
  @ApiResponse({ status: 200, description: 'Área encontrada' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.areasService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un área' })
  @ApiParam({ name: 'id', description: 'ID del área' })
  @ApiResponse({ status: 200, description: 'Área actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe un área con ese nombre en esta sede' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.areasService.update(id, updateAreaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un área (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del área' })
  @ApiResponse({ status: 200, description: 'Área eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.areasService.remove(id);
  }
} 