import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMantenimientos() {
  console.log('🍺 Iniciando seed de datos para módulo de mantenimientos...\n');

  try {
    // 1. CREAR TIPOS DE MANTENIMIENTO
    console.log('🔧 Creando tipos de mantenimiento...');
    const tiposMantenimiento = await Promise.all([
      prisma.tipoMantenimiento.upsert({
        where: { nombre: 'Mantenimiento Preventivo' },
        update: {},
        create: {
          nombre: 'Mantenimiento Preventivo',
          descripcion: 'Mantenimiento programado para prevenir fallas',
          activo: true,
        },
      }),
      prisma.tipoMantenimiento.upsert({
        where: { nombre: 'Mantenimiento Correctivo' },
        update: {},
        create: {
          nombre: 'Mantenimiento Correctivo',
          descripcion: 'Mantenimiento para corregir fallas existentes',
          activo: true,
        },
      }),
    ]);
    console.log(`✅ Tipos de mantenimiento creados: ${tiposMantenimiento.length}`);

    // 2. CREAR CATEGORÍAS DEL CHECKLIST
    console.log('\n📋 Creando categorías del checklist...');
    
    // Verificar si ya existen las categorías
    const categoriasExistentes = await prisma.categoriaChecklist.findMany();
    let categorias;
    
    if (categoriasExistentes.length === 0) {
      categorias = await Promise.all([
        prisma.categoriaChecklist.create({
          data: {
            nombre: 'Estado General del Equipo',
            orden: 1,
          },
        }),
        prisma.categoriaChecklist.create({
          data: {
            nombre: 'Procedimiento Limpieza',
            orden: 2,
          },
        }),
        prisma.categoriaChecklist.create({
          data: {
            nombre: 'Verificación Final',
            orden: 3,
          },
        }),
      ]);
      console.log(`✅ Categorías creadas: ${categorias.length}`);
    } else {
      categorias = categoriasExistentes;
      console.log(`✅ Categorías existentes encontradas: ${categorias.length}`);
    }

    // 3. CREAR ITEMS DEL CHECKLIST
    console.log('\n📝 Creando items del checklist...');
    
    // Verificar si ya existen los items
    const itemsExistentes = await prisma.itemChecklist.findMany();
    let itemsChecklist;
    
    if (itemsExistentes.length === 0) {
      itemsChecklist = await Promise.all([
        // Estado General del Equipo
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[0].id,
            nombre: 'Estado General del Equipo (Chopera)',
            tipoRespuesta: 'texto',
            orden: 1,
          },
        }),
        
        // Procedimiento Limpieza
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[1].id,
            nombre: 'Desarmado y Limpieza de Grifos (1 Vez al mes)',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 1,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[1].id,
            nombre: 'Limpieza general del área y del equipo',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 2,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[1].id,
            nombre: 'Pasada de soda cáustica (solución adecuada)',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 3,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[1].id,
            nombre: 'Enjuague completo con agua limpia después de soda cáustica',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 4,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[1].id,
            nombre: 'Aplicación de desinfectante autorizado',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 5,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[1].id,
            nombre: 'Pasada de solución con fenolftaleína para verificar limpieza y desinfección',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 6,
          },
        }),
        
        // Verificación Final
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[2].id,
            nombre: 'Confirmar que todos los componentes están correctamente armados y ajustados',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 1,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[2].id,
            nombre: 'Revisar que no haya residuos o restos de productos químicos en el sistema',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 2,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[2].id,
            nombre: 'Verificación de la temperatura de la cerveza en el punto de servicio',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 3,
          },
        }),
        prisma.itemChecklist.create({
          data: {
            categoriaId: categorias[2].id,
            nombre: 'Comprobación del funcionamiento correcto de los grifos y sistema de enfriamiento',
            tipoRespuesta: 'boolean',
            opciones: ['Cumple', 'No Cumple'],
            orden: 4,
          },
        }),
      ]);
      console.log(`✅ Items del checklist creados: ${itemsChecklist.length}`);
    } else {
      itemsChecklist = itemsExistentes;
      console.log(`✅ Items existentes encontrados: ${itemsChecklist.length}`);
    }

    // 4. OBTENER UN USUARIO PARA LOS MANTENIMIENTOS DE PRUEBA
    let usuario = await prisma.usuario.findFirst();
    if (!usuario) {
      console.log('⚠️ No se encontró ningún usuario. Creando usuario de prueba...');
      
      // Crear una sede, área, cargo y rol de prueba
      const sede = await prisma.sede.create({
        data: {
          nombre: 'Sede de Prueba',
          direccion: 'Dirección de prueba',
          telefono: '123456789',
          email: 'prueba@minoil.com',
        },
      });

      const area = await prisma.area.create({
        data: {
          nombre: 'Área de Prueba',
          descripcion: 'Área para pruebas del sistema',
          sedeId: sede.id,
        },
      });

      const rol = await prisma.rol.create({
        data: {
          nombre: 'Rol de Prueba',
          descripcion: 'Rol para pruebas del sistema',
        },
      });

      const cargo = await prisma.cargo.create({
        data: {
          nombre: 'Cargo de Prueba',
          descripcion: 'Cargo para pruebas del sistema',
          nivel: 1,
          areaId: area.id,
          rolId: rol.id,
        },
      });

      usuario = await prisma.usuario.create({
        data: {
          username: 'usuario_prueba',
          email: 'usuario.prueba@minoil.com',
          nombre: 'Usuario',
          apellido: 'Prueba',
          password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
          sedeId: sede.id,
          areaId: area.id,
          cargoId: cargo.id,
        },
      });
      
      console.log(`✅ Usuario de prueba creado: ${usuario.nombre} ${usuario.apellido}`);
    }

    // 5. CREAR MANTENIMIENTOS DE PRUEBA
    console.log('\n🍺 Creando mantenimientos de prueba...');
    
    const mantenimiento1 = await prisma.mantenimientoChopera.create({
      data: {
        usuarioId: usuario.id,
        clienteCodigo: 'CLP03480',
        choperaId: 1,
        fechaVisita: new Date('2025-08-10'),
        tipoMantenimientoId: tiposMantenimiento[0].id, // Preventivo
        estadoGeneral: 'BUENO',
        comentarioEstado: 'Equipo en buen estado general, requiere limpieza rutinaria',
        comentarioCalidadCerveza: 'Cerveza con buen aroma y sabor, temperatura correcta',
      },
    });

    const mantenimiento2 = await prisma.mantenimientoChopera.create({
      data: {
        usuarioId: usuario.id,
        clienteCodigo: 'CLP04520',
        choperaId: 2,
        fechaVisita: new Date('2025-08-11'),
        tipoMantenimientoId: tiposMantenimiento[1].id, // Correctivo
        estadoGeneral: 'REGULAR',
        comentarioEstado: 'Equipo requiere mantenimiento, grifos con fugas menores',
        comentarioCalidadCerveza: 'Cerveza con sabor ligeramente alterado, requiere ajuste de temperatura',
      },
    });

    console.log(`✅ Mantenimientos creados: 2`);

    // 6. CREAR RESPUESTAS DEL CHECKLIST PARA MANTENIMIENTO 1
    console.log('\n📋 Creando respuestas del checklist...');
    const respuestasChecklist1 = await Promise.all([
      // Estado General
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[0].id, // Estado General del Equipo
          valor: 'BUENO',
        },
      }),
      // Procedimiento Limpieza
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[1].id, // Desarmado y Limpieza de Grifos
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[2].id, // Limpieza general
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[3].id, // Soda cáustica
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[4].id, // Enjuague
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[5].id, // Desinfectante
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[6].id, // Fenolftaleína
          valor: 'Cumple',
        },
      }),
      // Verificación Final
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[7].id, // Componentes armados
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[8].id, // Sin residuos
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[9].id, // Temperatura
          valor: 'Cumple',
        },
      }),
      prisma.respuestaChecklist.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          itemId: itemsChecklist[10].id, // Funcionamiento grifos
          valor: 'Cumple',
        },
      }),
    ]);

    // 7. CREAR RESPUESTAS DEL ANÁLISIS SENSORIAL PARA MANTENIMIENTO 1
    console.log('\n🍺 Creando respuestas del análisis sensorial...');
    const respuestasSensorial1 = await Promise.all([
      // Grifo 1
      prisma.respuestaSensorial.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          grifo: 1,
          cerveza: 'Hoppy Lager',
          criterio: 'Aroma',
          valor: 'Cumple',
        },
      }),
      prisma.respuestaSensorial.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          grifo: 1,
          cerveza: 'Hoppy Lager',
          criterio: 'Sabor',
          valor: 'Cumple',
        },
      }),
      prisma.respuestaSensorial.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          grifo: 1,
          cerveza: 'Hoppy Lager',
          criterio: 'Aspecto',
          valor: 'Cumple',
        },
      }),
      // Grifo 2
      prisma.respuestaSensorial.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          grifo: 2,
          cerveza: 'IPA',
          criterio: 'Aroma',
          valor: 'Cumple',
        },
      }),
      prisma.respuestaSensorial.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          grifo: 2,
          cerveza: 'IPA',
          criterio: 'Sabor',
          valor: 'Cumple',
        },
      }),
      prisma.respuestaSensorial.create({
        data: {
          mantenimientoId: mantenimiento1.id,
          grifo: 2,
          cerveza: 'IPA',
          criterio: 'Aspecto',
          valor: 'Cumple',
        },
      }),
    ]);

    console.log(`✅ Respuestas del checklist creadas: ${respuestasChecklist1.length}`);
    console.log(`✅ Respuestas sensoriales creadas: ${respuestasSensorial1.length}`);

    console.log('\n🎉 ¡Seed de mantenimientos completado exitosamente!');
    console.log('\n📊 Resumen de datos creados:');
    console.log(`   • ${tiposMantenimiento.length} tipos de mantenimiento`);
    console.log(`   • ${categorias.length} categorías de checklist`);
    console.log(`   • ${itemsChecklist.length} items de checklist`);
    console.log(`   • 2 mantenimientos de prueba`);
    console.log(`   • ${respuestasChecklist1.length} respuestas de checklist`);
    console.log(`   • ${respuestasSensorial1.length} respuestas sensoriales`);

  } catch (error) {
    console.error('❌ Error durante el seed de mantenimientos:', error);
    throw error;
  }
}

// Ejecutar el seed si se llama directamente
if (require.main === module) {
  seedMantenimientos()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedMantenimientos };
