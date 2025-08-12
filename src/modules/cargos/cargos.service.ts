import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';

@Injectable()
export class CargosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCargoDto: CreateCargoDto) {
    try {
      // Verificar que el área existe
      const area = await this.prisma.area.findUnique({
        where: { id: createCargoDto.areaId }
      });

      if (!area) {
        throw new NotFoundException(`Área con ID ${createCargoDto.areaId} no encontrada`);
      }

      // Si se especifica un cargo superior, verificar que existe
      if (createCargoDto.cargoSuperiorId) {
        const cargoSuperior = await this.prisma.cargo.findUnique({
          where: { id: createCargoDto.cargoSuperiorId }
        });

        if (!cargoSuperior) {
          throw new NotFoundException(`Cargo superior con ID ${createCargoDto.cargoSuperiorId} no encontrado`);
        }

        // Verificar que el cargo superior pertenece a la misma área
        if (cargoSuperior.areaId !== createCargoDto.areaId) {
          throw new BadRequestException('El cargo superior debe pertenecer a la misma área');
        }
      }

      return await this.prisma.cargo.create({
        data: createCargoDto,
        include: {
          area: {
            select: { id: true, nombre: true, sede: { select: { id: true, nombre: true } } }
          },
          cargoSuperior: {
            select: { id: true, nombre: true, nivel: true }
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un cargo con ese nombre en esta área');
      }
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.cargo.findMany({
      where: { activo: true },
      include: {
        area: {
          select: { id: true, nombre: true, sede: { select: { id: true, nombre: true } } }
        },
        cargoSuperior: {
          select: { id: true, nombre: true, nivel: true }
        },
        cargosSubordinados: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        },
        _count: {
          select: { usuarios: true, cargosSubordinados: true }
        }
      },
      orderBy: [
        { area: { sede: { nombre: 'asc' } } },
        { area: { nombre: 'asc' } },
        { nivel: 'asc' },
        { nombre: 'asc' }
      ]
    });
  }

  async findOne(id: number) {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id },
      include: {
        area: {
          select: { 
            id: true, 
            nombre: true, 
            sede: { select: { id: true, nombre: true } } 
          }
        },
        cargoSuperior: {
          select: { id: true, nombre: true, nivel: true }
        },
        cargosSubordinados: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        },
        usuarios: {
          where: { activo: true },
          select: { id: true, username: true, nombre: true, apellido: true }
        },
        _count: {
          select: { usuarios: true, cargosSubordinados: true }
        }
      }
    });

    if (!cargo) {
      throw new NotFoundException(`Cargo con ID ${id} no encontrado`);
    }

    return cargo;
  }

  async findByArea(areaId: number) {
    return await this.prisma.cargo.findMany({
      where: { 
        areaId,
        activo: true 
      },
      include: {
        cargoSuperior: {
          select: { id: true, nombre: true, nivel: true }
        },
        cargosSubordinados: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        },
        _count: {
          select: { usuarios: true, cargosSubordinados: true }
        }
      },
      orderBy: [
        { nivel: 'asc' },
        { nombre: 'asc' }
      ]
    });
  }

  async getHierarchy(areaId?: number) {
    const whereClause = areaId ? { areaId, activo: true } : { activo: true };
    
    return await this.prisma.cargo.findMany({
      where: whereClause,
      include: {
        area: {
          select: { id: true, nombre: true, sede: { select: { id: true, nombre: true } } }
        },
        cargoSuperior: {
          select: { id: true, nombre: true, nivel: true }
        },
        cargosSubordinados: {
          where: { activo: true },
          select: { id: true, nombre: true, nivel: true }
        }
      },
      orderBy: [
        { area: { sede: { nombre: 'asc' } } },
        { area: { nombre: 'asc' } },
        { nivel: 'asc' },
        { nombre: 'asc' }
      ]
    });
  }

  async update(id: number, updateCargoDto: UpdateCargoDto) {
    try {
      // Verificar que el cargo existe
      const cargoExistente = await this.prisma.cargo.findUnique({
        where: { id }
      });

      if (!cargoExistente) {
        throw new NotFoundException(`Cargo con ID ${id} no encontrado`);
      }

      // Si se está cambiando el cargo superior, verificar que no se cree un ciclo
      if (updateCargoDto.cargoSuperiorId && updateCargoDto.cargoSuperiorId !== cargoExistente.cargoSuperiorId) {
        await this.verificarCicloJerarquico(id, updateCargoDto.cargoSuperiorId);
      }

      const cargo = await this.prisma.cargo.update({
        where: { id },
        data: updateCargoDto,
        include: {
          area: {
            select: { id: true, nombre: true, sede: { select: { id: true, nombre: true } } }
          },
          cargoSuperior: {
            select: { id: true, nombre: true, nivel: true }
          },
          cargosSubordinados: {
            where: { activo: true },
            select: { id: true, nombre: true, nivel: true }
          }
        }
      });

      return cargo;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Cargo con ID ${id} no encontrado`);
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un cargo con ese nombre en esta área');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      // Verificar que no hay usuarios asignados a este cargo
      const usuariosAsignados = await this.prisma.usuario.count({
        where: { cargoId: id, activo: true }
      });

      if (usuariosAsignados > 0) {
        throw new BadRequestException(`No se puede eliminar el cargo porque tiene ${usuariosAsignados} usuario(s) asignado(s)`);
      }

      // Verificar que no hay cargos subordinados
      const cargosSubordinados = await this.prisma.cargo.count({
        where: { cargoSuperiorId: id, activo: true }
      });

      if (cargosSubordinados > 0) {
        throw new BadRequestException(`No se puede eliminar el cargo porque tiene ${cargosSubordinados} cargo(s) subordinado(s)`);
      }

      // Soft delete
      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: false },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Cargo con ID ${id} no encontrado`);
      }
      throw error;
    }
  }

  private async verificarCicloJerarquico(cargoId: number, cargoSuperiorId: number): Promise<void> {
    let currentCargoId = cargoSuperiorId;
    const visited = new Set<number>();

    while (currentCargoId) {
      if (visited.has(currentCargoId)) {
        throw new BadRequestException('No se puede crear un ciclo en la jerarquía de cargos');
      }

      if (currentCargoId === cargoId) {
        throw new BadRequestException('Un cargo no puede ser su propio superior');
      }

      visited.add(currentCargoId);

      const cargo = await this.prisma.cargo.findUnique({
        where: { id: currentCargoId },
        select: { cargoSuperiorId: true }
      });

      if (!cargo) {
        break;
      }

      currentCargoId = cargo.cargoSuperiorId;
    }
  }
} 