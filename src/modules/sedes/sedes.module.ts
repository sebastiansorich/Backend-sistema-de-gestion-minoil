import { Module } from '@nestjs/common';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { PrismaService } from '@/config/prisma.service';

@Module({
  controllers: [SedesController],
  providers: [SedesService, PrismaService],
  exports: [SedesService],
})
export class SedesModule {} 