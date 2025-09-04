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
  private readonly ldapUrl: string;
  private readonly ldapsUrl: string;
  private readonly baseDN: string;
  private readonly useStartTLS: boolean;
  private readonly tlsRejectUnauthorized: boolean;
  private readonly connectionTimeout: number;
  private readonly searchTimeout: number;

  constructor() {
    // Configuración mejorada - Usar LDAP simple por defecto
    this.ldapUrl = process.env.LDAP_URL || 'ldap://SRVDC.main.minoil.com.bo:389';
    this.ldapsUrl = process.env.LDAP_SECURE_URL || 'ldaps://SRVDC.main.minoil.com.bo:636';
    this.baseDN = process.env.LDAP_BASE_DN || 'DC=main,DC=minoil,DC=com,DC=bo';
    this.useStartTLS = process.env.LDAP_USE_STARTTLS === 'true';
    this.tlsRejectUnauthorized = process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false';
    this.connectionTimeout = parseInt(process.env.LDAP_CONNECTION_TIMEOUT || '10000');
    this.searchTimeout = parseInt(process.env.LDAP_SEARCH_TIMEOUT || '15000');
    
    // Forzar uso de LDAP simple si la URL contiene ldaps pero falla
    if (this.ldapUrl.includes('ldaps://')) {
      this.ldapUrl = this.ldapUrl.replace('ldaps://', 'ldap://').replace(':636', ':389');
      this.logger.warn(`⚠️ Forzando uso de LDAP simple: ${this.ldapUrl}`);
    }
    
    this.logger.log(`🔧 LDAP configurado: ${this.ldapUrl} (LDAP simple), BaseDN: ${this.baseDN}`);
  }

  /**
   * Autentica un usuario contra LDAP y obtiene su información
   */
  async authenticateAndGetUserInfo(username: string, password: string): Promise<LDAPUserInfo> {
    const client = this.createClient(false); // Sin seguridad para autenticación básica
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
      this.safeUnbind(client);
    }
  }

  /**
   * Busca todos los usuarios en LDAP con manejo mejorado de errores
   */
  async searchAllUsers(): Promise<LDAPUserInfo[]> {
    this.logger.log('🔍 Iniciando búsqueda de usuarios LDAP...');
    
    try {
      // Intentar con credenciales de usuario normal primero
      const adminDn = process.env.LDAP_ADMIN_DN;
      const adminPassword = process.env.LDAP_ADMIN_PASSWORD;
      
      if (adminDn && adminPassword) {
        this.logger.log('🔐 Intentando búsqueda con credenciales de usuario...');
        try {
          const client = this.createClient(false);
          try {
            // Bind con usuario normal
            await this.bindUser(client, adminDn, adminPassword);
            this.logger.log('✅ Autenticado exitosamente con usuario LDAP');
            
            const usuarios = await this.searchUsersWithAuth(client);
            this.logger.log(`✅ Búsqueda autenticada exitosa: ${usuarios.length} usuarios encontrados`);
            return usuarios;
          } finally {
            this.safeUnbind(client);
          }
        } catch (authError) {
          this.logger.warn(`⚠️ Autenticación falló: ${authError.message}`);
          this.logger.log('🔄 Intentando búsqueda anónima como fallback...');
        }
      }
      
      // Fallback: intentar búsqueda anónima
      const client = this.createClient(false);
      try {
        const usuarios = await this.searchUsersAnonymous(client);
        this.logger.log(`✅ Búsqueda anónima exitosa: ${usuarios.length} usuarios encontrados`);
          return usuarios;
      } finally {
        this.safeUnbind(client);
        }
      
      } catch (error) {
      this.logger.warn(`⚠️ Error en búsqueda LDAP: ${error.message}`);
      this.logger.warn('🚫 Retornando array vacío para continuar sincronización');
      return [];
    }
  }

  /**
   * Búsqueda anónima simplificada que funcionaba antes
   */
  private async searchUsersAnonymous(client: ldap.Client): Promise<LDAPUserInfo[]> {
    return new Promise((resolve, reject) => {
      // Filtro simple que funcionaba antes
      const filter = '(objectClass=user)';
      
      const searchOptions = {
        filter,
        scope: 'sub' as const,
        attributes: [
          'sAMAccountName',
          'mail',
          'givenName',
          'sn',
          'displayName',
          'department',
          'physicalDeliveryOfficeName',
          'title',
          'memberOf'
        ],
        timeLimit: 30, // 30 segundos
        sizeLimit: 2000, // Más usuarios
      };

      const users: LDAPUserInfo[] = [];
      let hasError = false;

      // Timeout para la búsqueda
      const searchTimeout = setTimeout(() => {
        if (!hasError) {
          hasError = true;
          this.logger.error('⏰ Timeout en búsqueda LDAP anónima');
          reject(new Error('Timeout en búsqueda LDAP'));
        }
      }, 30000);

      try {
        client.search(this.baseDN, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(searchTimeout);
            if (!hasError) {
              hasError = true;
              this.logger.error('❌ Error en búsqueda LDAP anónima:', err.message);
              reject(new Error(`Error en búsqueda LDAP: ${err.message}`));
            }
            return;
          }

          res.on('searchEntry', (entry) => {
            try {
              const attributes = entry.pojo?.attributes || [];
              
              const userInfo: LDAPUserInfo = {
                username: this.getStringValue(attributes, 'sAMAccountName'),
                email: this.getStringValue(attributes, 'mail') || '',
                nombre: this.getStringValue(attributes, 'givenName') || '',
                apellido: this.getStringValue(attributes, 'sn') || '',
                displayName: this.getStringValue(attributes, 'displayName') || '',
                department: this.getStringValue(attributes, 'department') || '',
                office: this.getStringValue(attributes, 'physicalDeliveryOfficeName') || '',
                title: this.getStringValue(attributes, 'title') || '',
                groups: this.extractGroups(attributes),
              };

              // Solo incluir usuarios con username válido
              if (userInfo.username && userInfo.username.trim()) {
                // Generar email si no existe
                if (!userInfo.email) {
                  userInfo.email = `${userInfo.username}@minoil.com.bo`;
                }
                users.push(userInfo);
              }
            } catch (entryError) {
              this.logger.warn(`⚠️ Error procesando entrada LDAP: ${entryError.message}`);
            }
          });

          res.on('error', (err) => {
            clearTimeout(searchTimeout);
            if (!hasError) {
              hasError = true;
              this.logger.error('❌ Error en stream de búsqueda LDAP (anonymous):', err.message);
              reject(new Error(`Error en stream de búsqueda LDAP: ${err.message}`));
            }
          });

          res.on('end', () => {
            clearTimeout(searchTimeout);
            if (!hasError) {
              this.logger.log(`📊 Búsqueda LDAP completada: ${users.length} usuarios encontrados`);
              resolve(users);
            }
          });
        });
      } catch (error) {
        clearTimeout(searchTimeout);
        if (!hasError) {
          hasError = true;
          reject(error);
        }
      }
    });
  }

  /**
   * Búsqueda con usuario autenticado
   */
  private async searchUsersWithAuth(client: ldap.Client): Promise<LDAPUserInfo[]> {
    return new Promise((resolve, reject) => {
      // Filtro más permisivo para usuario autenticado
      const filter = '(&(objectClass=user)(objectCategory=person))';
      
      const searchOptions = {
        filter,
        scope: 'sub' as const,
        attributes: [
          'sAMAccountName',
          'mail',
          'givenName',
          'sn',
          'displayName',
          'department',
          'physicalDeliveryOfficeName',
          'title',
          'memberOf'
        ],
        timeLimit: 30,
        sizeLimit: 2000,
      };

      const users: LDAPUserInfo[] = [];
      let hasError = false;

      const searchTimeout = setTimeout(() => {
        if (!hasError) {
          hasError = true;
          this.logger.error('⏰ Timeout en búsqueda LDAP autenticada');
          reject(new Error('Timeout en búsqueda LDAP'));
        }
      }, 30000);

      try {
        client.search(this.baseDN, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(searchTimeout);
            if (!hasError) {
              hasError = true;
              this.logger.error('❌ Error en búsqueda LDAP autenticada:', err.message);
              reject(new Error(`Error en búsqueda LDAP: ${err.message}`));
            }
            return;
          }

          res.on('searchEntry', (entry) => {
            try {
              const attributes = entry.pojo?.attributes || [];
              
              const userInfo: LDAPUserInfo = {
                username: this.getStringValue(attributes, 'sAMAccountName'),
                email: this.getStringValue(attributes, 'mail') || '',
                nombre: this.getStringValue(attributes, 'givenName') || '',
                apellido: this.getStringValue(attributes, 'sn') || '',
                displayName: this.getStringValue(attributes, 'displayName') || '',
                department: this.getStringValue(attributes, 'department') || '',
                office: this.getStringValue(attributes, 'physicalDeliveryOfficeName') || '',
                title: this.getStringValue(attributes, 'title') || '',
                groups: this.extractGroups(attributes),
              };

              // Solo incluir usuarios con username válido
              if (userInfo.username && userInfo.username.trim()) {
                // Generar email si no existe
                if (!userInfo.email) {
                  userInfo.email = `${userInfo.username}@minoil.com.bo`;
                }
                users.push(userInfo);
              }
            } catch (entryError) {
              this.logger.warn(`⚠️ Error procesando entrada LDAP: ${entryError.message}`);
            }
          });

          res.on('error', (err) => {
            clearTimeout(searchTimeout);
            if (!hasError) {
              hasError = true;
              this.logger.error('❌ Error en stream de búsqueda LDAP autenticada:', err.message);
              reject(new Error(`Error en stream de búsqueda LDAP: ${err.message}`));
            }
          });

          res.on('end', () => {
            clearTimeout(searchTimeout);
            if (!hasError) {
              this.logger.log(`📊 Búsqueda LDAP autenticada completada: ${users.length} usuarios encontrados`);
              resolve(users);
            }
          });
        });
      } catch (error) {
        clearTimeout(searchTimeout);
        if (!hasError) {
          hasError = true;
          reject(error);
        }
      }
    });
  }

  /**
   * Ejecuta una estrategia específica de búsqueda
   */
  private async ejecutarEstrategiaBusqueda(tipo: string): Promise<LDAPUserInfo[]> {
    switch (tipo) {
      case 'admin':
        return await this.searchWithAdmin();
      case 'anonymous':
        return await this.searchAnonymous();
      case 'simple':
        return await this.searchSimple();
      default:
        throw new Error(`Estrategia desconocida: ${tipo}`);
    }
  }

  /**
   * Búsqueda con credenciales de administrador
   */
  private async searchWithAdmin(): Promise<LDAPUserInfo[]> {
    const adminDn = process.env.LDAP_ADMIN_DN;
    const adminPassword = process.env.LDAP_ADMIN_PASSWORD;

    if (!adminDn || !adminPassword) {
      throw new Error('Credenciales de administrador LDAP no configuradas');
    }

    const client = this.createClient(false);

    try {
      await this.bindUser(client, adminDn, adminPassword);
      this.logger.log('✅ Autenticado como administrador LDAP');
      return await this.searchAllUsersInternal(client, 'admin');
    } finally {
      this.safeUnbind(client);
    }
  }

  /**
   * Búsqueda anónima
   */
  private async searchAnonymous(): Promise<LDAPUserInfo[]> {
    const client = this.createClient(false);

    try {
      // No hacer bind para búsqueda anónima
      return await this.searchAllUsersInternal(client, 'anonymous');
    } finally {
      this.safeUnbind(client);
    }
  }

  /**
   * Búsqueda simple con filtros básicos
   */
  private async searchSimple(): Promise<LDAPUserInfo[]> {
    const client = this.createClient(false);

    try {
      return await this.searchAllUsersInternal(client, 'simple');
    } finally {
      this.safeUnbind(client);
    }
  }

  /**
   * Crea un cliente LDAP con configuración mejorada
   */
  private createClient(secure: boolean = false): ldap.Client {
    const clientOptions: any = {
      timeout: this.connectionTimeout,
      connectTimeout: this.connectionTimeout,
      maxConnections: 1,
      bindDN: undefined,
      bindCredentials: undefined,
    };

    // Forzar uso de LDAP simple por defecto ya que LDAPS está fallando
    const usarLDAPSimple = true; // Cambiar a false si quieres probar LDAPS
    
    if (secure && !usarLDAPSimple && this.useStartTLS) {
      // Usar LDAPS directo (deshabilitado por defecto)
      clientOptions.url = this.ldapsUrl;
      clientOptions.tlsOptions = {
        rejectUnauthorized: this.tlsRejectUnauthorized,
        secureProtocol: 'TLSv1_2_method',
      };
      this.logger.debug(`🔒 Creando cliente LDAPS: ${this.ldapsUrl}`);
    } else {
      // Usar LDAP simple (recomendado)
      clientOptions.url = this.ldapUrl;
      this.logger.debug(`🔓 Creando cliente LDAP simple: ${this.ldapUrl}`);
    }

    this.logger.log(`🔧 Configurando cliente LDAP con timeout: ${this.connectionTimeout}ms`);

    const client = ldap.createClient(clientOptions);

    // Configurar manejadores de eventos con mejor logging
    client.on('error', (error) => {
      this.logger.error(`❌ Error en cliente LDAP: ${error.message}`);
      this.logger.error(`❌ Error details:`, error);
    });

    client.on('connectError', (error) => {
      this.logger.error(`❌ Error de conexión LDAP: ${error.message}`);
      this.logger.error(`❌ Connection error details:`, error);
    });

    client.on('timeout', () => {
      this.logger.error(`⏰ Timeout en conexión LDAP después de ${this.connectionTimeout}ms`);
    });

    client.on('connect', () => {
      this.logger.log(`✅ Cliente LDAP conectado exitosamente`);
    });

    client.on('close', () => {
      this.logger.debug(`🔌 Cliente LDAP desconectado`);
    });

    return client;
  }

  /**
   * Bind seguro con timeout
   */
  private async bindUser(client: ldap.Client, userDN: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout en autenticación LDAP'));
      }, this.connectionTimeout);

      client.bind(userDN, password, (err) => {
        clearTimeout(timeout);
        if (err) {
          reject(new UnauthorizedException('Credenciales LDAP inválidas'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Búsqueda interna con diferentes estrategias de filtros
   */
  private async searchAllUsersInternal(client: ldap.Client, strategy: string): Promise<LDAPUserInfo[]> {
    return new Promise((resolve, reject) => {
      // Configurar filtro basado en la estrategia
      let filter: string;
      
      switch (strategy) {
        case 'admin':
          filter = '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';
          break;
        case 'anonymous':
          filter = '(&(objectClass=user)(sAMAccountName=*))';
          break;
        case 'simple':
          filter = '(objectClass=user)';
          break;
        default:
          filter = '(&(objectClass=user)(sAMAccountName=*))';
      }

      const searchOptions = {
        filter,
        scope: 'sub' as const,
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
        timeLimit: Math.floor(this.searchTimeout / 1000), // Convertir a segundos
        sizeLimit: 1000, // Limitar resultados
      };

      const users: LDAPUserInfo[] = [];
      let hasError = false;

      // Timeout para la búsqueda
      const searchTimeout = setTimeout(() => {
        if (!hasError) {
          hasError = true;
          this.logger.error(`⏰ Timeout en búsqueda LDAP (${strategy})`);
          reject(new Error(`Timeout en búsqueda LDAP strategy: ${strategy}`));
        }
      }, this.searchTimeout);

      try {
        client.search(this.baseDN, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(searchTimeout);
            if (!hasError) {
              hasError = true;
              this.logger.error(`❌ Error en búsqueda LDAP (${strategy}):`, err.message);
              reject(new Error(`Error en búsqueda LDAP: ${err.message}`));
            }
            return;
          }

          res.on('searchEntry', (entry) => {
            try {
              const attributes = entry.pojo?.attributes || [];
              
              const userInfo: LDAPUserInfo = {
                username: this.getStringValue(attributes, 'sAMAccountName'),
                email: this.getStringValue(attributes, 'mail') || '',
                nombre: this.getStringValue(attributes, 'givenName'),
                apellido: this.getStringValue(attributes, 'sn'),
                displayName: this.getStringValue(attributes, 'displayName'),
                department: this.getStringValue(attributes, 'department'),
                office: this.getStringValue(attributes, 'physicalDeliveryOfficeName'),
                title: this.getStringValue(attributes, 'title'),
                groups: this.extractGroups(attributes),
              };

              // Solo incluir usuarios con username válido
              if (userInfo.username && userInfo.username.trim()) {
                // Generar email si no existe
                if (!userInfo.email) {
                  userInfo.email = `${userInfo.username}@minoil.com.bo`;
                }
                users.push(userInfo);
              }
            } catch (entryError) {
              this.logger.warn(`⚠️ Error procesando entrada LDAP:`, entryError.message);
              // Continuar con las demás entradas
            }
          });

          res.on('searchReference', (referral) => {
            // Ignorar referencias
            this.logger.debug('📎 Referencia LDAP ignorada:', referral);
          });

          res.on('error', (error) => {
            clearTimeout(searchTimeout);
            if (!hasError) {
              hasError = true;
              this.logger.error(`❌ Error en stream de búsqueda LDAP (${strategy}):`, error.message);
              reject(new Error(`Error en stream de búsqueda LDAP: ${error.message}`));
            }
          });

          res.on('end', (result) => {
            clearTimeout(searchTimeout);
            if (!hasError) {
              this.logger.log(`✅ Búsqueda LDAP completada (${strategy}): ${users.length} usuarios encontrados`);
              resolve(users);
            }
          });
        });
      } catch (clientError) {
        clearTimeout(searchTimeout);
        if (!hasError) {
          hasError = true;
          this.logger.error(`❌ Error iniciando búsqueda LDAP (${strategy}):`, clientError.message);
          reject(new Error(`Error iniciando búsqueda LDAP: ${clientError.message}`));
        }
      }
    });
  }

  /**
   * Extraer grupos de atributos LDAP
   */
  private extractGroups(attributes: any[]): string[] {
    const memberOf = this.getAttributeValue(attributes, 'memberOf') || [];
    const groups = Array.isArray(memberOf) ? memberOf : [memberOf];
    
    return groups
      .filter(group => group && typeof group === 'string')
      .map(group => this.extractGroupName(group))
      .filter(group => group);
  }

  /**
   * Unbind seguro del cliente
   */
  private safeUnbind(client: ldap.Client): void {
    try {
      if (client) {
        client.unbind((err) => {
          if (err) {
            this.logger.debug('⚠️ Error en unbind LDAP (ignorado):', err.message);
          }
        });
      }
    } catch (error) {
      this.logger.debug('⚠️ Error en unbind LDAP (ignorado):', error.message);
    }
  }

  /**
   * Realiza el bind (autenticación) del usuario
   */
  private async searchUserInfo(client: ldap.Client, username: string): Promise<LDAPUserInfo> {
    return new Promise((resolve, reject) => {
      const searchOptions = {
        filter: `(sAMAccountName=${username})`,
        scope: 'sub' as const,
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
          const attributes = entry.pojo?.attributes || [];
          
          userInfo = {
            username: this.getStringValue(attributes, 'sAMAccountName') || username,
            email: this.getStringValue(attributes, 'mail') || `${username}@minoil.com.bo`,
            nombre: this.getStringValue(attributes, 'givenName') || '',
            apellido: this.getStringValue(attributes, 'sn') || '',
            displayName: this.getStringValue(attributes, 'displayName') || `${username}`,
            department: this.getStringValue(attributes, 'department') || '',
            office: this.getStringValue(attributes, 'physicalDeliveryOfficeName') || '',
            title: this.getStringValue(attributes, 'title') || '',
            groups: this.extractGroups(attributes),
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
   */
  mapGroupsToRole(groups: string[]): { roleName: string; defaultSedeId?: number; defaultAreaId?: number } {
    const groupMappings = {
      'Domain Admins': { roleName: 'Administrador', defaultSedeId: 1, defaultAreaId: 3 },
      'Administradores': { roleName: 'Administrador', defaultSedeId: 1, defaultAreaId: 3 },
      'Gerentes': { roleName: 'Gerente', defaultSedeId: 1, defaultAreaId: 1 },
      'Ventas': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 1 },
      'RRHH': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 2 },
      'Contabilidad': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 2 },
      'IT': { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 3 },
    };

    for (const group of groups) {
      if (groupMappings[group]) {
        this.logger.log(`Grupo ${group} mapeado a rol: ${groupMappings[group].roleName}`);
        return groupMappings[group];
      }
    }

    this.logger.log(`Usuario sin grupos reconocidos, asignando rol por defecto`);
    return { roleName: 'Usuario', defaultSedeId: 1, defaultAreaId: 1 };
  }

  // ... resto de métodos de cambio de contraseña y mapeo organizacional permanecen igual ...

  /**
   * Cambia la contraseña de un usuario en LDAP
   */
  async changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
    const client = this.createClient(false);
    const userDN = `MAIN\\${username}`;

    try {
      // 1. Verificar contraseña actual
      await this.bindUser(client, userDN, currentPassword);
      this.logger.log(`Contraseña actual verificada para usuario: ${username}`);

      // 2. Obtener el DN completo del usuario para la modificación
      const userFullDN = await this.getUserFullDN(client, username);
      
      // 3. Crear cliente seguro para la modificación
      let secureClient: ldap.Client | null = null;
      try {
        secureClient = this.createClient(true); // Crear cliente seguro
      } catch (e) {
        this.logger.error('Fallo al crear canal seguro para cambio de contraseña', e);
        throw new Error('No se pudo establecer conexión segura para cambio de contraseña');
      }

      try {
        const adminDn = process.env.LDAP_ADMIN_DN;
        const adminPassword = process.env.LDAP_ADMIN_PASSWORD;

        if (adminDn && adminPassword) {
          this.logger.log(`Intentando cambio de contraseña vía administrador para: ${username}`);
          await this.bindUser(secureClient, adminDn, adminPassword);
          await this.modifyUserPasswordAsAdminReplace(secureClient, userFullDN, newPassword);
          this.logger.log(`Contraseña cambiada exitosamente (admin) para usuario: ${username}`);
        } else {
          this.logger.log(`Intentando cambio de contraseña como usuario para: ${username}`);
          const upn = this.getUserUPN(username);
          
          try {
            await this.bindUser(secureClient, userFullDN, currentPassword);
          } catch (e1) {
            try {
              await this.bindUser(secureClient, userDN, currentPassword);
            } catch (e2) {
              await this.bindUser(secureClient, upn, currentPassword);
            }
          }
          
          await this.modifyUserPasswordAsUserDeleteAdd(secureClient, userFullDN, currentPassword, newPassword);
          this.logger.log(`Contraseña cambiada exitosamente (usuario) para: ${username}`);
        }
      } finally {
        this.safeUnbind(secureClient);
      }

    } catch (error) {
      this.logger.error(`Error al cambiar contraseña para ${username}:`, error.message);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new Error('Error al cambiar la contraseña. Verifique que la contraseña actual sea correcta.');
    } finally {
      this.safeUnbind(client);
    }
  }

  private getUserUPN(username: string): string {
    const domain = this.baseDN
      .split(',')
      .filter(part => part.trim().toUpperCase().startsWith('DC='))
      .map(part => part.split('=')[1])
      .join('.');
    return `${username}@${domain}`;
  }

  private async getUserFullDN(client: ldap.Client, username: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const searchOptions = {
        filter: `(sAMAccountName=${username})`,
        scope: 'sub' as const,
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
            values: [this.encodePassword(currentPassword)],
          }),
        }),
        new ldap.Change({
          operation: 'add',
          modification: new ldap.Attribute({
            type: 'unicodePwd',
            values: [this.encodePassword(newPassword)],
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

  private encodePassword(password: string): Buffer {
    const quotedPassword = `"${password}"`;
    return Buffer.from(quotedPassword, 'utf16le');
  }

  async mapUserToOrganization(department: string, office: string, title?: string, groups?: string[]): Promise<{
    sedeId: number; 
    areaId: number; 
    cargoNombre: string; 
    cargoDescripcion: string;
    rolNombre: string;
    nivel: number;
  }> {
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

    const officeToSede = {
      'Santa Cruz': { sedeId: 1 },
      'Rosario': { sedeId: 2 },
      'La Paz': { sedeId: 1 },
      'Cochabamba': { sedeId: 1 },
    };

    let sedeId = 1;
    if (office && officeToSede[office]) {
      sedeId = officeToSede[office].sedeId;
    }

    let areaId = 1;
    if (department && departmentToArea[department]) {
      areaId = departmentToArea[department].areaId;
    }

    let cargoNombre: string;
    let cargoDescripcion: string;
    let rolNombre: string;
    let nivel: number;

    if (groups && groups.includes('Domain Admins')) {
      cargoNombre = 'Administrador del Sistema';
      cargoDescripcion = 'Administrador con acceso completo al sistema';
      rolNombre = 'Administrador';
      nivel = 1;
    } else if (title && title.trim()) {
      const titleClean = title.trim();
      const deptClean = department || 'General';
      
      cargoNombre = `${titleClean} de ${deptClean}`;
      cargoDescripcion = `${titleClean} del área de ${deptClean}`;
      
      if (titleClean.toLowerCase().includes('gerente') || titleClean.toLowerCase().includes('director')) {
        rolNombre = 'Gerente';
        nivel = 2;
      } else {
        rolNombre = titleClean.replace(/\s+/g, '_');
        nivel = 3;
      }
    } else if (department && department.trim()) {
      cargoNombre = `Especialista de ${department}`;
      cargoDescripcion = `Especialista del área de ${department}`;
      rolNombre = `Especialista_${department.replace(/\s+/g, '_')}`;
      nivel = 3;
    } else {
      cargoNombre = 'Usuario General';
      cargoDescripcion = 'Usuario general del sistema';
      rolNombre = 'Usuario';
      nivel = 4;
    }

    this.logger.log(`Mapeo dinámico:`, {
      department,
      title,
      office,
      groups: groups?.slice(0, 3),
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

  /**
   * Obtiene todos los usuarios de LDAP (método de compatibilidad)
   */
  async getAllLdapUsers(): Promise<LDAPUserInfo[]> {
    return await this.searchAllUsers();
  }
}