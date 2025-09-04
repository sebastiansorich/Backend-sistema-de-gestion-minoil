import { Controller, Post, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SapHanaService } from './sap-hana.service';
import { SapSyncService } from './sap-sync.service';
import { LdapService } from '../auth/ldap.service';

@ApiTags('SAP')
@Controller('sap')
export class SapController {
  private readonly logger = new Logger(SapController.name);

  constructor(
    private readonly sapHanaService: SapHanaService,
    private readonly sapSyncService: SapSyncService,
    private readonly ldapService: LdapService,
  ) {}

  @Post('sincronizar-usuarios')
  @ApiOperation({ summary: 'Sincronizar usuarios con empleados de SAP y LDAP' })
  @ApiResponse({ status: 200, description: 'Sincronización completada exitosamente' })
  @ApiResponse({ status: 500, description: 'Error en la sincronización' })
  async sincronizarUsuarios() {
    try {
      const resultado = await this.sapSyncService.sincronizarUsuarios({
        soloActivos: true,
        forzarSincronizacion: false
      });
      return resultado;
    } catch (error) {
      return {
        success: false,
        message: 'Error en la sincronización',
        error: error.message
      };
    }
  }

  @Get('usuarios-ldap')
  @ApiOperation({ summary: 'Obtener usuarios de LDAP para debugging' })
  @ApiResponse({ status: 200, description: 'Usuarios LDAP obtenidos exitosamente' })
  @ApiResponse({ status: 500, description: 'Error al obtener usuarios LDAP' })
  async obtenerUsuariosLDAP() {
    try {
      this.logger.log('🔍 Endpoint de debug: Obteniendo usuarios LDAP...');
      
      const usuarios = await this.ldapService.searchAllUsers();
      
      return {
        success: true,
        message: 'Usuarios LDAP obtenidos exitosamente',
        data: {
          total: usuarios.length,
          usuarios: usuarios.map(u => ({
            username: u.username,
            email: u.email,
            nombre: u.nombre,
            apellido: u.apellido,
            displayName: u.displayName,
            department: u.department,
            office: u.office,
            title: u.title,
            groups: u.groups
          }))
        },
        debug: {
          timestamp: new Date().toISOString(),
          endpoint: '/sap/usuarios-ldap',
          ldapConfig: {
            url: process.env.LDAP_URL || 'ldap://SRVDC.main.minoil.com.bo:389',
            baseDN: process.env.LDAP_BASE_DN || 'DC=main,DC=minoil,DC=com,DC=bo'
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener usuarios LDAP',
        error: error.message,
        debug: {
          timestamp: new Date().toISOString(),
          endpoint: '/sap/usuarios-ldap',
          ldapConfig: {
            url: process.env.LDAP_URL || 'ldap://SRVDC.main.minoil.com.bo:389',
            baseDN: process.env.LDAP_BASE_DN || 'DC=main,DC=minoil,DC=com,DC=bo'
          }
        }
      };
    }
  }

  @Get('empleados-sap')
  @ApiOperation({ summary: 'Obtener todos los empleados de SAP para debugging' })
  @ApiResponse({ status: 200, description: 'Datos de empleados SAP obtenidos exitosamente' })
  @ApiResponse({ status: 500, description: 'Error al obtener datos de SAP' })
  async obtenerEmpleadosSAP() {
    try {
      this.logger.log('🔍 Endpoint de debug: Obteniendo datos de empleados SAP...');
      
      const empleados = await this.sapHanaService.obtenerEmpleadosActivos();
      
      return {
        success: true,
        message: 'Datos de empleados SAP obtenidos exitosamente',
        data: {
          total: empleados.length,
          empleados: empleados
        },
        debug: {
          timestamp: new Date().toISOString(),
          endpoint: '/sap/empleados-sap',
          camposDisponibles: empleados.length > 0 ? Object.keys(empleados[0]) : []
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener datos de SAP',
        error: error.message,
        debug: {
          timestamp: new Date().toISOString(),
          endpoint: '/sap/empleados-sap'
        }
      };
    }
  }

  @Get('socios-negocio')
  @ApiOperation({ summary: 'Obtener todos los socios de negocio desde SAP Business One' })
  @ApiResponse({ status: 200, description: 'Lista de socios de negocio obtenida exitosamente' })
  @ApiResponse({ status: 500, description: 'Error al obtener socios de negocio' })
  async obtenerSociosNegocio() {
    try {
      const socios = await this.sapHanaService.obtenerSociosNegocio();
      return {
        success: true,
        message: 'Socios de negocio obtenidos exitosamente',
        data: {
          total: socios.length,
          socios: socios
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener socios de negocio',
        error: error.message
      };
    }
  }
} 