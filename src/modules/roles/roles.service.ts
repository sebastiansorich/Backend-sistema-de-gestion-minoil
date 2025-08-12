import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRolDto: CreateRolDto) {
    try {
      return await this.prisma.rol.create({
        data: createRolDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.rol.findMany({
      where: { activo: true },
      include: {
        permisos: {
          include: {
            modulo: {
              select: { id: true, nombre: true, ruta: true }
            }
          }
        },
        _count: {
          select: { cargos: true, permisos: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async findOne(id: number) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      include: {
        permisos: {
          include: {
            modulo: {
              select: { id: true, nombre: true, ruta: true }
            }
          }
        },
        cargos: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        },
        _count: {
          select: { cargos: true, permisos: true }
        }
      }
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return rol;
  }

  async update(id: number, updateRolDto: UpdateRolDto) {
    try {
      const rol = await this.prisma.rol.update({
        where: { id },
        data: updateRolDto,
      });

      return rol;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Rol con ID ${id} no encontrado`);
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      // Soft delete
      return await this.prisma.rol.update({
        where: { id },
        data: { activo: false },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Rol con ID ${id} no encontrado`);
      }
      throw error;
    }
  }
} 