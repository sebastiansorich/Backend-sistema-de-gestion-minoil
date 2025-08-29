import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SapHanaService, RolHANA } from '../sap/sap-hana.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {
  constructor(private readonly sapHanaService: SapHanaService) {}

  async create(createRolDto: CreateRolDto) {
    try {
      // Verificar que el nombre del rol no existe
      const roles = await this.sapHanaService.obtenerRoles();
      const rolExistente = roles.find(r => r.nombre.toLowerCase() === createRolDto.nombre.toLowerCase());
      
      if (rolExistente) {
        throw new ConflictException(`Ya existe un rol con el nombre: ${createRolDto.nombre}`);
      }

      // Crear el rol
      const rolData = {
        nombre: createRolDto.nombre,
        descripcion: createRolDto.descripcion,
        activo: true,
      };

      const rolCreado = await this.sapHanaService.crearRol(rolData);

      return rolCreado;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Error creando rol: ${error.message}`);
    }
  }

  async findAll() {
    try {
      const roles = await this.sapHanaService.obtenerRoles();
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      const permisos = await this.sapHanaService.obtenerPermisos();

      // Crear mapas para conteos rápidos
      const usuariosPorRol = new Map<number, number>();
      const permisosPorRol = new Map<number, number>();

      // Contar usuarios por rol
      usuarios.forEach(usuario => {
        const count = usuariosPorRol.get(usuario.ROLID) || 0;
        usuariosPorRol.set(usuario.ROLID, count + 1);
      });

      // Contar permisos por rol
      permisos.forEach(permiso => {
        const count = permisosPorRol.get(permiso.rolId) || 0;
        permisosPorRol.set(permiso.rolId, count + 1);
      });

      // Combinar roles con conteos
      const rolesConConteos = roles.map(rol => ({
        ...rol,
        _count: {
          usuarios: usuariosPorRol.get(rol.id) || 0,
          permisos: permisosPorRol.get(rol.id) || 0,
        },
      }));

      return rolesConConteos;
    } catch (error) {
      throw new BadRequestException(`Error obteniendo roles: ${error.message}`);
    }
  }

  async findOne(id: number) {
    try {
      const rol = await this.sapHanaService.obtenerRolPorId(id);
      
      if (!rol) {
        throw new NotFoundException(`Rol con ID ${id} no encontrado`);
      }

      // Obtener usuarios del rol
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      const usuariosDelRol = usuarios.filter(u => u.ROLID === id);

      // Obtener permisos del rol
      const permisos = await this.sapHanaService.obtenerPermisosPorRol(id);

      // Obtener módulos para los permisos
      const modulos = await this.sapHanaService.obtenerModulos();
      const modulosMap = new Map(modulos.map(modulo => [modulo.id, modulo]));

      // Construir permisos con información del módulo
      const permisosConModulos = permisos.map(permiso => {
        const modulo = modulosMap.get(permiso.moduloId);
        return {
          id: permiso.id,
          modulo: modulo ? {
            id: modulo.id,
            nombre: modulo.nombre,
            ruta: modulo.ruta,
          } : null,
          crear: permiso.crear,
          leer: permiso.leer,
          actualizar: permiso.actualizar,
          eliminar: permiso.eliminar,
        };
      }).filter(permiso => permiso.modulo !== null);

      return {
        ...rol,
        usuarios: usuariosDelRol.map(u => ({
          id: u.id,
          nombre: u.nombre,
          apellido: u.apellido,
          username: u.username,
          email: u.email,
        })),
        permisos: permisosConModulos,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error obteniendo rol: ${error.message}`);
    }
  }

  async update(id: number, updateRolDto: UpdateRolDto) {
    try {
      // Verificar que el rol existe
      const rolExistente = await this.sapHanaService.obtenerRolPorId(id);
      if (!rolExistente) {
        throw new NotFoundException(`Rol con ID ${id} no encontrado`);
      }

      // Verificar que el nombre no existe (si se está actualizando)
      if (updateRolDto.nombre && updateRolDto.nombre !== rolExistente.nombre) {
        const roles = await this.sapHanaService.obtenerRoles();
        const rolConNombre = roles.find(r => 
          r.nombre.toLowerCase() === updateRolDto.nombre!.toLowerCase() && r.id !== id
        );
        
        if (rolConNombre) {
          throw new ConflictException(`Ya existe un rol con el nombre: ${updateRolDto.nombre}`);
        }
      }

      // Actualizar el rol
      const rolActualizado = await this.sapHanaService.actualizarRol(id, updateRolDto);

      if (!rolActualizado) {
        throw new NotFoundException(`Error actualizando rol con ID ${id}`);
      }

      return rolActualizado;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Error actualizando rol: ${error.message}`);
    }
  }

  async remove(id: number) {
    try {
      // Verificar que el rol existe
      const rol = await this.sapHanaService.obtenerRolPorId(id);
      if (!rol) {
        throw new NotFoundException(`Rol con ID ${id} no encontrado`);
      }

      // Verificar que no hay usuarios usando este rol
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      const usuariosConRol = usuarios.filter(u => u.ROLID === id);
      
      if (usuariosConRol.length > 0) {
        throw new BadRequestException(
          `No se puede eliminar el rol porque tiene ${usuariosConRol.length} usuario(s) asignado(s)`
        );
      }

      // Eliminar el rol
      const eliminado = await this.sapHanaService.eliminarRol(id);
      
      if (!eliminado) {
        throw new BadRequestException(`Error eliminando rol con ID ${id}`);
      }

      return { message: `Rol con ID ${id} eliminado exitosamente` };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error eliminando rol: ${error.message}`);
    }
  }
} 