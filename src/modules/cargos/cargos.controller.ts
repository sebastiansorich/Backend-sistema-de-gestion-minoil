import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CargosService } from './cargos.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';

@ApiTags('cargos')
@Controller('cargos')
export class CargosController {
  constructor(private readonly cargosService: CargosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo cargo' })
  @ApiResponse({ status: 201, description: 'Cargo creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe un cargo con ese nombre en esta área' })
  @ApiResponse({ status: 404, description: 'Área o cargo superior no encontrado' })
  create(@Body() createCargoDto: CreateCargoDto) {
    return this.cargosService.create(createCargoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los cargos activos' })
  @ApiResponse({ status: 200, description: 'Lista de cargos obtenida exitosamente' })
  findAll() {
    return this.cargosService.findAll();
  }

  @Get('hierarchy')
  @ApiOperation({ summary: 'Obtener jerarquía de cargos' })
  @ApiQuery({ name: 'areaId', required: false, description: 'ID del área para filtrar' })
  @ApiResponse({ status: 200, description: 'Jerarquía de cargos obtenida exitosamente' })
  getHierarchy(@Query('areaId') areaId?: string) {
    const areaIdNumber = areaId ? parseInt(areaId) : undefined;
    return this.cargosService.getHierarchy(areaIdNumber);
  }

  @Get('area/:areaId')
  @ApiOperation({ summary: 'Obtener cargos por área' })
  @ApiParam({ name: 'areaId', description: 'ID del área' })
  @ApiResponse({ status: 200, description: 'Cargos del área obtenidos exitosamente' })
  findByArea(@Param('areaId', ParseIntPipe) areaId: number) {
    return this.cargosService.findByArea(areaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cargo por ID' })
  @ApiParam({ name: 'id', description: 'ID del cargo' })
  @ApiResponse({ status: 200, description: 'Cargo encontrado' })
  @ApiResponse({ status: 404, description: 'Cargo no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cargosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un cargo' })
  @ApiParam({ name: 'id', description: 'ID del cargo' })
  @ApiResponse({ status: 200, description: 'Cargo actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cargo no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un cargo con ese nombre en esta área' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCargoDto: UpdateCargoDto,
  ) {
    return this.cargosService.update(id, updateCargoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cargo (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del cargo' })
  @ApiResponse({ status: 200, description: 'Cargo eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cargo no encontrado' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar el cargo porque tiene usuarios o cargos subordinados' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cargosService.remove(id);
  }
} 