import { Injectable, Logger } from '@nestjs/common';
import { SapHanaService, UsuarioHANA, EmpleadoSAP } from './sap-hana.service';
import { LdapService, LDAPUserInfo } from '../auth/ldap.service';
import { ConfigService } from '@nestjs/config';

export interface SyncResult {
  success: boolean;
  message: string;
  data?: {
  usuariosCreados: number;
  usuariosActualizados: number;
  usuariosDesactivados: number;
  errores: string[];
    detalles: {
      empleadosProcesados: number;
      empleadosSAP: number;
      usuariosExistentes: number;
    };
  };
  error?: string;
}

export interface SyncOptions {
  forzarSincronizacion?: boolean;
  soloActivos?: boolean;
  validarLDAP?: boolean;
}

@Injectable()
export class SapSyncService {
  private readonly logger = new Logger(SapSyncService.name);
  private readonly cache = new Map<string, any>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutos

  constructor(
    private readonly sapHanaService: SapHanaService,
    private readonly ldapService: LdapService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sincronización completa de usuarios con SAP HANA
   */
  async sincronizarUsuariosCompleto(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    this.logger.log('🔄 Iniciando sincronización completa de usuarios...');

    const resultado: SyncResult = {
      success: false,
      message: '',
      data: {
      usuariosCreados: 0,
      usuariosActualizados: 0,
      usuariosDesactivados: 0,
      errores: [],
        detalles: {
          empleadosProcesados: 0,
          empleadosSAP: 0,
          usuariosExistentes: 0,
        },
      },
    };

    try {
      // PASO 1: Validar conexión SAP
      await this.validarConexionSAP();

      // PASO 2: Obtener datos de SAP HANA
      this.logger.log('🔄 Obteniendo empleados de SAP...');
      const empleadosSAP = await this.obtenerEmpleadosSAP(options.soloActivos);
      
      this.logger.log('🔄 Obteniendo usuarios existentes...');
      const usuariosExistentes = await this.obtenerUsuariosExistentes();
      
      this.logger.log('🔄 Obteniendo roles...');
      const roles = await this.obtenerRolesExistentes();

      resultado.data!.detalles.empleadosSAP = empleadosSAP.length;
      resultado.data!.detalles.usuariosExistentes = usuariosExistentes.length;

      this.logger.log(`📊 Datos obtenidos: ${empleadosSAP.length} empleados SAP, ${usuariosExistentes.length} usuarios existentes, ${roles.length} roles`);

      // Verificar si tenemos datos para procesar
      if (empleadosSAP.length === 0) {
        this.logger.warn('⚠️ No se encontraron empleados SAP para procesar');
        resultado.success = true;
        resultado.message = 'No se encontraron empleados SAP para sincronizar';
        return resultado;
      }

      if (roles.length === 0) {
        this.logger.warn('⚠️ No se encontraron roles para asignar a usuarios');
        resultado.success = false;
        resultado.error = 'No se encontraron roles en la base de datos';
        resultado.message = 'Error: No hay roles disponibles para asignar a usuarios';
        return resultado;
      }

      // PASO 3: Procesar cada empleado SAP
      for (const empleado of empleadosSAP) {
        try {
          await this.procesarEmpleadoSAP(empleado, usuariosExistentes, roles, options, resultado);
          resultado.data!.detalles.empleadosProcesados++;
        } catch (error) {
          const errorMsg = `Error procesando empleado ${empleado.empID}: ${error.message}`;
          resultado.data!.errores.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // PASO 4: Desactivar usuarios que ya no están en SAP
      await this.desactivarUsuariosInactivos(empleadosSAP, resultado);

      // PASO 5: Validar resultados
      const totalProcesados = resultado.data!.usuariosCreados + resultado.data!.usuariosActualizados;
      const tiempoTotal = Date.now() - startTime;

      resultado.success = true;
      resultado.message = `Sincronización completada exitosamente en ${tiempoTotal}ms. ${totalProcesados} usuarios procesados, ${resultado.data!.usuariosDesactivados} desactivados.`;

      this.logger.log(`✅ Sincronización completada: ${resultado.message}`);

    } catch (error) {
      resultado.success = false;
      resultado.error = error.message;
      resultado.message = 'Error en la sincronización completa';
      this.logger.error(`❌ Error en sincronización: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Sincronización unificada: SAP + LDAP con estructura simplificada
   */
  async sincronizarUsuariosUnificado(options: SyncOptions = {}): Promise<SyncResult> {
    this.logger.log('🔄 Iniciando sincronización unificada SAP + LDAP...');
    
    const startTime = Date.now();
    const resultado: SyncResult = {
      success: false,
      message: '',
      data: {
        usuariosCreados: 0,
        usuariosActualizados: 0,
        usuariosDesactivados: 0,
        errores: [],
        detalles: {
          empleadosProcesados: 0,
          empleadosSAP: 0,
          usuariosExistentes: 0,
        },
      },
    };

    try {
      // PASO 1: Validar conexión SAP
      await this.validarConexionSAP();

      // PASO 2: Obtener datos de SAP HANA
      this.logger.log('🔄 Obteniendo empleados de SAP...');
      const empleadosSAP = await this.obtenerEmpleadosSAP(options.soloActivos);
      
      this.logger.log('🔄 Obteniendo usuarios existentes...');
      const usuariosExistentes = await this.obtenerUsuariosExistentes();
      
      this.logger.log('🔄 Obteniendo roles...');
      const roles = await this.obtenerRolesExistentes();

      resultado.data!.detalles.empleadosSAP = empleadosSAP.length;
      resultado.data!.detalles.usuariosExistentes = usuariosExistentes.length;

      this.logger.log(`📊 Datos obtenidos: ${empleadosSAP.length} empleados SAP, ${usuariosExistentes.length} usuarios existentes, ${roles.length} roles`);

      // PASO 3: Obtener usuarios LDAP para matching
      this.logger.log('🔄 Obteniendo usuarios de LDAP...');
      const usuariosLDAP = await this.obtenerUsuariosLDAP();

      this.logger.log(`📊 Usuarios LDAP obtenidos: ${usuariosLDAP.length}`);

      // PASO 4: Procesar cada empleado SAP con validación LDAP
      for (const empleado of empleadosSAP) {
        try {
          await this.procesarEmpleadoSAPUnificado(empleado, usuariosExistentes, roles, usuariosLDAP, resultado);
          resultado.data!.detalles.empleadosProcesados++;
        } catch (error) {
          const errorMsg = `Error procesando empleado ${empleado.empID}: ${error.message}`;
          resultado.data!.errores.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // PASO 5: Desactivar usuarios que ya no están en SAP
      await this.desactivarUsuariosInactivos(empleadosSAP, resultado);

      // PASO 6: Validar resultados
      const totalProcesados = resultado.data!.usuariosCreados + resultado.data!.usuariosActualizados;
      const tiempoTotal = Date.now() - startTime;

      resultado.success = true;
      resultado.message = `Sincronización unificada completada exitosamente en ${tiempoTotal}ms. ${totalProcesados} usuarios procesados, ${resultado.data!.usuariosDesactivados} desactivados.`;

      this.logger.log(`✅ Sincronización unificada completada: ${resultado.message}`);

    } catch (error) {
      resultado.success = false;
      resultado.error = error.message;
      resultado.message = 'Error en la sincronización unificada';
      this.logger.error(`❌ Error en sincronización unificada: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Sincronización con verificación individual de usuarios LDAP
   */
  async sincronizarUsuariosConVerificacionIndividual(): Promise<SyncResult> {
    this.logger.log('🔄 Iniciando sincronización con verificación individual LDAP...');
    
    const startTime = Date.now();
    const resultado: SyncResult = {
      success: false,
      message: '',
      data: {
        usuariosCreados: 0,
        usuariosActualizados: 0,
        usuariosDesactivados: 0,
        errores: [],
        detalles: {
          empleadosProcesados: 0,
          empleadosSAP: 0,
          usuariosExistentes: 0,
        },
      },
    };

    try {
      // PASO 1: Validar conexión SAP
      await this.validarConexionSAP();

      // PASO 2: Obtener datos de SAP HANA
      this.logger.log('🔄 Obteniendo empleados de SAP...');
      const empleadosSAP = await this.obtenerEmpleadosSAP(false); // Obtener todos, no solo activos
      
      this.logger.log('🔄 Obteniendo usuarios existentes...');
      const usuariosExistentes = await this.obtenerUsuariosExistentes();
      
      this.logger.log('🔄 Obteniendo roles...');
      const roles = await this.obtenerRolesExistentes();

      resultado.data!.detalles.empleadosSAP = empleadosSAP.length;
      resultado.data!.detalles.usuariosExistentes = usuariosExistentes.length;

      this.logger.log(`📊 Datos obtenidos: ${empleadosSAP.length} empleados SAP, ${usuariosExistentes.length} usuarios existentes, ${roles.length} roles`);

      // PASO 3: Obtener usuarios LDAP para matching
      this.logger.log('🔄 Obteniendo usuarios de LDAP...');
      const usuariosLDAP = await this.obtenerUsuariosLDAP();

      this.logger.log(`📊 Usuarios LDAP obtenidos: ${usuariosLDAP.length}`);

      // PASO 4: Procesar cada empleado SAP con validación LDAP
      for (const empleado of empleadosSAP) {
        try {
          await this.procesarEmpleadoSAPUnificado(empleado, usuariosExistentes, roles, usuariosLDAP, resultado);
          resultado.data!.detalles.empleadosProcesados++;
        } catch (error) {
          const errorMsg = `Error procesando empleado ${empleado.empID}: ${error.message}`;
          resultado.data!.errores.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // PASO 5: Desactivar usuarios que ya no están en SAP
      await this.desactivarUsuariosInactivos(empleadosSAP, resultado);

      // PASO 6: Validar resultados
      const totalProcesados = resultado.data!.usuariosCreados + resultado.data!.usuariosActualizados;
      const tiempoTotal = Date.now() - startTime;

      resultado.success = true;
      resultado.message = `Sincronización LDAP + SAP completada exitosamente en ${tiempoTotal}ms. ${totalProcesados} usuarios procesados, ${resultado.data!.usuariosDesactivados} desactivados.`;

      this.logger.log(`✅ Sincronización LDAP + SAP completada: ${resultado.message}`);

    } catch (error) {
      resultado.success = false;
      resultado.error = error.message;
      resultado.message = 'Error en la sincronización LDAP + SAP';
      this.logger.error(`❌ Error en sincronización LDAP + SAP: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Validar conexión a SAP HANA
   */
  private async validarConexionSAP(): Promise<void> {
    try {
      await this.sapHanaService.testConnection();
      this.logger.log('✅ Conexión SAP HANA validada');
    } catch (error) {
      throw new Error(`No se pudo conectar a SAP HANA: ${error.message}`);
    }
  }

  /**
   * Obtener empleados de SAP HANA
   */
  private async obtenerEmpleadosSAP(soloActivos: boolean = true): Promise<EmpleadoSAP[]> {
    try {
      const empleados = await this.sapHanaService.obtenerEmpleadosActivos();
      
      this.logger.log(`📊 Empleados obtenidos de SAP: ${empleados.length}`);
      
      if (soloActivos) {
        // TEMPORALMENTE: Mostrar todos los empleados para debug
        this.logger.log(`📊 Empleados totales obtenidos: ${empleados.length}`);
        
        if (empleados.length > 0) {
          this.logger.log(`📊 Primeros 3 empleados para debug:`, empleados.slice(0, 3).map(emp => ({
            empID: emp.empID,
            nombre: emp.nombreCompletoSap,
            activo: emp.activo,
            tipoActivo: typeof emp.activo
          })));
        }
        
        // TEMPORALMENTE: Retornar todos los empleados sin filtrar para debug
        this.logger.log(`📊 Retornando todos los empleados sin filtrar para debug`);
        return empleados;
        
        // CÓDIGO ORIGINAL (comentado temporalmente):
        // const empleadosActivos = empleados.filter(emp => {
        //   const activoValue = emp.activo as any;
        //   const esActivo = activoValue === true || activoValue === 1 || activoValue === 'Y' || activoValue === 'y';
        //   return esActivo;
        // });
        // return empleadosActivos;
      }
      
      return empleados;
    } catch (error) {
      throw new Error(`Error obteniendo empleados SAP: ${error.message}`);
    }
  }

  /**
   * Obtener usuarios existentes en la base de datos
   */
  private async obtenerUsuariosExistentes(): Promise<UsuarioHANA[]> {
    try {
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      this.logger.log(`📊 Usuarios existentes obtenidos: ${usuarios.length}`);
      return usuarios;
    } catch (error) {
      this.logger.error(`❌ Error obteniendo usuarios existentes: ${error.message}`);
      throw new Error(`Error obteniendo usuarios existentes: ${error.message}`);
    }
  }

  /**
   * Obtener roles existentes
   */
  private async obtenerRolesExistentes(): Promise<any[]> {
    try {
      const roles = await this.sapHanaService.obtenerRoles();
      this.logger.log(`📊 Roles obtenidos: ${roles.length}`);
      return roles;
    } catch (error) {
      this.logger.error(`❌ Error obteniendo roles: ${error.message}`);
      throw new Error(`Error obteniendo roles: ${error.message}`);
    }
  }

  /**
   * Procesar un empleado SAP individual
   */
  private async procesarEmpleadoSAP(
    empleado: EmpleadoSAP,
    usuariosExistentes: UsuarioHANA[],
    roles: any[],
    options: SyncOptions,
    resultado: SyncResult
  ): Promise<void> {
    // Buscar usuario existente por empID
    const usuarioExistente = usuariosExistentes.find(u => u.empID === empleado.empID);

    if (usuarioExistente) {
      // Actualizar usuario existente
      await this.actualizarUsuarioExistente(empleado, usuarioExistente, options, resultado);
    } else {
      // Crear nuevo usuario
      await this.crearNuevoUsuario(empleado, roles, options, resultado);
    }
  }

  /**
   * Actualizar usuario existente
   */
  private async actualizarUsuarioExistente(
    empleado: EmpleadoSAP,
    usuarioExistente: UsuarioHANA,
    options: SyncOptions,
    resultado: SyncResult
  ): Promise<void> {
    const datosActualizacion: any = {
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      activo: empleado.activo,
      ultimaSincronizacion: new Date(),
    };

    // Agregar información adicional si está disponible (solo campos que existen en la tabla)
    if (empleado.jefeDirecto && typeof empleado.jefeDirecto === 'number') {
      datosActualizacion.jefeDirectoSapId = empleado.jefeDirecto;
    }

    try {
      await this.sapHanaService.actualizarUsuario(usuarioExistente.id, datosActualizacion);
      resultado.data!.usuariosActualizados++;
      this.logger.debug(`🔄 Usuario actualizado: ${empleado.nombreCompletoSap} (ID: ${empleado.empID})`);
    } catch (error) {
      throw new Error(`Error actualizando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Crear nuevo usuario
   */
  private async crearNuevoUsuario(
    empleado: EmpleadoSAP,
    roles: any[],
    options: SyncOptions,
    resultado: SyncResult
  ): Promise<void> {
    // Obtener rol por defecto (ID = 3)
    const rolPorDefecto = await this.sapHanaService.obtenerRolPorId(3);
    
    if (!rolPorDefecto) {
      throw new Error('No se encontró el rol por defecto con ID = 3');
    }

    const datosUsuario: any = {
      empID: empleado.empID,
      username: this.generarUsername(empleado),
      email: this.generarEmail(empleado),
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      autenticacion: 'LOCAL',
      activo: empleado.activo,
      ROLID: rolPorDefecto.id, // Usar ROLID para mantener consistencia
      ultimaSincronizacion: new Date(),
    };

    // Agregar información adicional si está disponible (solo campos que existen en la tabla)
    if (empleado.jefeDirecto && typeof empleado.jefeDirecto === 'number') {
      datosUsuario.jefeDirectoSapId = empleado.jefeDirecto;
    }

    // Validar con LDAP si está habilitado (temporalmente comentado)
    // if (options.validarLDAP) {
    //   await this.validarUsuarioConLDAP(datosUsuario);
    // }

    try {
      await this.sapHanaService.crearUsuario(datosUsuario);
      resultado.data!.usuariosCreados++;
      this.logger.log(`👤 Nuevo usuario creado: ${empleado.nombreCompletoSap} (ID: ${empleado.empID})`);
    } catch (error) {
      throw new Error(`Error creando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Desactivar usuarios que ya no están en SAP
   */
  private async desactivarUsuariosInactivos(
    empleadosSAP: EmpleadoSAP[],
    resultado: SyncResult
  ): Promise<void> {
    const empIDsActivos = empleadosSAP.map(e => e.empID);
    
    try {
      const usuariosInactivos = await this.sapHanaService.obtenerUsuarios();
      const usuariosADesactivar = usuariosInactivos.filter(u => 
        u.empID && !empIDsActivos.includes(u.empID) && u.activo
      );

      for (const usuario of usuariosADesactivar) {
        try {
          await this.sapHanaService.actualizarUsuario(usuario.id, {
            activo: false,
            ultimaSincronizacion: new Date(),
          });
          resultado.data!.usuariosDesactivados++;
          this.logger.log(`🚫 Usuario desactivado: ${usuario.nombreCompletoSap} (ID: ${usuario.empID})`);
        } catch (error) {
          const errorMsg = `Error desactivando usuario ${usuario.empID}: ${error.message}`;
          resultado.data!.errores.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }
        } catch (error) {
      throw new Error(`Error obteniendo usuarios para desactivación: ${error.message}`);
    }
  }

  /**
   * Validar usuario con LDAP
   */
  private async validarUsuarioConLDAP(datosUsuario: any): Promise<void> {
    try {
      // Intentar buscar usuario en LDAP por nombre
      const usuariosLDAP = await this.ldapService.searchAllUsers();
      
      // Buscar usuario por nombre en la lista de usuarios LDAP
      const usuarioLDAP = usuariosLDAP.find(u => 
        u.nombre.toLowerCase().includes(datosUsuario.nombre.toLowerCase()) ||
        u.apellido.toLowerCase().includes(datosUsuario.apellido.toLowerCase())
      );
      
      if (usuarioLDAP) {
        // Si se encuentra en LDAP, cambiar autenticación
        datosUsuario.autenticacion = 'LDAP';
        datosUsuario.username = usuarioLDAP.username;
        datosUsuario.email = usuarioLDAP.email;
        this.logger.debug(`🔍 Usuario encontrado en LDAP: ${datosUsuario.nombreCompletoSap}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error validando usuario con LDAP: ${error.message}`);
      // No lanzar error para permitir que continúe la sincronización
    }
  }

  /**
   * Generar username único
   */
  private generarUsername(empleado: EmpleadoSAP): string {
    const nombre = empleado.nombreCompletoSap.split(' ')[0]?.toLowerCase() || 'usuario';
    const apellido = empleado.nombreCompletoSap.split(' ').slice(1).join('').toLowerCase() || '';
    return `${nombre}${apellido}${empleado.empID}`.replace(/[^a-z0-9]/g, '');
  }

  /**
   * Generar email
   */
  private generarEmail(empleado: EmpleadoSAP): string {
    const username = this.generarUsername(empleado);
    return `${username}@minoil.com.bo`;
  }

  /**
   * Limpiar cache
   */
  private limpiarCache(): void {
    const ahora = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (ahora - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtener datos del cache
   */
  private obtenerDelCache<T>(key: string): T | null {
    this.limpiarCache();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Guardar datos en cache
   */
  private guardarEnCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Obtener usuarios de LDAP
   */
  private async obtenerUsuariosLDAP(): Promise<LDAPUserInfo[]> {
    try {
      const usuarios = await this.ldapService.searchAllUsers();
      this.logger.log(`📊 Usuarios LDAP obtenidos: ${usuarios.length}`);
      return usuarios;
    } catch (error) {
      this.logger.warn(`⚠️ Error obteniendo usuarios LDAP: ${error.message}`);
      return []; // Retornar array vacío si falla LDAP
    }
  }

  /**
   * Procesar empleado SAP con estructura simplificada (sin cargos, áreas, regional)
   */
  private async procesarEmpleadoSAPUnificado(
    empleado: EmpleadoSAP,
    usuariosExistentes: UsuarioHANA[],
    roles: any[],
    usuariosLDAP: LDAPUserInfo[],
    resultado: SyncResult
  ): Promise<void> {
    // Buscar usuario existente por empID
    const usuarioExistente = usuariosExistentes.find(u => u.empID === empleado.empID);

    // Buscar usuario LDAP correspondiente
    const usuarioLDAP = this.buscarUsuarioLDAP(empleado, usuariosLDAP);

    if (usuarioExistente) {
      // Actualizar usuario existente
      await this.actualizarUsuarioExistenteUnificado(empleado, usuarioExistente, usuarioLDAP, resultado);
    } else {
      // Crear nuevo usuario
      await this.crearNuevoUsuarioUnificado(empleado, roles, usuarioLDAP, resultado);
    }
  }

  /**
   * Buscar usuario LDAP correspondiente al empleado SAP
   */
  private buscarUsuarioLDAP(empleado: EmpleadoSAP, usuariosLDAP: LDAPUserInfo[]): LDAPUserInfo | null {
    const nombreCompletoSAP = empleado.nombreCompletoSap.toLowerCase();
    
    // Buscar por nombre completo exacto
    let usuarioLDAP = usuariosLDAP.find(u => 
      `${u.nombre} ${u.apellido}`.toLowerCase() === nombreCompletoSAP
    );

    if (usuarioLDAP) {
      this.logger.debug(`🔍 Match exacto LDAP encontrado: ${usuarioLDAP.username} para ${empleado.nombreCompletoSap}`);
      return usuarioLDAP;
    }

    // Buscar por nombre o apellido parcial
    const [nombreSAP, ...apellidosSAP] = empleado.nombreCompletoSap.split(' ');
    const apellidoSAP = apellidosSAP.join(' ');

    usuarioLDAP = usuariosLDAP.find(u => 
      u.nombre.toLowerCase() === nombreSAP.toLowerCase() &&
      u.apellido.toLowerCase().includes(apellidoSAP.toLowerCase())
    );

    if (usuarioLDAP) {
      this.logger.debug(`🔍 Match parcial LDAP encontrado: ${usuarioLDAP.username} para ${empleado.nombreCompletoSap}`);
      return usuarioLDAP;
    }

    // Buscar por similitud de nombre
    for (const usuario of usuariosLDAP) {
      const nombreLDAP = `${usuario.nombre} ${usuario.apellido}`.toLowerCase();
      const similitud = this.calcularSimilitud(nombreCompletoSAP, nombreLDAP);
      
      if (similitud > 80) { // Umbral de similitud
        this.logger.debug(`🔍 Match por similitud LDAP encontrado: ${usuario.username} (${similitud}%) para ${empleado.nombreCompletoSap}`);
        return usuario;
      }
    }

    this.logger.debug(`❌ No se encontró usuario LDAP para: ${empleado.nombreCompletoSap}`);
    return null;
  }

  /**
   * Calcular similitud entre dos strings
   */
  private calcularSimilitud(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length * 100;
  }

  /**
   * Calcular distancia de Levenshtein
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Actualizar usuario existente con información LDAP
   */
  private async actualizarUsuarioExistenteConLDAP(
    empleado: EmpleadoSAP,
    usuarioExistente: UsuarioHANA,
    usuarioLDAP: LDAPUserInfo | null,
    resultado: SyncResult
  ): Promise<void> {
    const datosActualizacion: any = {
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      activo: empleado.activo,
      ultimaSincronizacion: new Date(),
    };

    // Agregar información adicional si está disponible
    if (empleado.cargo) datosActualizacion.cargo = empleado.cargo;
    if (empleado.area) datosActualizacion.area = empleado.area;
    if (empleado.sede) datosActualizacion.sede = empleado.sede;
    if (empleado.jefeDirecto) datosActualizacion.jefeDirectoSapId = empleado.jefeDirecto;

    // Si se encontró usuario LDAP, actualizar con información LDAP
    if (usuarioLDAP) {
      datosActualizacion.username = usuarioLDAP.username;
      datosActualizacion.email = usuarioLDAP.email;
      datosActualizacion.autenticacion = 'LDAP';
      
      // Mapear grupos LDAP a rol
      const mapeoRol = this.mapearGruposLDAPaRol(usuarioLDAP.groups);
      if (mapeoRol.rolId) {
        datosActualizacion.rolId = mapeoRol.rolId;
      }
      
      this.logger.debug(`🔄 Usuario actualizado con LDAP: ${usuarioLDAP.username} (${empleado.nombreCompletoSap})`);
    } else {
      // Si no se encontró en LDAP, mantener autenticación local
      datosActualizacion.autenticacion = 'LOCAL';
      this.logger.debug(`🔄 Usuario actualizado sin LDAP: ${empleado.nombreCompletoSap}`);
    }

    try {
      await this.sapHanaService.actualizarUsuario(usuarioExistente.id, datosActualizacion);
      resultado.data!.usuariosActualizados++;
    } catch (error) {
      throw new Error(`Error actualizando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Crear nuevo usuario con información LDAP
   */
  private async crearNuevoUsuarioConLDAP(
    empleado: EmpleadoSAP,
    roles: any[],
    usuarioLDAP: LDAPUserInfo | null,
    resultado: SyncResult
  ): Promise<void> {
    // Obtener rol por defecto (ID = 3)
    const rolPorDefecto = await this.sapHanaService.obtenerRolPorId(3);
    
    if (!rolPorDefecto) {
      throw new Error('No se encontró el rol por defecto con ID = 3');
    }

    const datosUsuario: any = {
      empID: empleado.empID,
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      activo: empleado.activo,
      ROLID: rolPorDefecto.id, // Usar ROLID para mantener consistencia
      ultimaSincronizacion: new Date(),
    };

    // Agregar información adicional si está disponible
    if (empleado.cargo) datosUsuario.cargo = empleado.cargo;
    if (empleado.area) datosUsuario.area = empleado.area;
    if (empleado.sede) datosUsuario.sede = empleado.sede;
    if (empleado.jefeDirecto) datosUsuario.jefeDirectoSapId = empleado.jefeDirecto;

    // Si se encontró usuario LDAP, usar información LDAP
    if (usuarioLDAP) {
      datosUsuario.username = usuarioLDAP.username;
      datosUsuario.email = usuarioLDAP.email;
      datosUsuario.autenticacion = 'LDAP';
      
      // Mapear grupos LDAP a rol
      const mapeoRol = this.mapearGruposLDAPaRol(usuarioLDAP.groups);
      if (mapeoRol.rolId) {
        datosUsuario.rolId = mapeoRol.rolId;
      }
      
      this.logger.log(`👤 Nuevo usuario creado con LDAP: ${usuarioLDAP.username} (${empleado.nombreCompletoSap})`);
    } else {
      // Si no se encontró en LDAP, generar username y usar autenticación local
      datosUsuario.username = this.generarUsername(empleado);
      datosUsuario.email = this.generarEmail(empleado);
      datosUsuario.autenticacion = 'LOCAL';
      
      this.logger.log(`👤 Nuevo usuario creado sin LDAP: ${datosUsuario.username} (${empleado.nombreCompletoSap})`);
    }

    try {
      await this.sapHanaService.crearUsuario(datosUsuario);
      resultado.data!.usuariosCreados++;
    } catch (error) {
      throw new Error(`Error creando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Mapear grupos LDAP a roles del sistema
   */
  private mapearGruposLDAPaRol(groups: string[]): { rolId?: number; rolNombre: string } {
    // Mapeo de grupos LDAP a roles locales
    const groupMappings: { [key: string]: string } = {
      'Domain Admins': 'Administrador',
      'Administradores': 'Administrador',
      'Gerentes': 'Gerente',
      'Ventas': 'Usuario',
      'RRHH': 'Usuario',
      'Contabilidad': 'Usuario',
      'IT': 'Usuario',
    };

    // Buscar el grupo con mayor privilegio
    for (const group of groups) {
      if (groupMappings[group]) {
        this.logger.debug(`🔍 Grupo ${group} mapeado a rol: ${groupMappings[group]}`);
        return { rolNombre: groupMappings[group] };
      }
    }

    // Rol por defecto para usuarios sin grupos específicos
    this.logger.debug(`🔍 Usuario sin grupos reconocidos, asignando rol por defecto`);
    return { rolNombre: 'Usuario' };
  }

  /**
   * Actualizar usuario existente con estructura simplificada
   */
  private async actualizarUsuarioExistenteUnificado(
    empleado: EmpleadoSAP,
    usuarioExistente: UsuarioHANA,
    usuarioLDAP: LDAPUserInfo | null,
    resultado: SyncResult
  ): Promise<void> {
    const datosActualizacion: any = {
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      activo: empleado.activo,
      ultimaSincronizacion: new Date(),
    };

    // Agregar información adicional si está disponible (solo campos que existen en la tabla)
    if (empleado.jefeDirecto && typeof empleado.jefeDirecto === 'number') {
      datosActualizacion.jefeDirectoSapId = empleado.jefeDirecto;
    }

    // Si se encontró usuario LDAP, actualizar con información LDAP REAL
    if (usuarioLDAP) {
      datosActualizacion.username = usuarioLDAP.username;
      datosActualizacion.email = usuarioLDAP.email; // Email REAL de LDAP
      datosActualizacion.autenticacion = 'LDAP';
      
      // Mapear grupos LDAP a rol
      const mapeoRol = this.mapearGruposLDAPaRol(usuarioLDAP.groups);
      if (mapeoRol.rolId) {
        datosActualizacion.rolId = mapeoRol.rolId;
      }
      
      this.logger.log(`🔄 Usuario actualizado con LDAP: ${usuarioLDAP.username} (${empleado.nombreCompletoSap}) - Email: ${usuarioLDAP.email}`);
    } else {
      // Si no se encontró en LDAP, mantener autenticación local
      datosActualizacion.autenticacion = 'LOCAL';
      this.logger.log(`🔄 Usuario actualizado sin LDAP: ${empleado.nombreCompletoSap}`);
    }

    try {
      await this.sapHanaService.actualizarUsuario(usuarioExistente.id, datosActualizacion);
      resultado.data!.usuariosActualizados++;
    } catch (error) {
      throw new Error(`Error actualizando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Crear nuevo usuario con estructura simplificada
   */
  private async crearNuevoUsuarioUnificado(
    empleado: EmpleadoSAP,
    roles: any[],
    usuarioLDAP: LDAPUserInfo | null,
    resultado: SyncResult
  ): Promise<void> {
    // Obtener rol por defecto (ID = 3)
    const rolPorDefecto = await this.sapHanaService.obtenerRolPorId(3);
    
    if (!rolPorDefecto) {
      throw new Error('No se encontró el rol por defecto con ID = 3');
    }

    const datosUsuario: any = {
      empID: empleado.empID,
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      activo: empleado.activo,
      ROLID: rolPorDefecto.id, // Usar ROLID para mantener consistencia
      ultimaSincronizacion: new Date(),
    };

    // Agregar información adicional si está disponible (solo campos que existen en la tabla)
    if (empleado.jefeDirecto && typeof empleado.jefeDirecto === 'number') {
      datosUsuario.jefeDirectoSapId = empleado.jefeDirecto;
    }

    // Si se encontró usuario LDAP, usar información LDAP REAL
    if (usuarioLDAP) {
      datosUsuario.username = usuarioLDAP.username;
      datosUsuario.email = usuarioLDAP.email; // Email REAL de LDAP
      datosUsuario.autenticacion = 'LDAP';
      
      // Mapear grupos LDAP a rol
      const mapeoRol = this.mapearGruposLDAPaRol(usuarioLDAP.groups);
      if (mapeoRol.rolId) {
        datosUsuario.rolId = mapeoRol.rolId;
      }
      
      this.logger.log(`👤 Nuevo usuario creado con LDAP: ${usuarioLDAP.username} (${empleado.nombreCompletoSap}) - Email: ${usuarioLDAP.email}`);
    } else {
      // Si no se encontró en LDAP, generar username y usar autenticación local
      datosUsuario.username = this.generarUsername(empleado);
      datosUsuario.email = this.generarEmail(empleado);
      datosUsuario.autenticacion = 'LOCAL';
      
      this.logger.log(`👤 Nuevo usuario creado sin LDAP: ${datosUsuario.username} (${empleado.nombreCompletoSap})`);
    }

    try {
      await this.sapHanaService.crearUsuario(datosUsuario);
      resultado.data!.usuariosCreados++;
    } catch (error) {
      throw new Error(`Error creando usuario ${empleado.empID}: ${error.message}`);
    }
  }

}
