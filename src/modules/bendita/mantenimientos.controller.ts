import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, ParseIntPipe, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MantenimientosService } from './mantenimientos.service';
import { CreateMantenimientoDto } from './dto/create-mantenimiento.dto.';
import { UpdateMantenimientoDto } from './dto/update-mantenimiento.dto';
import { SapHanaService } from '../sap/sap-hana.service';

@ApiTags('bendita/mantenimientos')
@Controller('bendita/mantenimientos')
@ApiBearerAuth()
export class MantenimientosController {
  constructor(private readonly mantenimientosService: MantenimientosService, private readonly sapHanaService: SapHanaService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Registrar nuevo mantenimiento de chopera',
    description: 'Crea un nuevo registro de mantenimiento para una chopera específica con checklist y evaluación sensorial. El mantenimiento debe estar asignado a un usuario válido existente en el sistema.'
  })
  @ApiResponse({ status: 201, description: 'Mantenimiento registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos, fecha futura o usuario inválido' })
  @ApiResponse({ status: 404, description: 'Usuario o chopera no encontrado en el sistema' })
  async create(@Request() req, @Body() createMantenimientoDto: CreateMantenimientoDto) {
    try {
      console.log('🎯 Controlador: Iniciando creación de mantenimiento');
      
      // Usar el usuario ID del DTO
      const usuarioId = createMantenimientoDto.usuarioId;
      console.log('👤 Controlador: Usando usuario ID:', usuarioId);
      
      return this.mantenimientosService.create(createMantenimientoDto, usuarioId);
    } catch (error) {
      console.log('❌ Controlador: Error:', error.message);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ 
    summary: 'Obtener todos los mantenimientos',
    description: 'Retorna la lista completa de mantenimientos registrados en el sistema'
  })
  @ApiResponse({ status: 200, description: 'Lista de mantenimientos obtenida exitosamente' })
  findAll() {
    return this.mantenimientosService.findAll();
  }

  @Get('chopera/:itemCode')
  @ApiOperation({ 
    summary: 'Obtener mantenimientos por chopera',
    description: 'Filtra los mantenimientos por el ItemCode de la chopera específica'
  })
  @ApiResponse({ status: 200, description: 'Mantenimientos de la chopera obtenidos exitosamente' })
  findByChopera(@Param('itemCode') itemCode: string) {
    return this.mantenimientosService.findByChopera(itemCode);
  }

  @Get('usuario/:usuarioId')
  @ApiOperation({ 
    summary: 'Obtener mantenimientos por usuario',
    description: 'Filtra los mantenimientos por el ID del usuario que los realizó'
  })
  @ApiResponse({ status: 200, description: 'Mantenimientos del usuario obtenidos exitosamente' })
  findByUsuario(@Param('usuarioId', ParseIntPipe) usuarioId: number) {
    return this.mantenimientosService.findByUsuario(usuarioId);
  }

  @Get('fecha')
  @ApiOperation({ 
    summary: 'Obtener mantenimientos por rango de fechas',
    description: 'Filtra los mantenimientos por un rango de fechas específico'
  })
  @ApiQuery({ name: 'fechaInicio', description: 'Fecha de inicio (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'fechaFin', description: 'Fecha de fin (YYYY-MM-DD)', example: '2024-12-31' })
  @ApiResponse({ status: 200, description: 'Mantenimientos del rango de fechas obtenidos exitosamente' })
  findByFecha(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string
  ) {
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);
    return this.mantenimientosService.findByFecha(fechaInicioDate, fechaFinDate);
  }

  @Get('estadisticas')
  @ApiOperation({ 
    summary: 'Obtener estadísticas de mantenimientos',
    description: 'Retorna estadísticas generales de los mantenimientos registrados'
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async getEstadisticas() {
    const mantenimientos = await this.mantenimientosService.findAll();
    
    const total = mantenimientos.length;
    const porEstado = mantenimientos.reduce((acc, m) => {
      acc[m.estadoGeneral] = (acc[m.estadoGeneral] || 0) + 1;
      return acc;
    }, {});

    const porTipo = mantenimientos.reduce((acc, m) => {
      const tipo = m.tipoMantenimiento?.nombre || 'Sin tipo';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});

    const ultimoMes = mantenimientos.filter(m => {
      const fecha = new Date(m.fechaVisita);
      const unMesAtras = new Date();
      unMesAtras.setMonth(unMesAtras.getMonth() - 1);
      return fecha >= unMesAtras;
    }).length;

    return {
      total,
      porEstado,
      porTipo,
      ultimoMes,
      promedioPorMes: total > 0 ? Math.round(total / 12) : 0
    };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Obtener un mantenimiento por ID',
    description: 'Retorna los detalles completos de un mantenimiento específico'
  })
  @ApiResponse({ status: 200, description: 'Mantenimiento encontrado' })
  @ApiResponse({ status: 404, description: 'Mantenimiento no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mantenimientosService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Actualizar un mantenimiento por ID',
    description: 'Actualiza los datos de un mantenimiento existente'
  })
  @ApiResponse({ status: 200, description: 'Mantenimiento actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o fecha futura' })
  @ApiResponse({ status: 404, description: 'Mantenimiento no encontrado' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMantenimientoDto: UpdateMantenimientoDto) {
    return this.mantenimientosService.update(id, updateMantenimientoDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Eliminar un mantenimiento por ID',
    description: 'Elimina permanentemente un mantenimiento del sistema'
  })
  @ApiResponse({ status: 200, description: 'Mantenimiento eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Mantenimiento no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.mantenimientosService.remove(id);
  }
}