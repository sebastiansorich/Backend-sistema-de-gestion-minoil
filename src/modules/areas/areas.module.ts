import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { PrismaService } from '@/config/prisma.service';

@Module({
  controllers: [AreasController],
  providers: [AreasService, PrismaService],
  exports: [AreasService],
})
export class AreasModule {} 