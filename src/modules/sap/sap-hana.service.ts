import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as hana from '@sap/hana-client';

export interface EmpleadoSAP {
  empID: number;
  nombreCompletoSap: string;
  cargo?: string;
  area?: string;
  sede?: string;
  jefeDirecto?: string;
  activo: boolean | number | string; // Más flexible para diferentes formatos de SAP
}

export interface SocioNegocioSAP {
  cardCode: string;
  cardName: string;
  cardType: string;
  groupCode?: number;
  groupName?: string;
  phone1?: string;
  phone2?: string;
  emailAddress?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  active: boolean;
  createDate?: Date;
  updateDate?: Date;
  // Campos adicionales del procedimiento R_014_ClientesV2
  ruta?: string;
  alias?: string;
  cadena?: string;
}

export interface UsuarioHANA {
  id: number;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  password?: string;
  activo: boolean;
  ultimoAcceso?: Date;
  autenticacion: string;
  empID?: number;
  jefeDirectoSapId?: number;
  nombreCompletoSap?: string;
  ROLID: number;
  ultimaSincronizacion?: Date;
}

export interface RolHANA {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermisoHANA {
  id: number;
  rolId: number;
  moduloId: number;
  crear: boolean;
  leer: boolean;
  actualizar: boolean;
  eliminar: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModuloHANA {
  id: number;
  nombre: string;
  descripcion?: string;
  ruta: string;
  activo: boolean;
  esMenu: boolean;
  icono?: string;
  nivel: number;
  orden: number;
  padreId?: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SapHanaService {
  private readonly logger = new Logger(SapHanaService.name);
  private connection: any;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const host = this.configService.get<string>('SAP_HANA_HOST', 'srvhana');
    const port = this.configService.get<string>('SAP_HANA_PORT', '30015');
    const username = this.configService.get<string>('SAP_HANA_USERNAME', 'CONSULTA');
    const password = this.configService.get<string>('SAP_HANA_PASSWORD', '');

    this.logger.log(`🔧 Intentando conectar a SAP HANA: ${host}:${port}`);
    this.logger.log(`🔐 Usuario: ${username}, Encrypt: false`);

    try {
      this.connection = hana.createConnection();
      
      await new Promise<void>((resolve, reject) => {
        this.connection.connect({
          serverNode: `${host}:${port}`,
          uid: username,
          pwd: password,
          encrypt: false,
          sslValidateCertificate: false,
          timeout: 30000,
          connectTimeout: 30000,
          // Parámetros adicionales para resolver problemas de protocolo
          validateCertificate: false,
          sslTrustStore: '',
          sslKeyStore: '',
          sslCryptoProvider: '',
        }, (err: any) => {
          if (err) {
            this.logger.error(`❌ Error conectando a SAP HANA: ${err.message}`);
            reject(err);
          } else {
            this.isConnected = true;
            this.logger.log(`✅ Conectado exitosamente a SAP HANA`);
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error(`❌ Error en conexión SAP HANA: ${error.message}`);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.connection.disconnect((err: any) => {
            if (err) {
              reject(err);
            } else {
              this.isConnected = false;
              resolve();
            }
          });
        });
      } catch (error) {
        this.logger.error('Error desconectando de SAP HANA:', error);
      }
    }
  }

  private async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('SAP HANA no está conectado');
    }

    return new Promise((resolve, reject) => {
      this.connection.exec(query, params, (err: any, result: any) => {
        if (err) {
          this.logger.error('Error ejecutando query:', err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // ============================================================================
  // 🔍 MÉTODOS PARA EXPLORAR LA BASE DE DATOS
  // ============================================================================

  async explorarSchemas(): Promise<string[]> {
    const query = `
      SELECT SCHEMA_NAME 
      FROM SCHEMAS 
      ORDER BY SCHEMA_NAME
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => row.SCHEMA_NAME);
    } catch (error) {
      this.logger.error('Error explorando schemas:', error);
      // Si falla, intentar con una consulta más simple
      try {
        const simpleQuery = `SELECT CURRENT_SCHEMA FROM DUMMY`;
        const result = await this.executeQuery(simpleQuery);
        return [result[0].CURRENT_SCHEMA];
      } catch (fallbackError) {
        this.logger.error('Error en fallback de schemas:', fallbackError);
        return ['CONSULTA']; // Schema por defecto
      }
    }
  }

  async explorarTablasEnSchema(schema: string): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME 
      FROM TABLES 
      WHERE SCHEMA_NAME = ?
      ORDER BY TABLE_NAME
    `;
    
    try {
      const result = await this.executeQuery(query, [schema]);
      return result.map(row => row.TABLE_NAME);
    } catch (error) {
      this.logger.error(`Error explorando tablas en schema ${schema}:`, error);
      throw error;
    }
  }

  async explorarTablas(): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME 
      FROM TABLES 
      WHERE SCHEMA_NAME = 'MINOILDES'
      ORDER BY TABLE_NAME
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => row.TABLE_NAME);
    } catch (error) {
      this.logger.error('Error explorando tablas:', error);
      throw error;
    }
  }

  async explorarColumnas(tabla: string): Promise<any[]> {
    const query = `
      SELECT COLUMN_NAME
      FROM TABLE_COLUMNS 
      WHERE TABLE_NAME = ? AND SCHEMA_NAME = 'MINOILDES'
      ORDER BY POSITION
    `;
    
    try {
      const result = await this.executeQuery(query, [tabla]);
      return result;
    } catch (error) {
      this.logger.error(`Error explorando columnas de ${tabla}:`, error);
      throw error;
    }
  }

  async explorarEstructuraTabla(schema: string, tabla: string): Promise<any[]> {
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, POSITION
      FROM TABLE_COLUMNS 
      WHERE TABLE_NAME = ? AND SCHEMA_NAME = ?
      ORDER BY POSITION
    `;
    
    try {
      const result = await this.executeQuery(query, [tabla, schema]);
      return result;
    } catch (error) {
      this.logger.error(`Error explorando estructura de ${schema}.${tabla}:`, error);
      throw error;
    }
  }

  async obtenerMuestraTabla(schema: string, tabla: string): Promise<any[]> {
    const query = `
      SELECT * FROM "${schema}"."${tabla}" 
      LIMIT 5
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result;
    } catch (error) {
      this.logger.error(`Error obteniendo muestra de ${schema}.${tabla}:`, error);
      throw error;
    }
  }

  async obtenerSchemaActual(): Promise<string> {
    const query = `SELECT CURRENT_SCHEMA FROM DUMMY`;
    
    try {
      const result = await this.executeQuery(query);
      return result[0].CURRENT_SCHEMA;
    } catch (error) {
      this.logger.error('Error obteniendo schema actual:', error);
      return 'PUBLIC';
    }
  }

  // ============================================================================
  // 👥 MÉTODOS PARA USUARIOS (CORREGIDOS)
  // ============================================================================

  async obtenerUsuarios(): Promise<UsuarioHANA[]> {
    const query = `SELECT "id", "username", "email", "nombre", "apellido", "password", "activo", 
                          "ultimoAcceso", "autenticacion", "empID", "jefeDirectoSapId", 
                          "nombreCompletoSap", "rolID", "ultimaSincronizacion"
                   FROM "MINOILDES"."users" ORDER BY "apellido", "nombre"`;

    try {
      const result = await this.executeQuery(query);
      return result.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        nombre: row.nombre,
        apellido: row.apellido,
        password: row.password,
        activo: row.activo || true,
        ultimoAcceso: row.ultimoAcceso ? new Date(row.ultimoAcceso) : undefined,
        autenticacion: row.autenticacion || 'local',
        empID: row.empID,
        jefeDirectoSapId: row.jefeDirectoSapId,
        nombreCompletoSap: row.nombreCompletoSap,
        ROLID: row.rolID || 1,
        ultimaSincronizacion: row.ultimaSincronizacion ? new Date(row.ultimaSincronizacion) : undefined,
      }));
    } catch (error) {
      this.logger.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  async obtenerUsuarioPorId(id: number): Promise<UsuarioHANA | null> {
    const query = `
      SELECT "id", "username", "email", "nombre", "apellido", "password", "activo", 
             "ultimoAcceso", "autenticacion", "empID", "jefeDirectoSapId", 
             "nombreCompletoSap", "rolID", "ultimaSincronizacion"
      FROM "MINOILDES"."users" 
      WHERE "id" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [id]);
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        nombre: row.nombre,
        apellido: row.apellido,
        password: row.password,
        activo: row.activo || true,
        ultimoAcceso: row.ultimoAcceso ? new Date(row.ultimoAcceso) : undefined,
        autenticacion: row.autenticacion || 'local',
        empID: row.empID,
        jefeDirectoSapId: row.jefeDirectoSapId,
        nombreCompletoSap: row.nombreCompletoSap,
        ROLID: row.rolID || 1,
        ultimaSincronizacion: row.ultimaSincronizacion ? new Date(row.ultimaSincronizacion) : undefined,
      };
    } catch (error) {
      this.logger.error('Error obteniendo usuario por ID:', error);
      throw error;
    }
  }

  async obtenerUsuarioPorUsername(username: string): Promise<UsuarioHANA | null> {
    const query = `
      SELECT "id", "username", "email", "nombre", "apellido", "password", "activo", 
             "ultimoAcceso", "autenticacion", "empID", "jefeDirectoSapId", 
             "nombreCompletoSap", "rolID", "ultimaSincronizacion"
      FROM "MINOILDES"."users" 
      WHERE "username" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [username]);
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        nombre: row.nombre,
        apellido: row.apellido,
        password: row.password,
        activo: row.activo || true,
        ultimoAcceso: row.ultimoAcceso ? new Date(row.ultimoAcceso) : undefined,
        autenticacion: row.autenticacion || 'local',
        empID: row.empID,
        jefeDirectoSapId: row.jefeDirectoSapId,
        nombreCompletoSap: row.nombreCompletoSap,
        ROLID: row.rolID || 1,
        ultimaSincronizacion: row.ultimaSincronizacion ? new Date(row.ultimaSincronizacion) : undefined,
      };
    } catch (error) {
      this.logger.error('Error obteniendo usuario por username:', error);
      throw error;
    }
  }


  async crearUsuario(usuario: Omit<UsuarioHANA, 'id' | 'createdAt' | 'updatedAt'>): Promise<UsuarioHANA> {
    const query = `
      INSERT INTO "MINOILDES"."users" (
        "username", "email", "nombre", "apellido", "password", "activo", 
        "autenticacion", "empID", "jefeDirectoSapId", "nombreCompletoSap", "rolID"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [
        usuario.username,
        usuario.email,
        usuario.nombre,
        usuario.apellido,
        usuario.password,
        usuario.activo,
        usuario.autenticacion,
        usuario.empID,
        usuario.jefeDirectoSapId,
        usuario.nombreCompletoSap,
        usuario.ROLID,
      ]);
      
      // Obtener el usuario creado
      return await this.obtenerUsuarioPorUsername(usuario.username) as UsuarioHANA;
    } catch (error) {
      this.logger.error('Error creando usuario:', error);
      throw error;
    }
  }

  async actualizarUsuario(id: number, datos: Partial<UsuarioHANA>): Promise<UsuarioHANA | null> {
    const campos = Object.keys(datos).filter(key => key !== 'id');
    const valores = Object.values(datos);
    
    if (campos.length === 0) return await this.obtenerUsuarioPorId(id);
    
    const setClause = campos.map(campo => `"${campo}" = ?`).join(', ');
    const query = `
      UPDATE "MINOILDES"."users" 
      SET ${setClause}${setClause ? ', ' : ''}"updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
    `;
    
    try {
      await this.executeQuery(query, [...valores, id]);
      return await this.obtenerUsuarioPorId(id);
    } catch (error) {
      this.logger.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  async eliminarUsuario(id: number): Promise<boolean> {
    const query = `DELETE FROM "MINOILDES"."users" WHERE "id" = ?`;
    
    try {
      await this.executeQuery(query, [id]);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  // ============================================================================
  // �� MÉTODOS PARA ROLES (CORREGIDOS)
  // ============================================================================

  async obtenerRoles(): Promise<RolHANA[]> {
    const query = `SELECT "id", "nombre", "descripcion", "activo", "createdAt", "updatedAt" FROM "MINOILDES"."roles" ORDER BY "nombre"`;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => ({
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion || null,
        activo: row.activo !== undefined ? row.activo : true,
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo roles:', error);
      throw error;
    }
  }

  async obtenerRolPorId(id: number): Promise<RolHANA | null> {
    const query = `
      SELECT "id", "nombre", "descripcion", "activo", "createdAt", "updatedAt"
      FROM "MINOILDES"."roles" 
      WHERE "id" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [id]);
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion || null,
        activo: row.activo !== undefined ? row.activo : true,
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo rol por ID:', error);
      throw error;
    }
  }

  async crearRol(rol: Omit<RolHANA, 'id' | 'createdAt' | 'updatedAt'>): Promise<RolHANA> {
    const query = `
      INSERT INTO "MINOILDES"."roles" ("nombre", "descripcion", "activo")
      VALUES (?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [rol.nombre, rol.descripcion, rol.activo]);
      
      // Obtener el rol creado
      const roles = await this.obtenerRoles();
      return roles.find(r => r.nombre === rol.nombre) as RolHANA;
    } catch (error) {
      this.logger.error('Error creando rol:', error);
      throw error;
    }
  }

  async actualizarRol(id: number, datos: Partial<RolHANA>): Promise<RolHANA | null> {
    const campos = Object.keys(datos).filter(key => key !== 'id');
    const valores = Object.values(datos);
    
    if (campos.length === 0) return await this.obtenerRolPorId(id);
    
    const setClause = campos.map(campo => `"${campo}" = ?`).join(', ');
    const query = `
      UPDATE "MINOILDES"."roles" 
      SET ${setClause}${setClause ? ', ' : ''}"updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
    `;
    
    try {
      await this.executeQuery(query, [...valores, id]);
      return await this.obtenerRolPorId(id);
    } catch (error) {
      this.logger.error('Error actualizando rol:', error);
      throw error;
    }
  }

  async eliminarRol(id: number): Promise<boolean> {
    const query = `DELETE FROM "MINOILDES"."roles" WHERE "id" = ?`;
    
    try {
      await this.executeQuery(query, [id]);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando rol:', error);
      throw error;
    }
  }

  // ============================================================================
  // 🔐 MÉTODOS PARA PERMISOS
  // ============================================================================

  async obtenerPermisos(): Promise<PermisoHANA[]> {
    const query = `
      SELECT "id", "rolId", "moduloId", "crear", "leer", "actualizar", "eliminar", "createdAt", "updatedAt"
      FROM "MINOILDES"."permisos"
      ORDER BY "rolId", "moduloId"
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo permisos:', error);
      throw error;
    }
  }

  async obtenerPermisosPorRol(rolId: number): Promise<PermisoHANA[]> {
    const query = `
      SELECT "id", "rolId", "moduloId", "crear", "leer", "actualizar", "eliminar", "createdAt", "updatedAt"
      FROM "MINOILDES"."permisos"
      WHERE "rolId" = ?
      ORDER BY "moduloId"
    `;
    
    try {
      const result = await this.executeQuery(query, [rolId]);
      return result.map(row => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo permisos por rol:', error);
      throw error;
    }
  }

  async obtenerPermisosPorModulo(moduloId: number): Promise<PermisoHANA[]> {
    const query = `
      SELECT "id", "rolId", "moduloId", "crear", "leer", "actualizar", "eliminar", "createdAt", "updatedAt"
      FROM "MINOILDES"."permisos"
      WHERE "moduloId" = ?
      ORDER BY "rolId"
    `;
    
    try {
      const result = await this.executeQuery(query, [moduloId]);
      return result.map(row => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo permisos por módulo:', error);
      throw error;
    }
  }

  async crearPermiso(permiso: Omit<PermisoHANA, 'id' | 'createdAt' | 'updatedAt'>): Promise<PermisoHANA> {
    const query = `
      INSERT INTO "MINOILDES"."permisos" ("rolId", "moduloId", "crear", "leer", "actualizar", "eliminar")
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [
        permiso.rolId,
        permiso.moduloId,
        permiso.crear,
        permiso.leer,
        permiso.actualizar,
        permiso.eliminar,
      ]);
      
      // Obtener el permiso creado
      const permisos = await this.obtenerPermisosPorRol(permiso.rolId);
      return permisos.find(p => p.moduloId === permiso.moduloId) as PermisoHANA;
    } catch (error) {
      this.logger.error('Error creando permiso:', error);
      throw error;
    }
  }

  async actualizarPermiso(id: number, datos: Partial<PermisoHANA>): Promise<PermisoHANA | null> {
    const campos = Object.keys(datos).filter(key => key !== 'id');
    const valores = Object.values(datos);
    
    if (campos.length === 0) {
      const permisos = await this.obtenerPermisos();
      return permisos.find(p => p.id === id) || null;
    }
    
    const setClause = campos.map(campo => `"${campo}" = ?`).join(', ');
    const query = `
      UPDATE "MINOILDES"."permisos" 
      SET ${setClause}${setClause ? ', ' : ''}"updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
    `;
    
    try {
      await this.executeQuery(query, [...valores, id]);
      
      // Obtener el permiso actualizado
      const permisos = await this.obtenerPermisos();
      return permisos.find(p => p.id === id) || null;
    } catch (error) {
      this.logger.error('Error actualizando permiso:', error);
      throw error;
    }
  }

  async eliminarPermiso(id: number): Promise<boolean> {
    const query = `DELETE FROM "MINOILDES"."permisos" WHERE "id" = ?`;
    
    try {
      await this.executeQuery(query, [id]);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando permiso:', error);
      throw error;
    }
  }

  // ============================================================================
  // 📦 MÉTODOS PARA MÓDULOS
  // ============================================================================

  async obtenerModulos(): Promise<ModuloHANA[]> {
    const query = `
      SELECT "id", "nombre", "descripcion", "ruta", "activo", "esMenu", "icono", "nivel", "orden", "padreId", "createdAt", "updatedAt"
      FROM "MINOILDES"."modulos"
      WHERE "activo" = true
      ORDER BY "nivel", "orden", "nombre"
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo módulos:', error);
      throw error;
    }
  }

  async obtenerModuloPorId(id: number): Promise<ModuloHANA | null> {
    const query = `
      SELECT "id", "nombre", "descripcion", "ruta", "activo", "esMenu", "icono", "nivel", "orden", "padreId", "createdAt", "updatedAt"
      FROM "MINOILDES"."modulos"
      WHERE "id" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [id]);
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    } catch (error) {
      this.logger.error('Error obteniendo módulo por ID:', error);
      throw error;
    }
  }

  async crearModulo(modulo: Omit<ModuloHANA, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModuloHANA> {
    const query = `
      INSERT INTO "MINOILDES"."modulos" (
        "nombre", "descripcion", "ruta", "activo", "esMenu", "icono", "nivel", "orden", "padreId"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [
        modulo.nombre,
        modulo.descripcion,
        modulo.ruta,
        modulo.activo,
        modulo.esMenu,
        modulo.icono,
        modulo.nivel,
        modulo.orden,
        modulo.padreId,
      ]);
      
      // Obtener el módulo creado
      const modulos = await this.obtenerModulos();
      return modulos.find(m => m.nombre === modulo.nombre) as ModuloHANA;
    } catch (error) {
      this.logger.error('Error creando módulo:', error);
      throw error;
    }
  }

  async actualizarModulo(id: number, datos: Partial<ModuloHANA>): Promise<ModuloHANA | null> {
    const campos = Object.keys(datos).filter(key => key !== 'id');
    const valores = Object.values(datos);
    
    if (campos.length === 0) return await this.obtenerModuloPorId(id);
    
    const setClause = campos.map(campo => `"${campo}" = ?`).join(', ');
    const query = `
      UPDATE "MINOILDES"."modulos" 
      SET ${setClause}${setClause ? ', ' : ''}"updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
    `;
    
    try {
      await this.executeQuery(query, [...valores, id]);
      return await this.obtenerModuloPorId(id);
    } catch (error) {
      this.logger.error('Error actualizando módulo:', error);
      throw error;
    }
  }

  async eliminarModulo(id: number): Promise<boolean> {
    const query = `DELETE FROM "MINOILDES"."modulos" WHERE "id" = ?`;
    
    try {
      await this.executeQuery(query, [id]);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando módulo:', error);
      throw error;
    }
  }

  // ============================================================================
  // 🔄 MÉTODOS EXISTENTES PARA SAP
  // ============================================================================


  async obtenerEmpleadosActivos(): Promise<EmpleadoSAP[]> {
    this.logger.log('📊 Ejecutando procedimiento almacenado MINOILDES.SP_OBTENER_DATOS_COMPLETOS_MINOIL...');
    
    try {
      const query = `CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()`;
      const result = await this.executeQuery(query, []);
      
      this.logger.log(`✅ Obtenidos ${result.length} empleados activos de SAP`);
      
      // Debug: mostrar campos disponibles en el primer registro
      if (result.length > 0) {
        const camposDisponibles = Object.keys(result[0]);
        this.logger.log(`🔍 Campos disponibles en el procedimiento: ${camposDisponibles.join(', ')}`);
        
        // Mostrar algunos valores de jefe para debug
        const primerosJefes = result.slice(0, 3).map(row => ({
          empID: row.ID_Empleado,
          nombre: row.Nombre_Completo,
          jefeNombre: row.Nombre_Jefe,
          jefeID: row.ID_Jefe_Inmediato || row.ID_Jefe || row.empID_Jefe,
          todosLosCampos: Object.keys(row).filter(key => key.toLowerCase().includes('jefe'))
        }));
        this.logger.log(`🔍 Debug jefes - Primeros 3: ${JSON.stringify(primerosJefes, null, 2)}`);
      }
      
      return result.map((row: any) => ({
        empID: row.ID_Empleado || row.empID,
        nombreCompletoSap: row.Nombre_Completo || row.nombreCompleto,
        cargo: row.Cargo || row.cargo,
        area: row.Nombre_Area || row.area,
        sede: row.Nombre_Sede || row.sede,
        jefeDirecto: row.ID_Jefe_Inmediato || row.ID_Jefe || row.empID_Jefe || row.jefeDirecto, // Usar ID_Jefe_Inmediato que es el empID del jefe
        
        activo: row.Activo === 1 || row.activo === 'Y',
      }));
    } catch (error) {
      this.logger.error('Error obteniendo empleados activos:', error);
      throw error;
    }
  }

  async obtenerEmpleadosActivosAlternativo(): Promise<EmpleadoSAP[]> {
    this.logger.log('📊 Intentando obtener empleados desde tablas directas de SAP B1...');
    
    try {
      // Intentar diferentes consultas para obtener empleados
      const consultas = [
        // Consulta 1: Tabla OHEM (empleados)
        `SELECT 
          empID as ID_Empleado,
          firstName + ' ' + lastName as Nombre_Completo,
          jobTitle as Cargo,
          dept as Area,
          branch as Sede,
          'Activo' as Estado
        FROM OHEM 
        WHERE active = 'Y'
        ORDER BY firstName, lastName`,
        
        // Consulta 2: Tabla OUSR (usuarios del sistema)
        `SELECT 
          userID as ID_Empleado,
          userCode as Nombre_Completo,
          'Usuario Sistema' as Cargo,
          'Sistema' as Area,
          'Principal' as Sede,
          'Activo' as Estado
        FROM OUSR 
        WHERE userLocked = 'N'
        ORDER BY userCode`,
        
        // Consulta 3: Tabla OSLP (vendedores)
        `SELECT 
          SlpCode as ID_Empleado,
          SlpName as Nombre_Completo,
          'Vendedor' as Cargo,
          'Ventas' as Area,
          'Principal' as Sede,
          'Activo' as Estado
        FROM OSLP 
        WHERE Active = 'Y'
        ORDER BY SlpName`
      ];
      
      let empleados: EmpleadoSAP[] = [];
      
      for (let i = 0; i < consultas.length; i++) {
        try {
          this.logger.log(`🔍 Intentando consulta ${i + 1}...`);
          const result = await this.executeQuery(consultas[i]);
          
          if (result.length > 0) {
            this.logger.log(`✅ Consulta ${i + 1} exitosa: ${result.length} registros`);
            empleados = result.map((row: any) => ({
              empID: row.ID_Empleado,
              nombreCompletoSap: row.Nombre_Completo,
              cargo: row.Cargo,
              area: row.Area,
              sede: row.Sede,
              jefeDirecto: null,
              activo: true,
            }));
            break; // Si encontramos datos, salimos del bucle
          }
        } catch (error) {
          this.logger.warn(`⚠️ Consulta ${i + 1} falló: ${error.message}`);
          continue;
        }
      }
      
             if (empleados.length === 0) {
         // Si ninguna consulta funcionó, lanzar error
         this.logger.error('❌ No se pudieron obtener empleados desde SAP');
         throw new Error('No se pudieron obtener empleados desde SAP Business One');
       }
      
      this.logger.log(`✅ Obtenidos ${empleados.length} empleados (método alternativo)`);
      return empleados;
      
    } catch (error) {
      this.logger.error('Error obteniendo empleados (método alternativo):', error);
      throw error;
    }
  }

  async sincronizarUsuariosConSAP(): Promise<any> {
    this.logger.log('🔄 Iniciando sincronización de usuarios con empleados de SAP...');
    
    try {
      // Intentar obtener empleados activos de SAP
      let empleadosSAP: EmpleadoSAP[];
      try {
        empleadosSAP = await this.obtenerEmpleadosActivos();
        this.logger.log(`📊 Empleados activos en SAP (procedimiento): ${empleadosSAP.length}`);
      } catch (error) {
        this.logger.warn('⚠️ Procedimiento almacenado no disponible, usando método alternativo...');
        empleadosSAP = await this.obtenerEmpleadosActivosAlternativo();
        this.logger.log(`📊 Empleados activos en SAP (alternativo): ${empleadosSAP.length}`);
      }
      
      // Obtener usuarios existentes
      const usuariosExistentes = await this.obtenerUsuarios();
      const usuariosMap = new Map(usuariosExistentes.map(u => [u.empID, u]));
      
      let usuariosCreados = 0;
      let usuariosActualizados = 0;
      let errores = 0;
      
      for (const empleado of empleadosSAP) {
        try {
          const usuarioExistente = usuariosMap.get(empleado.empID);
          
          if (usuarioExistente) {
            // Actualizar usuario existente
            await this.actualizarUsuario(usuarioExistente.id, {
              nombreCompletoSap: empleado.nombreCompletoSap,
              jefeDirectoSapId: empleado.jefeDirecto ? parseInt(empleado.jefeDirecto) || null : null,
            });
            usuariosActualizados++;
          } else {
            // Crear nuevo usuario
            const username = this.generarUsername(empleado.nombreCompletoSap);
            const email = `${username}@minoil.com.bo`;
            
            await this.crearUsuario({
              username,
              email,
              nombre: empleado.nombreCompletoSap.split(' ')[0] || 'Usuario',
              apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || 'SAP',
              password: '', // Sin contraseña para autenticación LDAP
              activo: Boolean(empleado.activo),
              autenticacion: 'ldap', // Configurar para autenticación LDAP
              empID: empleado.empID,
              jefeDirectoSapId: empleado.jefeDirecto ? parseInt(empleado.jefeDirecto) || null : null,
              nombreCompletoSap: empleado.nombreCompletoSap,
              ROLID: 1, // Rol por defecto
            });
            usuariosCreados++;
          }
        } catch (error) {
          this.logger.error(`Error procesando empleado ${empleado.empID}:`, error);
          errores++;
        }
      }
      
      return {
        usuariosCreados,
        usuariosActualizados,
        errores,
        totalProcesados: empleadosSAP.length
      };
      
    } catch (error) {
      this.logger.error('Error en sincronización:', error);
      throw error;
    }
  }

  /**
   * Sincroniza usuarios con enfoque de verificación individual LDAP
   * No requiere permisos de administrador LDAP
   */
  async sincronizarUsuariosConVerificacionIndividual(ldapService: any): Promise<any> {
    this.logger.log('🔄 Iniciando sincronización con verificación individual LDAP...');
    
    try {
      // Obtener empleados de SAP
      let empleadosSAP: EmpleadoSAP[];
      try {
        empleadosSAP = await this.obtenerEmpleadosActivos();
        this.logger.log(`📊 Empleados activos en SAP: ${empleadosSAP.length}`);
      } catch (error) {
        this.logger.warn('⚠️ Procedimiento almacenado no disponible, usando método alternativo...');
        empleadosSAP = await this.obtenerEmpleadosActivosAlternativo();
        this.logger.log(`📊 Empleados activos en SAP (alternativo): ${empleadosSAP.length}`);
      }
      
      // Obtener usuarios existentes
      const usuariosExistentes = await this.obtenerUsuarios();
      const usuariosMap = new Map(usuariosExistentes.map(u => [u.empID, u]));
      const usuariosPorUsername = new Map(usuariosExistentes.map(u => [u.username, u]));
      
      let usuariosCreados = 0;
      let usuariosActualizados = 0;
      let errores = 0;
      
      for (const empleado of empleadosSAP) {
        try {
          // Generar username basado en el nombre completo
          const username = this.generarUsername(empleado.nombreCompletoSap);
          const email = `${username}@minoil.com.bo`;
          
          // Configurar como autenticación LDAP por defecto
          // La verificación real se hará cuando el usuario intente autenticarse
          const autenticacion = 'ldap';
          const password = ''; // Sin contraseña para autenticación LDAP
          
          // Buscar usuario existente por empID o username
          let usuarioExistente = usuariosMap.get(empleado.empID);
          if (!usuarioExistente) {
            usuarioExistente = usuariosPorUsername.get(username);
          }
          
          if (usuarioExistente) {
            // Actualizar usuario existente
            await this.actualizarUsuario(usuarioExistente.id, {
              username,
              email,
              nombreCompletoSap: empleado.nombreCompletoSap,
              jefeDirectoSapId: empleado.jefeDirecto ? parseInt(empleado.jefeDirecto) || null : null,
              autenticacion,
              password,
            });
            usuariosActualizados++;
            this.logger.log(`✅ Usuario actualizado: ${username} (empID: ${empleado.empID})`);
          } else {
            // Crear nuevo usuario
            await this.crearUsuario({
              username,
              email,
              nombre: empleado.nombreCompletoSap.split(' ')[0] || 'Usuario',
              apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || 'SAP',
              password,
              activo: Boolean(empleado.activo),
              autenticacion,
              empID: empleado.empID,
              jefeDirectoSapId: empleado.jefeDirecto ? parseInt(empleado.jefeDirecto) || null : null,
              nombreCompletoSap: empleado.nombreCompletoSap,
              ROLID: 1, // Rol por defecto
            });
            usuariosCreados++;
            this.logger.log(`✅ Usuario creado: ${username} (empID: ${empleado.empID})`);
          }
        } catch (error) {
          this.logger.error(`Error procesando empleado ${empleado.empID}:`, error);
          errores++;
        }
      }
      
      return {
        usuariosCreados,
        usuariosActualizados,
        errores,
        totalProcesados: empleadosSAP.length,
        mensaje: 'Sincronización completada. Los usuarios están configurados para autenticación LDAP. La verificación se hará al momento del login.'
      };
      
    } catch (error) {
      this.logger.error('Error en sincronización:', error);
      throw error;
    }
  }

  async obtenerChoperas(): Promise<any[]> {
    this.logger.log('🍺 Obteniendo choperas desde tabla OITM...');
    
    try {
      // Consulta simple y robusta basada en tu código anterior
      const query = `call "MINOILDES"."ListadoChoperas"(0)`;
      
      const result = await this.executeQuery(query);
      this.logger.log(`✅ Obtenidas ${result.length} choperas de SAP (schema BD_MINOIL_PROD)`);
      
      // Mapear los resultados según los campos del procedimiento almacenado
      const choperas = result.map(row => ({
        ItemCode: row.ItemCode?.trim() || '',
        ItemName: row.ItemName?.trim() || '',
        Status: row.Status?.trim() || '',
        Ciudad: row.Ciudad?.trim() || '',
        SerieActivo: row.SerieActivo?.trim() || '',
        CardCode: row.CardCode?.trim() || '',
        CardName: row.CardName?.trim() || '',
        AliasName: row.AliasName?.trim() || '',
      }));
      
      return choperas;
    } catch (error) {
      this.logger.warn('⚠️ Error con schema BD_MINOIL_PROD, intentando con schema por defecto...');
      
      try {
        // Intentar con el schema por defecto (sin especificar schema)
        const querySimple = `call "MINOILDES"."ListadoChoperas"(0)`;
        
        const result = await this.executeQuery(querySimple);
        this.logger.log(`✅ Obtenidas ${result.length} choperas de SAP (schema por defecto)`);
        
        // Mapear los resultados según los campos del procedimiento almacenado
        const choperas = result.map(row => ({
          ItemCode: row.ItemCode?.trim() || '',
          ItemName: row.ItemName?.trim() || '',
          Status: row.Status?.trim() || '',
          Ciudad: row.Ciudad?.trim() || '',
          SerieActivo: row.SerieActivo?.trim() || '',
          CardCode: row.CardCode?.trim() || '',
          CardName: row.CardName?.trim() || '',
          AliasName: row.AliasName?.trim() || '',
        }));        
        return choperas;
      } catch (error2) {
        this.logger.error('Error obteniendo choperas:', error2);
        this.logger.error('❌ No se pudieron obtener choperas desde SAP');
        this.logger.warn('💡 Verifica que:');
        this.logger.warn('   1. La tabla OITM existe en tu SAP B1');
        this.logger.warn('   2. Tu usuario tiene permisos para consultarla');
        this.logger.warn('   3. El schema correcto es BD_MINOIL_PROD o el schema por defecto');
        
        throw new Error('No se pudieron obtener choperas desde SAP Business One');
      }
    }
  }

  async obtenerChoperasActivas(): Promise<any[]> {
    this.logger.log('🍺 Obteniendo choperas activas desde tabla OITM...');
    
    try {
      const query = `
        SELECT 
          ItemCode as codigo,
          ItemName as nombre,
          U_Chopera as esChopera
        FROM OITM 
        WHERE U_Chopera = 'Y' AND Valid = 'Y'
        ORDER BY ItemName
      `;
      
      const result = await this.executeQuery(query);
      this.logger.log(`✅ Obtenidas ${result.length} choperas activas de SAP (tabla OITM)`);
      
      return result;
    } catch (error) {
      this.logger.error('Error obteniendo choperas:', error);
      throw error;
    }
  }

  async obtenerCargosActivos(): Promise<any[]> {
    this.logger.log('👔 Obteniendo cargos activos desde procedimiento almacenado...');
    
    try {
      const query = `CALL SP_OBTENER_DATOS_COMPLETOS_MINOIL(?)`;
      const result = await this.executeQuery(query, []);
      
      // Extraer cargos únicos
      const cargos = [...new Set(result.map((row: any) => row.Cargo))].filter(cargo => cargo);
      
      this.logger.log(`✅ Obtenidos ${cargos.length} cargos únicos de SAP`);
      
      return cargos.map(cargo => ({ nombre: cargo }));
    } catch (error) {
      this.logger.error('Error obteniendo cargos:', error);
      throw error;
    }
  }

  async obtenerAreasActivas(): Promise<any[]> {
    this.logger.log('🏢 Obteniendo áreas activas desde procedimiento almacenado...');
    
    try {
      const query = `CALL SP_OBTENER_DATOS_COMPLETOS_MINOIL(?)`;
      const result = await this.executeQuery(query, []);
      
      // Extraer áreas únicas
      const areas = [...new Set(result.map((row: any) => row.Nombre_Area))].filter(area => area);
      
      this.logger.log(`✅ Obtenidas ${areas.length} áreas únicas de SAP`);
      
      return areas.map(area => ({ nombre: area }));
    } catch (error) {
      this.logger.error('Error obteniendo áreas:', error);
      throw error;
    }
  }

  async obtenerSedesActivas(): Promise<any[]> {
    this.logger.log('🏢 Obteniendo sedes activas desde tabla OUBR (Branches)...');
    
    try {
      const query = `
        SELECT 
          BPLId as id,
          BPLName as nombre
        FROM OUBR 
        WHERE Disabled = 'N'
        ORDER BY BPLName
      `;
      
      const result = await this.executeQuery(query);
      this.logger.log(`✅ Obtenidas ${result.length} sedes desde tabla OUBR`);
      
      return result;
    } catch (error) {
      this.logger.error('Error obteniendo sedes de SAP:', error);
      this.logger.warn('💡 Si el error es de tabla no encontrada, verifica que:');
      this.logger.warn('   1. La tabla OUBR existe en tu SAP B1');
      this.logger.warn('   2. Tu usuario tiene permisos para consultarla');
      this.logger.warn('   3. O actualiza el procedimiento almacenado para incluir sedes');
      
      // Intentar obtener desde procedimiento almacenado como fallback
      this.logger.log('🔄 Intentando obtener sedes desde procedimiento almacenado...');
      
      try {
        const querySP = `CALL SP_OBTENER_DATOS_COMPLETOS_MINOIL(?)`;
        const resultSP = await this.executeQuery(querySP, []);
        
        // Extraer sedes únicas
        const sedes = [...new Set(resultSP.map((row: any) => row.Nombre_Sede))].filter(sede => sede);
        
        this.logger.log(`✅ Extraídas ${sedes.length} sedes desde procedimiento almacenado`);
        
        return sedes.map((sede, index) => ({ id: index + 1, nombre: sede }));
      } catch (fallbackError) {
        this.logger.error('Error obteniendo sedes desde procedimiento almacenado:', fallbackError);
        throw error;
      }
    }
  }

  // Método para verificar la conexión
  async testConnection(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT 1 FROM DUMMY');
      return true;
    } catch (error) {
      this.logger.error('Error en test de conexión:', error);
      return false;
    }
  }

  // Método para probar la estructura de la tabla roles
  async testRolesStructure(): Promise<any> {
    try {
      // Intentar diferentes variaciones de la consulta
      const tests = [
        { name: 'SELECT * FROM MINOILDES.roles LIMIT 1', query: 'SELECT * FROM "MINOILDES"."roles" LIMIT 1' },
        { name: 'SELECT id FROM MINOILDES.roles LIMIT 1', query: 'SELECT "id" FROM "MINOILDES"."roles" LIMIT 1' },
      ];

      const results = {};
      
      for (const test of tests) {
        try {
          const result = await this.executeQuery(test.query);
          results[test.name] = { success: true, data: result };
        } catch (error) {
          results[test.name] = { success: false, error: error.message };
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error en test de estructura de roles:', error);
      throw error;
    }
  }

  // Método para probar consultas simples
  async testSimpleQuery(): Promise<any> {
    try {
      // Probar diferentes consultas simples
      const tests = [
        { name: 'SELECT 1 FROM DUMMY', query: 'SELECT 1 FROM DUMMY' },
        { name: 'SELECT COUNT(*) FROM MINOILDES.roles', query: 'SELECT COUNT(*) as count FROM "MINOILDES"."roles"' },
        { name: 'SELECT COUNT(*) FROM MINOILDES.users', query: 'SELECT COUNT(*) as count FROM "MINOILDES"."users"' },
      ];

      const results = {};
      
      for (const test of tests) {
        try {
          const result = await this.executeQuery(test.query);
          results[test.name] = { success: true, data: result };
        } catch (error) {
          results[test.name] = { success: false, error: error.message };
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error en test simple:', error);
      throw error;
    }
  }

  // Método para listar todas las tablas
  async listTables(): Promise<any> {
    try {
      const query = `
        SELECT TABLE_NAME 
        FROM TABLES 
        WHERE SCHEMA_NAME = 'MINOILDES'
        ORDER BY TABLE_NAME
      `;
      
      const result = await this.executeQuery(query);
      return result;
    } catch (error) {
      this.logger.error('Error listando tablas:', error);
      throw error;
    }
  }

  // Método para obtener información de conexión
  getConnectionInfo() {
    return {
      connected: this.isConnected,
      host: this.configService.get<string>('SAP_HANA_HOST'),
      port: this.configService.get<string>('SAP_HANA_PORT'),
      database: this.configService.get<string>('SAP_HANA_DATABASE'),
    };
  }

  // Método para probar específicamente la consulta de roles
  async testRolesQuery(): Promise<any> {
    try {
      const query = `
        SELECT "id", "nombre", "descripcion", "activo", "createdAt", "updatedAt"
        FROM "MINOILDES"."roles" 
        WHERE "activo" = true
        ORDER BY "nombre"
      `;
      
      const result = await this.executeQuery(query);
      return {
        success: true,
        data: result,
        count: result.length
      };
    } catch (error) {
      this.logger.error('Error en test de consulta de roles:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarTablasUsuariosRoles(): Promise<any> {
    const schemas = ['CONSULTA', 'MINOILDES', 'PUBLIC', 'SYS'];
    const resultados = {};

    for (const schema of schemas) {
      try {
        const query = `
          SELECT TABLE_NAME 
          FROM TABLES 
          WHERE SCHEMA_NAME = ?
          AND (TABLE_NAME LIKE '%USER%' OR TABLE_NAME LIKE '%ROL%' OR TABLE_NAME LIKE '%USUARIO%')
          ORDER BY TABLE_NAME
        `;
        
        const result = await this.executeQuery(query, [schema]);
        if (result.length > 0) {
          resultados[schema] = result.map(row => row.TABLE_NAME);
        }
      } catch (error) {
        this.logger.warn(`No se pudo acceder al schema ${schema}: ${error.message}`);
        continue;
      }
    }

    return resultados;
  }

  async explorarTablaUsuariosSAP(): Promise<any> {
    try {
      // Intentar obtener muestra de datos directamente
      const queryMuestra = `
        SELECT * FROM "SYS"."P_USERS_" 
        LIMIT 3
      `;
      
      const muestra = await this.executeQuery(queryMuestra);
      
      // Extraer nombres de columnas de la muestra
      const columnas = muestra.length > 0 ? Object.keys(muestra[0]) : [];
      
      return {
        columnas,
        muestra,
        tabla: 'SYS.P_USERS_',
        totalColumnas: columnas.length
      };
    } catch (error) {
      this.logger.error('Error explorando tabla P_USERS_:', error);
      return {
        error: error.message,
        tabla: 'SYS.P_USERS_'
      };
    }
  }

  // ============================================================================
  // 🔧 MÉTODOS DE DIAGNÓSTICO
  // ============================================================================

  async diagnosticarBaseDatos(): Promise<any> {
    try {
      const schema = await this.obtenerSchemaActual();
      const tablas = await this.explorarTablas();
      
      const diagnostico: any = {
        schema,
        tablas,
        tablasRelevantes: {
          usuarios: tablas.filter(t => t.toLowerCase().includes('user')),
          roles: tablas.filter(t => t.toLowerCase().includes('rol')),
          modulos: tablas.filter(t => t.toLowerCase().includes('modul')),
          permisos: tablas.filter(t => t.toLowerCase().includes('permis'))
        }
      };

      // Explorar estructura de tablas relevantes
      if (diagnostico.tablasRelevantes.usuarios.length > 0) {
        diagnostico.estructuraUsuarios = await this.explorarColumnas(diagnostico.tablasRelevantes.usuarios[0]);
      }
      
      if (diagnostico.tablasRelevantes.roles.length > 0) {
        diagnostico.estructuraRoles = await this.explorarColumnas(diagnostico.tablasRelevantes.roles[0]);
      }

      return diagnostico;
    } catch (error) {
      this.logger.error('Error en diagnóstico:', error);
      throw error;
    }
  }

  async probarConexion(): Promise<any> {
    try {
      const query = `SELECT CURRENT_SCHEMA, CURRENT_USER, CURRENT_DATE FROM DUMMY`;
      const result = await this.executeQuery(query);
      
      return {
        conectado: true,
        schema: result[0].CURRENT_SCHEMA,
        usuario: result[0].CURRENT_USER,
        fecha: result[0].CURRENT_DATE,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        conectado: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async probarConsultaRoles(): Promise<any> {
    try {
      const query = `SELECT * FROM "MINOILDES"."roles" LIMIT 1`;
      const result = await this.executeQuery(query);
      return {
        success: true,
        data: result,
        columnas: result.length > 0 ? Object.keys(result[0]) : []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async verificarTablasMINOILDES(): Promise<any> {
    try {
      // Verificar si existe la tabla roles
      const queryRoles = `SELECT COUNT(*) as count FROM "MINOILDES"."roles"`;
      const resultRoles = await this.executeQuery(queryRoles);
      
      // Verificar si existe la tabla users
      const queryUsers = `SELECT COUNT(*) as count FROM "MINOILDES"."users"`;
      const resultUsers = await this.executeQuery(queryUsers);
      
      // Obtener estructura de roles si existe
      let estructuraRoles = null;
      if (resultRoles[0].count > 0) {
        const queryEstructura = `SELECT * FROM "MINOILDES"."roles" LIMIT 1`;
        const estructura = await this.executeQuery(queryEstructura);
        estructuraRoles = estructura.length > 0 ? Object.keys(estructura[0]) : [];
      }
      
      return {
        roles: {
          existe: true,
          cantidad: resultRoles[0].count,
          estructura: estructuraRoles
        },
        users: {
          existe: true,
          cantidad: resultUsers[0].count
        }
      };
    } catch (error) {
      return {
        error: error.message,
        roles: { existe: false },
        users: { existe: false }
      };
    }
  }

  // ============================================================================
  // 🔄 MÉTODOS PARA SOCIOS DE NEGOCIO
  // ============================================================================

  async obtenerSociosNegocio(): Promise<SocioNegocioSAP[]> {
    this.logger.log('📊 Ejecutando procedimiento almacenado MINOILDES.R_014_ClientesV2...');
    
    try {
      // Usar el procedimiento almacenado para obtener socios de negocio
      const query = `CALL "MINOILDES"."R_014_ClientesV2"()`;
      const result = await this.executeQuery(query, []);
      
      this.logger.log(`✅ Obtenidos ${result.length} socios de negocio de SAP`);
      
      return result.map((row: any) => ({
        cardCode: row.CardCode || '',
        cardName: row.Cliente || '',
        cardType: row.SN || '', // SN parece ser el tipo de socio de negocio
        groupCode: undefined, // No está en la salida del procedimiento
        groupName: row.UnidadNegocio || '',
        phone1: row.Telefono || '',
        phone2: row.Celular || '',
        emailAddress: undefined, // No está en la salida del procedimiento
        address: row.Direccion || '',
        city: undefined, // No está en la salida del procedimiento
        country: undefined, // No está en la salida del procedimiento
        zipCode: undefined, // No está en la salida del procedimiento
        active: true, // Asumimos que todos los que devuelve el procedimiento están activos
        createDate: undefined, // No está en la salida del procedimiento
        updateDate: undefined, // No está en la salida del procedimiento
        // Campos adicionales que vienen del procedimiento
        ruta: row.RUTA || '',
        alias: row.alias || '',
        cadena: row.CADENA || '',
      }));
    } catch (error) {
      this.logger.error('Error obteniendo socios de negocio:', error);
      throw new Error('No se pudieron obtener socios de negocio desde SAP Business One');
    }
  }

  private generarUsername(nombreCompleto: string): string {
    const nombres = nombreCompleto.split(' ');
    let username = '';
    if (nombres.length > 0) {
      username += nombres[0].toLowerCase();
      if (nombres.length > 1) {
        username += '.' + nombres[1].toLowerCase();
      }
    }
    return username;
  }

  // ============================================================================
  // 🔧 MÉTODOS PARA MANTENIMIENTOS
  // ============================================================================

  async obtenerMantenimientos(): Promise<any[]> {
    const query = `
      SELECT "id", "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
             "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza", 
             "createdAt", "updatedAt"
      FROM "MINOILDES"."mantenimientos_choperas"
      ORDER BY "fechaVisita" DESC
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => ({
        ...row,
        itemCode: row.ItemCode, // Mapear ItemCode a itemCode para mantener compatibilidad
        choperaCode: row.choperaId, // Mapear choperaId a choperaCode para mantener compatibilidad
        fechaVisita: new Date(row.fechaVisita),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo mantenimientos:', error);
      throw error;
    }
  }

  async obtenerMantenimientoPorId(id: number): Promise<any | null> {
    const query = `
      SELECT "id", "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
             "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza", 
             "createdAt", "updatedAt"
      FROM "MINOILDES"."mantenimientos_choperas"  
      WHERE "id" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [id]);
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        ...row,
        itemCode: row.ItemCode, // Mapear ItemCode a itemCode para mantener compatibilidad
        choperaCode: row.choperaId, // Mapear choperaId a choperaCode para mantener compatibilidad
        fechaVisita: new Date(row.fechaVisita),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    } catch (error) {
      this.logger.error('Error obteniendo mantenimiento por ID:', error);
      throw error;
    }
  }

  async crearMantenimiento(mantenimiento: any): Promise<any> {
    const query = `
      INSERT INTO "MINOILDES"."mantenimientos_choperas" (
        "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
        "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      this.logger.log('🔍 Intentando crear mantenimiento con datos:', JSON.stringify(mantenimiento, null, 2));
      
      await this.executeQuery(query, [
        mantenimiento.usuarioId,
        mantenimiento.fechaVisita,
        mantenimiento.clienteCodigo,
        mantenimiento.itemCode,
        mantenimiento.choperaCode,
        mantenimiento.tipoMantenimientoId,
        mantenimiento.estadoGeneral,
        mantenimiento.comentarioEstado,
        mantenimiento.comentarioCalidadCerveza,
      ]);
      
      this.logger.log('✅ Mantenimiento insertado correctamente');
      
      // Obtener el ID real generado por la base de datos
      const queryBuscar = `
        SELECT "id", "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
               "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza", 
               "createdAt", "updatedAt"
        FROM "MINOILDES"."mantenimientos_choperas"
        WHERE "usuarioId" = ? AND "ItemCode" = ? AND "fechaVisita" = ?
        ORDER BY "id" DESC
        LIMIT 1
      `;
      
      const resultado = await this.executeQuery(queryBuscar, [
        mantenimiento.usuarioId,
        mantenimiento.itemCode,
        mantenimiento.fechaVisita
      ]);
      
      if (resultado.length === 0) {
        throw new Error('No se pudo encontrar el mantenimiento recién creado');
      }
      
      const mantenimientoCreado = resultado[0];
      this.logger.log('✅ Mantenimiento encontrado con ID real:', mantenimientoCreado.id);
      
      return {
        ...mantenimientoCreado,
        itemCode: mantenimientoCreado.ItemCode, // Mapear ItemCode a itemCode para mantener compatibilidad
        choperaCode: mantenimientoCreado.choperaId, // Mapear choperaId a choperaCode para mantener compatibilidad
        fechaVisita: new Date(mantenimientoCreado.fechaVisita),
        createdAt: new Date(mantenimientoCreado.createdAt),
        updatedAt: new Date(mantenimientoCreado.updatedAt),
      };
    } catch (error) {
      this.logger.error('Error creando mantenimiento:', error);
      throw error;
    }
  }

  async actualizarMantenimiento(id: number, datos: any): Promise<any | null> {
    // Mapear nombres de campos para mantener compatibilidad
    const mapeoCampos: { [key: string]: string } = {
      itemCode: 'ItemCode',
      choperaCode: 'choperaId'
    };
    
    const camposMapeados: { [key: string]: any } = {};
    Object.keys(datos).forEach(key => {
      if (key !== 'id') {
        const campoDB = mapeoCampos[key] || key;
        camposMapeados[campoDB] = datos[key];
      }
    });
    
    const campos = Object.keys(camposMapeados);
    const valores = Object.values(camposMapeados);
    
    if (campos.length === 0) return await this.obtenerMantenimientoPorId(id);
    
    const setClause = campos.map(campo => `"${campo}" = ?`).join(', ');
    const query = `
      UPDATE "MINOILDES"."mantenimientos_choperas" 
      SET ${setClause}${setClause ? ', ' : ''}"updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
    `;
    
    try {
      await this.executeQuery(query, [...valores, id]);
      return await this.obtenerMantenimientoPorId(id);
    } catch (error) {
      this.logger.error('Error actualizando mantenimiento:', error);
      throw error;
    }
  }

  async eliminarMantenimiento(id: number): Promise<boolean> {
    const query = `DELETE FROM "MINOILDES"."mantenimientos_choperas" WHERE "id" = ?`;
    
    try {
      await this.executeQuery(query, [id]);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando mantenimiento:', error);
      throw error;
    }
  }

  async obtenerMantenimientosPorChopera(itemCode: string): Promise<any[]> {
    const query = `
      SELECT "id", "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
             "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza", 
             "createdAt", "updatedAt"
      FROM "MINOILDES"."mantenimientos_choperas"
      WHERE "ItemCode" = ?
      ORDER BY "fechaVisita" DESC
    `;
    
    try {
      const result = await this.executeQuery(query, [itemCode]);
      return result.map(row => ({
        ...row,
        itemCode: row.ItemCode, // Mapear ItemCode a itemCode para mantener compatibilidad
        choperaCode: row.choperaId, // Mapear choperaId a choperaCode para mantener compatibilidad
        fechaVisita: new Date(row.fechaVisita),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo mantenimientos por chopera:', error);
      throw error;
    }
  }

  async obtenerMantenimientosPorUsuario(usuarioId: number): Promise<any[]> {
    const query = `
      SELECT "id", "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
             "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza", 
             "createdAt", "updatedAt"
      FROM "MINOILDES"."mantenimientos_choperas"
      WHERE "usuarioId" = ?
      ORDER BY "fechaVisita" DESC
    `;
    
    try {
      const result = await this.executeQuery(query, [usuarioId]);
      return result.map(row => ({
        ...row,
        itemCode: row.ItemCode, // Mapear ItemCode a itemCode para mantener compatibilidad
        choperaCode: row.choperaId, // Mapear choperaId a choperaCode para mantener compatibilidad
        fechaVisita: new Date(row.fechaVisita),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo mantenimientos por usuario:', error);
      throw error;
    }
  }

  async obtenerMantenimientosPorFecha(fechaInicio: Date, fechaFin: Date): Promise<any[]> {
    const query = `
      SELECT "id", "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
             "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza", 
             "createdAt", "updatedAt"
      FROM "MINOILDES"."mantenimientos_choperas"
      WHERE "fechaVisita" BETWEEN ? AND ?
      ORDER BY "fechaVisita" DESC
    `;
    
    try {
      const result = await this.executeQuery(query, [fechaInicio, fechaFin]);
      return result.map(row => ({
        ...row,
        itemCode: row.ItemCode, // Mapear ItemCode a itemCode para mantener compatibilidad
        choperaCode: row.choperaId, // Mapear choperaId a choperaCode para mantener compatibilidad
        fechaVisita: new Date(row.fechaVisita),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo mantenimientos por fecha:', error);
      throw error;
    }
  }

  async obtenerChoperasConUltimoMantenimiento(): Promise<any[]> {
    this.logger.log('🍺 Obteniendo choperas con último mantenimiento...');
    
    try {
      // Paso 1: Obtener choperas del procedimiento
      const choperasResult = await this.executeQuery(`call "MINOILDES"."ListadoChoperas"(0)`);
      this.logger.log(`✅ Obtenidas ${choperasResult.length} choperas`);

      // Paso 2: Obtener últimos mantenimientos con información de usuarios y tipos
      const mantenimientosQuery = `
        WITH UltimosMantenimientos AS (
          SELECT 
            m."choperaId",
            m."id" as ultimo_mantenimiento_id,
            m."usuarioId",
            m."fechaVisita",
            m."createdAt" as fechaCreacion,
            m."estadoGeneral",
            m."tipoMantenimientoId",
            ROW_NUMBER() OVER (
              PARTITION BY m."choperaId" 
              ORDER BY m."fechaVisita" DESC, m."createdAt" DESC
            ) as rn
          FROM "MINOILDES"."mantenimientos_choperas" m
        )
        SELECT 
          um."choperaId",
          um.ultimo_mantenimiento_id,
          um."usuarioId" as tecnico_id,
          um."fechaVisita",
          um.fechaCreacion,
          um."estadoGeneral",
          um."tipoMantenimientoId",
          u."nombre" as tecnico_nombre,
          u."apellido" as tecnico_apellido,
          tm."nombre" as tipo_mantenimiento
        FROM UltimosMantenimientos um
        LEFT JOIN "MINOILDES"."users" u ON um."usuarioId" = u."id"
        LEFT JOIN "MINOILDES"."tipos_mantenimiento" tm ON um."tipoMantenimientoId" = tm."id"
        WHERE um.rn = 1
      `;

      const mantenimientosResult = await this.executeQuery(mantenimientosQuery);
      this.logger.log(`✅ Obtenidos ${mantenimientosResult.length} últimos mantenimientos`);

      // Crear mapa de mantenimientos por serie
      const mantenimientosMap = new Map();
      mantenimientosResult.forEach(m => {
        const key = m.choperaId?.trim();
        mantenimientosMap.set(key, m);
      });

      // Combinar choperas con mantenimientos
      const resultado = choperasResult.map(chopera => {
        const serieKey = chopera.SerieActivo?.trim();
        const mantenimiento = mantenimientosMap.get(serieKey);
        
        return {
          ItemCode: chopera.ItemCode?.trim() || '',
          ItemName: chopera.ItemName?.trim() || '',
          Status: chopera.Status?.trim() || '',
          Ciudad: chopera.Ciudad?.trim() || '',
          SerieActivo: chopera.SerieActivo?.trim() || '',
          CardCode: chopera.CardCode?.trim() || '',
          CardName: chopera.CardName?.trim() || '',
          AliasName: chopera.AliasName?.trim() || '',
          // Información del último mantenimiento (si existe) - USANDO NOMBRES EN MAYÚSCULAS
          ultimo_mantenimiento_id: mantenimiento?.ULTIMO_MANTENIMIENTO_ID || null,
          fechaVisita: mantenimiento?.fechaVisita || null,
          fechaCreacion: mantenimiento?.FECHACREACION || null,
          tecnico_id: mantenimiento?.TECNICO_ID || null,
          tecnico_nombre: mantenimiento?.TECNICO_NOMBRE?.trim() || null,
          tecnico_apellido: mantenimiento?.TECNICO_APELLIDO?.trim() || null,
          estadoGeneral: mantenimiento?.estadoGeneral?.trim() || null,
          tipo_mantenimiento: mantenimiento?.TIPO_MANTENIMIENTO?.trim() || null,
        };
      });

      return resultado;
    } catch (error) {
      this.logger.error('Error obteniendo choperas con último mantenimiento:', error);
      throw error;
    }
  }

  // ============================================================================
  // 📋 MÉTODOS PARA RESPUESTAS DE CHECKLIST
  // ============================================================================

  async crearRespuestaChecklist(respuesta: any): Promise<any> {
    const query = `
      INSERT INTO "MINOILDES"."respuestas_checklist" (
        "itemId", "valor", "mantenimientoId"
      ) VALUES (?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [
        respuesta.itemId,
        respuesta.valor,
        respuesta.mantenimientoId,
      ]);
      
      // Obtener la respuesta creada
      const respuestas = await this.obtenerRespuestasChecklistPorMantenimiento(respuesta.mantenimientoId);
      return respuestas.find(r => 
        r.itemId === respuesta.itemId && 
        r.mantenimientoId === respuesta.mantenimientoId
      );
    } catch (error) {
      this.logger.error('Error creando respuesta checklist:', error);
      throw error;
    }
  }

  async obtenerRespuestasChecklistPorMantenimiento(mantenimientoId: number): Promise<any[]> {
    const query = `
      SELECT "id", "itemId", "valor", "mantenimientoId"
      FROM "MINOILDES"."respuestas_checklist"
      WHERE "mantenimientoId" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [mantenimientoId]);
      return result;
    } catch (error) {
      this.logger.error('Error obteniendo respuestas checklist:', error);
      throw error;
    }
  }

  // ============================================================================
  // 🍺 MÉTODOS PARA RESPUESTAS SENSORIALES
  // ============================================================================

  async crearRespuestaSensorial(respuesta: any): Promise<any> {
    const query = `
      INSERT INTO "MINOILDES"."respuestas_sensoriales" (
        "grifo", "cerveza", "criterio", "valor", "mantenimientoId"
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [
        respuesta.grifo,
        respuesta.cerveza,
        respuesta.criterio,
        respuesta.valor,
        respuesta.mantenimientoId,
      ]);
      
      // Obtener la respuesta creada
      const respuestas = await this.obtenerRespuestasSensorialesPorMantenimiento(respuesta.mantenimientoId);
      return respuestas.find(r => 
        r.grifo === respuesta.grifo && 
        r.cerveza === respuesta.cerveza &&
        r.mantenimientoId === respuesta.mantenimientoId
      );
    } catch (error) {
      this.logger.error('Error creando respuesta sensorial:', error);
      throw error;
    }
  }

  async obtenerRespuestasSensorialesPorMantenimiento(mantenimientoId: number): Promise<any[]> {
    const query = `
      SELECT "id", "grifo", "cerveza", "criterio", "valor", "mantenimientoId"
      FROM "MINOILDES"."respuestas_sensoriales"
      WHERE "mantenimientoId" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [mantenimientoId]);
      return result;
    } catch (error) {
      this.logger.error('Error obteniendo respuestas sensoriales:', error);
      throw error;
    }
  }

  // ============================================================================
  // 🔧 MÉTODOS PARA TIPOS DE MANTENIMIENTO
  // ============================================================================

  async obtenerTiposMantenimiento(): Promise<any[]> {
    const query = `
      SELECT "id", "nombre", "descripcion", "activo", "createdAt", "updatedAt"
      FROM "MINOILDES"."tipos_mantenimiento"
      WHERE "activo" = true
      ORDER BY "nombre"
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo tipos de mantenimiento:', error);
      throw error;
    }
  }

  async obtenerTipoMantenimientoPorId(id: number): Promise<any | null> {
    const query = `
      SELECT "id", "nombre", "descripcion", "activo", "createdAt", "updatedAt"
      FROM "MINOILDES"."tipos_mantenimiento"
      WHERE "id" = ?
    `;
    
    try {
      const result = await this.executeQuery(query, [id]);
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    } catch (error) {
      this.logger.error('Error obteniendo tipo de mantenimiento por ID:', error);
      throw error;
    }
  }

  async crearTipoMantenimiento(tipo: any): Promise<any> {
    const query = `
      INSERT INTO "MINOILDES"."tipos_mantenimiento" ("nombre", "descripcion", "activo")
      VALUES (?, ?, ?)
    `;
    
    try {
      await this.executeQuery(query, [tipo.nombre, tipo.descripcion, tipo.activo]);
      
      // Obtener el tipo creado
      const tipos = await this.obtenerTiposMantenimiento();
      return tipos.find(t => t.nombre === tipo.nombre);
    } catch (error) {
      this.logger.error('Error creando tipo de mantenimiento:', error);
      throw error;
    }
  }

  async actualizarTipoMantenimiento(id: number, datos: any): Promise<any | null> {
    const campos = Object.keys(datos).filter(key => key !== 'id');
    const valores = Object.values(datos);
    
    if (campos.length === 0) return await this.obtenerTipoMantenimientoPorId(id);
    
    const setClause = campos.map(campo => `"${campo}" = ?`).join(', ');
    const query = `
      UPDATE "MINOILDES"."tipos_mantenimiento" 
      SET ${setClause}${setClause ? ', ' : ''}"updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
    `;
    
    try {
      await this.executeQuery(query, [...valores, id]);
      return await this.obtenerTipoMantenimientoPorId(id);
    } catch (error) {
      this.logger.error('Error actualizando tipo de mantenimiento:', error);
      throw error;
    }
  }

  async eliminarTipoMantenimiento(id: number): Promise<boolean> {
    const query = `DELETE FROM "MINOILDES"."tipos_mantenimiento" WHERE "id" = ?`;
    
    try {
      await this.executeQuery(query, [id]);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando tipo de mantenimiento:', error);
      throw error;
    }
  }
}