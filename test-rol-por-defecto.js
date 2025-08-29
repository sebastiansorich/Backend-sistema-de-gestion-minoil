// Script de prueba para verificar el rol por defecto (ID = 3)
// Ejecutar con: node test-rol-por-defecto.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testRolPorDefecto() {
  console.log('🧪 Probando asignación de rol por defecto (ID = 3)...\n');

  try {
    // 1. Verificar que existe el rol con ID = 3
    console.log('1️⃣ Verificando que existe el rol con ID = 3...');
    const rol = await axios.get(`${BASE_URL}/roles/3`);
    console.log(`✅ Rol encontrado: ${rol.data.nombre}`);
    console.log('📋 Detalles del rol:', JSON.stringify(rol.data, null, 2));
    console.log('');

    // 2. Crear usuario sin especificar rol (debería usar ID = 3 por defecto)
    console.log('2️⃣ Creando usuario sin especificar rol...');
    const usuarioSinRol = {
      username: 'test.por.defecto',
      email: 'test.por.defecto@minoil.com.bo',
      nombre: 'Test',
      apellido: 'Por Defecto',
      password: 'password123',
      activo: true
    };
    
    const usuarioCreado = await axios.post(`${BASE_URL}/usuarios`, usuarioSinRol);
    console.log('✅ Usuario creado exitosamente');
    console.log('📋 Usuario creado:', JSON.stringify(usuarioCreado.data, null, 2));
    
    // Verificar que tiene el rol correcto
    if (usuarioCreado.data.rol && usuarioCreado.data.rol.id === 3) {
      console.log('✅ ✅ Rol asignado correctamente: ID = 3');
    } else {
      console.log('❌ ❌ Error: Rol no asignado correctamente');
      console.log(`Rol asignado: ${usuarioCreado.data.rol ? usuarioCreado.data.rol.id : 'No asignado'}`);
    }
    console.log('');

    // 3. Crear usuario especificando un rol diferente
    console.log('3️⃣ Creando usuario especificando rol diferente...');
    const usuarioConRol = {
      username: 'test.con.rol',
      email: 'test.con.rol@minoil.com.bo',
      nombre: 'Test',
      apellido: 'Con Rol',
      password: 'password123',
      activo: true,
      rolID: 1 // Especificar rol diferente
    };
    
    const usuarioCreadoConRol = await axios.post(`${BASE_URL}/usuarios`, usuarioConRol);
    console.log('✅ Usuario creado exitosamente');
    console.log('📋 Usuario creado:', JSON.stringify(usuarioCreadoConRol.data, null, 2));
    
    // Verificar que tiene el rol especificado
    if (usuarioCreadoConRol.data.rol && usuarioCreadoConRol.data.rol.id === 1) {
      console.log('✅ ✅ Rol especificado asignado correctamente: ID = 1');
    } else {
      console.log('❌ ❌ Error: Rol especificado no asignado correctamente');
      console.log(`Rol asignado: ${usuarioCreadoConRol.data.rol ? usuarioCreadoConRol.data.rol.id : 'No asignado'}`);
    }
    console.log('');

    // 4. Limpiar usuarios de prueba
    console.log('4️⃣ Limpiando usuarios de prueba...');
    
    if (usuarioCreado.data.id) {
      await axios.delete(`${BASE_URL}/usuarios/${usuarioCreado.data.id}`);
      console.log('✅ Usuario de prueba 1 eliminado');
    }
    
    if (usuarioCreadoConRol.data.id) {
      await axios.delete(`${BASE_URL}/usuarios/${usuarioCreadoConRol.data.id}`);
      console.log('✅ Usuario de prueba 2 eliminado');
    }
    console.log('');

    console.log('🎉 Todas las pruebas completadas exitosamente!');
    console.log('✅ El sistema de rol por defecto está funcionando correctamente.');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.response) {
      console.error('📋 Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
      console.error('🔢 Código de estado:', error.response.status);
    }
    
    console.log('\n💡 Posibles soluciones:');
    console.log('   1. Verifica que el servidor esté ejecutándose en http://localhost:3000');
    console.log('   2. Verifica que exista el rol con ID = 3 en la base de datos');
    console.log('   3. Verifica que las tablas de usuarios y roles existan');
    console.log('   4. Verifica la conexión a la base de datos');
  }
}

// Función para verificar roles disponibles
async function verificarRoles() {
  console.log('🔍 Verificando roles disponibles...\n');

  try {
    const roles = await axios.get(`${BASE_URL}/roles`);
    console.log(`✅ Roles encontrados: ${roles.data.length}`);
    
    roles.data.forEach(rol => {
      console.log(`   - ID: ${rol.id}, Nombre: ${rol.nombre}, Activo: ${rol.activo}`);
    });
    
    // Verificar si existe el rol con ID = 3
    const rol3 = roles.data.find(r => r.id === 3);
    if (rol3) {
      console.log(`\n✅ Rol con ID = 3 encontrado: ${rol3.nombre}`);
    } else {
      console.log('\n❌ Rol con ID = 3 NO encontrado');
      console.log('💡 Necesitas crear el rol con ID = 3 o modificar la configuración');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error verificando roles:', error.message);
    return false;
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando pruebas del rol por defecto (ID = 3)\n');

  // Primero verificar roles disponibles
  const rolesOk = await verificarRoles();
  
  if (rolesOk) {
    // Si los roles están bien, ejecutar las pruebas
    await testRolPorDefecto();
  } else {
    console.log('❌ No se puede continuar sin verificar los roles');
    console.log('💡 Verifica la configuración de roles y vuelve a intentar');
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testRolPorDefecto, verificarRoles };

