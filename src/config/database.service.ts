import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import * as hana from '@sap/hana-client';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;
  private hanaConnection: any;
  private isHanaConnected = false;

  constructor(private configService: ConfigService) {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    // Conectar a SAP HANA
    await this.connectToHana();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    await this.disconnectFromHana();
  }

  // Métodos para Prisma (para futuras migraciones)
  getPrisma() {
    return this.prisma;
  }

  // Métodos para SAP HANA
  private async connectToHana(): Promise<void> {
    const hanaHost = this.configService.get<string>('SAP_HANA_HOST');
    const hanaPort = this.configService.get<string>('SAP_HANA_PORT');
    const hanaDatabase = this.configService.get<string>('SAP_HANA_DATABASE');
    const hanaUsername = this.configService.get<string>('SAP_HANA_USERNAME');
    const hanaPassword = this.configService.get<string>('SAP_HANA_PASSWORD');

    if (!hanaHost || !hanaPort || !hanaUsername || !hanaPassword) {
      console.log('⚠️ Configuración de SAP HANA incompleta');
      return;
    }

    try {
      const connectionConfig = {
        serverNode: `${hanaHost}:${hanaPort}`,
        // Remover databaseName para usar la conexión por defecto
        // databaseName: hanaDatabase || 'MINOILDES',
        uid: hanaUsername,
        pwd: hanaPassword,
        encrypt: this.configService.get<string>('SAP_HANA_ENCRYPT') === 'true',
        sslValidateCertificate: this.configService.get<string>('SAP_HANA_TRUST_SERVER_CERTIFICATE') !== 'true',
      };

      this.hanaConnection = hana.createConnection();
      
      await new Promise<void>((resolve, reject) => {
        this.hanaConnection.connect(connectionConfig, (err: any) => {
          if (err) {
            console.error('❌ Error conectando a SAP HANA:', err);
            reject(err);
          } else {
            this.isHanaConnected = true;
            console.log('✅ Conectado exitosamente a SAP HANA');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('❌ Error en conexión SAP HANA:', error);
      throw error;
    }
  }

  private async disconnectFromHana(): Promise<void> {
    if (this.hanaConnection && this.isHanaConnected) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.hanaConnection.disconnect((err: any) => {
            if (err) {
              reject(err);
            } else {
              this.isHanaConnected = false;
              resolve();
            }
          });
        });
      } catch (error) {
        console.error('Error desconectando de SAP HANA:', error);
      }
    }
  }

  // Método para ejecutar consultas en SAP HANA
  async executeHanaQuery(query: string, params: any[] = []): Promise<any[]> {
    if (!this.isHanaConnected) {
      throw new Error('SAP HANA no está conectado');
    }

    return new Promise((resolve, reject) => {
      this.hanaConnection.exec(query, params, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // Método para verificar si SAP HANA está disponible
  isHanaAvailable(): boolean {
    return this.isHanaConnected;
  }

  // Método para obtener información de conexión
  getConnectionInfo() {
    return {
      hana: this.isHanaConnected ? 'connected' : 'disconnected'
    };
  }
}
