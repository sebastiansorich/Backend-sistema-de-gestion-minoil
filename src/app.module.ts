import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@/config/prisma.service';

// Importar módulos de features
import { SedesModule } from '@/modules/sedes/sedes.module';
import { AreasModule } from '@/modules/areas/areas.module';
import { CargosModule } from '@/modules/cargos/cargos.module';
import { RolesModule } from '@/modules/roles/roles.module';
import { UsuariosModule } from '@/modules/usuarios/usuarios.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ModulosModule } from '@/modules/modulos/modulos.module';
import { PermisosModule } from '@/modules/permisos/permisos.module';
import { SapModule } from '@/modules/sap/sap.module';
import { MantenimientosModule } from '@/modules/bendita/mantenimientos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SedesModule,
    AreasModule,
    CargosModule,
    RolesModule,
    UsuariosModule,
    AuthModule,
    ModulosModule,
    PermisosModule,
    SapModule,
    MantenimientosModule,
  ],
  providers: [PrismaService],
})
export class AppModule {} 