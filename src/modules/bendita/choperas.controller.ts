import { Controller, Get, Post, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ChoperasService } from './choperas.service';

@ApiTags('bendita/choperas')
@Controller('bendita/choperas')
@ApiBearerAuth()
export class ChoperasController {
  constructor(private readonly choperasService: ChoperasService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Obtener todas las choperas',
    description: 'Retorna la lista completa de choperas desde SAP Business One'
  })
  @ApiResponse({ status: 200, description: 'Lista de choperas obtenida exitosamente' })
  @ApiResponse({ status: 500, description: 'Error al obtener choperas' })
  async findAll() {
    try {
      const choperas = await this.choperasService.obtenerTodas();
      
      return {
        success: true,
        data: choperas,
        total: choperas.length,
        message: 'Choperas obtenidas exitosamente desde SAP'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener choperas desde SAP'
      };
    }
  }

  @Get('activas')
  @ApiOperation({ 
    summary: 'Obtener choperas activas',
    description: 'Retorna solo las choperas que están en estado activo/operativo'
  })
  @ApiResponse({ status: 200, description: 'Choperas activas obtenidas exitosamente' })
  async findActivas() {
    try {
      const choperas = await this.choperasService.filtrarPorEstado('Minoil');
      
      return {
        success: true,
        data: choperas,
        total: choperas.length,
        message: 'Choperas activas obtenidas exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener choperas activas'
      };
    }
  }

  @Get('ubicacion/:ubicacion')
  @ApiOperation({ 
    summary: 'Obtener choperas por ubicación',
    description: 'Filtra las choperas por ubicación específica'
  })
  @ApiResponse({ status: 200, description: 'Choperas de la ubicación obtenidas exitosamente' })
  async findByUbicacion(@Param('ubicacion') ubicacion: string) {
    try {
      const choperas = await this.choperasService.filtrarPorUbicacion(ubicacion);
      
      return {
        success: true,
        data: choperas,
        total: choperas.length,
        ubicacion,
        message: `Choperas filtradas por ubicación: ${ubicacion}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener choperas por ubicación'
      };
    }
  }

  @Get('estado/:estado')
  @ApiOperation({ 
    summary: 'Obtener choperas por estado',
    description: 'Filtra las choperas por estado específico (Operativa, Mantenimiento, Fuera de servicio, etc.)'
  })
  @ApiResponse({ status: 200, description: 'Choperas del estado obtenidas exitosamente' })
  async findByEstado(@Param('estado') estado: string) {
    try {
      const choperas = await this.choperasService.filtrarPorEstado(estado);
      
      return {
        success: true,
        data: choperas,
        total: choperas.length,
        estado,
        message: `Choperas filtradas por estado: ${estado}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener choperas por estado'
      };
    }
  }

  @Get('fabricante/:fabricante')
  @ApiOperation({ 
    summary: 'Obtener choperas por fabricante',
    description: 'Filtra las choperas por fabricante específico'
  })
  @ApiResponse({ status: 200, description: 'Choperas del fabricante obtenidas exitosamente' })
  async findByFabricante(@Param('fabricante') fabricante: string) {
    try {
      const choperas = await this.choperasService.filtrarPorFabricante(fabricante);
      
      return {
        success: true,
        data: choperas,
        total: choperas.length,
        fabricante,
        message: `Choperas filtradas por fabricante: ${fabricante}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener choperas por fabricante'
      };
    }
  }

  @Get('buscar')
  @ApiOperation({ 
    summary: 'Buscar choperas por término',
    description: 'Busca choperas que coincidan con el término de búsqueda en nombre, código o descripción'
  })
  @ApiQuery({ name: 'termino', description: 'Término de búsqueda', example: 'brahma' })
  @ApiResponse({ status: 200, description: 'Resultados de búsqueda obtenidos exitosamente' })
  async buscar(@Query('termino') termino: string) {
    try {
      const choperas = await this.choperasService.buscar(termino);
      
      return {
        success: true,
        data: choperas,
        total: choperas.length,
        termino,
        message: `Resultados de búsqueda para: ${termino}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al buscar choperas'
      };
    }
  }

  @Get('estadisticas')
  @ApiOperation({ 
    summary: 'Obtener estadísticas de choperas',
    description: 'Retorna estadísticas generales de las choperas disponibles'
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async getEstadisticas() {
    try {
      const estadisticas = await this.choperasService.obtenerEstadisticas();
      
      return {
        success: true,
        data: estadisticas,
        message: 'Estadísticas de choperas obtenidas exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener estadísticas'
      };
    }
  }

  @Get('codigo/:itemCode')
  @ApiOperation({ 
    summary: 'Obtener una chopera por código de SAP',
    description: 'Retorna los detalles completos de una chopera específica por su código de SAP'
  })
  @ApiResponse({ status: 200, description: 'Chopera encontrada' })
  @ApiResponse({ status: 404, description: 'Chopera no encontrada' })
  async findByItemCode(@Param('itemCode') itemCode: string) {
    try {
      const chopera = await this.choperasService.obtenerPorItemCode(itemCode);
      
      if (!chopera) {
        return {
          success: false,
          error: 'Chopera no encontrada',
          message: `Chopera con código ${itemCode} no encontrada`
        };
      }
      
      return {
        success: true,
        data: chopera,
        message: 'Chopera encontrada exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener chopera'
      };
    }
  }
}
