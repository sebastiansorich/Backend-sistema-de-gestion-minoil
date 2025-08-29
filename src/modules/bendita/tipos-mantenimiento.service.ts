import { Injectable } from '@nestjs/common';
import { SapHanaService } from '../sap/sap-hana.service';

export interface TipoMantenimiento {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  frecuencia?: string;
  duracionEstimada?: string;
  prioridad?: 'BAJA' | 'MEDIA' | 'ALTA';
}

@Injectable()
export class TiposMantenimientoService {
  constructor(private readonly sapHanaService: SapHanaService) {}

  async findAll(): Promise<TipoMantenimiento[]> {
    try {
      const tipos = await this.sapHanaService.obtenerTiposMantenimiento();
      return tipos.map(tipo => ({
        id: tipo.id,
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        activo: tipo.activo,
        // Los campos adicionales no están en la tabla real, los asignamos por defecto
        frecuencia: this.getFrecuenciaPorNombre(tipo.nombre),
        duracionEstimada: this.getDuracionPorNombre(tipo.nombre),
        prioridad: this.getPrioridadPorNombre(tipo.nombre),
      }));
    } catch (error) {
      console.error('Error obteniendo tipos de mantenimiento:', error);
      // Fallback a datos estáticos si la base de datos falla
      return this.getTiposEstaticos();
    }
  }

  async findOne(id: number): Promise<TipoMantenimiento | null> {
    try {
      const tipo = await this.sapHanaService.obtenerTipoMantenimientoPorId(id);
      if (!tipo) return null;
      
      return {
        id: tipo.id,
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        activo: tipo.activo,
        frecuencia: this.getFrecuenciaPorNombre(tipo.nombre),
        duracionEstimada: this.getDuracionPorNombre(tipo.nombre),
        prioridad: this.getPrioridadPorNombre(tipo.nombre),
      };
    } catch (error) {
      console.error('Error obteniendo tipo de mantenimiento:', error);
      // Fallback a datos estáticos
      const tiposEstaticos = this.getTiposEstaticos();
      return tiposEstaticos.find(t => t.id === id) || null;
    }
  }

  async findByPrioridad(prioridad: string): Promise<TipoMantenimiento[]> {
    try {
      const tipos = await this.findAll();
      return tipos.filter(tipo => 
        tipo.activo && tipo.prioridad === prioridad.toUpperCase()
      );
    } catch (error) {
      console.error('Error obteniendo tipos por prioridad:', error);
      return [];
    }
  }

  async getEstadisticas() {
    try {
      const tipos = await this.findAll();
      
      const porPrioridad = tipos.reduce((acc, tipo) => {
        acc[tipo.prioridad || 'Sin prioridad'] = (acc[tipo.prioridad || 'Sin prioridad'] || 0) + 1;
        return acc;
      }, {});

      const porFrecuencia = tipos.reduce((acc, tipo) => {
        acc[tipo.frecuencia || 'Sin frecuencia'] = (acc[tipo.frecuencia || 'Sin frecuencia'] || 0) + 1;
        return acc;
      }, {});

      return {
        total: tipos.length,
        porPrioridad,
        porFrecuencia,
        tipos
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { total: 0, porPrioridad: {}, porFrecuencia: {}, tipos: [] };
    }
  }

  async create(tipoMantenimiento: Omit<TipoMantenimiento, 'id'>): Promise<TipoMantenimiento> {
    try {
      const tipoCreado = await this.sapHanaService.crearTipoMantenimiento({
        nombre: tipoMantenimiento.nombre,
        descripcion: tipoMantenimiento.descripcion,
        activo: tipoMantenimiento.activo,
      });
      
      return {
        id: tipoCreado.id,
        nombre: tipoCreado.nombre,
        descripcion: tipoCreado.descripcion,
        activo: tipoCreado.activo,
        frecuencia: tipoMantenimiento.frecuencia,
        duracionEstimada: tipoMantenimiento.duracionEstimada,
        prioridad: tipoMantenimiento.prioridad,
      };
    } catch (error) {
      console.error('Error creando tipo de mantenimiento:', error);
      throw error;
    }
  }

  async update(id: number, datosActualizados: Partial<TipoMantenimiento>): Promise<TipoMantenimiento | null> {
    try {
      const tipoActualizado = await this.sapHanaService.actualizarTipoMantenimiento(id, {
        nombre: datosActualizados.nombre,
        descripcion: datosActualizados.descripcion,
        activo: datosActualizados.activo,
      });
      
      if (!tipoActualizado) return null;
      
      return {
        id: tipoActualizado.id,
        nombre: tipoActualizado.nombre,
        descripcion: tipoActualizado.descripcion,
        activo: tipoActualizado.activo,
        frecuencia: datosActualizados.frecuencia,
        duracionEstimada: datosActualizados.duracionEstimada,
        prioridad: datosActualizados.prioridad,
      };
    } catch (error) {
      console.error('Error actualizando tipo de mantenimiento:', error);
      throw error;
    }
  }

  async remove(id: number): Promise<boolean> {
    try {
      return await this.sapHanaService.eliminarTipoMantenimiento(id);
    } catch (error) {
      console.error('Error eliminando tipo de mantenimiento:', error);
      throw error;
    }
  }

  // Métodos auxiliares para mapear datos adicionales
  private getFrecuenciaPorNombre(nombre: string): string {
    const frecuencias: { [key: string]: string } = {
      'Mantenimiento Preventivo': 'Mensual',
      'Mantenimiento Correctivo': 'Según necesidad',
      'Mantenimiento Predictivo': 'Trimestral',
      'Inspección General': 'Semanal',
      'Limpieza y Sanitización': 'Semanal',
    };
    return frecuencias[nombre] || 'Según necesidad';
  }

  private getDuracionPorNombre(nombre: string): string {
    const duraciones: { [key: string]: string } = {
      'Mantenimiento Preventivo': '2-4 horas',
      'Mantenimiento Correctivo': '4-8 horas',
      'Mantenimiento Predictivo': '6-12 horas',
      'Inspección General': '1-2 horas',
      'Limpieza y Sanitización': '2-3 horas',
    };
    return duraciones[nombre] || '2-4 horas';
  }

  private getPrioridadPorNombre(nombre: string): 'BAJA' | 'MEDIA' | 'ALTA' {
    const prioridades: { [key: string]: 'BAJA' | 'MEDIA' | 'ALTA' } = {
      'Mantenimiento Preventivo': 'MEDIA',
      'Mantenimiento Correctivo': 'ALTA',
      'Mantenimiento Predictivo': 'MEDIA',
      'Inspección General': 'BAJA',
      'Limpieza y Sanitización': 'MEDIA',
    };
    return prioridades[nombre] || 'MEDIA';
  }

  // Datos estáticos como fallback
  private getTiposEstaticos(): TipoMantenimiento[] {
    return [
      {
        id: 1,
        nombre: 'Mantenimiento Preventivo',
        descripcion: 'Mantenimiento programado para prevenir fallas y mantener el equipo en óptimas condiciones',
        activo: true,
        frecuencia: 'Mensual',
        duracionEstimada: '2-4 horas',
        prioridad: 'MEDIA'
      },
      {
        id: 2,
        nombre: 'Mantenimiento Correctivo',
        descripcion: 'Reparación de fallas o averías que han ocurrido en el equipo',
        activo: true,
        frecuencia: 'Según necesidad',
        duracionEstimada: '4-8 horas',
        prioridad: 'ALTA'
      },
      {
        id: 3,
        nombre: 'Mantenimiento Predictivo',
        descripcion: 'Mantenimiento basado en el estado real del equipo mediante monitoreo y análisis',
        activo: true,
        frecuencia: 'Trimestral',
        duracionEstimada: '6-12 horas',
        prioridad: 'MEDIA'
      },
      {
        id: 4,
        nombre: 'Inspección General',
        descripcion: 'Revisión completa del estado general del equipo y sus componentes',
        activo: true,
        frecuencia: 'Semanal',
        duracionEstimada: '1-2 horas',
        prioridad: 'BAJA'
      },
      {
        id: 5,
        nombre: 'Limpieza y Sanitización',
        descripcion: 'Limpieza profunda y sanitización del equipo para mantener la calidad del producto',
        activo: true,
        frecuencia: 'Semanal',
        duracionEstimada: '2-3 horas',
        prioridad: 'MEDIA'
      },
    ];
  }
}
