import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmpleadoSAP {
  ID_Empleado: number;
  Nombre_Completo: string;
  Cargo: string;
  ID_Area: number;
  Nombre_Area: string;
  ID_Jefe_Inmediato: number | null;
  Nombre_Jefe: string | null;
  Activo: string; // 'Y' o 'N' en SAP
  // 🆕 Campo workCity para mapeo manual de sedes (1-4)
  workCity: number; // Sede ID determinado por el procedimiento SAP
}

export interface SedeSAP {
  ID_Sede: number | string;
  Nombre_Sede: string;
  Codigo_Sede?: string;
  Direccion?: string;
  Ciudad?: string;
  Telefono?: string;
  Email?: string;
  Activo: string;
}

export interface ChoperaSAP {
  ItemCode: string;
  ItemName: string;
  ItemType: string;
  ItmsGrpCod: number;
  ItmsGrpNam: string;
  QryGroup1: string; // Y/N - Activo
  InvntItem: string; // Y/N - Item de inventario
  SellItem: string; // Y/N - Item de venta
  PrchseItem: string; // Y/N - Item de compra
  SalUnitMsr: string; // Unidad de medida venta
  PurUnitMsr: string; // Unidad de medida compra
  InvntryUom: string; // Unidad de medida inventario
  LastPurPrc: number; // Último precio de compra
  AvgPrice: number; // Precio promedio
  FirmCode: number; // Código fabricante
  FirmName: string; // Nombre fabricante
  U_Ubicacion?: string; // Campo definido por usuario - ubicación
  U_Estado?: string; // Campo definido por usuario - estado
  CreateDate: string; // Fecha de creación
  UpdateDate: string; // Fecha de actualización
}

@Injectable()
export class SapHanaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SapHanaService.name);
  private connection: any;
  private isConnected = false;
  private hana: any;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    if (this.configService.get<string>('SAP_SYNC_ENABLED') === 'true') {
      // Importar dinámicamente el driver
      try {
        this.hana = await import('@sap/hana-client');
        await this.connect();
      } catch (error) {
        this.logger.error('Error cargando driver SAP HANA:', error);
        this.logger.warn('⚠️ Driver @sap/hana-client no instalado - usando modo simulación');
      }
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    if (!this.hana) {
      throw new Error('Driver SAP HANA no disponible');
    }

    try {
      const connectionConfig = {
        serverNode: `${this.configService.get<string>('SAP_HANA_HOST')}:${this.configService.get<string>('SAP_HANA_PORT')}`,
        databaseName: this.configService.get<string>('SAP_HANA_DATABASE'),
        uid: this.configService.get<string>('SAP_HANA_USERNAME'),
        pwd: this.configService.get<string>('SAP_HANA_PASSWORD'),
        encrypt: this.configService.get<string>('SAP_HANA_ENCRYPT') === 'true',
        sslValidateCertificate: this.configService.get<string>('SAP_HANA_TRUST_SERVER_CERTIFICATE') !== 'true',
      };

      this.logger.log(`🔧 Intentando conectar a SAP HANA: ${connectionConfig.serverNode}/${connectionConfig.databaseName}`);
      this.logger.log(`🔐 Usuario: ${connectionConfig.uid}, Encrypt: ${connectionConfig.encrypt}`);

      this.connection = this.hana.createConnection();
      
      await new Promise<void>((resolve, reject) => {
        this.connection.connect(connectionConfig, (err: any) => {
          if (err) {
            this.logger.error('Error conectando a SAP HANA:', err);
            reject(err);
          } else {
            this.isConnected = true;
            this.logger.log('✅ Conectado exitosamente a SAP HANA B1');
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Error en conexión SAP HANA:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await new Promise<void>((resolve) => {
          this.connection.disconnect((err: any) => {
            if (err) {
              this.logger.warn('Warning al desconectar SAP HANA:', err);
            }
            this.isConnected = false;
            this.logger.log('🔌 Desconectado de SAP HANA B1');
            resolve();
          });
        });
      } catch (error) {
        this.logger.error('Error desconectando SAP HANA:', error);
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.hana) {
        this.logger.warn('⚠️ Driver SAP HANA no disponible - modo simulación');
        return false;
      }

      if (!this.isConnected) {
        await this.connect();
      }
      
      const result = await this.executeQuery('SELECT 1 FROM DUMMY');
      return result && result.length > 0;
    } catch (error) {
      this.logger.error('Error en test de conexión:', error);
      return false;
    }
  }

  private async executeQuery(query: string, params?: any[]): Promise<any[]> {
    if (!this.isConnected || !this.connection) {
      throw new Error('No hay conexión a SAP HANA');
    }

    return new Promise((resolve, reject) => {
      this.connection.exec(query, params || [], (err: any, results: any[]) => {
        if (err) {
          this.logger.error('Error ejecutando query:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

  /**
   * Obtiene todos los empleados activos de SAP HANA B1
   */
  async obtenerEmpleadosActivos(): Promise<EmpleadoSAP[]> {
    if (!this.hana) {
      this.logger.warn('⚠️ Modo simulación - devolviendo datos de prueba');
      return [
        {
          ID_Empleado: 580,
          Nombre_Completo: 'Dorian Aguilar',
          Cargo: 'Desarrollador',
          ID_Area: -2,
          Nombre_Area: 'Administracion',
          ID_Jefe_Inmediato: null,
          Nombre_Jefe: null,
          Activo: 'Y',
          workCity: 1 // Santa Cruz
        },
        {
          ID_Empleado: 254,
          Nombre_Completo: 'Abdon Quispe',
          Cargo: 'Encargado Mantenim.',
          ID_Area: -2,
          Nombre_Area: 'Administracion',
          ID_Jefe_Inmediato: 248,
          Nombre_Jefe: 'Hector Poroma',
          Activo: 'Y',
          workCity: 2 // La Paz
        }
      ];
    }

    try {
      // Usar el procedimiento almacenado creado
      const query = 'CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()';

      this.logger.log('📊 Ejecutando procedimiento almacenado SP_OBTENER_DATOS_COMPLETOS_MINOIL...');
      const results = await this.executeQuery(query);
      
      this.logger.log(`✅ Obtenidos ${results.length} empleados activos de SAP`);
      return results.map(row => ({
        ID_Empleado: row.ID_Empleado,
        Nombre_Completo: row.Nombre_Completo?.trim() || '',
        Cargo: row.Cargo?.trim() || '',
        ID_Area: row.ID_Area,
        Nombre_Area: row.Nombre_Area?.trim() || '',
        ID_Jefe_Inmediato: row.ID_Jefe_Inmediato || null,
        Nombre_Jefe: row.Nombre_Jefe?.trim() || null,
        Activo: row.Activo || 'Y',
        workCity: row.workCity || 1 // Default a Santa Cruz si no viene el campo
      }));

    } catch (error) {
      this.logger.error('Error obteniendo empleados de SAP:', error);
      throw error;
    }
  }

  /**
   * Obtiene un empleado específico por ID
   */
  async obtenerEmpleadoPorId(empleadoId: number): Promise<EmpleadoSAP | null> {
    if (!this.hana) {
      this.logger.warn('⚠️ Modo simulación - devolviendo null');
      return null;
    }

    try {
      // Usar el procedimiento almacenado y filtrar por ID
      const query = 'CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()';

      const results = await this.executeQuery(query);
      
      // Buscar el empleado específico
      const empleado = results.find(row => row.ID_Empleado === empleadoId);
      
      if (!empleado) {
        this.logger.log(`❌ Empleado ${empleadoId} no encontrado en SAP`);
        return null;
      }

      this.logger.log(`✅ Empleado ${empleadoId} encontrado: ${empleado.Nombre_Completo}`);
      return {
        ID_Empleado: empleado.ID_Empleado,
        Nombre_Completo: empleado.Nombre_Completo?.trim() || '',
        Cargo: empleado.Cargo?.trim() || '',
        ID_Area: empleado.ID_Area,
        Nombre_Area: empleado.Nombre_Area?.trim() || '',
        ID_Jefe_Inmediato: empleado.ID_Jefe_Inmediato || null,
        Nombre_Jefe: empleado.Nombre_Jefe?.trim() || null,
        Activo: empleado.Activo || 'Y',
        workCity: empleado.workCity || 1 // Default a Santa Cruz si no viene el campo
      };

    } catch (error) {
      this.logger.error(`Error obteniendo empleado ${empleadoId} de SAP:`, error);
      throw error;
    }
  }

  /**
   * Obtiene las áreas/departamentos activos
   */
  async obtenerAreasActivas(): Promise<{ ID_Area: number; Nombre_Area: string }[]> {
    if (!this.hana) {
      this.logger.warn('⚠️ Modo simulación - devolviendo datos de prueba');
      return [
        { ID_Area: -2, Nombre_Area: 'Administracion' },
        { ID_Area: -1, Nombre_Area: 'Ventas' }
      ];
    }

    try {
      // Usar el mismo procedimiento almacenado y extraer áreas únicas
      const query = 'CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()';

      this.logger.log('🏢 Obteniendo áreas activas desde procedimiento almacenado...');
      const results = await this.executeQuery(query);
      
      // Extraer áreas únicas
      const areasMap = new Map();
      results.forEach(row => {
        if (row.ID_Area && row.Nombre_Area && !areasMap.has(row.ID_Area)) {
          areasMap.set(row.ID_Area, {
            ID_Area: row.ID_Area,
            Nombre_Area: row.Nombre_Area.trim()
          });
        }
      });
      
      const areasUnicas = Array.from(areasMap.values());
      this.logger.log(`✅ Obtenidas ${areasUnicas.length} áreas únicas de SAP`);
      
      return areasUnicas;

    } catch (error) {
      this.logger.error('Error obteniendo áreas de SAP:', error);
      throw error;
    }
  }

  /**
   * Obtiene los cargos/posiciones activos
   */
  async obtenerCargosActivos(): Promise<{ posID: number; name: string }[]> {
    if (!this.hana) {
      this.logger.warn('⚠️ Modo simulación - devolviendo datos de prueba');
      return [
        { posID: 1, name: 'Desarrollador' },
        { posID: 2, name: 'Encargado Mantenim.' }
      ];
    }

    try {
      // Usar el mismo procedimiento almacenado y extraer cargos únicos
      const query = 'CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()';

      this.logger.log('👔 Obteniendo cargos activos desde procedimiento almacenado...');
      const results = await this.executeQuery(query);
      
      // Extraer cargos únicos
      const cargosMap = new Map();
      let cargoId = 1; // Generar IDs secuenciales para cargos
      
      results.forEach(row => {
        if (row.Cargo && row.Cargo.trim() !== 'SIN CARGO' && !cargosMap.has(row.Cargo.trim())) {
          cargosMap.set(row.Cargo.trim(), {
            posID: cargoId++,
            name: row.Cargo.trim()
          });
        }
      });
      
      const cargosUnicos = Array.from(cargosMap.values());
      this.logger.log(`✅ Obtenidos ${cargosUnicos.length} cargos únicos de SAP`);
      
      return cargosUnicos;

    } catch (error) {
      this.logger.error('Error obteniendo cargos de SAP:', error);
      throw error;
    }
  }

  /**
   * 🆕 Obtiene las sedes/sucursales activas desde SAP
   */
  async obtenerSedesActivas(): Promise<SedeSAP[]> {
    if (!this.hana) {
      this.logger.warn('⚠️ Modo simulación - devolviendo datos de prueba para sedes');
      return [
        {
          ID_Sede: 'CENTRAL',
          Nombre_Sede: 'Sede Central',
          Codigo_Sede: 'SCZ-001',
          Direccion: 'Av. Principal 123, Santa Cruz',
          Ciudad: 'Santa Cruz',
          Telefono: '+591-3-123-4567',
          Email: 'central@minoil.com.bo',
          Activo: 'Y'
        },
        {
          ID_Sede: 'LAPAZ',
          Nombre_Sede: 'Sucursal La Paz',
          Codigo_Sede: 'LPZ-001', 
          Direccion: 'Av. 16 de Julio 456, La Paz',
          Ciudad: 'La Paz',
          Telefono: '+591-2-123-4567',
          Email: 'lapaz@minoil.com.bo',
          Activo: 'Y'
        }
      ];
    }

    try {
      // Consulta directa a tabla de Branches de SAP B1 
      const query = `
        SELECT 
          "Code" as ID_Sede,
          "Name" as Nombre_Sede,
          "Code" as Codigo_Sede,
          "Street" as Direccion,
          "City" as Ciudad,
          "Phone1" as Telefono,
          "E_Mail" as Email,
          'Y' as Activo
        FROM "OUBR" 
        ORDER BY "Name"
      `;

      this.logger.log('🏢 Obteniendo sedes activas desde tabla OUBR (Branches)...');
      const results = await this.executeQuery(query);
      
      const sedes = results.map(row => ({
        ID_Sede: row.ID_Sede,
        Nombre_Sede: row.Nombre_Sede?.trim() || '',
        Codigo_Sede: row.Codigo_Sede?.trim() || '',
        Direccion: row.Direccion?.trim() || '',
        Ciudad: row.Ciudad?.trim() || '',
        Telefono: row.Telefono?.trim() || '',
        Email: row.Email?.trim() || '',
        Activo: row.Activo || 'Y'
      }));
      
      this.logger.log(`✅ Obtenidas ${sedes.length} sedes activas de SAP (tabla OUBR)`);
      return sedes;

    } catch (error) {
      this.logger.error('Error obteniendo sedes de SAP:', error);
      this.logger.warn('💡 Si el error es de tabla no encontrada, verifica que:');
      this.logger.warn('   1. La tabla OUBR existe en tu SAP B1');
      this.logger.warn('   2. Tu usuario tiene permisos para consultarla');
      this.logger.warn('   3. O actualiza el procedimiento almacenado para incluir sedes');
      
      // Fallback: intentar obtener sedes desde el procedimiento almacenado actual
      return await this.obtenerSedesDesdeProcesoAlmacenado();
    }
  }

  /**
   * 🆕 Fallback: Intenta obtener sedes desde el procedimiento almacenado actual
   */
  private async obtenerSedesDesdeProcesoAlmacenado(): Promise<SedeSAP[]> {
    try {
      this.logger.log('🔄 Intentando obtener sedes desde procedimiento almacenado...');
      const query = 'CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()';
      const results = await this.executeQuery(query);
      
      // Buscar si hay columnas relacionadas con sedes en el resultado
      if (results.length > 0) {
        const firstRow = results[0];
        this.logger.log('🔍 Columnas disponibles en procedimiento:', Object.keys(firstRow));
        
        // Si encuentra columnas de sede, extraerlas
        const sedesMap = new Map();
        let sedeId = 1;
        
        results.forEach(row => {
          // Buscar columnas que podrían ser sedes
          const posiblesSedes = [
            row.Sede, row.Sucursal, row.Branch, row.Location, 
            row.Site, row.Office, row.BPL, row.ID_Sede, row.Nombre_Sede
          ].filter(Boolean);
          
          if (posiblesSedes.length > 0 && !sedesMap.has(posiblesSedes[0])) {
            sedesMap.set(posiblesSedes[0], {
              ID_Sede: sedeId++,
              Nombre_Sede: posiblesSedes[0].toString().trim(),
              Codigo_Sede: `SEDE-${sedeId}`,
              Activo: 'Y'
            });
          }
        });
        
        if (sedesMap.size > 0) {
          const sedes = Array.from(sedesMap.values());
          this.logger.log(`✅ Extraídas ${sedes.length} sedes desde procedimiento almacenado`);
          return sedes;
        }
      }
      
      // Si no encuentra nada, crear sede por defecto
      this.logger.warn('⚠️ No se encontraron datos de sedes, creando sede por defecto');
      return [{
        ID_Sede: 1,
        Nombre_Sede: 'Sede Principal',
        Codigo_Sede: 'PRINCIPAL',
        Activo: 'Y'
      }];
      
    } catch (error) {
      this.logger.error('Error en fallback de sedes:', error);
      throw error;
    }
  }

  /**
   * 🍺 Obtiene las choperas activas desde SAP (artículos con descripción "*chop*")
   */
  async obtenerChoperasActivas(): Promise<ChoperaSAP[]> {
    if (!this.hana) {
      this.logger.warn('⚠️ Modo simulación - devolviendo datos de prueba para choperas');
      return [
        {
          ItemCode: 'CHOP001',
          ItemName: 'Chopera Premium Brahma 10L',
          ItemType: 'I',
          ItmsGrpCod: 101,
          ItmsGrpNam: 'Equipos de Cerveza',
          QryGroup1: 'Y',
          InvntItem: 'Y',
          SellItem: 'N',
          PrchseItem: 'Y',
          SalUnitMsr: 'UN',
          PurUnitMsr: 'UN',
          InvntryUom: 'UN',
          LastPurPrc: 2500.00,
          AvgPrice: 2300.00,
          FirmCode: 1,
          FirmName: 'Ambev',
          U_Ubicacion: 'Sector A-1',
          U_Estado: 'Operativa',
          CreateDate: '2024-01-15',
          UpdateDate: '2024-12-20'
        },
        {
          ItemCode: 'CHOP002',
          ItemName: 'Chopera Stella Artois 15L',
          ItemType: 'I',
          ItmsGrpCod: 101,
          ItmsGrpNam: 'Equipos de Cerveza',
          QryGroup1: 'Y',
          InvntItem: 'Y',
          SellItem: 'N',
          PrchseItem: 'Y',
          SalUnitMsr: 'UN',
          PurUnitMsr: 'UN',
          InvntryUom: 'UN',
          LastPurPrc: 3200.00,
          AvgPrice: 3100.00,
          FirmCode: 1,
          FirmName: 'Ambev',
          U_Ubicacion: 'Sector B-2',
          U_Estado: 'Mantenimiento',
          CreateDate: '2024-02-20',
          UpdateDate: '2024-12-20'
        }
      ];
    }

    try {
      // Consulta simplificada a tabla de Items de SAP B1 usando solo campos básicos
      const query = `
        SELECT 
          i."ItemCode",
          i."ItemName",
          i."ItemType",
          i."ItmsGrpCod",
          g."ItmsGrpNam",
          i."QryGroup1",
          i."InvntItem",
          i."SellItem", 
          i."PrchseItem",
          i."CreateDate",
          i."UpdateDate"
        FROM "BD_MINOIL_PROD"."OITM" i
        LEFT JOIN "BD_MINOIL_PROD"."OITB" g ON i."ItmsGrpCod" = g."ItmsGrpCod"
        WHERE (
          UPPER(i."ItemName") LIKE '%CHOP%' 
          OR UPPER(i."ItemCode") LIKE '%CHOP%'
        )
        AND i."frozenFor" = 'N'
        AND i."validFor" = 'Y'
        ORDER BY i."ItemName"
      `;

      this.logger.log('🍺 Obteniendo choperas activas desde tabla OITM...');
      const results = await this.executeQuery(query);
      
      const choperas = results.map(row => ({
        ItemCode: row.ItemCode?.trim() || '',
        ItemName: row.ItemName?.trim() || '',
        ItemType: row.ItemType?.trim() || 'I',
        ItmsGrpCod: row.ItmsGrpCod || 0,
        ItmsGrpNam: row.ItmsGrpNam?.trim() || '',
        QryGroup1: row.QryGroup1 || 'Y',
        InvntItem: row.InvntItem || 'Y',
        SellItem: row.SellItem || 'N',
        PrchseItem: row.PrchseItem || 'Y',
        SalUnitMsr: 'UN', // Valor por defecto
        PurUnitMsr: 'UN', // Valor por defecto
        InvntryUom: 'UN', // Valor por defecto
        LastPurPrc: 0, // Valor por defecto
        AvgPrice: 0, // Valor por defecto
        FirmCode: 0, // Valor por defecto
        FirmName: '', // Valor por defecto
        U_Ubicacion: '', // Valor por defecto
        U_Estado: '', // Valor por defecto
        CreateDate: row.CreateDate ? new Date(row.CreateDate).toISOString().split('T')[0] : '',
        UpdateDate: row.UpdateDate ? new Date(row.UpdateDate).toISOString().split('T')[0] : ''
      }));
      
      this.logger.log(`✅ Obtenidas ${choperas.length} choperas activas de SAP (tabla OITM)`);
      return choperas;

    } catch (error) {
      this.logger.error('Error obteniendo choperas de SAP:', error);
      this.logger.warn('💡 Si el error es de tabla no encontrada, verifica que:');
      this.logger.warn('   1. La tabla OITM existe en tu SAP B1');
      this.logger.warn('   2. Tu usuario tiene permisos para consultarla');
      this.logger.warn('   3. Los campos definidos por usuario (U_*) existen en tu sistema');
      
      // En caso de error, devolver array vacío pero registrar el error
      throw new Error(`Error obteniendo choperas de SAP: ${error.message}`);
    }
  }

  /**
   * Verifica si la conexión está activa
   */
  isConnectionActive(): boolean {
    return this.isConnected && !!this.connection;
  }
} 