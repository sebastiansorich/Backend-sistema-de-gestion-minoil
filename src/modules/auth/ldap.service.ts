import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as ldap from 'ldapjs';

export interface LDAPUserInfo {
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  displayName: string;
  department: string;
  office: string;
  title: string;
  groups: string[];
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);
  private readonly ldapUrl = 'ldap://SRVDC.main.minoil.com.bo';
  // Para cambio de contraseña en Active Directory se requiere canal seguro (LDAPS)
  private readonly ldapsUrl = 'ldaps://SRVDC.main.minoil.com.bo:636';
  private readonly baseDN = 'DC=main,DC=minoil,DC=com,DC=bo';
  private readonly useStartTLS = process.env.LDAP_USE_STARTTLS === 'true';
  private readonly tlsRejectUnauthorized = process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false';

  /**
   * Autentica un usuario contra LDAP y obtiene su información
   */
  async authenticateAndGetUserInfo(username: string, password: string): Promise<LDAPUserInfo> {
    const client = ldap.createClient({
      url: this.ldapUrl,
      timeout: 5000,
      connectTimeout: 5000,
    });

    const userDN = `MAIN\\${username}`;

    try {
      // 1. Autenticar usuario
      await this.bindUser(client, userDN, password);
      this.logger.log(`Usuario ${username} autenticado exitosamente en LDAP`);

      // 2. Buscar información del usuario
      const userInfo = await this.searchUserInfo(client, username);
      
      return userInfo;

    } catch (error) {
      this.logger.error(`Error en autenticación LDAP para ${username}:`, error.message);
      throw new UnauthorizedException('Credenciales LDAP inválidas');
    } finally {
      client.unbind();
    }
  }

  /**
   * Realiza el bind (autenticación) del usuario
   */
  private async bindUser(client: ldap.Client, userDN: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(userDN, password, (err) => {
        if (err) {
          reject(new UnauthorizedException('Credenciales LDAP inválidas'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Busca la información detallada del usuario en LDAP
   */
  private async searchUserInfo(client: ldap.Client, username: string): Promise<LDAPUserInfo> {
    return new Promise((resolve, reject) => {
      const searchOptions = {
        filter: `(sAMAccountName=${username})`,
        scope: 'sub',
        attributes: [
          'sAMAccountName',
          'mail',
          'givenName',
          'sn',
          'displayName',
          'department',
          'physicalDeliveryOfficeName',
          'title',
          'memberOf',
          'cn',
          'telephoneNumber'
        ],
      };

      client.search(this.baseDN, searchOptions, (err, res) => {
        if (err) {
          this.logger.error(`Error en búsqueda LDAP:`, err);
          reject(new Error('Error al buscar información del usuario en LDAP'));
          return;
        }

        let userFound = false;
        let userInfo: LDAPUserInfo;

        res.on('searchEntry', (entry) => {
          userFound = true;
          const attributes = entry.pojo.attributes;
          
          // Extraer grupos
          const memberOf = this.getAttributeValue(attributes, 'memberOf') || [];
          const groups = Array.isArray(memberOf) ? memberOf : [memberOf];
          const extractedGroups = groups
            .filter(group => group && typeof group === 'string')
            .map(group => this.extractGroupName(group))
            .filter(group => group);

          userInfo = {
            username: this.getStringValue(attributes, 'sAMAccountName') || username,
            email: this.getStringValue(attributes, 'mail') || `${username}@minoil.com.bo`,
            nombre: this.getStringValue(attributes, 'givenName') || '',
            apellido: this.getStringValue(attributes, 'sn') || '',
            displayName: this.getStringValue(attributes, 'displayName') || `${username}`,
            department: this.getStringValue(attributes, 'department') || '',
            office: this.getStringValue(attributes, 'physicalDeliveryOfficeName') || '',
            title: this.getStringValue(attributes, 'title') || '',
            groups: extractedGroups,
          };

          this.logger.log(`Información LDAP obtenida para ${username}:`, {
            nombre: userInfo.nombre,
            apellido: userInfo.apellido,
            email: userInfo.email,
            department: userInfo.department,
            title: userInfo.title,
            office: userInfo.office,
            groups: userInfo.groups,
          });
        });

        res.on('error', (error) => {
          this.logger.error(`Error en búsqueda LDAP:`, error);
          reject(new Error('Error al buscar usuario en LDAP'));
        });

        res.on('end', () => {
          if (!userFound) {
            reject(new Error('Usuario no encontrado en LDAP'));
          } else {
            resolve(userInfo);
          }
        });
      });
    });
  }

  /**
   * Extrae el valor de un atributo LDAP
   */
  private getAttributeValue(attributes: any[], attributeName: string): string | string[] | null {
    const attribute = attributes.find(attr => attr.type === attributeName);
    if (!attribute || !attribute.values || attribute.values.length === 0) {
      return null;
    }
    return attribute.values.length === 1 ? attribute.values[0] : attribute.values;
  }

  /**
   * Extrae el valor de un atributo LDAP como string
   */
  private getStringValue(attributes: any[], attributeName: string): string {
    const value = this.getAttributeValue(attributes, attributeName);
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value || '';
  }

  /**
   * Extrae el nombre del grupo desde el DN completo
   * Ejemplo: "CN=Domain Admins,CN=Users,DC=main,DC=minoil,DC=com,DC=bo" -> "Domain Admins"
   */
  private extractGroupName(groupDN: string): string {
    const match = groupDN.match(/^CN=([^,]+)/);
    return match ? match[1] : '';
  }

  /**
   * Mapea los grupos LDAP a roles del sistema local
   * Este método se puede personalizar según la estructura de grupos de tu empresa
   */
  mapGroupsToRole(groups: string[]): { roleName: string; defaultSedeId?: number; defaultAreaId?: number } {
    // Mapeo de grupos LDAP a roles locales
    const groupMappings = {
      'Domain Admins': { roleName: 'Administrador', defaultSedeId: 1, defaultAreaId: 3 }, // IT
      'Administradores': { roleName: 'Administrador', defaultSedeId: 1, defaultAreaId: 3 },
      'Gerentes': { roleName: 'Gerente', defaultSedeId: 1, defaultAreaId: 1 }, // Ventas
      'Ventas': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 1 },
      'RRHH': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 2 },
      'Contabilidad': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 2 },
      'IT': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 3 },
    };

    // Buscar el grupo con mayor privilegio
    for (const group of groups) {
      if (groupMappings[group]) {
        this.logger.log(`Grupo ${group} mapeado a rol: ${groupMappings[group].roleName}`);
        return groupMappings[group];
      }
    }

    // Rol por defecto para usuarios sin grupos específicos
    this.logger.log(`Usuario sin grupos reconocidos, asignando rol por defecto`);
    return { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 1 };
  }

  /**
   * Cambia la contraseña de un usuario en LDAP
   */
  async changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
    const client = ldap.createClient({
      url: this.ldapUrl,
      timeout: 10000,
      connectTimeout: 10000,
    });

    const userDN = `MAIN\\${username}`;

    try {
      // 1. Verificar contraseña actual
      await this.bindUser(client, userDN, currentPassword);
      this.logger.log(`Contraseña actual verificada para usuario: ${username}`);

      // Log de configuración activa
      this.logger.log(
        `LDAP secure mode: ${this.useStartTLS ? 'StartTLS' : 'LDAPS'} | tlsRejectUnauthorized=${this.tlsRejectUnauthorized} | hasAdmin=${!!process.env.LDAP_ADMIN_DN}`
      );

      // 2. Obtener el DN completo del usuario para la modificación
      const userFullDN = await this.getUserFullDN(client, username);
      
      // 3. Crear cliente seguro para la modificación (LDAPS o StartTLS)
      let secureClient: ldap.Client | null = null;
      try {
        secureClient = await this.createSecureClient();
      } catch (e) {
        this.logger.error('Fallo al crear canal seguro primario, intentando modo alternativo', e);
        // fallback entre StartTLS y LDAPS
        const original = this.useStartTLS;
        (this as any).useStartTLS = !original;
        secureClient = await this.createSecureClient();
        // restaurar flag para futuras llamadas
        (this as any).useStartTLS = original;
      }

      try {
        // Intentar reset como administrador si hay credenciales configuradas
        const adminDn = process.env.LDAP_ADMIN_DN;
        const adminPassword = process.env.LDAP_ADMIN_PASSWORD;

        if (adminDn && adminPassword) {
          this.logger.log(`Intentando cambio de contraseña vía administrador para: ${username}`);
          await this.bindUser(secureClient, adminDn, adminPassword);
          await this.modifyUserPasswordAsAdminReplace(secureClient, userFullDN, newPassword);
          this.logger.log(`Contraseña cambiada exitosamente (admin) para usuario: ${username}`);
        } else {
          // Cambio de contraseña como usuario requiere delete+add con unicodePwd en el mismo modify
          this.logger.log(`Intentando cambio de contraseña como usuario (delete+add) para: ${username}`);
          // Intentar bind con Full DN, luego DOMAIN\\user, luego UPN
          const upn = this.getUserUPN(username);
          let bound = false;
          try {
            await this.bindUser(secureClient, userFullDN, currentPassword);
            bound = true;
            this.logger.log(`Bind exitoso para cambio con DN completo: ${userFullDN}`);
          } catch (e1) {
            this.logger.warn(`Bind con DN completo falló, probando DOMAIN\\user`);
            try {
              await this.bindUser(secureClient, userDN, currentPassword);
              bound = true;
              this.logger.log(`Bind exitoso para cambio con DOMAIN\\user: ${userDN}`);
            } catch (e2) {
              this.logger.warn(`Bind con DOMAIN\\user falló, probando UPN: ${upn}`);
              await this.bindUser(secureClient, upn, currentPassword);
              bound = true;
              this.logger.log(`Bind exitoso para cambio con UPN: ${upn}`);
            }
          }
          await this.modifyUserPasswordAsUserDeleteAdd(secureClient, userFullDN, currentPassword, newPassword);
          this.logger.log(`Contraseña cambiada exitosamente (usuario) para: ${username}`);
        }
      } finally {
        secureClient.unbind();
      }

    } catch (error) {
      this.logger.error(`Error al cambiar contraseña para ${username}:`, error.message);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new Error('Error al cambiar la contraseña. Verifique que la contraseña actual sea correcta.');
    } finally {
      client.unbind();
    }
  }

  /**
   * Construye UPN (userPrincipalName) a partir del baseDN y el username
   */
  private getUserUPN(username: string): string {
    // baseDN: DC=main,DC=minoil,DC=com,DC=bo  => dominio: main.minoil.com.bo
    const domain = this.baseDN
      .split(',')
      .filter(part => part.trim().toUpperCase().startsWith('DC='))
      .map(part => part.split('=')[1])
      .join('.');
    return `${username}@${domain}`;
  }

  /**
   * Crea un cliente LDAP con canal cifrado (LDAPS o StartTLS)
   */
  private async createSecureClient(): Promise<ldap.Client> {
    if (this.useStartTLS) {
      // Conexión por LDAP (389) y upgrade con StartTLS
      const starttlsClient: ldap.Client = ldap.createClient({
        url: this.ldapUrl,
        timeout: 15000,
        connectTimeout: 15000,
      });
      starttlsClient.on('error', (e) => this.logger.error('LDAP client error (StartTLS):', e));

      await new Promise<void>((resolve, reject) => {
        const tlsOptions = { rejectUnauthorized: this.tlsRejectUnauthorized, secureProtocol: 'TLSv1_2_method' } as any;
        starttlsClient.starttls(tlsOptions, null as any, (err) => {
          if (err) {
            this.logger.error('Fallo StartTLS:', err);
            reject(err);
          } else {
            this.logger.log('Canal TLS establecido vía StartTLS');
            resolve();
          }
        });
      });
      return starttlsClient;
    }

    // Conexión directa LDAPS (636)
    const ldapsClient: ldap.Client = ldap.createClient({
      url: this.ldapsUrl,
      timeout: 15000,
      connectTimeout: 15000,
      tlsOptions: {
        rejectUnauthorized: this.tlsRejectUnauthorized,
        secureProtocol: 'TLSv1_2_method',
      },
    });
    ldapsClient.on('error', (e) => this.logger.error('LDAP client error (LDAPS):', e));
    return ldapsClient;
  }

  /**
   * Obtiene el DN completo de un usuario
   */
  private async getUserFullDN(client: ldap.Client, username: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const searchOptions = {
        filter: `(sAMAccountName=${username})`,
        scope: 'sub',
        attributes: ['distinguishedName'],
      };

      client.search(this.baseDN, searchOptions, (err, res) => {
        if (err) {
          reject(new Error('Error al buscar DN del usuario'));
          return;
        }

        let userDN: string;

        res.on('searchEntry', (entry) => {
          userDN = entry.pojo.objectName || entry.pojo.attributes.find(attr => attr.type === 'distinguishedName')?.values[0];
        });

        res.on('error', (error) => {
          reject(new Error('Error al buscar DN del usuario'));
        });

        res.on('end', () => {
          if (!userDN) {
            reject(new Error('Usuario no encontrado para modificación'));
          } else {
            resolve(userDN);
          }
        });
      });
    });
  }

  /**
   * Reset de contraseña como administrador (reemplazo directo)
   */
  private async modifyUserPasswordAsAdminReplace(client: ldap.Client, userDN: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const change = new ldap.Change({
        operation: 'replace',
        modification: {
          type: 'unicodePwd',
          vals: [this.encodePassword(newPassword)],
        } as any,
      });

      client.modify(userDN, change, (err) => {
        if (err) {
          this.logger.error(`Error (admin replace unicodePwd):`, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Cambio de contraseña como usuario (delete old + add new en una sola operación)
   */
  private async modifyUserPasswordAsUserDeleteAdd(
    client: ldap.Client,
    userDN: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const changes = [
        new ldap.Change({
          operation: 'delete',
          modification: new ldap.Attribute({
            type: 'unicodePwd',
            values: [this.encodePassword(currentPassword)], // Cambiar vals por values
          }),
        }),
        new ldap.Change({
          operation: 'add',
          modification: new ldap.Attribute({
            type: 'unicodePwd',
            values: [this.encodePassword(newPassword)], // Cambiar vals por values
          }),
        }),
      ];

      client.modify(userDN, changes, (err) => {
        if (err) {
          this.logger.error(`Error (user delete+add unicodePwd):`, err);
          reject(new Error('Active Directory requiere un canal seguro para cambiar contraseñas'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Codifica la contraseña en formato UTF-16LE para Active Directory
   */
  private encodePassword(password: string): Buffer {
    // Active Directory requiere UTF-16LE y rodeadas por comillas dobles
    const quotedPassword = `"${password}"`;
    return Buffer.from(quotedPassword, 'utf16le');
  }

  /**
   * Mapea información LDAP a estructura organizacional dinámicamente
   */
  async mapUserToOrganization(department: string, office: string, title?: string, groups?: string[]): Promise<{
    sedeId: number; 
    areaId: number; 
    cargoNombre: string; 
    cargoDescripcion: string;
    rolNombre: string;
    nivel: number;
  }> {
    // Mapeo de departamentos a áreas
    const departmentToArea = {
      'Sistemas': { areaId: 3, areaName: 'IT' },
      'Tecnología': { areaId: 3, areaName: 'IT' },
      'IT': { areaId: 3, areaName: 'IT' },
      'Ventas': { areaId: 1, areaName: 'Ventas' },
      'Comercial': { areaId: 1, areaName: 'Ventas' },
      'Marketing': { areaId: 1, areaName: 'Ventas' },
      'Recursos Humanos': { areaId: 2, areaName: 'Recursos Humanos' },
      'RRHH': { areaId: 2, areaName: 'Recursos Humanos' },
      'Contabilidad': { areaId: 2, areaName: 'Recursos Humanos' },
      'Finanzas': { areaId: 2, areaName: 'Recursos Humanos' },
      'Administración': { areaId: 2, areaName: 'Recursos Humanos' },
      'Logística': { areaId: 1, areaName: 'Ventas' },
    };

    // Mapeo de oficinas a sedes
    const officeToSede = {
      'Santa Cruz': { sedeId: 1 },
      'Rosario': { sedeId: 2 },
      'La Paz': { sedeId: 1 },
      'Cochabamba': { sedeId: 1 },
    };

    // Determinar sede
    let sedeId = 1; // Por defecto Sede Central
    if (office && officeToSede[office]) {
      sedeId = officeToSede[office].sedeId;
    }

    // Determinar área
    let areaId = 1; // Por defecto Ventas
    if (department && departmentToArea[department]) {
      areaId = departmentToArea[department].areaId;
    }

    // Crear nombre del cargo dinámicamente basado en title y department
    let cargoNombre: string;
    let cargoDescripcion: string;
    let rolNombre: string;
    let nivel: number;

    // Prioridad 1: Grupos especiales de LDAP
    if (groups && groups.includes('Domain Admins')) {
      cargoNombre = 'Administrador del Sistema';
      cargoDescripcion = 'Administrador con acceso completo al sistema';
      rolNombre = 'Administrador';
      nivel = 1;
    }
    // Prioridad 2: Título específico
    else if (title && title.trim()) {
      // Crear cargo basado en título + departamento
      const titleClean = title.trim();
      const deptClean = department || 'General';
      
      cargoNombre = `${titleClean} de ${deptClean}`;
      cargoDescripcion = `${titleClean} del área de ${deptClean}`;
      
      // Determinar rol basado en título
      if (titleClean.toLowerCase().includes('gerente') || titleClean.toLowerCase().includes('director')) {
        rolNombre = 'Gerente';
        nivel = 2;
      } else {
        rolNombre = titleClean.replace(/\s+/g, '_'); // "Trade de MKT" → "Trade_de_MKT"
        nivel = 3;
      }
    }
    // Prioridad 3: Solo departamento
    else if (department && department.trim()) {
      cargoNombre = `Especialista de ${department}`;
      cargoDescripcion = `Especialista del área de ${department}`;
      rolNombre = `Especialista_${department.replace(/\s+/g, '_')}`;
      nivel = 3;
    }
    // Por defecto
    else {
      cargoNombre = 'Usuario General';
      cargoDescripcion = 'Usuario general del sistema';
      rolNombre = 'Usuario';
      nivel = 4;
    }

    this.logger.log(`Mapeo dinámico:`, {
      department,
      title,
      office,
      groups: groups?.slice(0, 3), // Solo primeros 3 grupos para logs
      resultado: {
        sedeId,
        areaId,
        cargoNombre,
        rolNombre,
        nivel
      }
    });

    return {
      sedeId,
      areaId,
      cargoNombre,
      cargoDescripcion,
      rolNombre,
      nivel
    };
  }
} 