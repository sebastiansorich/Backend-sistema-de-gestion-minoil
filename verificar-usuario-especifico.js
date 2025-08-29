const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function verificarUsuarioEspecifico() {
  console.log('🔍 Verificando usuario específico ID 1002...\n');

  try {
    // 1. Verificar usuario específico
    console.log('1️⃣ Verificando usuario con ID 1002...');
    const responseUsuario = await axios.get(`${BASE_URL}/usuarios/1002`);
    console.log('✅ Usuario encontrado:', responseUsuario.data);
    
    // 2. Verificar estructura de la tabla users
    console.log('\n2️⃣ Verificando estructura de usuarios...');
    const responseUsuarios = await axios.get(`${BASE_URL}/usuarios`);
    console.log('✅ Total usuarios:', responseUsuarios.data.length);
    
    // Buscar usuario con ID 1002 en la lista
    const usuario1002 = responseUsuarios.data.find(u => u.id === 1002);
    if (usuario1002) {
      console.log('✅ Usuario 1002 encontrado en la lista:', usuario1002.username);
    } else {
      console.log('❌ Usuario 1002 NO encontrado en la lista');
      console.log('📋 Primeros 5 usuarios:');
      responseUsuarios.data.slice(0, 5).forEach(u => {
        console.log(`   - ID: ${u.id}, Username: ${u.username}`);
      });
    }

    // 3. Verificar tipos de mantenimiento
    console.log('\n3️⃣ Verificando tipos de mantenimiento...');
    const responseTipos = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos disponibles:', responseTipos.data.length);
    
    if (responseTipos.data.length > 0) {
      console.log('📋 Primer tipo:', responseTipos.data[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Ejecutar verificación
verificarUsuarioEspecifico();
