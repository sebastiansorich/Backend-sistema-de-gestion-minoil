import { Module } from '@nestjs/common';
import { MantenimientosService } from './mantenimientos.service';
import { MantenimientosController } from './mantenimientos.controller';
import { PrismaService } from '@/config/prisma.service';

@Module({
  controllers: [MantenimientosController],
  providers: [MantenimientosService, PrismaService],
  exports: [MantenimientosService],
})
export class MantenimientosModule {}