import { Controller, Get, Post, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SapHanaService } from './sap-hana.service';
import { SapSyncService, ResultadoSincronizacion } from './sap-sync.service';

@ApiTags('SAP Integration')
@Controller('sap')
export class SapController {
  private readonly logger = new Logger(SapController.name);

  constructor(
    private readonly sapHanaService: SapHanaService,
    private readonly sapSyncService: SapSyncService
  ) {}

  @Get('connection/test')
  @ApiOperation({ summary: 'Probar conexión a SAP HANA B1' })
  @ApiResponse({ status: 200, description: 'Estado de la conexión' })
  async testConnection() {
    try {
      const isConnected = await this.sapHanaService.testConnection();
      return {
        connected: isConnected,
        status: isConnected ? 'Conectado a SAP HANA B1' : 'Sin conexión a SAP HANA B1',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error probando conexión SAP:', error);
      throw new HttpException(
        `Error probando conexión: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('connection/status')
  @ApiOperation({ summary: 'Obtener estado actual de la conexión' })
  @ApiResponse({ status: 200, description: 'Estado de la conexión' })
  async getConnectionStatus() {
    return {
      connected: this.sapHanaService.isConnectionActive(),
      timestamp: new Date().toISOString()
    };
  }

  @Get('connection/config')
  @ApiOperation({ summary: 'Verificar configuración de conexión (sin credenciales)' })
  @ApiResponse({ status: 200, description: 'Configuración de conexión' })
  async getConnectionConfig() {
    const config = this.sapHanaService['configService'];
    return {
      host: config.get<string>('SAP_HANA_HOST'),
      port: config.get<string>('SAP_HANA_PORT'),
      database: config.get<string>('SAP_HANA_DATABASE'),
      username: config.get<string>('SAP_HANA_USERNAME') ? '***SET***' : 'NOT SET',
      password: config.get<string>('SAP_HANA_PASSWORD') ? '***SET***' : 'NOT SET',
      encrypt: config.get<string>('SAP_HANA_ENCRYPT'),
      trustServerCertificate: config.get<string>('SAP_HANA_TRUST_SERVER_CERTIFICATE'),
      syncEnabled: config.get<string>('SAP_SYNC_ENABLED'),
      timestamp: new Date().toISOString()
    };
  }

  @Get('empleados')
  @ApiOperation({ summary: 'Obtener empleados activos de SAP HANA B1' })
  @ApiResponse({ status: 200, description: 'Lista de empleados activos' })
  async getEmpleadosActivos() {
    try {
      const empleados = await this.sapHanaService.obtenerEmpleadosActivos();
      return {
        total: empleados.length,
        empleados,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error obteniendo empleados SAP:', error);
      throw new HttpException(
        `Error obteniendo empleados: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('sedes')
  @ApiOperation({ summary: '🏢 Obtener sedes/sucursales activas de SAP HANA B1 (tabla OUBR)' })
  @ApiResponse({ status: 200, description: 'Lista de sedes activas desde SAP tabla OUBR (Branches)' })
  async getSedesActivas() {
    try {
      const sedes = await this.sapHanaService.obtenerSedesActivas();
      return {
        total: sedes.length,
        sedes,
        timestamp: new Date().toISOString(),
        info: 'Sedes obtenidas desde tabla OUBR (Branches) de SAP B1'
      };
    } catch (error) {
      this.logger.error('Error obteniendo sedes SAP:', error);
      throw new HttpException(
        `Error obteniendo sedes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('areas')
  @ApiOperation({ summary: 'Obtener áreas/departamentos activos de SAP HANA B1' })
  @ApiResponse({ status: 200, description: 'Lista de áreas activas' })
  async getAreasActivas() {
    try {
      const areas = await this.sapHanaService.obtenerAreasActivas();
      return {
        total: areas.length,
        areas,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error obteniendo áreas SAP:', error);
      throw new HttpException(
        `Error obteniendo áreas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('cargos')
  @ApiOperation({ summary: 'Obtener cargos activos de SAP HANA B1' })
  @ApiResponse({ status: 200, description: 'Lista de cargos activos' })
  async getCargosActivos() {
    try {
      const cargos = await this.sapHanaService.obtenerCargosActivos();
      return {
        total: cargos.length,
        cargos,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error obteniendo cargos SAP:', error);
      throw new HttpException(
        `Error obteniendo cargos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('choperas')
  @ApiOperation({ summary: '🍺 Obtener choperas activas de SAP HANA B1 (tabla OITM)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de choperas activas desde SAP tabla OITM (Items) filtradas por descripción "*chop*"'
  })
  async getChoperasActivas() {
    try {
      const choperas = await this.sapHanaService.obtenerChoperasActivas();
      return {
        total: choperas.length,
        choperas,
        timestamp: new Date().toISOString(),
        info: 'Choperas obtenidas desde tabla OITM (Items) de SAP B1 filtradas por descripción que contenga "chop"'
      };
    } catch (error) {
      this.logger.error('Error obteniendo choperas SAP:', error);
      throw new HttpException(
        `Error obteniendo choperas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('sync/completo')
  @ApiOperation({ summary: 'Ejecutar sincronización completa con SAP HANA B1' })
  @ApiResponse({ status: 200, description: 'Resultado de la sincronización' })
  async sincronizarCompleto(): Promise<{
    success: boolean;
    resultado: ResultadoSincronizacion;
    timestamp: string;
  }> {
    try {
      this.logger.log('🚀 Iniciando sincronización completa desde endpoint...');
      
      const resultado = await this.sapSyncService.sincronizarCompleto();
      
      const success = resultado.errores.length === 0;
      
      if (success) {
        this.logger.log('✅ Sincronización completa finalizada exitosamente');
      } else {
        this.logger.warn(`⚠️ Sincronización finalizada con ${resultado.errores.length} errores`);
      }

      return {
        success,
        resultado,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('❌ Error en sincronización completa:', error);
      throw new HttpException(
        `Error en sincronización: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Obtener estadísticas de la última sincronización' })
  @ApiResponse({ status: 200, description: 'Estadísticas de sincronización' })
  async getSyncStatus() {
    try {
      // Obtener estadísticas de usuarios sincronizados
      const usuariosSincronizados = await this.sapHanaService.obtenerEmpleadosActivos();
      const totalUsuarios = usuariosSincronizados.length;

      // Nota: Estos campos requieren regenerar el cliente de Prisma tras la migración
      const usuariosTotal = await this.sapSyncService['prisma'].usuario.count({
        where: { activo: true }
      });

      return {
        totalEmpleadosSAP: totalUsuarios,
        usuariosEnSistema: usuariosTotal,
        estado: 'Configuración de SAP lista - ejecutar migración de Prisma',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Error obteniendo estado de sincronización:', error);
      throw new HttpException(
        `Error obteniendo estado: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 