import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateMantenimientoDto } from './dto/create-mantenimiento.dto.';
import { UpdateMantenimientoDto } from './dto/update-mantenimiento.dto';

@Injectable()
export class MantenimientosService {
  private readonly logger = new Logger(MantenimientosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createMantenimientoDto: CreateMantenimientoDto, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar que el tipo de mantenimiento existe
      const tipoMantenimiento = await tx.tipoMantenimiento.findUnique({
        where: { id: createMantenimientoDto.tipoMantenimientoId }
      });

      if (!tipoMantenimiento) {
        throw new NotFoundException(`Tipo de mantenimiento con ID ${createMantenimientoDto.tipoMantenimientoId} no encontrado`);
      }

      // 2. Crear el registro principal de mantenimiento
      const mantenimiento = await tx.mantenimientoChopera.create({
        data: {
          usuarioId,
          fechaVisita: new Date(createMantenimientoDto.fechaVisita),
          clienteCodigo: createMantenimientoDto.clienteCodigo,
          choperaId: createMantenimientoDto.choperaId,
          tipoMantenimientoId: createMantenimientoDto.tipoMantenimientoId,
          estadoGeneral: createMantenimientoDto.estadoGeneral,
          comentarioEstado: createMantenimientoDto.comentarioEstado,
          comentarioCalidadCerveza: createMantenimientoDto.comentarioCalidadCerveza
        }
      });

      // 3. Crear las respuestas del checklist
      if (createMantenimientoDto.respuestasChecklist && createMantenimientoDto.respuestasChecklist.length > 0) {
        await tx.respuestaChecklist.createMany({
          data: createMantenimientoDto.respuestasChecklist.map(r => ({
            mantenimientoId: mantenimiento.id,
            itemId: r.itemId,
            valor: r.valor
          }))
        });
      }

      // 4. Crear las respuestas del análisis sensorial
      if (createMantenimientoDto.respuestasSensorial && createMantenimientoDto.respuestasSensorial.length > 0) {
        await tx.respuestaSensorial.createMany({
          data: createMantenimientoDto.respuestasSensorial.map(r => ({
            mantenimientoId: mantenimiento.id,
            grifo: r.grifo,
            cerveza: r.cerveza,
            criterio: r.criterio,
            valor: r.valor
          }))
        });
      }

      return mantenimiento;
    });
  }

  async findAll() {
    return this.prisma.mantenimientoChopera.findMany({
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true }
        },
        tipoMantenimiento: true,
        respuestasChecklist: {
          include: {
            item: {
              include: {
                categoria: true
              }
            }
          }
        },
        respuestasSensorial: true
      },
      orderBy: { fechaVisita: 'desc' }
    });
  }

  async findOne(id: number) {
    const mantenimiento = await this.prisma.mantenimientoChopera.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true }
        },
        tipoMantenimiento: true,
        respuestasChecklist: {
          include: {
            item: {
              include: {
                categoria: true
              }
            }
          }
        },
        respuestasSensorial: true
      }
    });

    if (!mantenimiento) {
      throw new NotFoundException(`Mantenimiento con ID ${id} no encontrado`);
    }

    return mantenimiento;
  }

  async update(id: number, updateMantenimientoDto: UpdateMantenimientoDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verificar que el mantenimiento existe
      const mantenimientoExistente = await tx.mantenimientoChopera.findUnique({
        where: { id }
      });

      if (!mantenimientoExistente) {
        throw new NotFoundException(`Mantenimiento con ID ${id} no encontrado`);
      }

      // 2. Actualizar el registro principal de mantenimiento
      const mantenimiento = await tx.mantenimientoChopera.update({
        where: { id },
        data: {
          fechaVisita: updateMantenimientoDto.fechaVisita ? new Date(updateMantenimientoDto.fechaVisita) : undefined,
          clienteCodigo: updateMantenimientoDto.clienteCodigo,
          choperaId: updateMantenimientoDto.choperaId,
          tipoMantenimientoId: updateMantenimientoDto.tipoMantenimientoId,
          estadoGeneral: updateMantenimientoDto.estadoGeneral,
          comentarioEstado: updateMantenimientoDto.comentarioEstado,
          comentarioCalidadCerveza: updateMantenimientoDto.comentarioCalidadCerveza
        }
      });

      // 3. Actualizar las respuestas del checklist si se proporcionan
      if (updateMantenimientoDto.respuestasChecklist) {
        // Eliminar respuestas existentes
        await tx.respuestaChecklist.deleteMany({
          where: { mantenimientoId: id }
        });

        // Crear nuevas respuestas
        if (updateMantenimientoDto.respuestasChecklist.length > 0) {
          await tx.respuestaChecklist.createMany({
            data: updateMantenimientoDto.respuestasChecklist.map(r => ({
              mantenimientoId: id,
              itemId: r.itemId,
              valor: r.valor
            }))
          });
        }
      }

      // 4. Actualizar las respuestas del análisis sensorial si se proporcionan
      if (updateMantenimientoDto.respuestasSensorial) {
        // Eliminar respuestas existentes
        await tx.respuestaSensorial.deleteMany({
          where: { mantenimientoId: id }
        });

        // Crear nuevas respuestas
        if (updateMantenimientoDto.respuestasSensorial.length > 0) {
          await tx.respuestaSensorial.createMany({
            data: updateMantenimientoDto.respuestasSensorial.map(r => ({
              mantenimientoId: id,
              grifo: r.grifo,
              cerveza: r.cerveza,
              criterio: r.criterio,
              valor: r.valor
            }))
          });
        }
      }

      return mantenimiento;
    });
  }

  async remove(id: number) {
    const mantenimiento = await this.prisma.mantenimientoChopera.findUnique({
      where: { id }
    });

    if (!mantenimiento) {
      throw new NotFoundException(`Mantenimiento con ID ${id} no encontrado`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Eliminar respuestas relacionadas
      await tx.respuestaChecklist.deleteMany({
        where: { mantenimientoId: id }
      });

      await tx.respuestaSensorial.deleteMany({
        where: { mantenimientoId: id }
      });

      // Eliminar el mantenimiento
      return tx.mantenimientoChopera.delete({
        where: { id }
      });
    });
  }
}