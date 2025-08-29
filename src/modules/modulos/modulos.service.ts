import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { SapHanaService } from '../sap/sap-hana.service';

@Injectable()
export class ModulosService {
  constructor(
    private readonly sapHanaService: SapHanaService,
  ) {}

  // 🔍 OBTENER MÓDULOS JERÁRQUICOS PARA SIDEBAR
  async findAllForSidebar() {
    try {
      const modulos = await this.sapHanaService.obtenerModulos();
      
      // Filtrar solo módulos activos y que sean menú
      const modulosActivos = modulos.filter(m => m.activo && m.esMenu);
      
      // Construir estructura jerárquica
      const modulosJerarquicos = modulosActivos
        .filter(m => !m.padreId) // Solo módulos raíz
        .map(moduloPadre => {
          const submodulos = modulosActivos
            .filter(m => m.padreId === moduloPadre.id)
            .sort((a, b) => a.orden - b.orden);
          
          return {
            ...moduloPadre,
            submodulos
          };
        })
        .sort((a, b) => a.orden - b.orden);
      
      return {
        success: true,
        data: modulosJerarquicos,
        total: modulosJerarquicos.length,
        message: 'Estructura jerárquica de módulos obtenida exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener estructura jerárquica de módulos'
      };
    }
  }

  async create(createModuloDto: CreateModuloDto) {
    try {
      // Validar que no exista un módulo con el mismo nombre o ruta
      const modulosExistentes = await this.sapHanaService.obtenerModulos();
      const moduloExistente = modulosExistentes.find(m => 
        m.nombre.toLowerCase() === createModuloDto.nombre.toLowerCase() ||
        m.ruta === createModuloDto.ruta
      );
      
      if (moduloExistente) {
        throw new ConflictException('Ya existe un módulo con ese nombre o ruta');
      }

      // Validar módulo padre si se especifica
      if (createModuloDto.padreId) {
        const moduloPadre = await this.sapHanaService.obtenerModuloPorId(createModuloDto.padreId);
        if (!moduloPadre) {
          throw new NotFoundException(`Módulo padre con ID ${createModuloDto.padreId} no encontrado`);
        }
        // Calcular nivel automáticamente
        createModuloDto.nivel = moduloPadre.nivel + 1;
      } else {
        createModuloDto.nivel = 1;
      }

      // Crear módulo usando SAP HANA
      const moduloCreado = await this.sapHanaService.crearModulo({
        nombre: createModuloDto.nombre,
        descripcion: createModuloDto.descripcion,
        ruta: createModuloDto.ruta,
        activo: createModuloDto.activo ?? true,
        esMenu: createModuloDto.esMenu ?? true,
        icono: createModuloDto.icono,
        nivel: createModuloDto.nivel,
        orden: createModuloDto.orden ?? 0,
        padreId: createModuloDto.padreId,
      });

      return {
        success: true,
        data: moduloCreado,
        message: 'Módulo creado exitosamente'
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException('Error creando módulo: ' + error.message);
    }
  }

  async findAll() {
    try {
      const modulos = await this.sapHanaService.obtenerModulos();
      
      // Enriquecer con información de submódulos y permisos
      const modulosEnriquecidos = await Promise.all(
        modulos.map(async (modulo) => {
          // Obtener submódulos
          const submodulos = modulos.filter(m => m.padreId === modulo.id);
          
          // Obtener permisos (si existe la tabla)
          let permisos = [];
          try {
            permisos = await this.sapHanaService.obtenerPermisosPorModulo(modulo.id);
          } catch (error) {
            // Si no existe la tabla de permisos, continuar sin errores
          }
          
          return {
            ...modulo,
            padre: modulo.padreId ? modulos.find(m => m.id === modulo.padreId) : null,
            submodulos,
            permisos,
            _count: { 
              permisos: permisos.length, 
              submodulos: submodulos.length 
            }
          };
        })
      );
      
      return {
        success: true,
        data: modulosEnriquecidos,
        total: modulosEnriquecidos.length,
        message: 'Módulos obtenidos exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener módulos'
      };
    }
  }

  async findOne(id: number) {
    try {
      const modulo = await this.sapHanaService.obtenerModuloPorId(id);
      
      if (!modulo) {
        throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
      }
      
      // Obtener submódulos
      const todosLosModulos = await this.sapHanaService.obtenerModulos();
      const submodulos = todosLosModulos.filter(m => m.padreId === id);
      
      // Obtener permisos
      let permisos = [];
      try {
        permisos = await this.sapHanaService.obtenerPermisosPorModulo(id);
      } catch (error) {
        // Si no existe la tabla de permisos, continuar sin errores
      }
      
      const moduloEnriquecido = {
        ...modulo,
        padre: modulo.padreId ? todosLosModulos.find(m => m.id === modulo.padreId) : null,
        submodulos,
        permisos,
        _count: { 
          permisos: permisos.length, 
          submodulos: submodulos.length 
        }
      };
      
      return {
        success: true,
        data: moduloEnriquecido,
        message: 'Módulo encontrado exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener módulo'
      };
    }
  }

  async update(id: number, updateModuloDto: UpdateModuloDto) {
    try {
      // Verificar que el módulo existe
      const moduloExistente = await this.sapHanaService.obtenerModuloPorId(id);
      if (!moduloExistente) {
        throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
      }

      // Validar que no exista otro módulo con el mismo nombre o ruta
      if (updateModuloDto.nombre || updateModuloDto.ruta) {
        const modulosExistentes = await this.sapHanaService.obtenerModulos();
        const moduloConflictivo = modulosExistentes.find(m => 
          m.id !== id && (
            (updateModuloDto.nombre && m.nombre.toLowerCase() === updateModuloDto.nombre.toLowerCase()) ||
            (updateModuloDto.ruta && m.ruta === updateModuloDto.ruta)
          )
        );
        
        if (moduloConflictivo) {
          throw new ConflictException('Ya existe un módulo con ese nombre o ruta');
        }
      }

      // Validar módulo padre si se especifica
      if (updateModuloDto.padreId) {
        const moduloPadre = await this.sapHanaService.obtenerModuloPorId(updateModuloDto.padreId);
        if (!moduloPadre) {
          throw new NotFoundException(`Módulo padre con ID ${updateModuloDto.padreId} no encontrado`);
        }
        // Calcular nivel automáticamente
        updateModuloDto.nivel = moduloPadre.nivel + 1;
      }

      // Actualizar módulo usando SAP HANA
      const moduloActualizado = await this.sapHanaService.actualizarModulo(id, updateModuloDto);
      
      return {
        success: true,
        data: moduloActualizado,
        message: 'Módulo actualizado exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Error actualizando módulo: ' + error.message);
    }
  }

  async remove(id: number) {
    try {
      // Verificar que el módulo existe
      const moduloExistente = await this.sapHanaService.obtenerModuloPorId(id);
      if (!moduloExistente) {
        throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
      }

      // Verificar que no tenga submódulos
      const todosLosModulos = await this.sapHanaService.obtenerModulos();
      const tieneSubmodulos = todosLosModulos.some(m => m.padreId === id);
      
      if (tieneSubmodulos) {
        throw new ConflictException('No se puede eliminar un módulo que tiene submódulos. Elimine primero los submódulos.');
      }

      // Verificar que no tenga permisos asociados
      try {
        const permisos = await this.sapHanaService.obtenerPermisosPorModulo(id);
        if (permisos.length > 0) {
          throw new ConflictException('No se puede eliminar un módulo que tiene permisos asociados. Elimine primero los permisos.');
        }
      } catch (error) {
        // Si no existe la tabla de permisos, continuar
      }

      // Eliminar módulo usando SAP HANA
      await this.sapHanaService.eliminarModulo(id);
      
      return {
        success: true,
        message: `Módulo con ID ${id} eliminado exitosamente`,
        id
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Error eliminando módulo: ' + error.message);
    }
  }
} 