import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';

@Injectable()
export class PermisosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPermisoDto: CreatePermisoDto) {
    try {
      // Verificar que el rol existe
      const rol = await this.prisma.rol.findUnique({
        where: { id: createPermisoDto.rolId }
      });

      if (!rol) {
        throw new NotFoundException(`Rol con ID ${createPermisoDto.rolId} no encontrado`);
      }

      // Verificar que el módulo existe
      const modulo = await this.prisma.modulo.findUnique({
        where: { id: createPermisoDto.moduloId }
      });

      if (!modulo) {
        throw new NotFoundException(`Módulo con ID ${createPermisoDto.moduloId} no encontrado`);
      }

      return await this.prisma.permiso.create({
        data: createPermisoDto,
        include: {
          rol: {
            select: { id: true, nombre: true }
          },
          modulo: {
            select: { id: true, nombre: true, ruta: true }
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un permiso para este rol y módulo');
      }
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.permiso.findMany({
      include: {
        rol: {
          select: { id: true, nombre: true }
        },
        modulo: {
          select: { id: true, nombre: true, ruta: true }
        }
      },
      orderBy: [
        { rol: { nombre: 'asc' } },
        { modulo: { nombre: 'asc' } }
      ]
    });
  }

  async findOne(id: number) {
    const permiso = await this.prisma.permiso.findUnique({
      where: { id },
      include: {
        rol: {
          select: { id: true, nombre: true }
        },
        modulo: {
          select: { id: true, nombre: true, ruta: true }
        }
      }
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
    }

    return permiso;
  }

  async findByRol(rolId: number) {
    return await this.prisma.permiso.findMany({
      where: { rolId },
      include: {
        modulo: {
          select: { id: true, nombre: true, ruta: true }
        }
      },
      orderBy: { modulo: { nombre: 'asc' } }
    });
  }

  async findByModulo(moduloId: number) {
    return await this.prisma.permiso.findMany({
      where: { moduloId },
      include: {
        rol: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { rol: { nombre: 'asc' } }
    });
  }

  async update(id: number, updatePermisoDto: UpdatePermisoDto) {
    try {
      const permiso = await this.prisma.permiso.update({
        where: { id },
        data: updatePermisoDto,
        include: {
          rol: {
            select: { id: true, nombre: true }
          },
          modulo: {
            select: { id: true, nombre: true, ruta: true }
          }
        }
      });

      return permiso;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un permiso para este rol y módulo');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.permiso.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
      }
      throw error;
    }
  }
} 