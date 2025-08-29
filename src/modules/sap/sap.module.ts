import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SapHanaService } from './sap-hana.service';
import { SapSyncService } from './sap-sync.service';
import { SapController } from './sap.controller';
import { LdapService } from '../auth/ldap.service';

@Module({
  imports: [ConfigModule],
  controllers: [SapController],
  providers: [
    SapHanaService,
    SapSyncService,
    LdapService
  ],
  exports: [SapHanaService, SapSyncService]
})
export class SapModule {} 