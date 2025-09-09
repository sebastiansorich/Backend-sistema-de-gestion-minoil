import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SapHanaService } from '../sap/sap-hana.service';
import { ChoperasService } from './choperas.service';

export interface Mantenimiento {
  id: number;
  usuarioId: number;
  fechaVisita: Date;
  clienteCodigo: string;
  itemCode: string;
  choperaCode: string;
  tipoMantenimientoId: number;
  estadoGeneral: string;
  comentarioEstado?: string;
  comentarioCalidadCerveza?: string;
  respuestasChecklist: RespuestaChecklist[];
  respuestasSensorial: RespuestaSensorial[];
  createdAt: Date;
  updatedAt: Date;
  tipoMantenimiento?: TipoMantenimiento;
  usuario?: Usuario;
  chopera?: Chopera;
}

export interface RespuestaChecklist {
  id: number;
  itemId: number;
  valor: string;
  mantenimientoId: number;
}

export interface RespuestaSensorial {
  id: number;
  grifo: number;
  cerveza: string;
  criterio: string;
  valor: string;
  mantenimientoId: number;
}

export interface TipoMantenimiento {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
}

export interface Chopera {
  itemCode: string;
  itemName: string;
  status: string;
  ciudad: string;
  serieActivo: string;
  cardCode: string;
  cardName: string;
  aliasName: string;
}

@Injectable()
export class MantenimientosService {
  constructor(
    private readonly sapHanaService: SapHanaService,
    private readonly choperasService: ChoperasService,
  ) {}

  async create(createMantenimientoDto: any, usuarioId: number): Promise<Mantenimiento> {
    try {
      console.log('🔧 Iniciando creación de mantenimiento...');
      console.log('📋 DTO recibido:', JSON.stringify(createMantenimientoDto, null, 2));
      console.log('👤 Usuario ID:', usuarioId);
      
      // Verificar que el usuario existe en SAP HANA (obligatorio)
      console.log('🔍 Verificando que el usuario existe en SAP HANA...');
      const usuario = await this.sapHanaService.obtenerUsuarioPorId(usuarioId);
      
      if (!usuario) {
        console.log('❌ Usuario no encontrado en SAP HANA');
        throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado. El mantenimiento debe ser asignado a un usuario válido.`);
      }
      
      console.log('✅ Usuario encontrado en SAP HANA:', usuario.nombre, usuario.apellido);

      // Verificar que la chopera existe en SAP
      console.log('🔍 Buscando chopera con ItemCode:', createMantenimientoDto.itemCode);
      const chopera = await this.choperasService.obtenerPorItemCode(createMantenimientoDto.itemCode);
      if (!chopera) {
        console.log('❌ Chopera no encontrada');
        throw new NotFoundException(`Chopera con ItemCode ${createMantenimientoDto.itemCode} no encontrada en SAP.`);
      }
      console.log('✅ Chopera encontrada:', chopera.itemName);

      // Validar fecha de visita
      console.log('📅 Validando fecha de visita:', createMantenimientoDto.fechaVisita);
      const fechaVisita = new Date(createMantenimientoDto.fechaVisita);
      if (fechaVisita > new Date()) {
        console.log('❌ Fecha futura no permitida');
        throw new BadRequestException('La fecha de visita no puede ser futura');
      }
      console.log('✅ Fecha válida');

      // Crear el mantenimiento en la base de datos
      console.log('💾 Guardando mantenimiento en base de datos...');
      console.log('👤 Usuario ID que se va a usar:', usuarioId);
      console.log('👤 Tipo de usuarioId:', typeof usuarioId);
      
      const mantenimientoData = {
        usuarioId,
        fechaVisita,
        clienteCodigo: createMantenimientoDto.clienteCodigo,
        itemCode: createMantenimientoDto.itemCode,
        choperaCode: createMantenimientoDto.choperaCode,
        tipoMantenimientoId: createMantenimientoDto.tipoMantenimientoId,
        estadoGeneral: createMantenimientoDto.estadoGeneral || 'BUENO',
        comentarioEstado: createMantenimientoDto.comentarioEstado,
        comentarioCalidadCerveza: createMantenimientoDto.comentarioCalidadCerveza,
      };

      console.log('📋 Datos del mantenimiento que se van a guardar:', JSON.stringify(mantenimientoData, null, 2));

      const mantenimientoCreado = await this.sapHanaService.crearMantenimiento(mantenimientoData);
      console.log('✅ Mantenimiento creado en base de datos con ID:', mantenimientoCreado.id);

      // NOTA: No guardamos checklist ni sensoriales - se generarán simulados
      console.log('📋 Checklist y sensoriales: Se generarán datos simulados al consultar');

      // Obtener el mantenimiento completo con respuestas
      const mantenimientoCompleto = await this.findOne(mantenimientoCreado.id);
      console.log('✅ Mantenimiento completo obtenido');
      return mantenimientoCompleto;
    } catch (error) {
      console.log('❌ Error en creación de mantenimiento:', error.message);
      console.log('📋 Stack trace:', error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error creando mantenimiento: ${error.message}`);
    }
  }

  async findAll(): Promise<Mantenimiento[]> {
    try {
      const mantenimientos = await this.sapHanaService.obtenerMantenimientos();
      
      // Enriquecer con información de usuario, chopera y respuestas
      const mantenimientosEnriquecidos = await Promise.all(
        mantenimientos.map(async (mantenimiento) => {
          return await this.enriquecerMantenimiento(mantenimiento);
        })
      );
      
      return mantenimientosEnriquecidos;
    } catch (error) {
      throw new BadRequestException(`Error obteniendo mantenimientos: ${error.message}`);
    }
  }

  async findOne(id: number): Promise<Mantenimiento> {
    try {
      const mantenimiento = await this.sapHanaService.obtenerMantenimientoPorId(id);
      
      if (!mantenimiento) {
        throw new NotFoundException(`Mantenimiento con ID ${id} no encontrado`);
      }

      return await this.enriquecerMantenimiento(mantenimiento);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error obteniendo mantenimiento: ${error.message}`);
    }
  }

  private async enriquecerMantenimiento(mantenimiento: any): Promise<Mantenimiento> {
    try {
      // Obtener información del usuario
      const usuario = await this.sapHanaService.obtenerUsuarioPorId(mantenimiento.usuarioId);
      
      // Obtener información de la chopera
      const chopera = await this.choperasService.obtenerPorItemCode(mantenimiento.itemCode);
      
      // Generar respuestas de checklist simuladas
      const respuestasChecklist = this.generarChecklistSimulado(mantenimiento.id);
      
      // Generar respuestas sensoriales simuladas
      const respuestasSensorial = this.generarSensorialSimulado(mantenimiento.id);

      return {
        ...mantenimiento,
        usuario: usuario ? {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
        } : {
          id: mantenimiento.usuarioId,
          nombre: 'Usuario No Encontrado',
          apellido: `(ID: ${mantenimiento.usuarioId})`,
          email: 'no-encontrado@minoil.com.bo',
        },
        chopera: chopera ? {
          itemCode: chopera.itemCode,
          itemName: chopera.itemName,
          status: chopera.status,
          ciudad: chopera.ciudad,
          serieActivo: chopera.serieActivo,
          cardCode: chopera.cardCode,
          cardName: chopera.cardName,
          aliasName: chopera.aliasName,
        } : {
          itemCode: mantenimiento.itemCode,
          itemName: 'Chopera no encontrada',
          status: 'N/A',
          ciudad: 'N/A',
          serieActivo: 'N/A',
          cardCode: 'N/A',
          cardName: 'N/A',
          aliasName: 'N/A',
        },
        respuestasChecklist,
        respuestasSensorial,
        tipoMantenimiento: {
          id: mantenimiento.tipoMantenimientoId,
          nombre: this.getTipoMantenimientoNombre(mantenimiento.tipoMantenimientoId),
          descripcion: 'Descripción del tipo de mantenimiento',
          activo: true
        }
      };
    } catch (error) {
      console.error('Error enriqueciendo mantenimiento:', error);
      // Retornar mantenimiento básico si hay error al enriquecer
      return {
        ...mantenimiento,
        usuario: {
          id: mantenimiento.usuarioId,
          nombre: 'Usuario No Encontrado',
          apellido: `(ID: ${mantenimiento.usuarioId})`,
          email: 'no-encontrado@minoil.com.bo',
        },
        chopera: {
          itemCode: mantenimiento.itemCode,
          itemName: 'Chopera no encontrada',
          status: 'N/A',
          ciudad: 'N/A',
          serieActivo: 'N/A',
          cardCode: 'N/A',
          cardName: 'N/A',
          aliasName: 'N/A',
        },
        respuestasChecklist: [],
        respuestasSensorial: [],
        tipoMantenimiento: {
          id: mantenimiento.tipoMantenimientoId,
          nombre: this.getTipoMantenimientoNombre(mantenimiento.tipoMantenimientoId),
          descripcion: 'Descripción del tipo de mantenimiento',
          activo: true
        }
      };
    }
  }

  async update(id: number, updateMantenimientoDto: any): Promise<Mantenimiento> {
    try {
      // Verificar que el mantenimiento existe
      const mantenimientoExistente = await this.sapHanaService.obtenerMantenimientoPorId(id);
      if (!mantenimientoExistente) {
        throw new NotFoundException(`Mantenimiento con ID ${id} no encontrado`);
      }

      // Validar fecha de visita si se proporciona
      if (updateMantenimientoDto.fechaVisita) {
        const fechaVisita = new Date(updateMantenimientoDto.fechaVisita);
        if (fechaVisita > new Date()) {
          throw new BadRequestException('La fecha de visita no puede ser futura');
        }
      }

      // Actualizar el mantenimiento en la base de datos
      const mantenimientoActualizado = await this.sapHanaService.actualizarMantenimiento(id, updateMantenimientoDto);
      
      if (!mantenimientoActualizado) {
        throw new NotFoundException(`Error actualizando mantenimiento con ID ${id}`);
      }

      // Obtener el mantenimiento completo actualizado
      return await this.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error actualizando mantenimiento: ${error.message}`);
    }
  }

  async remove(id: number): Promise<{ message: string; id: number }> {
    try {
      // Verificar que el mantenimiento existe
      const mantenimientoExistente = await this.sapHanaService.obtenerMantenimientoPorId(id);
      if (!mantenimientoExistente) {
        throw new NotFoundException(`Mantenimiento con ID ${id} no encontrado`);
      }

      // Eliminar el mantenimiento de la base de datos
      const eliminado = await this.sapHanaService.eliminarMantenimiento(id);
      
      if (!eliminado) {
        throw new BadRequestException(`Error eliminando mantenimiento con ID ${id}`);
      }
      
      return {
        message: `Mantenimiento con ID ${id} eliminado exitosamente`,
        id
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error eliminando mantenimiento: ${error.message}`);
    }
  }

  async findByChopera(serieActivo: string): Promise<Mantenimiento[]> {
    try {
      const mantenimientos = await this.sapHanaService.obtenerMantenimientosPorChopera(serieActivo);
      
      // Enriquecer con información de usuario, chopera y respuestas
      const mantenimientosEnriquecidos = await Promise.all(
        mantenimientos.map(async (mantenimiento) => {
          return await this.enriquecerMantenimiento(mantenimiento);
        })
      );
      
      return mantenimientosEnriquecidos;
    } catch (error) {
      throw new BadRequestException(`Error obteniendo mantenimientos por chopera: ${error.message}`);
    }
  }

  async findByUsuario(usuarioId: number): Promise<Mantenimiento[]> {
    try {
      const mantenimientos = await this.sapHanaService.obtenerMantenimientosPorUsuario(usuarioId);
      
      // Enriquecer con información de usuario, chopera y respuestas
      const mantenimientosEnriquecidos = await Promise.all(
        mantenimientos.map(async (mantenimiento) => {
          return await this.enriquecerMantenimiento(mantenimiento);
        })
      );
      
      return mantenimientosEnriquecidos;
    } catch (error) {
      throw new BadRequestException(`Error obteniendo mantenimientos por usuario: ${error.message}`);
    }
  }

  async findByFecha(fechaInicio: Date, fechaFin: Date): Promise<Mantenimiento[]> {
    try {
      const mantenimientos = await this.sapHanaService.obtenerMantenimientosPorFecha(fechaInicio, fechaFin);
      
      // Enriquecer con información de usuario, chopera y respuestas
      const mantenimientosEnriquecidos = await Promise.all(
        mantenimientos.map(async (mantenimiento) => {
          return await this.enriquecerMantenimiento(mantenimiento);
        })
      );
      
      return mantenimientosEnriquecidos;
    } catch (error) {
      throw new BadRequestException(`Error obteniendo mantenimientos por fecha: ${error.message}`);
    }
  }

  private getTipoMantenimientoNombre(tipoId: number): string {
    const tipos: { [key: number]: string } = {
      1: 'Mantenimiento Preventivo',
      2: 'Mantenimiento Correctivo',
      3: 'Mantenimiento de Emergencia'
    };
    return tipos[tipoId] || 'Mantenimiento General';
  }

  private generarChecklistSimulado(mantenimientoId: number): any[] {
    // Generar datos simulados de checklist
    const itemsChecklist = [
      { id: 1, nombre: 'Temperatura de la cerveza', valor: 'BUENO' },
      { id: 2, nombre: 'Presión del CO2', valor: 'EXCELENTE' },
      { id: 3, nombre: 'Limpieza del equipo', valor: 'BUENO' },
      { id: 4, nombre: 'Funcionamiento del grifo', valor: 'EXCELENTE' },
      { id: 5, nombre: 'Calidad de la espuma', valor: 'BUENO' }
    ];

    return itemsChecklist.map(item => ({
      id: Math.floor(Math.random() * 1000) + 1,
      itemId: item.id,
      valor: item.valor,
      mantenimientoId: mantenimientoId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  private generarSensorialSimulado(mantenimientoId: number): any[] {
    // Generar datos simulados de evaluación sensorial
    const cervezas = ['Paceña', 'Huari', 'Cusqueña', 'Bock'];
    const criterios = ['Temperatura', 'Espuma', 'Sabor', 'Aroma'];
    const valores = ['EXCELENTE', 'BUENO', 'REGULAR'];

    const respuestas = [];
    for (let grifo = 1; grifo <= 2; grifo++) {
      respuestas.push({
        id: Math.floor(Math.random() * 1000) + 1,
        grifo: grifo,
        cerveza: cervezas[Math.floor(Math.random() * cervezas.length)],
        criterio: criterios[Math.floor(Math.random() * criterios.length)],
        valor: valores[Math.floor(Math.random() * valores.length)],
        mantenimientoId: mantenimientoId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return respuestas;
  }
}