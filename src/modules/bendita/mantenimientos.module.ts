import { Module } from '@nestjs/common';
import { MantenimientosService } from './mantenimientos.service';
import { MantenimientosController } from './mantenimientos.controller';
import { ChoperasController } from './choperas.controller';
import { ChoperasService } from './choperas.service';
import { TiposMantenimientoService } from './tipos-mantenimiento.service';
import { TiposMantenimientoController } from './tipos-mantenimiento.controller';
import { SapHanaService } from '../sap/sap-hana.service';

@Module({
  controllers: [
    MantenimientosController, 
    ChoperasController, 
    TiposMantenimientoController
  ],
  providers: [
    MantenimientosService, 
    ChoperasService,
    TiposMantenimientoService, 
    SapHanaService
  ],
  exports: [MantenimientosService, ChoperasService, TiposMantenimientoService],
})
export class BenditaModule {}