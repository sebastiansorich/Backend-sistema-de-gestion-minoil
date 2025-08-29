const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testCrearMantenimientoDirecto() {
  console.log('🧪 Probando crearMantenimiento directamente...\n');

  try {
    // 1. Crear datos de prueba
    const mantenimientoData = {
      usuarioId: 1729,
      fechaVisita: "2024-12-20",
      clienteCodigo: "CLP03480",
      itemCode: "903050",
      choperaCode: "UPP2092208M",
      tipoMantenimientoId: 1,
      estadoGeneral: "BUENO",
      comentarioEstado: "Prueba directa",
      comentarioCalidadCerveza: "Prueba directa"
    };

    console.log('📋 Datos de prueba:', JSON.stringify(mantenimientoData, null, 2));

    // 2. Intentar crear el mantenimiento directamente usando el endpoint
    console.log('\n🔧 Intentando crear mantenimiento...');
    
    const mantenimientoCompleto = {
      fechaVisita: "2024-12-20",
      clienteCodigo: "CLP03480",
      itemCode: "903050",
      choperaCode: "UPP2092208M",
      tipoMantenimientoId: 1,
      estadoGeneral: "BUENO",
      comentarioEstado: "Prueba directa",
      comentarioCalidadCerveza: "Prueba directa",
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

    const response = await axios.post(`${BASE_URL}/bendita/mantenimientos`, mantenimientoCompleto);
    console.log('✅ Mantenimiento creado exitosamente');
    console.log('📋 Respuesta:', response.data);

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Ejecutar prueba
testCrearMantenimientoDirecto();
