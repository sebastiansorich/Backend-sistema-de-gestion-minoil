import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';
import { SapHanaService } from '../sap/sap-hana.service';

@Module({
  controllers: [ModulosController],
  providers: [ModulosService, SapHanaService],
  exports: [ModulosService],
})
export class ModulosModule {} 