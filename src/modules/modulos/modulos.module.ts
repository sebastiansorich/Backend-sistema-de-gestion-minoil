import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';
import { PrismaService } from '@/config/prisma.service';

@Module({
  controllers: [ModulosController],
  providers: [ModulosService, PrismaService],
  exports: [ModulosService],
})
export class ModulosModule {} 