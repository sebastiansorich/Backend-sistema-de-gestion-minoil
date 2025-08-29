const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function verificarEstructuraTabla() {
  console.log('🔍 Verificando estructura de la tabla mantenimientos_choperas...\n');

  try {
    // 1. Verificar si hay mantenimientos existentes
    console.log('1️⃣ Verificando mantenimientos existentes...');
    const responseMantenimientos = await axios.get(`${BASE_URL}/bendita/mantenimientos`);
    console.log('✅ Mantenimientos existentes:', responseMantenimientos.data.length);
    
    if (responseMantenimientos.data.length > 0) {
      console.log('📋 Primer mantenimiento:', responseMantenimientos.data[0]);
    }

    // 2. Verificar tipos de mantenimiento
    console.log('\n2️⃣ Verificando tipos de mantenimiento...');
    const responseTipos = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos disponibles:', responseTipos.data.length);
    
    responseTipos.data.forEach(tipo => {
      console.log(`   - ID: ${tipo.id}, Nombre: ${tipo.nombre}`);
    });

    // 3. Verificar usuario específico
    console.log('\n3️⃣ Verificando usuario específico...');
    const responseUsuario = await axios.get(`${BASE_URL}/usuarios/1002`);
    console.log('✅ Usuario 1002:', responseUsuario.data.username);

    // 4. Intentar crear un mantenimiento simple sin checklist ni sensorial
    console.log('\n4️⃣ Intentando crear mantenimiento simple...');
    const mantenimientoSimple = {
      fechaVisita: "2024-12-20",
      clienteCodigo: "CLP03480",
      itemCode: "903050",
      choperaCode: "UPP2092208M",
      tipoMantenimientoId: 1,
      estadoGeneral: "BUENO",
      comentarioEstado: "Prueba simple",
      comentarioCalidadCerveza: "Prueba simple",
      respuestasChecklist: [
        { itemId: 1, valor: "SI" }
      ],
      respuestasSensorial: [
        {
          grifo: 1,
          cerveza: "Paceña",
          criterio: "Temperatura",
          valor: "BUENO"
        }
      ]
    };

    try {
      const response = await axios.post(`${BASE_URL}/bendita/mantenimientos`, mantenimientoSimple);
      console.log('✅ Mantenimiento simple creado:', response.data.id);
    } catch (error) {
      console.log('❌ Error creando mantenimiento simple:', error.response?.data?.message);
      console.log('📋 Detalles:', JSON.stringify(error.response?.data, null, 2));
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
verificarEstructuraTabla();
