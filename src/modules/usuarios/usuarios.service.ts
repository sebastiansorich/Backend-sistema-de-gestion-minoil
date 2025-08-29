import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SapHanaService, UsuarioHANA, RolHANA } from '../sap/sap-hana.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsuariosService {
  constructor(private readonly sapHanaService: SapHanaService) {}

  async create(createUsuarioDto: CreateUsuarioDto): Promise<UsuarioHANA> {
    try {
      // Asignar rol por defecto (id = 3) si no se especifica
      const rolId = createUsuarioDto.rolID || 3;
      
      // Verificar que el rol existe
      const rol = await this.sapHanaService.obtenerRolPorId(rolId);

      if (!rol) {
        throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);
      }

      // Verificar que el username no existe
      const usuarioExistente = await this.sapHanaService.obtenerUsuarioPorUsername(createUsuarioDto.username);
      if (usuarioExistente) {
        throw new BadRequestException(`El username '${createUsuarioDto.username}' ya existe`);
      }

      // Verificar que el email no existe
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      const emailExistente = usuarios.find(u => u.email === createUsuarioDto.email);
      if (emailExistente) {
        throw new BadRequestException(`El email '${createUsuarioDto.email}' ya existe`);
      }

      // Encriptar password si se proporciona
      let passwordEncriptado = createUsuarioDto.password;
      if (createUsuarioDto.password) {
        passwordEncriptado = await bcrypt.hash(createUsuarioDto.password, 10);
      }

      // Preparar datos del usuario
      const usuarioData = {
        username: createUsuarioDto.username,
        email: createUsuarioDto.email,
        nombre: createUsuarioDto.nombre,
        apellido: createUsuarioDto.apellido,
        password: passwordEncriptado,
        activo: createUsuarioDto.activo ?? true,
        autenticacion: createUsuarioDto.autenticacion ?? 'local',
        empID: createUsuarioDto.empID,
        jefeDirectoSapId: createUsuarioDto.jefeDirectoSapId,
        nombreCompletoSap: createUsuarioDto.nombreCompletoSap,
        ROLID: rolId, // Usar el rolId (por defecto 3 si no se especifica)
      };

      const usuarioCreado = await this.sapHanaService.crearUsuario(usuarioData);

      // No retornar la contraseña
      delete usuarioCreado.password;

      return usuarioCreado;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }

  async findAll() {
    try {
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      const roles = await this.sapHanaService.obtenerRoles();

      // Crear un mapa de roles para acceso rápido
      const rolesMap = new Map(roles.map(rol => [rol.id, rol]));

      // Combinar usuarios con sus roles
      const usuariosConRoles = usuarios.map(usuario => ({
        ...usuario,
        rol: rolesMap.get(usuario.ROLID),
        password: undefined, // No devolver contraseñas
      }));

      return usuariosConRoles;
    } catch (error) {
      throw new BadRequestException(`Error obteniendo usuarios: ${error.message}`);
    }
  }

  async findOne(id: number) {
    try {
      const usuario = await this.sapHanaService.obtenerUsuarioPorId(id);
      
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Obtener el rol del usuario
      const rol = await this.sapHanaService.obtenerRolPorId(usuario.ROLID);

      return {
        ...usuario,
        rol,
        password: undefined, // No devolver la contraseña
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error obteniendo usuario: ${error.message}`);
    }
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    try {
      // Verificar que el usuario existe
      const usuarioExistente = await this.sapHanaService.obtenerUsuarioPorId(id);
      if (!usuarioExistente) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Verificar que el rol existe si se está actualizando
      if (updateUsuarioDto.rolID) {
        const rol = await this.sapHanaService.obtenerRolPorId(updateUsuarioDto.rolID);
        if (!rol) {
          throw new NotFoundException(`Rol con ID ${updateUsuarioDto.rolID} no encontrado`);
        }
      }

      // Verificar que el username no existe (si se está actualizando)
      if (updateUsuarioDto.username && updateUsuarioDto.username !== usuarioExistente.username) {
        const usuarioConUsername = await this.sapHanaService.obtenerUsuarioPorUsername(updateUsuarioDto.username);
        if (usuarioConUsername) {
          throw new ConflictException(`Ya existe un usuario con el username: ${updateUsuarioDto.username}`);
        }
      }

      // Verificar que el email no existe (si se está actualizando)
      if (updateUsuarioDto.email && updateUsuarioDto.email !== usuarioExistente.email) {
        const usuarios = await this.sapHanaService.obtenerUsuarios();
        const emailExistente = usuarios.find(u => u.email === updateUsuarioDto.email && u.id !== id);
        if (emailExistente) {
          throw new ConflictException(`Ya existe un usuario con el email: ${updateUsuarioDto.email}`);
        }
      }

      // Encriptar contraseña si se está actualizando
      if (updateUsuarioDto.password) {
        const salt = await bcrypt.genSalt(10);
        updateUsuarioDto.password = await bcrypt.hash(updateUsuarioDto.password, salt);
      }

      // Actualizar el usuario
      const usuarioActualizado = await this.sapHanaService.actualizarUsuario(id, updateUsuarioDto);

      if (!usuarioActualizado) {
        throw new NotFoundException(`Error actualizando usuario con ID ${id}`);
      }

      // Obtener el rol para la respuesta
      const rol = await this.sapHanaService.obtenerRolPorId(usuarioActualizado.ROLID);

      return {
        ...usuarioActualizado,
        rol,
        password: undefined, // No devolver la contraseña
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Error actualizando usuario: ${error.message}`);
    }
  }

  async remove(id: number) {
    try {
      // Verificar que el usuario existe
      const usuario = await this.sapHanaService.obtenerUsuarioPorId(id);
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Eliminar el usuario
      const eliminado = await this.sapHanaService.eliminarUsuario(id);
      
      if (!eliminado) {
        throw new BadRequestException(`Error eliminando usuario con ID ${id}`);
      }

      return { message: `Usuario con ID ${id} eliminado exitosamente` };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error eliminando usuario: ${error.message}`);
    }
  }

  async verificarDuplicados() {
    try {
      const usuarios = await this.sapHanaService.obtenerUsuarios();
      
      const duplicados = {
        usernames: [] as any[],
        emails: [] as any[],
      };

      // Verificar usernames duplicados
      const usernames = usuarios.map(u => u.username);
      const usernamesUnicos = new Set(usernames);
      if (usernames.length !== usernamesUnicos.size) {
        const usernameCounts = usernames.reduce((acc, username) => {
          acc[username] = (acc[username] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        duplicados.usernames = Object.entries(usernameCounts)
          .filter(([_, count]) => count > 1)
          .map(([username, count]) => ({ username, count }));
      }

      // Verificar emails duplicados
      const emails = usuarios.map(u => u.email);
      const emailsUnicos = new Set(emails);
      if (emails.length !== emailsUnicos.size) {
        const emailCounts = emails.reduce((acc, email) => {
          acc[email] = (acc[email] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        duplicados.emails = Object.entries(emailCounts)
          .filter(([_, count]) => count > 1)
          .map(([email, count]) => ({ email, count }));
      }

      return duplicados;
    } catch (error) {
      throw new BadRequestException(`Error verificando duplicados: ${error.message}`);
    }
  }
} 