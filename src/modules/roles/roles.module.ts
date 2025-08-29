import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { SapHanaService } from '../sap/sap-hana.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService, SapHanaService],
  exports: [RolesService],
})
export class RolesModule {} 