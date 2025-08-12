import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { PrismaService } from '@/config/prisma.service';

@Module({
  controllers: [PermisosController],
  providers: [PermisosService, PrismaService],
  exports: [PermisosService],
})
export class PermisosModule {} 