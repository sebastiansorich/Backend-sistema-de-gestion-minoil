import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LdapService, LDAPUserInfo } from './ldap.service';
import { SapHanaService, UsuarioHANA } from '../sap/sap-hana.service';
import { UsuarioConPermisosDto } from '../usuarios/dto/usuario-con-permisos.dto';
import * as bcrypt from 'bcryptjs';

export interface AuthResult {
  access_token: string;
  user: UsuarioConPermisosDto;
  authMethod: 'LDAP' | 'LOCAL';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly ldapService: LdapService,
    private readonly sapHanaService: SapHanaService,
  ) {}

  /**
   * Autenticación híbrida: LDAP primero, luego local
   */
  async login(username: string, password: string): Promise<AuthResult> {
    this.logger.log(`🔐 Intentando autenticación para usuario: ${username}`);

    try {
      // PASO 1: Intentar autenticación LDAP
      const ldapResult = await this.authenticateWithLDAP(username, password);
      if (ldapResult) {
        this.logger.log(`✅ Autenticación LDAP exitosa para: ${username}`);
        return ldapResult;
      }
    } catch (error) {
      this.logger.warn(`⚠️ Autenticación LDAP falló para ${username}: ${error.message}`);
    }

    // PASO 2: Intentar autenticación local
    try {
      const localResult = await this.authenticateWithLocal(username, password);
      this.logger.log(`✅ Autenticación local exitosa para: ${username}`);
      return localResult;
    } catch (error) {
      this.logger.error(`❌ Autenticación local falló para ${username}: ${error.message}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }

  /**
   * Autenticación con LDAP
   */
  private async authenticateWithLDAP(username: string, password: string): Promise<AuthResult | null> {
    try {
      // Autenticar con LDAP
      const ldapUserInfo = await this.ldapService.authenticateAndGetUserInfo(username, password);
      
      // Buscar usuario en SAP HANA por username LDAP
      let usuario = await this.sapHanaService.obtenerUsuarioPorUsername(ldapUserInfo.username);

      // Si no existe, buscar por empID o crear nuevo
      if (!usuario) {
        usuario = await this.findOrCreateUserFromLDAP(ldapUserInfo);
      }

      // Actualizar último acceso
      await this.updateLastAccess(usuario.id);

      // Cargar permisos y generar token
      const usuarioConPermisos = await this.loadUserPermissions(usuario);
      const token = this.generateJWT(usuario, usuarioConPermisos.rol);

      return {
        access_token: token,
        user: usuarioConPermisos,
        authMethod: 'LDAP',
      };

    } catch (error) {
      this.logger.debug(`LDAP authentication failed for ${username}: ${error.message}`);
      return null;
    }
  }

  /**
   * Autenticación local
   */
  private async authenticateWithLocal(username: string, password: string): Promise<AuthResult> {
    // Buscar usuario en SAP HANA
    const usuario = await this.sapHanaService.obtenerUsuarioPorUsername(username);
    
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar que el usuario permita autenticación local
    if (usuario.autenticacion === 'LDAP_ONLY') {
      throw new UnauthorizedException('Usuario configurado solo para autenticación LDAP');
    }

    // Verificar contraseña
    if (!usuario.password) {
      throw new UnauthorizedException('Usuario sin contraseña configurada');
    }

    const isPasswordValid = await bcrypt.compare(password, usuario.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    // Actualizar último acceso
    await this.updateLastAccess(usuario.id);

    // Cargar permisos y generar token
    const usuarioConPermisos = await this.loadUserPermissions(usuario);
    const token = this.generateJWT(usuario, usuarioConPermisos.rol);

    return {
      access_token: token,
      user: usuarioConPermisos,
      authMethod: 'LOCAL',
    };
  }

  /**
   * Busca o crea usuario desde información LDAP
   */
  private async findOrCreateUserFromLDAP(ldapUserInfo: LDAPUserInfo): Promise<UsuarioHANA> {
    // Buscar por empID en SAP
    const empleadosSAP = await this.sapHanaService.obtenerEmpleadosActivos();
    const empleadoSAP = this.findEmployeeByLDAPInfo(ldapUserInfo, empleadosSAP);

    if (empleadoSAP) {
      // Buscar usuario existente por empID
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      let usuario = usuarios.find(u => u.empID === empleadoSAP.empID);

      if (usuario) {
        // Actualizar información LDAP
        await this.sapHanaService.actualizarUsuario(usuario.id, {
          username: ldapUserInfo.username,
          email: ldapUserInfo.email,
          autenticacion: 'LDAP',
        });
        return await this.sapHanaService.obtenerUsuarioPorId(usuario.id);
      }
    }

    // Crear nuevo usuario
    return await this.createNewUserFromLDAP(ldapUserInfo, empleadoSAP);
  }

  /**
   * Busca empleado SAP por información LDAP
   */
  private findEmployeeByLDAPInfo(ldapUserInfo: LDAPUserInfo, empleadosSAP: any[]): any | null {
    const nombreCompletoLDAP = `${ldapUserInfo.nombre} ${ldapUserInfo.apellido}`.toLowerCase();
    
    // Buscar por nombre exacto
    const matchExacto = empleadosSAP.find(emp => 
      emp.nombreCompletoSap.toLowerCase() === nombreCompletoLDAP
    );
    
    if (matchExacto) return matchExacto;

    // Buscar por similitud
    let mejorMatch: any = null;
    let mejorSimilitud = 0;

    for (const empleado of empleadosSAP) {
      const similitud = this.calculateSimilarity(
        nombreCompletoLDAP, 
        empleado.nombreCompletoSap.toLowerCase()
      );
      
      if (similitud > mejorSimilitud && similitud >= 85) {
        mejorMatch = empleado;
        mejorSimilitud = similitud;
      }
    }

    return mejorMatch;
  }

  /**
   * Crea nuevo usuario desde información LDAP
   */
  private async createNewUserFromLDAP(ldapUserInfo: LDAPUserInfo, empleadoSAP: any): Promise<UsuarioHANA> {
    // Obtener rol por defecto (ID = 3)
    const rolPorDefecto = await this.sapHanaService.obtenerRolPorId(3);

    if (!rolPorDefecto) {
      throw new Error('No se encontró el rol por defecto con ID = 3');
    }

    const datosUsuario: any = {
      username: ldapUserInfo.username,
      email: ldapUserInfo.email,
      nombre: ldapUserInfo.nombre,
      apellido: ldapUserInfo.apellido,
      autenticacion: 'LDAP',
      activo: true,
      ROLID: rolPorDefecto.id, // Usar ROLID para mantener consistencia
    };

    // Si hay empleado SAP, agregar información adicional
    if (empleadoSAP) {
      datosUsuario.empID = empleadoSAP.empID;
      datosUsuario.nombreCompletoSap = empleadoSAP.nombreCompletoSap;
    }

    const nuevoUsuario = await this.sapHanaService.crearUsuario(datosUsuario);
    this.logger.log(`👤 Nuevo usuario creado desde LDAP: ${ldapUserInfo.username}`);
    return nuevoUsuario;
  }

  /**
   * Actualiza último acceso del usuario
   */
  private async updateLastAccess(userId: number): Promise<void> {
    await this.sapHanaService.actualizarUsuario(userId, {
      ultimoAcceso: new Date(),
    });
  }

  /**
   * Carga permisos del usuario
   */
  private async loadUserPermissions(usuario: UsuarioHANA): Promise<UsuarioConPermisosDto> {
    // Obtener permisos del rol
    const permisos = await this.sapHanaService.obtenerPermisosPorRol(usuario.ROLID);

    // Obtener módulos para los permisos
    const modulos = await this.sapHanaService.obtenerModulos();
    const modulosMap = new Map(modulos.map(modulo => [modulo.id, modulo]));

    // Construir permisos con información del módulo
    const permisosConModulos = permisos.map(permiso => {
      const modulo = modulosMap.get(permiso.moduloId);
      return {
        moduloId: permiso.moduloId,
        moduloNombre: modulo ? modulo.nombre : 'Módulo no encontrado',
        crear: permiso.crear,
        leer: permiso.leer,
        actualizar: permiso.actualizar,
        eliminar: permiso.eliminar,
      };
    }).filter(permiso => permiso.moduloNombre !== 'Módulo no encontrado');

    // Obtener rol
    const rol = await this.sapHanaService.obtenerRolPorId(usuario.ROLID);

    return {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      autenticacion: usuario.autenticacion,
      activo: usuario.activo,
      ultimoAcceso: usuario.ultimoAcceso,
      empID: usuario.empID,
      jefeDirectoSapId: usuario.jefeDirectoSapId,
      nombreCompletoSap: usuario.nombreCompletoSap,
      rol: {
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
      },
      permisos: permisosConModulos,
    };
  }

  /**
   * Genera token JWT
   */
  private generateJWT(usuario: UsuarioHANA, rol: any): string {
      const payload = {
      sub: usuario.id,
      username: usuario.username,
      email: usuario.email,
      rol: rol.nombre,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Calcula similitud entre dos strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    const distance = this.calculateLevenshteinDistance(longer, shorter);
    return Math.round(((longer.length - distance) / longer.length) * 100);
  }

  /**
   * Calcula distancia de Levenshtein
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Cambia la contraseña de un usuario
   */
  async changePassword(username: string, currentPassword: string, newPassword: string, confirmPassword: string) {
    try {
      // Validar que las contraseñas coincidan
      if (newPassword !== confirmPassword) {
        throw new UnauthorizedException('Las contraseñas no coinciden');
      }

      // Obtener usuario
      const usuario = await this.sapHanaService.obtenerUsuarioPorUsername(username);

      if (!usuario) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Verificar que el usuario permita cambio de contraseña local
      if (usuario.autenticacion === 'LDAP_ONLY') {
        throw new UnauthorizedException('Usuario configurado solo para autenticación LDAP');
      }

      // Si es usuario LDAP, cambiar contraseña en LDAP
      if (usuario.autenticacion === 'LDAP') {
        await this.ldapService.changePassword(username, currentPassword, newPassword);
        this.logger.log(`🔐 Contraseña LDAP cambiada para usuario: ${username}`);
      } else {
        // Verificar contraseña actual local
        if (!usuario.password) {
          throw new UnauthorizedException('Usuario sin contraseña configurada');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, usuario.password);
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('Contraseña actual incorrecta');
      }

      // Encriptar nueva contraseña
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña en SAP HANA
      await this.sapHanaService.actualizarUsuario(usuario.id, {
        password: hashedNewPassword,
      });

        this.logger.log(`🔐 Contraseña local cambiada para usuario: ${username}`);
      }

      return {
        message: 'Contraseña cambiada exitosamente',
        success: true
      };

    } catch (error) {
      this.logger.error(`Error al cambiar contraseña para usuario ${username}:`, error);
      throw error;
    }
  }

  /**
   * Valida token JWT
   */
  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
