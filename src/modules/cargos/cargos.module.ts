import { Module } from '@nestjs/common';
import { CargosService } from './cargos.service';
import { CargosController } from './cargos.controller';
import { PrismaService } from '@/config/prisma.service';

@Module({
  controllers: [CargosController],
  providers: [CargosService, PrismaService],
  exports: [CargosService],
})
export class CargosModule {} 