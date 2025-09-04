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
      usuariosLDAP: number;
    };
  };
  error?: string;
}

export interface SyncOptions {
  soloActivos?: boolean;
  forzarSincronizacion?: boolean;
}

@Injectable()
export class SapSyncService {
  private readonly logger = new Logger(SapSyncService.name);

  constructor(
    private readonly sapHanaService: SapHanaService,
    private readonly ldapService: LdapService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sincronización unificada de usuarios SAP + LDAP
   * Algoritmo simplificado:
   * 1. Obtener empleados de SAP
   * 2. Obtener usuarios de LDAP
   * 3. Hacer matching por nombre/apellido
   * 4. Fusionar datos y crear/actualizar usuarios
   */
  async sincronizarUsuarios(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    this.logger.log('🔄 Iniciando sincronización unificada SAP + LDAP...');

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
          usuariosLDAP: 0,
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

      // PASO 3: Obtener usuarios LDAP
      this.logger.log('🔄 Obteniendo usuarios de LDAP...');
      const usuariosLDAP = await this.obtenerUsuariosLDAP();

      resultado.data!.detalles.empleadosSAP = empleadosSAP.length;
      resultado.data!.detalles.usuariosExistentes = usuariosExistentes.length;
      resultado.data!.detalles.usuariosLDAP = usuariosLDAP.length;

      this.logger.log(`📊 Datos obtenidos: ${empleadosSAP.length} empleados SAP, ${usuariosExistentes.length} usuarios existentes, ${usuariosLDAP.length} usuarios LDAP, ${roles.length} roles`);

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

      // PASO 4: Procesar cada empleado SAP
      let empleadosConMatch = 0;
      let empleadosSinMatch = 0;
      
      for (const empleado of empleadosSAP) {
        try {
          const usuarioLDAP = this.buscarUsuarioLDAP(empleado, usuariosLDAP);
          if (usuarioLDAP) {
            empleadosConMatch++;
            await this.procesarEmpleadoSAP(empleado, usuariosExistentes, roles, usuariosLDAP, resultado);
            resultado.data!.detalles.empleadosProcesados++;
          } else {
            empleadosSinMatch++;
          }
        } catch (error) {
          const errorMsg = `Error procesando empleado ${empleado.empID}: ${error.message}`;
          resultado.data!.errores.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }
      
      this.logger.log(`📊 Resumen matching: ${empleadosConMatch} con match, ${empleadosSinMatch} sin match`);

      // PASO 5: Eliminar usuarios que ya no tienen match SAP ↔ LDAP
      await this.desactivarUsuariosInactivos(empleadosSAP, usuariosLDAP, resultado);

      // PASO 6: Validar resultados
      const totalProcesados = resultado.data!.usuariosCreados + resultado.data!.usuariosActualizados;
      const tiempoTotal = Date.now() - startTime;

      resultado.success = true;
      resultado.message = `Sincronización completada exitosamente en ${tiempoTotal}ms. ${totalProcesados} usuarios procesados, ${resultado.data!.usuariosDesactivados} desactivados.`;

      this.logger.log(`✅ Sincronización completada: ${resultado.message}`);

    } catch (error) {
      resultado.success = false;
      resultado.error = error.message;
      resultado.message = 'Error en la sincronización';
      this.logger.error(`❌ Error en sincronización: ${error.message}`);
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
        // Debug: mostrar algunos valores de "activo" para entender el formato
        const valoresActivo = empleados.slice(0, 5).map(emp => ({
          empID: emp.empID,
          activo: emp.activo,
          tipo: typeof emp.activo
        }));
        this.logger.log(`🔍 Debug - Primeros 5 valores de 'activo': ${JSON.stringify(valoresActivo)}`);
        
        // El procedimiento almacenado ya filtra empleados activos, 
        // pero el campo 'activo' en el resultado puede ser false.
        // Si el procedimiento retorna empleados, asumimos que están activos.
        this.logger.log(`📊 Empleados activos filtrados: ${empleados.length} (procedimiento ya filtra activos)`);
        return empleados;
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
   * Procesar un empleado SAP individual
   */
  private async procesarEmpleadoSAP(
    empleado: EmpleadoSAP,
    usuariosExistentes: UsuarioHANA[],
    roles: any[],
    usuariosLDAP: LDAPUserInfo[],
    resultado: SyncResult
  ): Promise<void> {
    // Buscar usuario LDAP correspondiente
    const usuarioLDAP = this.buscarUsuarioLDAP(empleado, usuariosLDAP);

    // SOLO procesar si hay match SAP ↔ LDAP
    if (!usuarioLDAP) {
      this.logger.log(`❌ No se procesa empleado ${empleado.empID} (${empleado.nombreCompletoSap}): No hay match en LDAP`);
      return;
    }

    // Buscar usuario existente por empID
    const usuarioExistente = usuariosExistentes.find(u => u.empID === empleado.empID);

    if (usuarioExistente) {
      // Actualizar usuario existente con datos LDAP
      await this.actualizarUsuarioExistente(empleado, usuarioExistente, usuarioLDAP, usuariosExistentes, resultado);
    } else {
      // Crear nuevo usuario con datos LDAP (solo si hay match)
      await this.crearNuevoUsuario(empleado, roles, usuarioLDAP, usuariosExistentes, resultado);
    }
  }

  /**
   * Buscar usuario LDAP correspondiente al empleado SAP
   * Algoritmo mejorado de matching por nombre y apellido
   */
  private buscarUsuarioLDAP(empleado: EmpleadoSAP, usuariosLDAP: LDAPUserInfo[]): LDAPUserInfo | null {
    if (usuariosLDAP.length === 0) {
      return null;
    }

    const nombreCompletoSAP = empleado.nombreCompletoSap.toLowerCase();
    const [nombreSAP, ...apellidosSAP] = empleado.nombreCompletoSap.split(' ');
    const apellidoSAP = apellidosSAP.join(' ');
    
    // Normalizar nombres (quitar acentos, espacios extra, etc.)
    const normalizarNombre = (nombre: string) => {
      return nombre.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim();
    };

    const nombreSAPNormalizado = normalizarNombre(nombreCompletoSAP);
    
    // Debug temporal para casos específicos
    if (empleado.nombreCompletoSap.toLowerCase().includes('marcos') && empleado.nombreCompletoSap.toLowerCase().includes('grageda')) {
      this.logger.log(`🔍 Debug matching para: ${empleado.nombreCompletoSap}`);
      this.logger.log(`🔍 Nombre SAP normalizado: "${nombreSAPNormalizado}"`);
    }
    
    // 1. Buscar por nombre completo exacto (normalizado)
    let usuarioLDAP = usuariosLDAP.find(u => {
      const nombreLDAPNormalizado = normalizarNombre(`${u.nombre} ${u.apellido}`);
      return nombreLDAPNormalizado === nombreSAPNormalizado;
    });

    if (usuarioLDAP) {
      this.logger.debug(`🔍 Match exacto LDAP encontrado: ${usuarioLDAP.username} para ${empleado.nombreCompletoSap}`);
      return usuarioLDAP;
    }

    // 2. Buscar por nombre y apellido parcial (normalizado)
    usuarioLDAP = usuariosLDAP.find(u => {
      const nombreLDAPNormalizado = normalizarNombre(u.nombre);
      const apellidoLDAPNormalizado = normalizarNombre(u.apellido);
      const nombreSAPNormalizado = normalizarNombre(nombreSAP);
      const apellidoSAPNormalizado = normalizarNombre(apellidoSAP);
      
      return nombreLDAPNormalizado.includes(nombreSAPNormalizado) &&
             apellidoLDAPNormalizado.includes(apellidoSAPNormalizado);
    });

    if (usuarioLDAP) {
      this.logger.debug(`🔍 Match parcial LDAP encontrado: ${usuarioLDAP.username} para ${empleado.nombreCompletoSap}`);
      return usuarioLDAP;
    }

    // 3. Buscar por similitud de nombre (umbral más bajo para casos complejos)
    let mejorMatch: LDAPUserInfo | null = null;
    let mejorSimilitud = 0;
    
    for (const usuario of usuariosLDAP) {
      const nombreLDAPNormalizado = normalizarNombre(`${usuario.nombre} ${usuario.apellido}`);
      const similitud = this.calcularSimilitud(nombreSAPNormalizado, nombreLDAPNormalizado);
      
      if (similitud > mejorSimilitud && similitud > 70) { // Umbral más bajo
        mejorSimilitud = similitud;
        mejorMatch = usuario;
      }
    }

    if (mejorMatch) {
      this.logger.debug(`🔍 Match por similitud LDAP encontrado: ${mejorMatch.username} (${mejorSimilitud}%) para ${empleado.nombreCompletoSap}`);
      return mejorMatch;
    }

    this.logger.debug(`❌ No se encontró usuario LDAP para: ${empleado.nombreCompletoSap}`);
    return null;
  }

  /**
   * Calcular similitud entre dos strings usando distancia de Levenshtein
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
   * Actualizar usuario existente
   */
  private async actualizarUsuarioExistente(
    empleado: EmpleadoSAP,
    usuarioExistente: UsuarioHANA,
    usuarioLDAP: LDAPUserInfo,
    usuariosExistentes: UsuarioHANA[],
    resultado: SyncResult
  ): Promise<void> {
    const datosActualizacion: any = {
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      nombreCompletoSap: empleado.nombreCompletoSap,
      activo: empleado.activo,
      ultimaSincronizacion: new Date(),
    };

    // Asignar jefe directo (empID del jefe viene directamente de SAP)
    if (empleado.jefeDirecto && typeof empleado.jefeDirecto === 'number') {
      datosActualizacion.jefeDirectoSapId = empleado.jefeDirecto;
      this.logger.debug(`🔍 Jefe directo asignado: empID ${empleado.jefeDirecto} para ${empleado.nombreCompletoSap}`);
    }

    // Actualizar con información LDAP (siempre hay match en este punto)
    // Solo actualizar username si es diferente al actual y no existe otro usuario con ese username
    if (usuarioLDAP.username !== usuarioExistente.username) {
      // Verificar si el username de LDAP ya existe en otro usuario
      const usernameExiste = await this.verificarUsernameExistente(usuarioLDAP.username, usuarioExistente.id);
      if (!usernameExiste) {
        datosActualizacion.username = usuarioLDAP.username;
        datosActualizacion.email = `${usuarioLDAP.username}@minoil.com.bo`;
      } else {
        this.logger.warn(`⚠️ Username LDAP '${usuarioLDAP.username}' ya existe, manteniendo username actual: ${usuarioExistente.username}`);
      }
    }
    datosActualizacion.autenticacion = 'LDAP';
    
    this.logger.log(`🔄 Usuario actualizado con LDAP: ${usuarioLDAP.username} (${empleado.nombreCompletoSap})`);

    try {
      await this.sapHanaService.actualizarUsuario(usuarioExistente.id, datosActualizacion);
      resultado.data!.usuariosActualizados++;
    } catch (error) {
      throw new Error(`Error actualizando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Crear nuevo usuario con datos LDAP
   */
  private async crearNuevoUsuario(
    empleado: EmpleadoSAP,
    roles: any[],
    usuarioLDAP: LDAPUserInfo,
    usuariosExistentes: UsuarioHANA[],
    resultado: SyncResult
  ): Promise<void> {
    // Verificar si el username ya existe
    const usernameExiste = await this.verificarUsernameExistente(usuarioLDAP.username, null);
    if (usernameExiste) {
      this.logger.warn(`⚠️ Username LDAP '${usuarioLDAP.username}' ya existe, omitiendo creación para ${empleado.nombreCompletoSap} (empID: ${empleado.empID})`);
      return;
    }

    // Obtener rol por defecto (ID = 3 según tu requerimiento)
    const rolPorDefecto = roles.find(r => r.id === 3);
    
    if (!rolPorDefecto) {
      throw new Error('No se encontró el rol por defecto con ID = 3');
    }

    const datosUsuario: Omit<UsuarioHANA, 'id' | 'createdAt' | 'updatedAt'> = {
      username: usuarioLDAP.username,
      email: `${usuarioLDAP.username}@minoil.com.bo`,
      nombre: empleado.nombreCompletoSap.split(' ')[0] || empleado.nombreCompletoSap,
      apellido: empleado.nombreCompletoSap.split(' ').slice(1).join(' ') || '',
      activo: true,
      autenticacion: 'LDAP',
      empID: empleado.empID,
      jefeDirectoSapId: null,
      nombreCompletoSap: empleado.nombreCompletoSap,
      ROLID: rolPorDefecto.id, // Usar ROLID = 3
      ultimaSincronizacion: new Date(),
    };

    // Asignar jefe directo (empID del jefe viene directamente de SAP)
    if (empleado.jefeDirecto && typeof empleado.jefeDirecto === 'number') {
      datosUsuario.jefeDirectoSapId = empleado.jefeDirecto;
      this.logger.debug(`🔍 Jefe directo asignado: empID ${empleado.jefeDirecto} para ${empleado.nombreCompletoSap}`);
    }
    
    this.logger.log(`👤 Nuevo usuario creado con LDAP: ${usuarioLDAP.username} (${empleado.nombreCompletoSap})`);

    try {
      await this.sapHanaService.crearUsuario(datosUsuario);
      resultado.data!.usuariosCreados++;
    } catch (error) {
      throw new Error(`Error creando usuario ${empleado.empID}: ${error.message}`);
    }
  }

  /**
   * Desactivar usuarios que ya no están en SAP
   */
  private async desactivarUsuariosInactivos(
    empleadosSAP: EmpleadoSAP[],
    usuariosLDAP: LDAPUserInfo[],
    resultado: SyncResult
  ): Promise<void> {
    const empIDsConMatch = empleadosSAP.map(e => e.empID);
    
    try {
      const usuariosExistentes = await this.sapHanaService.obtenerUsuarios();
      const usuariosAEliminar = usuariosExistentes.filter(u => 
        u.empID && !empIDsConMatch.includes(u.empID)
      );

      for (const usuario of usuariosAEliminar) {
        try {
          // Eliminar usuario que ya no tiene match en SAP
          await this.sapHanaService.eliminarUsuario(usuario.id);
          resultado.data!.usuariosDesactivados++;
          this.logger.log(`🗑️ Usuario eliminado (sin match SAP): ${usuario.nombreCompletoSap} (ID: ${usuario.empID})`);
        } catch (error) {
          const errorMsg = `Error eliminando usuario ${usuario.empID}: ${error.message}`;
          resultado.data!.errores.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }
    } catch (error) {
      throw new Error(`Error obteniendo usuarios para eliminación: ${error.message}`);
    }
  }

  /**
   * Verificar si un username ya existe en otro usuario
   */
  private async verificarUsernameExistente(username: string, usuarioIdActual: number): Promise<boolean> {
    try {
      const usuarioExistente = await this.sapHanaService.obtenerUsuarioPorUsername(username);
      return usuarioExistente && usuarioExistente.id !== usuarioIdActual;
    } catch (error) {
      // Si no se encuentra el usuario, el username está disponible
      return false;
    }
  }


}
