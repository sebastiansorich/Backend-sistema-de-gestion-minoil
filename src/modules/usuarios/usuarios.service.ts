import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUsuarioDto: CreateUsuarioDto) {
    try {
      // Verificar que la sede existe
      const sede = await this.prisma.sede.findUnique({
        where: { id: createUsuarioDto.sedeId }
      });

      if (!sede) {
        throw new NotFoundException(`Sede con ID ${createUsuarioDto.sedeId} no encontrada`);
      }

      // Verificar que el área existe y pertenece a la sede
      const area = await this.prisma.area.findUnique({
        where: { id: createUsuarioDto.areaId }
      });

      if (!area) {
        throw new NotFoundException(`Área con ID ${createUsuarioDto.areaId} no encontrada`);
      }

      if (area.sedeId !== createUsuarioDto.sedeId) {
        throw new BadRequestException('El área debe pertenecer a la sede especificada');
      }

      // Verificar que el cargo existe y pertenece al área
      const cargo = await this.prisma.cargo.findUnique({
        where: { id: createUsuarioDto.cargoId },
        include: { rol: true }
      });

      if (!cargo) {
        throw new NotFoundException(`Cargo con ID ${createUsuarioDto.cargoId} no encontrado`);
      }

      if (cargo.areaId !== createUsuarioDto.areaId) {
        throw new BadRequestException('El cargo debe pertenecer al área especificada');
      }

      // Hash de la contraseña si se proporciona
      let hashedPassword = null;
      if (createUsuarioDto.password) {
        hashedPassword = await bcrypt.hash(createUsuarioDto.password, 10);
      }

      return await this.prisma.usuario.create({
        data: {
          ...createUsuarioDto,
          password: hashedPassword,
        },
        include: {
          sede: {
            select: { id: true, nombre: true }
          },
          area: {
            select: { id: true, nombre: true }
          },
          cargo: {
            select: { id: true, nombre: true, nivel: true }
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('username')) {
          throw new ConflictException('Ya existe un usuario con ese username');
        }
        if (error.meta?.target?.includes('email')) {
          throw new ConflictException('Ya existe un usuario con ese email');
        }
      }
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.usuario.findMany({
      where: { activo: true },
      include: {
        sede: {
          select: { id: true, nombre: true }
        },
        area: {
          select: { id: true, nombre: true }
        },
        cargo: {
          select: { id: true, nombre: true, nivel: true }
        }
      },
      orderBy: [
        { sede: { nombre: 'asc' } },
        { area: { nombre: 'asc' } },
        { apellido: 'asc' },
        { nombre: 'asc' }
      ]
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        sede: {
          select: { id: true, nombre: true }
        },
        area: {
          select: { id: true, nombre: true }
        },
        cargo: {
          select: { id: true, nombre: true, nivel: true }
        }
      }
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // No retornar la contraseña
    const { password, ...usuarioSinPassword } = usuario;
    return usuarioSinPassword;
  }

  async findByUsername(username: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { username },
      include: {
        sede: {
          select: { id: true, nombre: true }
        },
        area: {
          select: { id: true, nombre: true }
        },
        cargo: {
          select: { id: true, nombre: true, nivel: true }
        }
      }
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con username ${username} no encontrado`);
    }

    return usuario;
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    try {
      // Verificar que el usuario existe
      const usuarioExistente = await this.prisma.usuario.findUnique({
        where: { id }
      });

      if (!usuarioExistente) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Validar relaciones si se están actualizando
      if (updateUsuarioDto.sedeId || updateUsuarioDto.areaId || updateUsuarioDto.cargoId) {
        const sedeId = updateUsuarioDto.sedeId || usuarioExistente.sedeId;
        const areaId = updateUsuarioDto.areaId || usuarioExistente.areaId;
        const cargoId = updateUsuarioDto.cargoId || usuarioExistente.cargoId;

        // Verificar que el área pertenece a la sede
        if (updateUsuarioDto.areaId) {
          const area = await this.prisma.area.findUnique({
            where: { id: areaId }
          });

          if (!area) {
            throw new NotFoundException(`Área con ID ${areaId} no encontrada`);
          }

          if (area.sedeId !== sedeId) {
            throw new BadRequestException('El área debe pertenecer a la sede especificada');
          }
        }

        // Verificar que el cargo pertenece al área
        if (updateUsuarioDto.cargoId) {
          const cargo = await this.prisma.cargo.findUnique({
            where: { id: cargoId }
          });

          if (!cargo) {
            throw new NotFoundException(`Cargo con ID ${cargoId} no encontrado`);
          }

          if (cargo.areaId !== areaId) {
            throw new BadRequestException('El cargo debe pertenecer al área especificada');
          }
        }
      }

      // Hash de la contraseña si se está actualizando
      let hashedPassword = undefined;
      if (updateUsuarioDto.password) {
        hashedPassword = await bcrypt.hash(updateUsuarioDto.password, 10);
      }

      const usuario = await this.prisma.usuario.update({
        where: { id },
        data: {
          ...updateUsuarioDto,
          ...(hashedPassword && { password: hashedPassword }),
        },
        include: {
          sede: {
            select: { id: true, nombre: true }
          },
          area: {
            select: { id: true, nombre: true }
          },
          cargo: {
            select: { id: true, nombre: true, nivel: true }
          }
        }
      });

      // No retornar la contraseña
      const { password, ...usuarioSinPassword } = usuario;
      return usuarioSinPassword;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('username')) {
          throw new ConflictException('Ya existe un usuario con ese username');
        }
        if (error.meta?.target?.includes('email')) {
          throw new ConflictException('Ya existe un usuario con ese email');
        }
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      // Soft delete
      return await this.prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
      throw error;
    }
  }

  async verificarDuplicados() {
    try {
      // 1. Contar usuarios totales vs únicos por empleadoSapId
      const [totalUsuarios, usuariosConSapId, usuariosSinSapId] = await Promise.all([
        this.prisma.usuario.count(),
        this.prisma.usuario.count({ where: { empleadoSapId: { not: null } } }),
        this.prisma.usuario.count({ where: { empleadoSapId: null } })
      ]);

      // 2. Buscar usuarios sin empleadoSapId que podrían ser duplicados LDAP
      const usuariosSinSap = await this.prisma.usuario.findMany({
        where: { empleadoSapId: null },
        select: {
          id: true,
          username: true,
          nombre: true,
          apellido: true,
          autenticacion: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // 3. Verificar si hay empleadoSapId duplicados (no debería por UNIQUE constraint)
      const sapIdDuplicados = await this.prisma.$queryRaw`
        SELECT empleadoSapId, COUNT(*) as duplicados
        FROM usuarios 
        WHERE empleadoSapId IS NOT NULL
        GROUP BY empleadoSapId 
        HAVING COUNT(*) > 1
      `;

      // 4. Estadísticas por tipo de autenticación
      const estadisticasPorAuth = await this.prisma.usuario.groupBy({
        by: ['autenticacion'],
        _count: {
          id: true
        },
        where: {}
      });

      return {
        resumen: {
          totalUsuarios,
          usuariosConSapId,
          usuariosSinSapId,
          posiblesDuplicados: usuariosSinSapId > 0 ? usuariosSinSapId : 0
        },
        usuariosSinSapId: usuariosSinSap,
        sapIdDuplicados,
        estadisticasPorAuth,
        recomendacion: usuariosSinSapId > 0 
          ? "⚠️ Hay usuarios sin empleadoSapId que podrían ser duplicados LDAP antiguos"
          : "✅ No se detectaron duplicados evidentes"
      };
    } catch (error) {
      // Assuming 'this.logger' is available, otherwise remove or define it
      // this.logger.error('Error verificando duplicados:', error);
      throw new Error(`Error verificando duplicados: ${error.message}`);
    }
  }
} 