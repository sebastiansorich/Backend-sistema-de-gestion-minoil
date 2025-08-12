import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/config/prisma.service';
import { SapHanaService, EmpleadoSAP } from './sap-hana.service';
import { NombreMatchingUtil } from '@/utils/nombre-matching.util';

export interface ResultadoSincronizacion {
  empleadosProcesados: number;
  usuariosCreados: number;
  usuariosActualizados: number;
  usuariosDesactivados: number;
  // 🆕 Agregar sedes
  sedesCreadas: number;
  sedesActualizadas: number;
  areasCreadas: number;
  areasActualizadas: number;
  cargosCreados: number;
  cargosActualizados: number;
  errores: string[];
  advertencias: string[];
  detalles: any[];
}

@Injectable()
export class SapSyncService {
  private readonly logger = new Logger(SapSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapHanaService: SapHanaService
  ) {}

  /**
   * Ejecuta la sincronización completa con SAP HANA B1
   */
  async sincronizarCompleto(): Promise<ResultadoSincronizacion> {
    const resultado: ResultadoSincronizacion = {
      empleadosProcesados: 0,
      usuariosCreados: 0,
      usuariosActualizados: 0,
      usuariosDesactivados: 0,
      sedesCreadas: 0,
      sedesActualizadas: 0,
      areasCreadas: 0,
      areasActualizadas: 0,
      cargosCreados: 0,
      cargosActualizados: 0,
      errores: [],
      advertencias: [],
      detalles: []
    };

    try {
      this.logger.log('🔄 Iniciando sincronización completa con SAP HANA B1...');

      // 1. Verificar conexión a SAP
      if (!this.sapHanaService.isConnectionActive()) {
        throw new Error('No hay conexión activa a SAP HANA B1');
      }

      // 2. Obtener datos de SAP
      const empleadosSAP = await this.sapHanaService.obtenerEmpleadosActivos();
      resultado.empleadosProcesados = empleadosSAP.length;

      this.logger.log(`📊 Obtenidos ${empleadosSAP.length} empleados activos de SAP`);

      // 3. Sincronizar sedes
      const resultadoSedes = await this.sincronizarSedes(empleadosSAP);
      resultado.sedesCreadas = resultadoSedes.creadas;
      resultado.sedesActualizadas = resultadoSedes.actualizadas;
      resultado.errores.push(...resultadoSedes.errores);

      // 4. Sincronizar áreas
      const resultadoAreas = await this.sincronizarAreas(empleadosSAP);
      resultado.areasCreadas = resultadoAreas.creadas;
      resultado.areasActualizadas = resultadoAreas.actualizadas;
      resultado.errores.push(...resultadoAreas.errores);

      // 5. Sincronizar cargos
      const resultadoCargos = await this.sincronizarCargos(empleadosSAP);
      resultado.cargosCreados = resultadoCargos.creados;
      resultado.cargosActualizados = resultadoCargos.actualizados;
      resultado.errores.push(...resultadoCargos.errores);

      // 6. Sincronizar usuarios
      const resultadoUsuarios = await this.sincronizarUsuarios(empleadosSAP);
      resultado.usuariosCreados = resultadoUsuarios.creados;
      resultado.usuariosActualizados = resultadoUsuarios.actualizados;
      resultado.usuariosDesactivados = resultadoUsuarios.desactivados;
      resultado.errores.push(...resultadoUsuarios.errores);
      resultado.advertencias.push(...resultadoUsuarios.advertencias);
      resultado.detalles.push(...resultadoUsuarios.detalles);

      this.logger.log('✅ Sincronización completa finalizada exitosamente');

    } catch (error) {
      this.logger.error('❌ Error en sincronización completa:', error);
      resultado.errores.push(`Error general: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Valida que las 4 sedes predefinidas existan en la base de datos
   * Enfoque manual: sedes 1=Santa Cruz, 2=La Paz, 3=Cochabamba, 4=Interior
   */
  private async sincronizarSedes(empleadosSAP: EmpleadoSAP[]): Promise<{
    creadas: number;
    actualizadas: number;
    errores: string[];
  }> {
    const resultado = { creadas: 0, actualizadas: 0, errores: [] };

    try {
      // Obtener sedes IDs únicos que vienen de SAP
      const sedesUsadas = new Set(empleadosSAP.map(emp => emp.workCity));
      this.logger.log(`🏢 Validando sedes usadas por empleados SAP: ${Array.from(sedesUsadas).join(', ')}`);

      // Validar que las sedes predefinidas existen (1-4)
      const sedesPredefinidas = [1, 2, 3, 4];
      for (const sedeId of sedesPredefinidas) {
        try {
          const sedeExistente = await this.prisma.sede.findUnique({
            where: { id: sedeId }
          });

          if (!sedeExistente) {
            resultado.errores.push(`❌ Sede predefinida ${sedeId} no existe en la base de datos. Usuario debe crearla.`);
          } else if (!sedeExistente.activo) {
            // Reactivar sede si está inactiva
            await this.prisma.sede.update({
              where: { id: sedeId },
              data: { activo: true }
            });
            resultado.actualizadas++;
            this.logger.log(`🔄 Sede ${sedeId} (${sedeExistente.nombre}) reactivada`);
          }
        } catch (error) {
          resultado.errores.push(`Error validando sede ${sedeId}: ${error.message}`);
        }
      }

      // Verificar que todas las sedes usadas por empleados existen
      for (const sedeId of sedesUsadas) {
        if (!sedesPredefinidas.includes(sedeId)) {
          resultado.errores.push(`⚠️ Empleados asignados a sede ${sedeId} que no está en sedes predefinidas (1-4)`);
        }
      }

    } catch (error) {
      resultado.errores.push(`Error general en validación de sedes: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Sincroniza las áreas/departamentos
   */
  private async sincronizarAreas(empleadosSAP: EmpleadoSAP[]): Promise<{
    creadas: number;
    actualizadas: number;
    errores: string[];
  }> {
    const resultado = { creadas: 0, actualizadas: 0, errores: [] };

    try {
      // 🆕 Crear área por defecto para empleados sin área asignada
      const areaDefault = await this.prisma.area.upsert({
        where: { areaSapId: -999 }, // ID especial para área por defecto
        update: {},
        create: {
          nombre: 'Sin Área Asignada',
          areaSapId: -999,
          nombreSap: 'SIN AREA',
          sedeId: 1, // Santa Cruz por defecto
          descripcion: 'Área por defecto para empleados sin área asignada en SAP'
        }
      });

      // Obtener áreas únicas de SAP (incluyendo las válidas)
      const areasSAP = empleadosSAP
        .filter(emp => emp.ID_Area && emp.Nombre_Area)
        .reduce((acc, emp) => {
          const key = emp.ID_Area;
          if (!acc.has(key)) {
            acc.set(key, {
              ID_Area: emp.ID_Area,
              Nombre_Area: emp.Nombre_Area.trim()
            });
          }
          return acc;
        }, new Map());

      this.logger.log(`🏢 Sincronizando ${areasSAP.size} áreas de SAP + área por defecto...`);

      for (const [sapAreaId, areaSAP] of areasSAP) {
        try {
          // Buscar área existente por SAP ID
          let areaExistente = await this.prisma.area.findFirst({
            where: { areaSapId: sapAreaId }
          });

          if (!areaExistente) {
            // Buscar por nombre similar
            const areasLocales = await this.prisma.area.findMany({
              where: { activo: true }
            });

            const matchPorNombre = NombreMatchingUtil.encontrarMejorMatch(
              areaSAP.Nombre_Area,
              areasLocales.map(a => a.nombre),
              85
            );

            if (matchPorNombre.match && matchPorNombre.indice >= 0) {
              areaExistente = areasLocales[matchPorNombre.indice];
              
              // Actualizar con SAP ID
              await this.prisma.area.update({
                where: { id: areaExistente.id },
                data: {
                  areaSapId: sapAreaId,
                  nombreSap: areaSAP.Nombre_Area
                }
              });
              
              resultado.actualizadas++;
              this.logger.log(`🔄 Área vinculada: "${areaExistente.nombre}" ↔ SAP: "${areaSAP.Nombre_Area}"`);
              continue;
            }
          }

          if (areaExistente) {
            // Actualizar área existente
            await this.prisma.area.update({
              where: { id: areaExistente.id },
              data: {
                nombreSap: areaSAP.Nombre_Area,
                // Solo actualizar nombre si es muy diferente
                ...(NombreMatchingUtil.calcularSimilitud(areaExistente.nombre, areaSAP.Nombre_Area) < 90 && {
                  nombre: areaSAP.Nombre_Area
                })
              }
            });
            resultado.actualizadas++;
          } else {
            // Crear nueva área - necesitamos asignarla a una sede por defecto
            const sedeDefault = await this.prisma.sede.findFirst({
              where: { activo: true },
              orderBy: { id: 'asc' }
            });

            if (!sedeDefault) {
              resultado.errores.push(`No hay sedes disponibles para crear el área: ${areaSAP.Nombre_Area}`);
              continue;
            }

            await this.prisma.area.create({
              data: {
                nombre: areaSAP.Nombre_Area,
                areaSapId: sapAreaId,
                nombreSap: areaSAP.Nombre_Area,
                sedeId: sedeDefault.id,
                descripcion: `Área sincronizada desde SAP HANA B1`
              }
            });
            resultado.creadas++;
            this.logger.log(`➕ Nueva área creada: "${areaSAP.Nombre_Area}"`);
          }

        } catch (error) {
          resultado.errores.push(`Error procesando área ${areaSAP.Nombre_Area}: ${error.message}`);
        }
      }

    } catch (error) {
      resultado.errores.push(`Error general en sincronización de áreas: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Sincroniza los cargos/posiciones
   */
  private async sincronizarCargos(empleadosSAP: EmpleadoSAP[]): Promise<{
    creados: number;
    actualizados: number;
    errores: string[];
  }> {
    const resultado = { creados: 0, actualizados: 0, errores: [] };

    try {
      // 🆕 Crear cargo por defecto para empleados sin cargo específico
      const areaDefault = await this.prisma.area.findFirst({
        where: { areaSapId: -999 }
      });

      if (areaDefault) {
        const rolDefault = await this.prisma.rol.findFirst({
          where: { activo: true },
          orderBy: { id: 'asc' }
        });

        if (rolDefault) {
          await this.prisma.cargo.upsert({
            where: { 
              cargoSap_areaId: {
                cargoSap: 'SIN CARGO',
                areaId: areaDefault.id
              }
            },
            update: {},
            create: {
              nombre: 'Sin Cargo Asignado',
              cargoSap: 'SIN CARGO',
              areaId: areaDefault.id,
              rolId: rolDefault.id,
              sincronizadoSap: true,
              descripcion: 'Cargo por defecto para empleados sin cargo específico en SAP'
            }
          });
        }
      }

      // Obtener cargos únicos de SAP por área (incluyendo todos los cargos, incluso "SIN CARGO")
      const cargosSAP = empleadosSAP
        .filter(emp => emp.Cargo) // Solo filtrar que tenga algún cargo
        .reduce((acc, emp) => {
          // Usar área por defecto si no tiene área asignada
          const areaId = emp.ID_Area || -999;
          const cargo = emp.Cargo.trim();
          
          const key = `${cargo}_${areaId}`;
          if (!acc.has(key)) {
            acc.set(key, {
              cargo: cargo,
              areaId: areaId
            });
          }
          return acc;
        }, new Map());

      this.logger.log(`👔 Sincronizando ${cargosSAP.size} cargos de SAP (incluyendo casos especiales)...`);

      for (const [_, cargoSAP] of cargosSAP) {
        try {
          // Buscar el área local correspondiente
          let areaLocal = await this.prisma.area.findFirst({
            where: { areaSapId: cargoSAP.areaId }
          });

          // Si no encuentra el área, usar el área por defecto
          if (!areaLocal) {
            areaLocal = await this.prisma.area.findFirst({
              where: { areaSapId: -999 }
            });
            
            if (!areaLocal) {
              resultado.errores.push(`Área con SAP ID ${cargoSAP.areaId} no encontrada y área por defecto no disponible para cargo: ${cargoSAP.cargo}`);
              continue;
            }
          }

          // Buscar cargo existente
          let cargoExistente = await this.prisma.cargo.findFirst({
            where: {
              cargoSap: cargoSAP.cargo,
              areaId: areaLocal.id
            }
          });

          if (!cargoExistente) {
            // Buscar por nombre similar en la misma área con umbral más bajo
            const cargosLocales = await this.prisma.cargo.findMany({
              where: { 
                areaId: areaLocal.id,
                activo: true 
              }
            });

            // 🆕 Intentar matching con umbral más bajo para variaciones menores
            const matchPorNombre = NombreMatchingUtil.encontrarMejorMatch(
              cargoSAP.cargo,
              cargosLocales.map(c => c.nombre),
              75 // Reducido de 85 a 75 para capturar más variaciones
            );

            if (matchPorNombre.match && matchPorNombre.indice >= 0) {
              cargoExistente = cargosLocales[matchPorNombre.indice];
              
              // Actualizar con SAP mapping
              await this.prisma.cargo.update({
                where: { id: cargoExistente.id },
                data: {
                  cargoSap: cargoSAP.cargo,
                  sincronizadoSap: true
                }
              });
              
              resultado.actualizados++;
              this.logger.log(`🔄 Cargo vinculado: "${cargoExistente.nombre}" ↔ SAP: "${cargoSAP.cargo}" (${matchPorNombre.similitud}%)`);
              continue;
            }
          }

          if (cargoExistente) {
            // Actualizar cargo existente
            await this.prisma.cargo.update({
              where: { id: cargoExistente.id },
              data: {
                sincronizadoSap: true,
                // Solo actualizar nombre si es muy diferente
                ...(NombreMatchingUtil.calcularSimilitud(cargoExistente.nombre, cargoSAP.cargo) < 90 && {
                  nombre: cargoSAP.cargo
                })
              }
            });
            resultado.actualizados++;
          } else {
            // Crear nuevo cargo - necesita un rol por defecto
            const rolDefault = await this.prisma.rol.findFirst({
              where: { activo: true },
              orderBy: { id: 'asc' }
            });

            if (!rolDefault) {
              resultado.errores.push(`No hay roles disponibles para crear el cargo: ${cargoSAP.cargo}`);
              continue;
            }

            await this.prisma.cargo.create({
              data: {
                nombre: cargoSAP.cargo,
                cargoSap: cargoSAP.cargo,
                areaId: areaLocal.id,
                rolId: rolDefault.id,
                sincronizadoSap: true,
                descripcion: `Cargo sincronizado desde SAP HANA B1`
              }
            });
            resultado.creados++;
            this.logger.log(`➕ Nuevo cargo creado: "${cargoSAP.cargo}" en área "${areaLocal.nombre}"`);
          }

        } catch (error) {
          resultado.errores.push(`Error procesando cargo ${cargoSAP.cargo}: ${error.message}`);
        }
      }

    } catch (error) {
      resultado.errores.push(`Error general en sincronización de cargos: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Sincroniza los usuarios/empleados
   */
  private async sincronizarUsuarios(empleadosSAP: EmpleadoSAP[]): Promise<{
    creados: number;
    actualizados: number;
    desactivados: number;
    errores: string[];
    advertencias: string[];
    detalles: any[];
  }> {
    const resultado = { 
      creados: 0, 
      actualizados: 0, 
      desactivados: 0, 
      errores: [], 
      advertencias: [],
      detalles: []
    };

    try {
      this.logger.log(`👥 Sincronizando ${empleadosSAP.length} usuarios de SAP...`);

      // Obtener usuarios existentes
      const usuariosExistentes = await this.prisma.usuario.findMany({
        select: {
          id: true,
          empleadoSapId: true,
          nombre: true,
          apellido: true,
          nombreCompletoSap: true,
          activo: true
        }
      });

      const idsEmpleadosSAP = new Set(empleadosSAP.map(emp => emp.ID_Empleado));

      // Procesar cada empleado de SAP
      for (const empleadoSAP of empleadosSAP) {
        try {
          const detalleEmpleado = {
            sapId: empleadoSAP.ID_Empleado,
            nombre: empleadoSAP.Nombre_Completo,
            accion: '',
            resultado: '',
            similitud: 0
          };

          // 1. Buscar usuario existente por SAP ID
          let usuarioExistente = usuariosExistentes.find(u => u.empleadoSapId === empleadoSAP.ID_Empleado);

          // 2. Si no existe, buscar por nombre
          if (!usuarioExistente) {
            const matchResult = NombreMatchingUtil.buscarUsuarioPorNombre(
              empleadoSAP.Nombre_Completo,
              usuariosExistentes.filter(u => !u.empleadoSapId), // Solo usuarios sin SAP ID
              80
            );

            if (matchResult.usuario) {
              usuarioExistente = matchResult.usuario;
              detalleEmpleado.similitud = matchResult.similitud;
              
              const confiabilidad = NombreMatchingUtil.esMatchConfiable(
                matchResult.similitud,
                empleadoSAP.Nombre_Completo.length,
                matchResult.estrategia
              );

              if (!confiabilidad.esConfiable) {
                resultado.advertencias.push(
                  `Match poco confiable: SAP "${empleadoSAP.Nombre_Completo}" vs Sistema "${usuarioExistente.nombre} ${usuarioExistente.apellido}" (${matchResult.similitud}%)`
                );
              }
            }
          }

          // 3. Validar que la sede existe
          const sedeId = empleadoSAP.workCity;
          const sedeExistente = await this.prisma.sede.findUnique({
            where: { id: sedeId }
          });

          if (!sedeExistente) {
            resultado.errores.push(
              `Sede ${sedeId} no encontrada para empleado ${empleadoSAP.Nombre_Completo}`
            );
            detalleEmpleado.accion = 'error';
            detalleEmpleado.resultado = `Sede ${sedeId} no existe`;
            resultado.detalles.push(detalleEmpleado);
            continue;
          }

          // 4. Obtener área y cargo correspondientes
          let areaLocal = await this.prisma.area.findFirst({
            where: { areaSapId: empleadoSAP.ID_Area }
          });

          // 🆕 Si no tiene área asignada en SAP, usar área por defecto
          if (!areaLocal) {
            areaLocal = await this.prisma.area.findFirst({
              where: { areaSapId: -999 } // Área por defecto
            });
          }

          let cargoLocal = await this.prisma.cargo.findFirst({
            where: {
              cargoSap: empleadoSAP.Cargo,
              areaId: areaLocal?.id
            }
          });

          // 🆕 Si no encuentra el cargo, intentar en el área por defecto
          if (!cargoLocal && areaLocal) {
            // Si el cargo es "SIN CARGO" o vacío, buscar el cargo por defecto
            if (!empleadoSAP.Cargo || empleadoSAP.Cargo.trim() === 'SIN CARGO' || empleadoSAP.Cargo.trim() === '') {
              cargoLocal = await this.prisma.cargo.findFirst({
                where: {
                  cargoSap: 'SIN CARGO',
                  areaId: areaLocal.id
                }
              });
            } else {
              // Buscar el cargo con matching más flexible en cualquier área
              const todosCargos = await this.prisma.cargo.findMany({
                where: { 
                  activo: true,
                  sincronizadoSap: true
                }
              });

              const matchCargo = NombreMatchingUtil.encontrarMejorMatch(
                empleadoSAP.Cargo,
                todosCargos.map(c => c.cargoSap || c.nombre),
                70 // Umbral más bajo para matching flexible
              );

              if (matchCargo.match && matchCargo.indice >= 0) {
                cargoLocal = todosCargos[matchCargo.indice];
                this.logger.log(`🔄 Empleado ${empleadoSAP.Nombre_Completo}: cargo "${empleadoSAP.Cargo}" matcheado con "${cargoLocal.nombre}" (${matchCargo.similitud}%)`);
              }
            }
          }

          if (!areaLocal || !cargoLocal) {
            resultado.errores.push(
              `Área o cargo no encontrado para empleado ${empleadoSAP.Nombre_Completo}: Área SAP ${empleadoSAP.ID_Area}, Cargo SAP "${empleadoSAP.Cargo}"`
            );
            detalleEmpleado.accion = 'error';
            detalleEmpleado.resultado = 'Área o cargo no encontrado';
            resultado.detalles.push(detalleEmpleado);
            continue;
          }

          if (usuarioExistente) {
            // Actualizar usuario existente
            await this.prisma.usuario.update({
              where: { id: usuarioExistente.id },
              data: {
                empleadoSapId: empleadoSAP.ID_Empleado,
                nombreCompletoSap: empleadoSAP.Nombre_Completo,
                jefeDirectoSapId: empleadoSAP.ID_Jefe_Inmediato,
                sedeId: sedeId, // Usar workCity directamente
                areaId: areaLocal.id,
                cargoId: cargoLocal.id,
                ultimaSincronizacion: new Date(),
                activo: true
              }
            });
            
            resultado.actualizados++;
            detalleEmpleado.accion = 'actualizado';
            detalleEmpleado.resultado = 'Usuario actualizado exitosamente';
            
          } else {
            // Crear nuevo usuario
            // Generar username único basado en el nombre
            const [nombre, ...apellidos] = empleadoSAP.Nombre_Completo.trim().split(' ');
            const apellido = apellidos.join(' ') || '';
            const username = await this.generarUsernameUnico(nombre, apellido);

            await this.prisma.usuario.create({
              data: {
                username,
                email: `${username}@empresa.com`, // Email temporal
                nombre,
                apellido,
                empleadoSapId: empleadoSAP.ID_Empleado,
                nombreCompletoSap: empleadoSAP.Nombre_Completo,
                jefeDirectoSapId: empleadoSAP.ID_Jefe_Inmediato,
                autenticacion: 'ldap',
                sedeId: sedeId, // Usar workCity directamente
                areaId: areaLocal.id,
                cargoId: cargoLocal.id,
                ultimaSincronizacion: new Date()
              }
            });
            
            resultado.creados++;
            detalleEmpleado.accion = 'creado';
            detalleEmpleado.resultado = `Usuario creado con username: ${username}`;
          }

          resultado.detalles.push(detalleEmpleado);

        } catch (error) {
          resultado.errores.push(`Error procesando empleado ${empleadoSAP.Nombre_Completo}: ${error.message}`);
        }
      }

      // Desactivar usuarios que ya no están en SAP (optimizado para listas grandes)
      if (idsEmpleadosSAP.size > 0) {
        // Procesar en lotes para evitar consultas SQL con demasiados parámetros
        const batchSize = 100;
        const idsArray = Array.from(idsEmpleadosSAP);
        let totalDesactivados = 0;

        // Primero obtener todos los usuarios con empleadoSapId activos
        const usuariosConSapId = await this.prisma.usuario.findMany({
          where: {
            empleadoSapId: { not: null },
            activo: true
          },
          select: { id: true, empleadoSapId: true, nombre: true, apellido: true }
        });

        // Identificar cuáles no están en la lista de SAP
        const usuariosParaDesactivar = usuariosConSapId.filter(
          usuario => !idsEmpleadosSAP.has(usuario.empleadoSapId!)
        );

        if (usuariosParaDesactivar.length > 0) {
          this.logger.log(`📉 Desactivando ${usuariosParaDesactivar.length} usuarios que ya no están en SAP...`);
          
          // Desactivar en lotes
          for (let i = 0; i < usuariosParaDesactivar.length; i += batchSize) {
            const lote = usuariosParaDesactivar.slice(i, i + batchSize);
            const idsLote = lote.map(u => u.id);
            
            await this.prisma.usuario.updateMany({
              where: { id: { in: idsLote } },
              data: { activo: false }
            });
            
            totalDesactivados += idsLote.length;
            
            // Log de progreso
            this.logger.log(`  - Lote ${Math.ceil((i + 1) / batchSize)}: ${idsLote.length} usuarios desactivados`);
          }
          
          resultado.desactivados = totalDesactivados;
        }
      }

    } catch (error) {
      resultado.errores.push(`Error general en sincronización de usuarios: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Genera un username único basado en nombre y apellido
   */
  private async generarUsernameUnico(nombre: string, apellido: string): Promise<string> {
    const baseUsername = `${nombre.toLowerCase()}.${apellido.toLowerCase().split(' ')[0]}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z.]/g, '');

    let username = baseUsername;
    let contador = 1;

    while (await this.prisma.usuario.findUnique({ where: { username } })) {
      username = `${baseUsername}${contador}`;
      contador++;
    }

    return username;
  }
} 