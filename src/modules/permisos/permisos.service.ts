import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { SapHanaService } from '../sap/sap-hana.service';

@Injectable()
export class PermisosService {
  constructor(
    private readonly sapHanaService: SapHanaService,
  ) {}

  async create(createPermisoDto: CreatePermisoDto) {
    try {
      // Validar que el rol existe
      const rol = await this.sapHanaService.obtenerRolPorId(createPermisoDto.rolId);
      if (!rol) {
        throw new NotFoundException(`Rol con ID ${createPermisoDto.rolId} no encontrado`);
      }

      // Validar que el módulo existe
      const modulo = await this.sapHanaService.obtenerModuloPorId(createPermisoDto.moduloId);
      if (!modulo) {
        throw new NotFoundException(`Módulo con ID ${createPermisoDto.moduloId} no encontrado`);
      }

      // Verificar que no exista ya un permiso para este rol y módulo
      const permisosExistentes = await this.sapHanaService.obtenerPermisosPorRol(createPermisoDto.rolId);
      const permisoExistente = permisosExistentes.find(p => p.moduloId === createPermisoDto.moduloId);
      
      if (permisoExistente) {
        throw new ConflictException('Ya existe un permiso para este rol y módulo');
      }

      // Crear permiso usando SAP HANA
      const permisoCreado = await this.sapHanaService.crearPermiso({
        rolId: createPermisoDto.rolId,
        moduloId: createPermisoDto.moduloId,
        crear: createPermisoDto.crear ?? false,
        leer: createPermisoDto.leer ?? false,
        actualizar: createPermisoDto.actualizar ?? false,
        eliminar: createPermisoDto.eliminar ?? false,
      });

      // Enriquecer con información del rol y módulo
      const permisoEnriquecido = {
        ...permisoCreado,
        rol,
        modulo
      };

      return {
        success: true,
        data: permisoEnriquecido,
        message: 'Permiso creado exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Error creando permiso: ' + error.message);
    }
  }

  async findAll() {
    try {
      const permisos = await this.sapHanaService.obtenerPermisos();
      
      // Enriquecer con información de roles y módulos
      const permisosEnriquecidos = await Promise.all(
        permisos.map(async (permiso) => {
          const rol = await this.sapHanaService.obtenerRolPorId(permiso.rolId);
          const modulo = await this.sapHanaService.obtenerModuloPorId(permiso.moduloId);
          
          return {
            ...permiso,
            rol: rol || { id: permiso.rolId, nombre: 'Rol no encontrado' },
            modulo: modulo || { id: permiso.moduloId, nombre: 'Módulo no encontrado' }
          };
        })
      );
      
      return {
        success: true,
        data: permisosEnriquecidos,
        total: permisosEnriquecidos.length,
        message: 'Permisos obtenidos exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener permisos'
      };
    }
  }

  async findByRol(rolId: number) {
    try {
      // Validar que el rol existe
      const rol = await this.sapHanaService.obtenerRolPorId(rolId);
      if (!rol) {
        throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);
      }

      const permisos = await this.sapHanaService.obtenerPermisosPorRol(rolId);
      
      // Enriquecer con información de módulos
      const permisosEnriquecidos = await Promise.all(
        permisos.map(async (permiso) => {
          const modulo = await this.sapHanaService.obtenerModuloPorId(permiso.moduloId);
          
          return {
            ...permiso,
            rol,
            modulo: modulo || { id: permiso.moduloId, nombre: 'Módulo no encontrado' }
          };
        })
      );
      
      return {
        success: true,
        data: permisosEnriquecidos,
        total: permisosEnriquecidos.length,
        message: `Permisos del rol ${rol.nombre} obtenidos exitosamente`
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener permisos del rol'
      };
    }
  }

  async findByModulo(moduloId: number) {
    try {
      // Validar que el módulo existe
      const modulo = await this.sapHanaService.obtenerModuloPorId(moduloId);
      if (!modulo) {
        throw new NotFoundException(`Módulo con ID ${moduloId} no encontrado`);
      }

      const permisos = await this.sapHanaService.obtenerPermisosPorModulo(moduloId);
      
      // Enriquecer con información de roles
      const permisosEnriquecidos = await Promise.all(
        permisos.map(async (permiso) => {
          const rol = await this.sapHanaService.obtenerRolPorId(permiso.rolId);
          
          return {
            ...permiso,
            rol: rol || { id: permiso.rolId, nombre: 'Rol no encontrado' },
            modulo
          };
        })
      );
      
      return {
        success: true,
        data: permisosEnriquecidos,
        total: permisosEnriquecidos.length,
        message: `Permisos del módulo ${modulo.nombre} obtenidos exitosamente`
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener permisos del módulo'
      };
    }
  }

  async findOne(id: number) {
    try {
      const permisos = await this.sapHanaService.obtenerPermisos();
      const permiso = permisos.find(p => p.id === id);
      
      if (!permiso) {
        throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
      }
      
      // Enriquecer con información de rol y módulo
      const rol = await this.sapHanaService.obtenerRolPorId(permiso.rolId);
      const modulo = await this.sapHanaService.obtenerModuloPorId(permiso.moduloId);
      
      const permisoEnriquecido = {
        ...permiso,
        rol: rol || { id: permiso.rolId, nombre: 'Rol no encontrado' },
        modulo: modulo || { id: permiso.moduloId, nombre: 'Módulo no encontrado' }
      };
      
      return {
        success: true,
        data: permisoEnriquecido,
        message: 'Permiso encontrado exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener permiso'
      };
    }
  }

  async update(id: number, updatePermisoDto: UpdatePermisoDto) {
    try {
      // Verificar que el permiso existe
      const permisos = await this.sapHanaService.obtenerPermisos();
      const permisoExistente = permisos.find(p => p.id === id);
      
      if (!permisoExistente) {
        throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
      }

      // Validar rol si se está actualizando
      if (updatePermisoDto.rolId) {
        const rol = await this.sapHanaService.obtenerRolPorId(updatePermisoDto.rolId);
        if (!rol) {
          throw new NotFoundException(`Rol con ID ${updatePermisoDto.rolId} no encontrado`);
        }
      }

      // Validar módulo si se está actualizando
      if (updatePermisoDto.moduloId) {
        const modulo = await this.sapHanaService.obtenerModuloPorId(updatePermisoDto.moduloId);
        if (!modulo) {
          throw new NotFoundException(`Módulo con ID ${updatePermisoDto.moduloId} no encontrado`);
        }
      }

      // Verificar que no exista conflicto con otro permiso
      if (updatePermisoDto.rolId || updatePermisoDto.moduloId) {
        const rolId = updatePermisoDto.rolId || permisoExistente.rolId;
        const moduloId = updatePermisoDto.moduloId || permisoExistente.moduloId;
        
        const permisosConflictivos = permisos.filter(p => 
          p.id !== id && p.rolId === rolId && p.moduloId === moduloId
        );
        
        if (permisosConflictivos.length > 0) {
          throw new ConflictException('Ya existe un permiso para este rol y módulo');
        }
      }

      // Actualizar permiso usando SAP HANA
      const permisoActualizado = await this.sapHanaService.actualizarPermiso(id, updatePermisoDto);
      
      // Enriquecer con información de rol y módulo
      const rol = await this.sapHanaService.obtenerRolPorId(permisoActualizado.rolId);
      const modulo = await this.sapHanaService.obtenerModuloPorId(permisoActualizado.moduloId);
      
      const permisoEnriquecido = {
        ...permisoActualizado,
        rol: rol || { id: permisoActualizado.rolId, nombre: 'Rol no encontrado' },
        modulo: modulo || { id: permisoActualizado.moduloId, nombre: 'Módulo no encontrado' }
      };
      
      return {
        success: true,
        data: permisoEnriquecido,
        message: 'Permiso actualizado exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Error actualizando permiso: ' + error.message);
    }
  }

  async remove(id: number) {
    try {
      // Verificar que el permiso existe
      const permisos = await this.sapHanaService.obtenerPermisos();
      const permisoExistente = permisos.find(p => p.id === id);
      
      if (!permisoExistente) {
        throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
      }

      // Eliminar permiso usando SAP HANA
      await this.sapHanaService.eliminarPermiso(id);
      
      return {
        success: true,
        message: `Permiso con ID ${id} eliminado exitosamente`,
        id
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException('Error eliminando permiso: ' + error.message);
    }
  }
} 