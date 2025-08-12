import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed seguro (solo datos faltantes)...\n');

  try {
    // 🏢 1. VERIFICAR SEDES EXISTENTES (NO TOCAR)
    const sedesExistentes = await prisma.sede.count();
    console.log(`🏢 Sedes existentes: ${sedesExistentes} (no se modificarán)`);

    // 📦 2. CREAR MÓDULOS JERÁRQUICOS (NO EXISTEN - SEGURO CREAR)
    console.log('\n📦 Creando módulos jerárquicos del sistema...');
    
    // 1️⃣ CREAR MÓDULOS PADRE PRIMERO
    const modulosPadre = await Promise.all([
      prisma.modulo.upsert({
        where: { nombre: 'Usuarios' },
        update: {},
        create: {
          nombre: 'Usuarios',
          descripcion: 'Gestión integral de usuarios del sistema',
          ruta: '/usuarios',
          icono: 'users',
          orden: 1,
          padreId: null,     // Es módulo padre
          nivel: 1,          // Nivel 1 = padre
          esMenu: false,     // No aparece como ítem clickeable, solo agrupador
          activo: true,
        },
      }),
      prisma.modulo.upsert({
        where: { nombre: 'Recursos Humanos' },
        update: {},
        create: {
          nombre: 'Recursos Humanos',
          descripcion: 'Gestión de personal, vacaciones y planillas',
          ruta: '/recursos-humanos',
          icono: 'building',
          orden: 2,
          padreId: null,
          nivel: 1,
          esMenu: false,
          activo: true,
        },
      }),
      prisma.modulo.upsert({
        where: { nombre: 'Marketing/Comisiones' },
        update: {},
        create: {
          nombre: 'Marketing/Comisiones',
          descripcion: 'Gestión de mercaderistas y reportes por sala',
          ruta: '/marketing',
          icono: 'trending-up',
          orden: 3,
          padreId: null,
          nivel: 1,
          esMenu: false,
          activo: true,
        },
      }),
    ]);

    // 2️⃣ CREAR SUBMÓDULOS DE USUARIOS
    const moduloPadreUsuarios = modulosPadre.find(m => m.nombre === 'Usuarios');
    const submodulosUsuarios = await Promise.all([
      prisma.modulo.upsert({
        where: { nombre: 'Empleados' },
        update: {},
        create: {
          nombre: 'Empleados',
          descripcion: 'Listado y gestión de empleados',
          ruta: '/usuarios/empleados',
          icono: 'user',
          orden: 1,
          padreId: moduloPadreUsuarios.id, // 🔗 Hijo de "Usuarios"
          nivel: 2,                        // Nivel 2 = hijo
          esMenu: true,                    // SÍ aparece clickeable en sidebar
          activo: true,
        },
      }),
      prisma.modulo.upsert({
        where: { nombre: 'Cargos' },
        update: {},
        create: {
          nombre: 'Cargos',
          descripcion: 'Gestión de cargos y posiciones',
          ruta: '/usuarios/cargos',
          icono: 'briefcase',
          orden: 2,
          padreId: moduloPadreUsuarios.id,
          nivel: 2,
          esMenu: true,
          activo: true,
        },
      }),
      prisma.modulo.upsert({
        where: { nombre: 'Roles' },
        update: {},
        create: {
          nombre: 'Roles',
          descripcion: 'Configuración de roles y permisos',
          ruta: '/usuarios/roles',
          icono: 'shield',
          orden: 3,
          padreId: moduloPadreUsuarios.id,
          nivel: 2,
          esMenu: true,
          activo: true,
        },
      }),
    ]);

    // 3️⃣ CREAR SUBMÓDULO DE SALIDAS (STANDALONE)
    const moduloSalidas = await prisma.modulo.upsert({
      where: { nombre: 'Salidas de Producto' },
      update: {},
      create: {
        nombre: 'Salidas de Producto',
        descripcion: 'Gestión de salidas de inventario y productos',
        ruta: '/salidas',
        icono: 'package',
        orden: 4,
        padreId: null,
        nivel: 1,
        esMenu: true,  // Este SÍ es clickeable (no tiene submódulos)
        activo: true,
      },
    });

    const modulos = [...modulosPadre, ...submodulosUsuarios, moduloSalidas];
    console.log(`✅ Módulos jerárquicos creados: ${modulos.length}`);
    console.log(`   → Módulos padre: ${modulosPadre.length}`);
    console.log(`   → Submódulos usuarios: ${submodulosUsuarios.length}`);
    console.log(`   → Módulos independientes: 1`);

    // 🎭 3. CREAR ROLES FALTANTES (YA HAY 1 - CREAR 3 MÁS)
    console.log('\n🎭 Creando roles faltantes...');
    
    const roles = await Promise.all([
      prisma.rol.upsert({
        where: { nombre: 'Administrador' },
        update: {},
        create: {
          nombre: 'Administrador',
          descripcion: 'Acceso total al sistema - Super usuario',
          activo: true,
        },
      }),
      prisma.rol.upsert({
        where: { nombre: 'Recursos Humanos' },
        update: {},
        create: {
          nombre: 'Recursos Humanos',
          descripcion: 'Gestión de personal y usuarios del sistema',
          activo: true,
        },
      }),
      prisma.rol.upsert({
        where: { nombre: 'Mercaderistas' },
        update: {},
        create: {
          nombre: 'Mercaderistas',
          descripcion: 'Acceso exclusivo a salidas de productos',
          activo: true,
        },
      }),
      prisma.rol.upsert({
        where: { nombre: 'Marketing' },
        update: {},
        create: {
          nombre: 'Marketing',
          descripcion: 'Gestión de marketing, comisiones y salidas de producto',
          activo: true,
        },
      }),
    ]);

    console.log(`✅ Roles procesados: ${roles.length}`);

    // 🔐 4. CONFIGURAR PERMISOS (NO EXISTEN - SEGURO CREAR)
    console.log('\n🔐 Configurando permisos por rol...');
    
    // Obtener referencias de roles
    const adminRol = await prisma.rol.findUnique({ where: { nombre: 'Administrador' } });
    const rrhhRol = await prisma.rol.findUnique({ where: { nombre: 'Recursos Humanos' } });
    const mercaderistasRol = await prisma.rol.findUnique({ where: { nombre: 'Mercaderistas' } });
    const marketingRol = await prisma.rol.findUnique({ where: { nombre: 'Marketing' } });

    // Obtener referencias de módulos (solo módulos padre para permisos)
    const moduloUsuarios = await prisma.modulo.findUnique({ where: { nombre: 'Usuarios' } });
    const moduloRRHH = await prisma.modulo.findUnique({ where: { nombre: 'Recursos Humanos' } });
    const moduloMarketing = await prisma.modulo.findUnique({ where: { nombre: 'Marketing/Comisiones' } });
    const moduloSalidasRef = await prisma.modulo.findUnique({ where: { nombre: 'Salidas de Producto' } });

    // ADMINISTRADOR: Acceso total (solo a módulos padre y independientes)
    console.log('   → Configurando permisos de Administrador...');
    const modulosConPermisos = [moduloUsuarios, moduloRRHH, moduloMarketing, moduloSalidasRef];
    const permisosAdmin = modulosConPermisos.map(modulo =>
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: adminRol.id,
            moduloId: modulo.id,
          },
        },
        update: {},
        create: {
          rolId: adminRol.id,
          moduloId: modulo.id,
          crear: true,
          leer: true,
          actualizar: true,
          eliminar: true,
        },
      })
    );

    // RECURSOS HUMANOS: RRHH + Usuarios
    console.log('   → Configurando permisos de Recursos Humanos...');
    const permisosRRHH = [
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: rrhhRol.id,
            moduloId: moduloRRHH.id,
          },
        },
        update: {},
        create: {
          rolId: rrhhRol.id,
          moduloId: moduloRRHH.id,
          crear: true,
          leer: true,
          actualizar: true,
          eliminar: true,
        },
      }),
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: rrhhRol.id,
            moduloId: moduloUsuarios.id,
          },
        },
        update: {},
        create: {
          rolId: rrhhRol.id,
          moduloId: moduloUsuarios.id,
          crear: true,
          leer: true,
          actualizar: true,
          eliminar: true,
        },
      }),
    ];

    // MERCADERISTAS: Solo Salidas
    console.log('   → Configurando permisos de Mercaderistas...');
    const permisosMercaderistas = [
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: mercaderistasRol.id,
            moduloId: moduloSalidasRef.id,
          },
        },
        update: {},
        create: {
          rolId: mercaderistasRol.id,
          moduloId: moduloSalidasRef.id,
          crear: true,
          leer: true,
          actualizar: true,
          eliminar: false,
        },
      }),
    ];

    // MARKETING: Marketing + Salidas + Usuarios (limitado)
    console.log('   → Configurando permisos de Marketing...');
    const permisosMarketing = [
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: marketingRol.id,
            moduloId: moduloMarketing.id,
          },
        },
        update: {},
        create: {
          rolId: marketingRol.id,
          moduloId: moduloMarketing.id,
          crear: true,
          leer: true,
          actualizar: true,
          eliminar: true,
        },
      }),
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: marketingRol.id,
            moduloId: moduloSalidasRef.id,
          },
        },
        update: {},
        create: {
          rolId: marketingRol.id,
          moduloId: moduloSalidasRef.id,
          crear: true,
          leer: true,
          actualizar: true,
          eliminar: false,
        },
      }),
      prisma.permiso.upsert({
        where: {
          rolId_moduloId: {
            rolId: marketingRol.id,
            moduloId: moduloUsuarios.id,
          },
        },
        update: {},
        create: {
          rolId: marketingRol.id,
          moduloId: moduloUsuarios.id,
          crear: false,
          leer: true,
          actualizar: true,
          eliminar: false,
        },
      }),
    ];

    // Ejecutar todos los permisos
    await Promise.all([
      ...permisosAdmin,
      ...permisosRRHH,
      ...permisosMercaderistas,
      ...permisosMarketing,
    ]);

    console.log('✅ Permisos configurados exitosamente');

    // 📊 VERIFICACIÓN FINAL
    const resumenFinal = {
      sedes: await prisma.sede.count(),
      modulos: await prisma.modulo.count(),
      roles: await prisma.rol.count(),
      permisos: await prisma.permiso.count(),
      usuarios: await prisma.usuario.count(),
    };

    console.log('\n🎉 ¡Seed completado sin duplicados!');
    console.log('📊 Estado final:');
    console.log(`   • ${resumenFinal.sedes} sedes (sin tocar)`)
    console.log(`   • ${resumenFinal.modulos} módulos (✅ creados)`);
    console.log(`   • ${resumenFinal.roles} roles (✅ completados)`);
    console.log(`   • ${resumenFinal.permisos} permisos (✅ configurados)`);
    console.log(`   • ${resumenFinal.usuarios} usuarios (sin tocar)`);

    console.log('\n🎯 Roles configurados:');
    console.log('   • Administrador: Acceso total');
    console.log('   • Recursos Humanos: RRHH + Usuarios');
    console.log('   • Mercaderistas: Solo Salidas de Producto');
    console.log('   • Marketing: Marketing + Salidas + Usuarios (limitado)');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 