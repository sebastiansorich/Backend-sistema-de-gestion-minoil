import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { SapHanaService } from '../sap/sap-hana.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, SapHanaService],
  exports: [UsuariosService],
})
export class UsuariosModule {} 