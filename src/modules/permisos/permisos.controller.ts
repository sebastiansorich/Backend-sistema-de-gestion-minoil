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
import { PermisosService } from './permisos.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';

@ApiTags('permisos')
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo permiso' })
  @ApiResponse({ status: 201, description: 'Permiso creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe un permiso para este rol y módulo' })
  @ApiResponse({ status: 404, description: 'Rol o módulo no encontrado' })
  create(@Body() createPermisoDto: CreatePermisoDto) {
    return this.permisosService.create(createPermisoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los permisos' })
  @ApiResponse({ status: 200, description: 'Lista de permisos obtenida exitosamente' })
  findAll() {
    return this.permisosService.findAll();
  }

  @Get('rol/:rolId')
  @ApiOperation({ summary: 'Obtener permisos por rol' })
  @ApiParam({ name: 'rolId', description: 'ID del rol' })
  @ApiResponse({ status: 200, description: 'Permisos del rol obtenidos exitosamente' })
  findByRol(@Param('rolId', ParseIntPipe) rolId: number) {
    return this.permisosService.findByRol(rolId);
  }

  @Get('modulo/:moduloId')
  @ApiOperation({ summary: 'Obtener permisos por módulo' })
  @ApiParam({ name: 'moduloId', description: 'ID del módulo' })
  @ApiResponse({ status: 200, description: 'Permisos del módulo obtenidos exitosamente' })
  findByModulo(@Param('moduloId', ParseIntPipe) moduloId: number) {
    return this.permisosService.findByModulo(moduloId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un permiso por ID' })
  @ApiParam({ name: 'id', description: 'ID del permiso' })
  @ApiResponse({ status: 200, description: 'Permiso encontrado' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permisosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  @ApiParam({ name: 'id', description: 'ID del permiso' })
  @ApiResponse({ status: 200, description: 'Permiso actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un permiso para este rol y módulo' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermisoDto: UpdatePermisoDto,
  ) {
    return this.permisosService.update(id, updatePermisoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un permiso' })
  @ApiParam({ name: 'id', description: 'ID del permiso' })
  @ApiResponse({ status: 200, description: 'Permiso eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.permisosService.remove(id);
  }
} 