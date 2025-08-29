const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function crearUsuarioSistema() {
  console.log('🔧 Creando usuario sistema por defecto...\n');

  try {
    // 1. Verificar si ya existe el usuario sistema
    console.log('1️⃣ Verificando si existe usuario sistema...');
    try {
      const responseUsuario = await axios.get(`${BASE_URL}/usuarios/9999`);
      console.log('✅ Usuario sistema ya existe:', responseUsuario.data.username);
      return 9999;
    } catch (error) {
      console.log('❌ Usuario sistema no existe, creándolo...');
    }

    // 2. Verificar roles existentes
    console.log('\n2️⃣ Verificando roles existentes...');
    const responseRoles = await axios.get(`${BASE_URL}/roles`);
    console.log('✅ Roles encontrados:', responseRoles.data.length);
    
    let rolId = 1; // Por defecto usar rol 1
    if (responseRoles.data.length > 0) {
      rolId = responseRoles.data[0].id;
      console.log('👤 Usando rol ID:', rolId);
    }

    // 3. Crear usuario sistema
    console.log('\n3️⃣ Creando usuario sistema...');
    const usuarioSistema = {
      username: 'sistema',
      email: 'sistema@minoil.com.bo',
      nombre: 'Usuario',
      apellido: 'Sistema',
      password: 'sistema123',
      activo: true,
      rolID: rolId
    };

    const response = await axios.post(`${BASE_URL}/usuarios`, usuarioSistema);
    console.log('✅ Usuario sistema creado exitosamente');
    console.log('📋 ID del usuario:', response.data.id);
    console.log('👤 Username:', response.data.username);

    return response.data.id;

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    return null;
  }
}

// Ejecutar creación
crearUsuarioSistema().then(usuarioId => {
  if (usuarioId) {
    console.log(`\n🎯 Usuario sistema creado con ID: ${usuarioId}`);
    console.log('💡 Este usuario será usado para todos los mantenimientos');
  }
});
