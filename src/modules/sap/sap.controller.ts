import { Controller, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SapHanaService } from './sap-hana.service';
import { SapSyncService } from './sap-sync.service';
import { LdapService } from '../auth/ldap.service';

@ApiTags('SAP')
@Controller('sap')
export class SapController {
  constructor(
    private readonly sapHanaService: SapHanaService,
    private readonly sapSyncService: SapSyncService,
    private readonly ldapService: LdapService,
  ) {}

  @Post('sincronizar-usuarios')
  @ApiOperation({ summary: 'Sincronizar usuarios con empleados de SAP' })
  @ApiResponse({ status: 200, description: 'Sincronización completada exitosamente' })
  @ApiResponse({ status: 500, description: 'Error en la sincronización' })
  async sincronizarUsuarios() {
    try {
      const resultado = await this.sapSyncService.sincronizarUsuariosCompleto({
        soloActivos: true,
        validarLDAP: false
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

  @Post('sincronizar-ldap-sap')
  @ApiOperation({ summary: 'Sincronizar usuarios con LDAP y SAP para autenticación (estructura simplificada)' })
  @ApiResponse({ status: 200, description: 'Sincronización completada exitosamente' })
  @ApiResponse({ status: 500, description: 'Error en la sincronización' })
  async sincronizarLdapSap() {
    try {
      const resultado = await this.sapSyncService.sincronizarUsuariosUnificado();
      return resultado;
    } catch (error) {
      return {
        success: false,
        message: 'Error en la sincronización LDAP + SAP',
        error: error.message
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