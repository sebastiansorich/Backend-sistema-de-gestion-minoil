// Script de prueba para verificar el sistema de permisos
// Ejecutar con: node test-permisos.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testPermisos() {
  console.log('🧪 Iniciando pruebas del sistema de permisos...\n');

  try {
    // 1. Obtener todos los permisos
    console.log('1️⃣ Obteniendo todos los permisos...');
    const permisos = await axios.get(`${BASE_URL}/permisos`);
    console.log(`✅ Permisos obtenidos: ${permisos.data.total || permisos.data.length} registros`);
    console.log('📋 Respuesta:', JSON.stringify(permisos.data, null, 2));
    console.log('');

    // 2. Obtener permisos por rol (ID 1 - Administrador)
    console.log('2️⃣ Obteniendo permisos del rol Administrador...');
    const permisosRol = await axios.get(`${BASE_URL}/permisos/rol/1`);
    console.log(`✅ Permisos del rol: ${permisosRol.data.total || permisosRol.data.length} registros`);
    console.log('📋 Respuesta:', JSON.stringify(permisosRol.data, null, 2));
    console.log('');

    // 3. Obtener permisos por módulo (ID 1 - Dashboard)
    console.log('3️⃣ Obteniendo permisos del módulo Dashboard...');
    const permisosModulo = await axios.get(`${BASE_URL}/permisos/modulo/1`);
    console.log(`✅ Permisos del módulo: ${permisosModulo.data.total || permisosModulo.data.length} registros`);
    console.log('📋 Respuesta:', JSON.stringify(permisosModulo.data, null, 2));
    console.log('');

    // 4. Obtener un permiso específico
    if (permisos.data.data && permisos.data.data.length > 0) {
      const primerPermiso = permisos.data.data[0];
      console.log(`4️⃣ Obteniendo permiso específico (ID: ${primerPermiso.id})...`);
      const permisoEspecifico = await axios.get(`${BASE_URL}/permisos/${primerPermiso.id}`);
      console.log('✅ Permiso específico obtenido');
      console.log('📋 Respuesta:', JSON.stringify(permisoEspecifico.data, null, 2));
      console.log('');
    }

    // 5. Crear un nuevo permiso (si hay roles y módulos disponibles)
    console.log('5️⃣ Creando un nuevo permiso...');
    const nuevoPermiso = {
      rolId: 1,
      moduloId: 2,
      crear: true,
      leer: true,
      actualizar: false,
      eliminar: false
    };
    
    const permisoCreado = await axios.post(`${BASE_URL}/permisos`, nuevoPermiso);
    console.log('✅ Permiso creado exitosamente');
    console.log('📋 Respuesta:', JSON.stringify(permisoCreado.data, null, 2));
    console.log('');

    // 6. Actualizar el permiso creado
    if (permisoCreado.data.data && permisoCreado.data.data.id) {
      console.log(`6️⃣ Actualizando permiso (ID: ${permisoCreado.data.data.id})...`);
      const actualizacion = {
        actualizar: true,
        eliminar: true
      };
      
      const permisoActualizado = await axios.patch(`${BASE_URL}/permisos/${permisoCreado.data.data.id}`, actualizacion);
      console.log('✅ Permiso actualizado exitosamente');
      console.log('📋 Respuesta:', JSON.stringify(permisoActualizado.data, null, 2));
      console.log('');

      // 7. Eliminar el permiso creado
      console.log(`7️⃣ Eliminando permiso (ID: ${permisoCreado.data.data.id})...`);
      const permisoEliminado = await axios.delete(`${BASE_URL}/permisos/${permisoCreado.data.data.id}`);
      console.log('✅ Permiso eliminado exitosamente');
      console.log('📋 Respuesta:', JSON.stringify(permisoEliminado.data, null, 2));
      console.log('');
    }

    console.log('🎉 Todas las pruebas completadas exitosamente!');
    console.log('✅ El sistema de permisos está funcionando correctamente con la base de datos real.');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.response) {
      console.error('📋 Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
      console.error('🔢 Código de estado:', error.response.status);
    }
    
    console.log('\n💡 Posibles soluciones:');
    console.log('   1. Verifica que el servidor esté ejecutándose en http://localhost:3000');
    console.log('   2. Verifica que las tablas de la base de datos existan');
    console.log('   3. Ejecuta el script crear-tablas-permisos.sql en tu base de datos HANA');
    console.log('   4. Verifica la conexión a la base de datos en las variables de entorno');
  }
}

// Función para probar la conexión a la base de datos
async function testDatabaseConnection() {
  console.log('🔍 Probando conexión a la base de datos...\n');

  try {
    // Probar endpoint de diagnóstico de SAP
    const diagnostico = await axios.get(`${BASE_URL}/sap/diagnostico`);
    console.log('✅ Conexión a la base de datos exitosa');
    console.log('📋 Diagnóstico:', JSON.stringify(diagnostico.data, null, 2));
    console.log('');

    // Probar consulta de roles
    const roles = await axios.get(`${BASE_URL}/sap/test-roles`);
    console.log('✅ Consulta de roles exitosa');
    console.log('📋 Roles:', JSON.stringify(roles.data, null, 2));
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Error en la conexión a la base de datos:', error.message);
    return false;
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando pruebas del sistema de permisos con base de datos real\n');

  // Primero probar la conexión a la base de datos
  const dbConnected = await testDatabaseConnection();
  
  if (dbConnected) {
    // Si la conexión es exitosa, ejecutar las pruebas de permisos
    await testPermisos();
  } else {
    console.log('❌ No se puede continuar sin conexión a la base de datos');
    console.log('💡 Verifica la configuración de la base de datos y vuelve a intentar');
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPermisos, testDatabaseConnection };
