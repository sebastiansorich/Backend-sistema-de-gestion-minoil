import { ApiProperty } from '@nestjs/swagger';

export class UsuarioConPermisosDto {
  @ApiProperty({ description: 'ID del usuario' })
  id: number;

  @ApiProperty({ description: 'Nombre de usuario' })
  username: string;

  @ApiProperty({ description: 'Email del usuario' })
  email: string;

  @ApiProperty({ description: 'Nombre del usuario' })
  nombre: string;

  @ApiProperty({ description: 'Apellido del usuario' })
  apellido: string;

  @ApiProperty({ description: 'Tipo de autenticación' })
  autenticacion: string;

  @ApiProperty({ description: 'Estado activo del usuario' })
  activo: boolean;

  @ApiProperty({ description: 'Último acceso del usuario' })
  ultimoAcceso?: Date;

  @ApiProperty({ description: 'Información de la sede' })
  sede: {
    id: number;
    nombre: string;
  };

  @ApiProperty({ description: 'Información del área' })
  area: {
    id: number;
    nombre: string;
  };

  @ApiProperty({ description: 'Información del cargo' })
  cargo: {
    id: number;
    nombre: string;
  };

  @ApiProperty({ description: 'Información del rol' })
  rol: {
    id: number;
    nombre: string;
  };

  @ApiProperty({ description: 'Permisos del usuario por módulo' })
  permisos: {
    moduloId: number;
    moduloNombre: string;
    crear: boolean;
    leer: boolean;
    actualizar: boolean;
    eliminar: boolean;
  }[];
} 