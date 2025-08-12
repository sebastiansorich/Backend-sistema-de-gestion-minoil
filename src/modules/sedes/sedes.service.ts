import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@Injectable()
export class SedesService {
  private readonly logger = new Logger(SedesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createSedeDto: CreateSedeDto) {
    try {
      return await this.prisma.sede.create({
        data: createSedeDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe una sede con ese nombre');
      }
      throw error;
    }
  }

  /**
   * 🚀 Crea las sedes iniciales necesarias para la sincronización SAP
   */
  async crearSedesIniciales() {
    this.logger.log('🏢 Creando sedes iniciales para sincronización SAP...');

    // Verificar si ya existen sedes
    const sedesExistentes = await this.prisma.sede.count({ where: { activo: true } });
    
    if (sedesExistentes > 0) {
      this.logger.log(`✅ Ya existen ${sedesExistentes} sedes en el sistema`);
      return {
        mensaje: 'Ya existen sedes en el sistema',
        sedesExistentes,
        sedesCreadas: 0
      };
    }

    // Crear sedes iniciales
    const sedesIniciales = [
      {
        nombre: 'Sede Central',
        direccion: 'Dirección Central Minoil',
        telefono: '+591-3-123-4567',
        email: 'central@minoil.com.bo',
        activo: true
      },
      {
        nombre: 'Sucursal Santa Cruz',
        direccion: 'Santa Cruz, Bolivia',
        telefono: '+591-3-123-4568',
        email: 'santacruz@minoil.com.bo',
        activo: true
      },
      {
        nombre: 'Sucursal La Paz',
        direccion: 'La Paz, Bolivia',
        telefono: '+591-2-123-4569',
        email: 'lapaz@minoil.com.bo',
        activo: true
      }
    ];

    let sedesCreadas = 0;
    const errores = [];

    for (const sedeData of sedesIniciales) {
      try {
        await this.prisma.sede.create({ data: sedeData });
        sedesCreadas++;
        this.logger.log(`✅ Sede creada: ${sedeData.nombre}`);
      } catch (error) {
        if (error.code === 'P2002') {
          this.logger.warn(`⚠️ Sede ya existe: ${sedeData.nombre}`);
        } else {
          errores.push(`Error creando ${sedeData.nombre}: ${error.message}`);
          this.logger.error(`❌ Error creando ${sedeData.nombre}:`, error);
        }
      }
    }

    this.logger.log(`🎉 Sedes iniciales creadas: ${sedesCreadas}`);

    return {
      mensaje: 'Sedes iniciales creadas exitosamente',
      sedesCreadas,
      errores,
      siguiente: 'Ahora puedes ejecutar la sincronización SAP'
    };
  }

  async findAll() {
    return await this.prisma.sede.findMany({
      where: { activo: true },
      include: {
        areas: {
          where: { activo: true },
          select: { id: true, nombre: true }
        },
        _count: {
          select: { usuarios: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async findOne(id: number) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        areas: {
          where: { activo: true },
          include: {
            cargos: {
              where: { activo: true },
              select: { id: true, nombre: true, nivel: true }
            },
            _count: {
              select: { usuarios: true }
            }
          }
        },
        usuarios: {
          where: { activo: true },
          select: { id: true, username: true, nombre: true, apellido: true }
        },
        _count: {
          select: { usuarios: true, areas: true }
        }
      }
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }

    return sede;
  }

  async update(id: number, updateSedeDto: UpdateSedeDto) {
    try {
      const sede = await this.prisma.sede.update({
        where: { id },
        data: updateSedeDto,
      });

      return sede;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Sede con ID ${id} no encontrada`);
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe una sede con ese nombre');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      // Soft delete - marcar como inactivo
      return await this.prisma.sede.update({
        where: { id },
        data: { activo: false },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Sede con ID ${id} no encontrada`);
      }
      throw error;
    }
  }
} 