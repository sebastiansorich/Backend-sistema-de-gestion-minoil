import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as bcrypt from 'bcrypt';
import { UsuarioConPermisosDto } from '../usuarios/dto/usuario-con-permisos.dto';
import { LdapService } from './ldap.service';
import { SapHanaService } from '../sap/sap-hana.service';
import { NombreMatchingUtil } from '../../utils/nombre-matching.util';
import { PasswordPolicyService } from './password-policy.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  constructor(
    private prisma: PrismaService,
    private ldapService: LdapService,
    private sapHanaService: SapHanaService,
    private passwordPolicyService: PasswordPolicyService
  ) {}

  async login(username: string, password: string): Promise<UsuarioConPermisosDto> {
    try {
      // 1. Intentar autenticación LDAP primero
      this.logger.log(`Intentando autenticación LDAP para usuario: ${username}`);
      
      const ldapUserInfo = await this.ldapService.authenticateAndGetUserInfo(username, password);
      
      // 2. LDAP exitoso: sincronizar usuario automáticamente
      const usuario = await this.syncUserFromLDAP(ldapUserInfo);
      
      // 3. Cargar permisos y retornar
      return await this.cargarPermisos(usuario);
      
    } catch (ldapError) {
      this.logger.warn(`Autenticación LDAP falló para ${username}, intentando autenticación local:`, ldapError.message);
      
      // 4. LDAP falló: intentar autenticación local
      return await this.loginLocal(username, password);
    }
  }

  /**
   * Autenticación local como fallback
   */
  private async loginLocal(username: string, password: string): Promise<UsuarioConPermisosDto> {
    const usuario = await this.prisma.usuario.findUnique({ where: { username } });
    
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (usuario.autenticacion !== 'local') {
      throw new UnauthorizedException('Usuario configurado para LDAP solamente');
    }

    if (!usuario.password) {
      throw new UnauthorizedException('Usuario sin password local');
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      throw new UnauthorizedException('Password incorrecto');
    }

    this.logger.log(`Autenticación local exitosa para usuario: ${username}`);
    return this.cargarPermisos(usuario);
  }

  /**
   * Sincroniza usuario desde LDAP - SOLO busca usuarios SAP existentes, NO crea nuevos
   */
  private async syncUserFromLDAP(ldapUserInfo: any): Promise<any> {
    const { username, email, nombre, apellido } = ldapUserInfo;
  
    this.logger.log(`🔍 LDAP Login: ${username} (${nombre} ${apellido}) - SOLO BUSCAR USUARIOS SAP EXISTENTES`);
  
    // PASO 1: Buscar usuario existente por username
    let usuarioSAP = await this.prisma.usuario.findUnique({ 
      where: { username },
      include: {
        cargo: { include: { rol: true } },
        area: true,
        sede: true
      }
    });
  
    if (usuarioSAP) {
      this.logger.log(`✅ Usuario encontrado por username: ${username} (SAP ID: ${usuarioSAP.empleadoSapId})`);
      
      // Actualizar último acceso y continuar
      return await this.prisma.usuario.update({
        where: { id: usuarioSAP.id },
        data: {
          ultimoAcceso: new Date(),
          email: email || usuarioSAP.email, // Actualizar email si viene de LDAP
          autenticacion: 'ldap'
        }
      });
    }
  
    // PASO 2: No existe por username - buscar en usuarios SAP por matching de nombres
    this.logger.log(`👤 Usuario ${username} no encontrado por username, buscando matches en usuarios SAP...`);
  
    // Obtener TODOS los usuarios SAP (que tienen empleadoSapId)
    const usuariosSAP = await this.prisma.usuario.findMany({
      where: {
        empleadoSapId: { not: null }, // Solo usuarios sincronizados desde SAP
        activo: true
      },
      select: {
        id: true,
        username: true,
        empleadoSapId: true,
        nombreCompletoSap: true,
        nombre: true,
        apellido: true
      }
    });
  
    this.logger.log(`📊 Buscando matches entre "${nombre} ${apellido}" y ${usuariosSAP.length} usuarios SAP...`);
  
    // PASO 3: Hacer matching inteligente
    const candidatosSAP = usuariosSAP.map(u => ({
      empleadoSapId: u.empleadoSapId!,
      nombreCompletoSap: u.nombreCompletoSap || `${u.nombre} ${u.apellido}`,
      usuarioCompleto: u
    }));
  
    const matchResult = NombreMatchingUtil.buscarEmpleadoSAPPorUsuarioLDAP(
      nombre,
      apellido,
      candidatosSAP,
      70 // Umbral más bajo para ser más inclusivo
    );
  
    if (matchResult.empleado) {
      this.logger.log(`🎯 MATCH ENCONTRADO:`, {
        usuarioLDAP: `${nombre} ${apellido}`,
        usuarioSAP: matchResult.empleado.nombreCompletoSap,
        similitud: `${matchResult.similitud}%`,
        esConfiable: matchResult.esConfiable,
        estrategia: matchResult.estrategia
      });
  
      // PASO 4: Actualizar usuario SAP existente con username LDAP
      const usuarioSAPEncontrado = matchResult.empleado.usuarioCompleto;
      
      this.logger.log(`🔄 Actualizando usuario SAP "${usuarioSAPEncontrado.username}" → "${username}"`);
  
      return await this.prisma.usuario.update({
        where: { id: usuarioSAPEncontrado.id },
        data: {
          username, // ¡ESTO ES CLAVE! Actualizar con username de LDAP
          email: email || `${username}@minoil.com.bo`,
          autenticacion: 'ldap',
          ultimoAcceso: new Date(),
          ultimaSincronizacion: new Date()
          // CONSERVAR todos los demás datos SAP (area, cargo, empleadoSapId, etc)
        }
      });
  
    } else {
      // PASO 5: NO SE ENCONTRÓ MATCH - DAR ERROR (NO CREAR USUARIO)
      this.logger.error(`❌ NO SE ENCONTRÓ USUARIO SAP para "${nombre} ${apellido}" (username: ${username})`);
      this.logger.error(`📋 Usuarios SAP disponibles: ${usuariosSAP.map(u => u.nombreCompletoSap || `${u.nombre} ${u.apellido}`).join(', ')}`);
      
      throw new UnauthorizedException(
        `Usuario "${nombre} ${apellido}" no encontrado en el sistema. ` +
        `Debe ser sincronizado desde SAP primero o contactar al administrador.`
      );
    }
  }

  // Implementa este método para devolver el DTO con permisos (Nueva arquitectura: Usuario → Cargo → Rol)
  async cargarPermisos(usuario: any): Promise<UsuarioConPermisosDto> {
    // Cargar usuario con todas las relaciones necesarias usando nueva arquitectura
    const usuarioCompleto = await this.prisma.usuario.findUnique({
      where: { id: usuario.id },
      include: {
        sede: { select: { id: true, nombre: true } },
        area: { select: { id: true, nombre: true } },
        cargo: { 
          select: { 
            id: true, 
            nombre: true,
            rol: {
              select: {
                id: true,
                nombre: true,
                permisos: {
                  include: {
                    modulo: { select: { id: true, nombre: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!usuarioCompleto) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Actualizar último acceso
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() }
    });

    // Mapear permisos desde cargo.rol (Nueva arquitectura)
    const permisos = usuarioCompleto.cargo.rol.permisos.map(permiso => ({
      moduloId: permiso.modulo.id,
      moduloNombre: permiso.modulo.nombre,
      crear: permiso.crear,
      leer: permiso.leer,
      actualizar: permiso.actualizar,
      eliminar: permiso.eliminar
    }));

    this.logger.log(`Permisos cargados para ${usuarioCompleto.username}:`, {
      cargo: usuarioCompleto.cargo.nombre,
      rol: usuarioCompleto.cargo.rol.nombre,
      cantidadPermisos: permisos.length
    });

    // Construir el DTO de respuesta
    return {
      id: usuarioCompleto.id,
      username: usuarioCompleto.username,
      email: usuarioCompleto.email,
      nombre: usuarioCompleto.nombre,
      apellido: usuarioCompleto.apellido,
      autenticacion: usuarioCompleto.autenticacion,
      activo: usuarioCompleto.activo,
      ultimoAcceso: usuarioCompleto.ultimoAcceso,
      sede: usuarioCompleto.sede,
      area: usuarioCompleto.area,
      cargo: usuarioCompleto.cargo,
      rol: {
        id: usuarioCompleto.cargo.rol.id,
        nombre: usuarioCompleto.cargo.rol.nombre
      },
      permisos
    };
  }

  /**
   * Cambia la contraseña de un usuario LDAP con validaciones y auditoría
   */
  async changePassword(
    username: string, 
    currentPassword: string, 
    newPassword: string, 
    confirmPassword: string,
    clientIp?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Validar que las contraseñas coincidan
      if (newPassword !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // 2. Validar que no sea la misma contraseña
      if (currentPassword === newPassword) {
        throw new Error('La nueva contraseña debe ser diferente a la actual');
      }

      // 3. Buscar usuario en la base de datos para verificar que existe
      const usuario = await this.prisma.usuario.findUnique({ 
        where: { username },
        select: { id: true, username: true, autenticacion: true, nombre: true, apellido: true, email: true }
      });

      if (!usuario) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // 4. Verificar que el usuario usa autenticación LDAP
      if (usuario.autenticacion === 'local') {
        throw new Error('Este usuario usa autenticación local. Use el proceso de cambio de contraseña local.');
      }

      // 5. Validar la nueva contraseña contra la política de seguridad
      const userInfo = {
        username: usuario.username,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email
      };

      const passwordValidation = this.passwordPolicyService.validatePassword(
        newPassword, 
        userInfo, 
        this.passwordPolicyService.getMinoilPasswordPolicy()
      );

      if (!passwordValidation.isValid) {
        const errorMessage = `Contraseña no cumple con la política de seguridad:\n${passwordValidation.errors.join('\n')}`;
        this.logger.warn(`Contraseña rechazada para usuario ${username}:`, passwordValidation.errors);
        throw new BadRequestException(errorMessage);
      }

      // Log del nivel de seguridad de la contraseña
      this.logger.log(`Contraseña validada para usuario ${username}:`, {
        strength: passwordValidation.strength,
        score: passwordValidation.score
      });

      // 6. Log de auditoría - inicio del proceso
      this.logger.log(`Iniciando cambio de contraseña para usuario LDAP: ${username}`, {
        userId: usuario.id,
        clientIp,
        userAgent: userAgent?.substring(0, 200), // Limitar tamaño del log
        timestamp: new Date().toISOString()
      });

      // 7. Intentar cambiar la contraseña en LDAP
      await this.ldapService.changePassword(username, currentPassword, newPassword);

      // 8. Log de auditoría - éxito
      this.logger.log(`Contraseña cambiada exitosamente para usuario LDAP: ${username}`, {
        userId: usuario.id,
        clientIp,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Contraseña cambiada exitosamente'
      };

    } catch (error) {
      // Log de auditoría - error
      this.logger.error(`Error al cambiar contraseña para usuario: ${username}`, {
        error: error.message,
        clientIp,
        timestamp: new Date().toISOString()
      });

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new Error(error.message || 'Error al cambiar la contraseña');
    }
  }
}
