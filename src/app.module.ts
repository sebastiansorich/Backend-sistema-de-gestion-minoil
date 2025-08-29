import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from '@/config/database.service';

// Importar módulos esenciales
import { RolesModule } from '@/modules/roles/roles.module';
import { UsuariosModule } from '@/modules/usuarios/usuarios.module';
import { ModulosModule } from '@/modules/modulos/modulos.module';
import { PermisosModule } from '@/modules/permisos/permisos.module';
import { AuthModule } from '@/modules/auth/auth.module';

// Importar módulo SAP
import { SapModule } from '@/modules/sap/sap.module';

// Importar módulo Bendita
import { BenditaModule } from '@/modules/bendita/mantenimientos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Solo módulos esenciales
    RolesModule,
    UsuariosModule,
    ModulosModule,
    PermisosModule,
    AuthModule,
    SapModule, // Importar el módulo SAP completo
    BenditaModule, // Importar el módulo de mantenimientos de choperas
  ],
  controllers: [],
  providers: [
    DatabaseService,
  ],
})
export class AppModule {} 