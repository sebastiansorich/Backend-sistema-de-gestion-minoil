import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAreaDto: CreateAreaDto) {
    try {
      // Verificar que la sede existe
      const sede = await this.prisma.sede.findUnique({
        where: { id: createAreaDto.sedeId }
      });

      if (!sede) {
        throw new NotFoundException(`Sede con ID ${createAreaDto.sedeId} no encontrada`);
      }

      return await this.prisma.area.create({
        data: createAreaDto,
        include: {
          sede: {
            select: { id: true, nombre: true }
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un área con ese nombre en esta sede');
      }
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.area.findMany({
      where: { activo: true },
      include: {
        sede: {
          select: { id: true, nombre: true }
        },
        cargos: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        },
        _count: {
          select: { usuarios: true, cargos: true }
        }
      },
      orderBy: [
        { sede: { nombre: 'asc' } },
        { nombre: 'asc' }
      ]
    });
  }

  async findOne(id: number) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: {
        sede: {
          select: { id: true, nombre: true }
        },
        cargos: {
          where: { activo: true },
          include: {
            cargoSuperior: {
              select: { id: true, nombre: true, nivel: true }
            },
            cargosSubordinados: {
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
          select: { usuarios: true, cargos: true }
        }
      }
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    return area;
  }

  async findBySede(sedeId: number) {
    return await this.prisma.area.findMany({
      where: { 
        sedeId,
        activo: true 
      },
      include: {
        cargos: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        },
        _count: {
          select: { usuarios: true, cargos: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async update(id: number, updateAreaDto: UpdateAreaDto) {
    try {
      const area = await this.prisma.area.update({
        where: { id },
        data: updateAreaDto,
        include: {
          sede: {
            select: { id: true, nombre: true }
          }
        }
      });

      return area;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Área con ID ${id} no encontrada`);
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un área con ese nombre en esta sede');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      // Soft delete
      return await this.prisma.area.update({
        where: { id },
        data: { activo: false },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Área con ID ${id} no encontrada`);
      }
      throw error;
    }
  }
} 