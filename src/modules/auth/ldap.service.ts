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

    if (secure) {
      // Para cambios de contraseña, SIEMPRE usar LDAPS
      clientOptions.url = this.ldapsUrl;
      clientOptions.tlsOptions = {
        rejectUnauthorized: false, // Permitir certificados auto-firmados en entornos corporativos
        secureProtocol: 'TLSv1_2_method',
        servername: 'SRVDC.main.minoil.com.bo', // Nombre del servidor para verificación SSL
        checkServerIdentity: () => undefined, // Deshabilitar verificación de identidad del servidor
      };
      this.logger.debug(`🔒 Creando cliente LDAPS seguro: ${this.ldapsUrl}`);
    } else {
      // Usar LDAP simple para operaciones normales
      clientOptions.url = this.ldapUrl;
      this.logger.debug(`🔓 Creando cliente LDAP simple: ${this.ldapUrl}`);
    }

    this.logger.log(`🔧 Configurando cliente LDAP con timeout: ${this.connectionTimeout}ms`);

    const client = ldap.createClient(clientOptions);

    // Configurar manejadores de eventos con mejor logging
    client.on('error', (error) => {
      this.logger.error(`❌ Error en cliente LDAP: ${error.message}`);
      if (secure) {
        this.logger.error(`🔒 Error en conexión segura LDAPS`);
      }
    });

    client.on('connectError', (error) => {
      this.logger.error(`❌ Error de conexión LDAP: ${error.message}`);
      if (secure) {
        this.logger.error(`🔒 Error de conexión LDAPS - verificar certificados SSL`);
      }
    });

    client.on('timeout', () => {
      this.logger.error(`⏰ Timeout en conexión LDAP después de ${this.connectionTimeout}ms`);
    });

    client.on('connect', () => {
      if (secure) {
        this.logger.log(`🔒 Cliente LDAPS conectado exitosamente (conexión segura)`);
      } else {
        this.logger.log(`✅ Cliente LDAP conectado exitosamente`);
      }
    });

    client.on('close', () => {
      this.logger.debug(`🔌 Cliente LDAP desconectado`);
    });

    return client;
  }

  /**
   * Prueba si una conexión segura está funcionando correctamente
   */
  private async testSecureConnection(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout probando conexión segura'));
      }, 5000); // 5 segundos para probar la conexión

      // Intentar un bind simple para probar la conexión
      const adminDn = process.env.LDAP_ADMIN_DN;
      const adminPassword = process.env.LDAP_ADMIN_PASSWORD;

      if (!adminDn || !adminPassword) {
        clearTimeout(timeout);
        reject(new Error('Credenciales de administrador no configuradas para prueba de conexión'));
        return;
      }

      client.bind(adminDn, adminPassword, (err) => {
        clearTimeout(timeout);
        if (err) {
          // Si es error de conexión, rechazar para activar fallback
          if (err.message.includes('ECONNRESET') || 
              err.message.includes('ECONNREFUSED') || 
              err.message.includes('ETIMEDOUT') ||
              err.message.includes('socket hang up')) {
            this.logger.warn(`🔌 Error de conexión en prueba LDAPS: ${err.message}`);
            reject(err);
          } else {
            // Si es error de credenciales pero la conexión funciona, continuar
            this.logger.log(`🔐 Conexión LDAPS funciona (error de credenciales esperado en prueba)`);
            resolve();
          }
        } else {
          this.logger.log(`✅ Prueba de conexión LDAPS exitosa`);
          resolve();
        }
      });
    });
  }

  /**
   * Crea un cliente LDAP con StartTLS para conexiones seguras
   */
  private async createClientWithStartTLS(): Promise<ldap.Client> {
    return new Promise((resolve, reject) => {
      const clientOptions: any = {
        url: this.ldapUrl, // Usar LDAP normal y luego hacer StartTLS
        timeout: this.connectionTimeout,
        connectTimeout: this.connectionTimeout,
        maxConnections: 1,
      };

      this.logger.debug(`🔄 Creando cliente LDAP para StartTLS: ${this.ldapUrl}`);
      const client = ldap.createClient(clientOptions);

      // Configurar eventos
      client.on('error', (error) => {
        this.logger.error(`❌ Error en cliente StartTLS: ${error.message}`);
        reject(error);
      });

      client.on('connect', () => {
        this.logger.log(`🔗 Conexión LDAP establecida, iniciando StartTLS...`);
        
        // Iniciar StartTLS
        const tlsOptions = {
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method',
          servername: 'SRVDC.main.minoil.com.bo',
          checkServerIdentity: () => undefined,
        };

        client.starttls(tlsOptions, null, (err) => {
          if (err) {
            this.logger.error(`❌ Error en StartTLS: ${err.message}`);
            reject(err);
          } else {
            this.logger.log(`🔒 StartTLS establecido exitosamente`);
            resolve(client);
          }
        });
      });

      client.on('connectError', (error) => {
        this.logger.error(`❌ Error de conexión StartTLS: ${error.message}`);
        reject(error);
      });

      // Timeout para la operación completa
      setTimeout(() => {
        reject(new Error('Timeout estableciendo conexión StartTLS'));
      }, this.connectionTimeout);
    });
  }

  /**
   * Bind seguro con timeout y mejor manejo de errores
   */
  private async bindUser(client: ldap.Client, userDN: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout en autenticación LDAP'));
      }, this.connectionTimeout);

      client.bind(userDN, password, (err) => {
        clearTimeout(timeout);
        if (err) {
          // Distinguir entre errores de conexión y errores de autenticación
          if (err.message.includes('ECONNRESET') || 
              err.message.includes('ECONNREFUSED') || 
              err.message.includes('ETIMEDOUT') ||
              err.message.includes('socket hang up') ||
              err.message.includes('ENOTFOUND') ||
              err.message.includes('EHOSTUNREACH')) {
            // Error de conexión - propagar el error original
            this.logger.error(`🔌 Error de conexión en bind: ${err.message}`);
            reject(err);
          } else {
            // Error de autenticación - usar UnauthorizedException
            this.logger.error(`🔐 Error de autenticación en bind: ${err.message}`);
            reject(new UnauthorizedException('Credenciales LDAP inválidas'));
          }
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
    this.logger.log(`🔄 Iniciando cambio de contraseña para usuario: ${username}`);
    
    const client = this.createClient(false);
    const userDN = `MAIN\\${username}`;

    try {
      // 1. Verificar contraseña actual
      this.logger.log(`🔐 Verificando contraseña actual para usuario: ${username}`);
      await this.bindUser(client, userDN, currentPassword);
      this.logger.log(`✅ Contraseña actual verificada para usuario: ${username}`);

      // 2. Obtener el DN completo del usuario para la modificación
      this.logger.log(`🔍 Obteniendo DN completo para usuario: ${username}`);
      const userFullDN = await this.getUserFullDN(client, username);
      this.logger.log(`📋 DN completo obtenido: ${userFullDN}`);
      
      // 3. Crear cliente seguro para la modificación
      let secureClient: ldap.Client | null = null;
      let useSecureConnection = true;
      let isSecureClient = false;
      
      try {
        this.logger.log(`🔒 Creando cliente seguro LDAPS para modificación de contraseña`);
        secureClient = this.createClient(true); // Crear cliente LDAPS
        this.logger.log(`✅ Cliente LDAPS creado exitosamente`);
        
        // Probar la conexión LDAPS antes de continuar
        await this.testSecureConnection(secureClient);
        this.logger.log(`✅ Conexión LDAPS verificada exitosamente`);
        isSecureClient = true;
        
      } catch (ldapsError) {
        this.logger.warn(`⚠️ Fallo al crear/conectar cliente LDAPS: ${ldapsError.message}`);
        this.logger.log(`🔄 Intentando con StartTLS como fallback...`);
        
        // Limpiar cliente LDAPS fallido
        if (secureClient) {
          this.safeUnbind(secureClient);
          secureClient = null;
        }
        
        try {
          secureClient = await this.createClientWithStartTLS();
          this.logger.log(`✅ Cliente con StartTLS creado exitosamente`);
          isSecureClient = true;
        } catch (startTlsError) {
          this.logger.error(`❌ Fallo al crear conexión con StartTLS: ${startTlsError.message}`);
          this.logger.warn(`⚠️ No se pudo establecer conexión SSL/TLS, intentando método sin SSL...`);
          
          // Continuar sin conexión segura - usar método alternativo
          secureClient = this.createClient(false); // Cliente LDAP simple
          this.logger.log(`🔧 Usando cliente LDAP simple como último recurso`);
          isSecureClient = false;
        }
      }

      try {
        const adminDn = process.env.LDAP_ADMIN_DN;
        const adminPassword = process.env.LDAP_ADMIN_PASSWORD;

        if (adminDn && adminPassword) {
          this.logger.log(`👤 Intentando cambio de contraseña vía administrador para: ${username}`);
          
          // Intentar diferentes formatos de DN de administrador
          let adminBindSuccessful = false;
          const adminFormats = [
            adminDn, // Formato original
            `CN=${username},OU=Usuarios,OU=IT,DC=main,DC=minoil,DC=com,DC=bo`, // DN completo del usuario
            `MAIN\\${username}`, // Formato DOMAIN\username
            `${username}@main.minoil.com.bo` // Formato UPN
          ];

          for (const adminFormat of adminFormats) {
            try {
              this.logger.log(`🔐 Intentando bind de administrador con: ${adminFormat}`);
              await this.bindUser(secureClient, adminFormat, adminPassword);
              this.logger.log(`✅ Autenticado como administrador LDAP con formato: ${adminFormat}`);
              adminBindSuccessful = true;
              break;
            } catch (bindError) {
              this.logger.warn(`⚠️ Fallo bind admin con ${adminFormat}: ${bindError.message}`);
            }
          }

          if (!adminBindSuccessful) {
            throw new Error('No se pudo autenticar con credenciales de administrador');
          }
          
          if (isSecureClient) {
            // Intentar cambio con SSL/TLS primero
            try {
              await this.modifyUserPasswordAsAdminReplace(secureClient, userFullDN, newPassword);
              this.logger.log(`✅ Contraseña cambiada exitosamente (admin con SSL) para usuario: ${username}`);
            } catch (sslError) {
              this.logger.warn(`⚠️ Fallo cambio con SSL, intentando método alternativo: ${sslError.message}`);
              
              // Fallback: usar cliente LDAP simple para cambio de contraseña
              await this.changePasswordWithoutSSL(userFullDN, newPassword, username);
              this.logger.log(`✅ Contraseña cambiada exitosamente (admin SSL fallback) para usuario: ${username}`);
            }
          } else {
            // Usar método sin SSL directamente
            this.logger.log(`🔧 Usando método sin SSL directamente para: ${username}`);
            
            // Primero intentar API REST
            try {
              await this.changePasswordViaAPI(username, currentPassword, newPassword);
              this.logger.log(`✅ Contraseña cambiada exitosamente (API REST) para usuario: ${username}`);
              return;
            } catch (apiError) {
              this.logger.warn(`⚠️ API REST falló: ${apiError.message}`);
              this.logger.log(`🔄 Intentando método LDAP tradicional...`);
            }
            
            // Fallback: método LDAP tradicional
            await this.changePasswordWithoutSSL(userFullDN, newPassword, username);
            this.logger.log(`✅ Contraseña cambiada exitosamente (admin sin SSL) para usuario: ${username}`);
          }
        } else {
          throw new Error('Credenciales de administrador LDAP no configuradas');
        }
      } finally {
        this.safeUnbind(secureClient);
      }

    } catch (error) {
      this.logger.error(`❌ Error al cambiar contraseña para ${username}:`, error.message);
      this.logger.error(`❌ Stack trace:`, error.stack);
      
      if (error instanceof UnauthorizedException) {
        this.logger.error(`🚫 Error de autorización: ${error.message}`);
        throw error;
      }
      
      // Proporcionar mensajes de error más específicos
      if (error.message.includes('modification must be an Attribute')) {
        this.logger.error(`🔧 Error de construcción de modificación LDAP`);
        throw new Error('Error interno en la construcción de la modificación LDAP');
      }
      
      if (error.message.includes('Unwilling To Perform')) {
        this.logger.error(`🔒 El servidor LDAP requiere conexión segura para cambio de contraseña`);
        throw new Error('El servidor requiere una conexión segura (SSL/TLS) para cambiar contraseñas. Verifique la configuración LDAPS del servidor.');
      }
      
      if (error.message.includes('Timeout')) {
        this.logger.error(`⏰ Timeout en operación LDAP`);
        throw new Error('Timeout en la operación de cambio de contraseña. Intente nuevamente.');
      }
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connect ECONNREFUSED')) {
        this.logger.error(`🚫 Conexión rechazada al servidor LDAP`);
        throw new Error('No se puede conectar al servidor LDAP. Verifique que el servicio esté funcionando.');
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
        modification: new ldap.Attribute({
          type: 'unicodePwd',
          values: [this.encodePassword(newPassword)],
        }),
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

  /**
   * Cambio de contraseña usando API REST externa (método alternativo)
   */
  private async changePasswordViaAPI(username: string, currentPassword: string, newPassword: string): Promise<void> {
    this.logger.log(`🌐 Intentando cambio de contraseña vía API REST para: ${username}`);
    
    try {
      // Opción 1: Usar API de Windows Server (si está disponible)
      const apiUrl = process.env.AD_PASSWORD_API_URL || 'http://SRVDC.main.minoil.com.bo:8080/api/change-password';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AD_API_TOKEN || ''}`
        },
        body: JSON.stringify({
          username: username,
          currentPassword: currentPassword,
          newPassword: newPassword,
          domain: 'main.minoil.com.bo'
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.logger.log(`✅ Cambio de contraseña exitoso vía API para: ${username}`);
        return;
      } else {
        throw new Error(`API respondió con código: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error en API REST: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cambio de contraseña usando PowerShell (método para Active Directory)
   */
  private async changePasswordWithoutSSL(userDN: string, newPassword: string, username: string): Promise<void> {
    this.logger.log(`🔧 Intentando cambio de contraseña con PowerShell para: ${username}`);
    
    // Usar PowerShell directamente (más confiable)
    try {
      await this.changePasswordWithPowerShell(username, newPassword);
      this.logger.log(`✅ Contraseña cambiada exitosamente con PowerShell para: ${username}`);
    } catch (psError) {
      this.logger.error(`❌ Error con PowerShell: ${psError.message}`);
      throw new Error('No se pudo cambiar la contraseña usando ningún método disponible');
    }
  }

  /**
   * Cambio de contraseña usando LDAP tradicional
   */
  private async changePasswordWithLDAP(userDN: string, newPassword: string, username: string): Promise<void> {
    this.logger.log(`🔧 Intentando cambio LDAP tradicional para: ${username}`);
    
    const simpleClient = this.createClient(false);
    
    try {
      const adminDn = process.env.LDAP_ADMIN_DN;
      const adminPassword = process.env.LDAP_ADMIN_PASSWORD;
      
      const adminFormats = [
        `MAIN\\${username}`,
        adminDn,
        `${username}@main.minoil.com.bo`,
        userDN
      ];

      let bindSuccessful = false;
      for (const adminFormat of adminFormats) {
        try {
          this.logger.log(`🔐 Probando bind LDAP con: ${adminFormat}`);
          await this.bindUser(simpleClient, adminFormat, adminPassword);
          this.logger.log(`✅ Bind LDAP exitoso con: ${adminFormat}`);
          bindSuccessful = true;
          break;
        } catch (bindError) {
          this.logger.warn(`⚠️ Fallo bind LDAP con ${adminFormat}: ${bindError.message}`);
        }
      }

      if (!bindSuccessful) {
        throw new Error('No se pudo autenticar para cambio LDAP');
      }

      // Solo intentar métodos que realmente funcionan con AD
      const passwordMethods = [
        { attr: 'unicodePwd', value: this.encodePassword(newPassword) }, // Método AD preferido
        { attr: 'userPassword', value: newPassword } // Fallback LDAP estándar
      ];

      for (const method of passwordMethods) {
        try {
          this.logger.log(`🔧 Intentando cambio LDAP con atributo: ${method.attr}`);
          
          const change = new ldap.Change({
            operation: 'replace',
            modification: new ldap.Attribute({
              type: method.attr,
              values: [method.value],
            }),
          });

          await new Promise<void>((resolve, reject) => {
            simpleClient.modify(userDN, change, (err) => {
              if (err) {
                this.logger.warn(`⚠️ Fallo LDAP con ${method.attr}: ${err.message}`);
                reject(err);
              } else {
                this.logger.log(`✅ Éxito LDAP con atributo: ${method.attr}`);
                resolve();
              }
            });
          });

          // Verificar si el cambio realmente funcionó
          await this.verifyPasswordChange(username, newPassword);
          return;

        } catch (methodError) {
          this.logger.warn(`⚠️ Método LDAP ${method.attr} falló: ${methodError.message}`);
          continue;
        }
      }

      throw new Error('Todos los métodos LDAP fallaron');

    } finally {
      this.safeUnbind(simpleClient);
    }
  }

  /**
   * Cambio de contraseña usando PowerShell (Windows AD)
   */
  private async changePasswordWithPowerShell(username: string, newPassword: string): Promise<void> {
    this.logger.log(`🔧 Ejecutando cambio de contraseña con PowerShell para: ${username}`);
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Escapar caracteres especiales en la contraseña
    const escapedPassword = newPassword.replace(/["`$\\]/g, '\\$&');
    
    // Script PowerShell para cambiar contraseña
    const psScript = `
      try {
        Import-Module ActiveDirectory -ErrorAction Stop
        $SecurePassword = ConvertTo-SecureString "${escapedPassword}" -AsPlainText -Force
        Set-ADAccountPassword -Identity "${username}" -NewPassword $SecurePassword -Reset
        Write-Output "SUCCESS: Password changed for ${username}"
      } catch {
        Write-Error "ERROR: $($_.Exception.Message)"
        exit 1
      }
    `;

    try {
      const { stdout, stderr } = await execAsync(
        `powershell.exe -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 30000 }
      );

      this.logger.log(`📋 PowerShell stdout: ${stdout}`);
      if (stderr) {
        this.logger.warn(`⚠️ PowerShell stderr: ${stderr}`);
      }

      if (stdout.includes('SUCCESS')) {
        this.logger.log(`✅ PowerShell confirmó cambio exitoso para: ${username}`);
        
        // Verificar el cambio
        await this.verifyPasswordChange(username, newPassword);
      } else {
        throw new Error('PowerShell no confirmó el cambio de contraseña');
      }

    } catch (error) {
      this.logger.error(`❌ Error ejecutando PowerShell: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verificar si el cambio de contraseña funcionó realmente
   */
  private async verifyPasswordChange(username: string, newPassword: string): Promise<void> {
    this.logger.log(`🔍 Verificando cambio de contraseña para: ${username}`);
    
    const testClient = this.createClient(false);
    const userDN = `MAIN\\${username}`;

    try {
      await this.bindUser(testClient, userDN, newPassword);
      this.logger.log(`✅ Verificación exitosa: nueva contraseña funciona para ${username}`);
    } catch (verifyError) {
      this.logger.error(`❌ Verificación falló: nueva contraseña NO funciona para ${username}`);
      throw new Error('La contraseña no se cambió correctamente - verificación falló');
    } finally {
      this.safeUnbind(testClient);
    }
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