const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testConexionSimple() {
  console.log('🔍 Probando conexión al servidor...\n');

  try {
    // 1. Probar conexión básica
    console.log('1️⃣ Probando conexión básica...');
    const response = await axios.get(`${BASE_URL}/`);
    console.log('✅ Servidor respondiendo');

    // 2. Probar endpoint de usuarios
    console.log('\n2️⃣ Probando endpoint de usuarios...');
    const responseUsuarios = await axios.get(`${BASE_URL}/usuarios`);
    console.log('✅ Usuarios obtenidos:', responseUsuarios.data.length);

    // 3. Probar endpoint de tipos de mantenimiento
    console.log('\n3️⃣ Probando endpoint de tipos de mantenimiento...');
    const responseTipos = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos obtenidos:', responseTipos.data.length);

    console.log('\n🎉 Conexión funcionando correctamente');

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 El servidor no está corriendo. Ejecuta: npm run start:dev');
    }
  }
}

// Ejecutar prueba
testConexionSimple();

