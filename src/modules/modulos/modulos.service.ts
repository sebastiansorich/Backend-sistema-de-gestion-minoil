import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';

@Injectable()
export class ModulosService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔍 OBTENER MÓDULOS JERÁRQUICOS PARA SIDEBAR
  async findAllForSidebar() {
    // Obtener solo módulos padre (nivel 1) con sus submódulos
    const modulosPadre = await this.prisma.modulo.findMany({
      where: { 
        activo: true,
        nivel: 1 
      },
      include: {
        submodulos: {
          where: { 
            activo: true,
            esMenu: true  // Solo los que deben aparecer clickeables en sidebar
          },
          orderBy: { orden: 'asc' }
        }
      },
      orderBy: { orden: 'asc' }
    });

    return modulosPadre;
  }

  async create(createModuloDto: CreateModuloDto) {
    try {
      // Si es submódulo, validar que el padre existe y calcular nivel
      if (createModuloDto.padreId) {
        const padre = await this.prisma.modulo.findUnique({
          where: { id: createModuloDto.padreId }
        });
        
        if (!padre) {
          throw new NotFoundException('Módulo padre no encontrado');
        }
        
        // Auto-calcular nivel basado en el padre
        createModuloDto.nivel = padre.nivel + 1;
      }

      return await this.prisma.modulo.create({
        data: createModuloDto,
        include: {
          padre: { select: { id: true, nombre: true } },
          submodulos: { 
            select: { id: true, nombre: true },
            where: { activo: true }
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('nombre')) {
          throw new ConflictException('Ya existe un módulo con ese nombre');
        }
        if (error.meta?.target?.includes('ruta')) {
          throw new ConflictException('Ya existe un módulo con esa ruta');
        }
      }
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.modulo.findMany({
      where: { activo: true },
      include: {
        padre: {
          select: { id: true, nombre: true }
        },
        submodulos: {
          select: { id: true, nombre: true },
          where: { activo: true }
        },
        permisos: {
          include: {
            rol: {
              select: { id: true, nombre: true }
            }
          }
        },
        _count: {
          select: { permisos: true, submodulos: true }
        }
      },
      orderBy: [
        { nivel: 'asc' },
        { orden: 'asc' },
        { nombre: 'asc' }
      ]
    });
  }

  async findOne(id: number) {
    const modulo = await this.prisma.modulo.findUnique({
      where: { id },
      include: {
        padre: {
          select: { id: true, nombre: true }
        },
        submodulos: {
          select: { id: true, nombre: true },
          where: { activo: true }
        },
        permisos: {
          include: {
            rol: {
              select: { id: true, nombre: true }
            }
          }
        },
        _count: {
          select: { permisos: true, submodulos: true }
        }
      }
    });

    if (!modulo) {
      throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
    }

    return modulo;
  }

  async update(id: number, updateModuloDto: UpdateModuloDto) {
    try {
      const modulo = await this.prisma.modulo.update({
        where: { id },
        data: updateModuloDto,
      });

      return modulo;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
      }
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('nombre')) {
          throw new ConflictException('Ya existe un módulo con ese nombre');
        }
        if (error.meta?.target?.includes('ruta')) {
          throw new ConflictException('Ya existe un módulo con esa ruta');
        }
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      // Verificar si tiene submódulos activos
      const submodulosActivos = await this.prisma.modulo.count({
        where: { 
          padreId: id,
          activo: true 
        }
      });

      if (submodulosActivos > 0) {
        throw new ConflictException(
          'No se puede eliminar un módulo que tiene submódulos activos. Elimine primero los submódulos.'
        );
      }

      // Soft delete
      return await this.prisma.modulo.update({
        where: { id },
        data: { activo: false },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
      }
      throw error;
    }
  }
} 