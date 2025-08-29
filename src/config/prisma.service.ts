import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Conectado exitosamente a la base de datos');
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      console.log('🔌 Desconectado de la base de datos');
    } catch (error) {
      console.log('🔌 Error al desconectar:', error.message);
    }
  }
} 