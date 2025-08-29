const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function verificarTipoMantenimiento() {
  console.log('🔍 Verificando tipo de mantenimiento ID 1...\n');

  try {
    // 1. Verificar tipos de mantenimiento disponibles
    console.log('1️⃣ Obteniendo tipos de mantenimiento...');
    const responseTipos = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos disponibles:', responseTipos.data.length);
    
    responseTipos.data.forEach(tipo => {
      console.log(`   - ID: ${tipo.id}, Nombre: ${tipo.nombre}`);
    });

    // 2. Verificar si existe el tipo con ID 1
    const tipo1 = responseTipos.data.find(t => t.id === 1);
    if (tipo1) {
      console.log('\n✅ Tipo de mantenimiento ID 1 encontrado:', tipo1.nombre);
    } else {
      console.log('\n❌ Tipo de mantenimiento ID 1 NO encontrado');
      console.log('💡 Usando el primer tipo disponible...');
      const primerTipo = responseTipos.data[0];
      console.log(`   - ID: ${primerTipo.id}, Nombre: ${primerTipo.nombre}`);
    }

    // 3. Verificar usuario sistema
    console.log('\n2️⃣ Verificando usuario sistema...');
    const responseUsuario = await axios.get(`${BASE_URL}/usuarios/1729`);
    console.log('✅ Usuario sistema encontrado:', responseUsuario.data.username);

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Ejecutar verificación
verificarTipoMantenimiento();

