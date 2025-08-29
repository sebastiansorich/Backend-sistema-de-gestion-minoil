const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testMantenimientoSimplificado() {
  console.log('🧪 Probando mantenimiento con datos simulados...\n');

  try {
    // Crear mantenimiento de prueba
    const mantenimiento = {
      fechaVisita: "2024-12-20",
      clienteCodigo: "CLP03480",
      itemCode: "903050",
      choperaCode: "UPP2092208M",
      tipoMantenimientoId: 1,
      estadoGeneral: "BUENO",
      comentarioEstado: "Prueba simplificada - Equipo funcionando correctamente",
      comentarioCalidadCerveza: "Prueba simplificada - Cerveza con excelente calidad",
      respuestasChecklist: [
        { itemId: 1, valor: "SI" },
        { itemId: 2, valor: "SI" },
        { itemId: 3, valor: "BUENO" }
      ],
      respuestasSensorial: [
        {
          grifo: 1,
          cerveza: "Paceña",
          criterio: "Temperatura",
          valor: "EXCELENTE"
        }
      ]
    };

    console.log('📋 Enviando mantenimiento...');
    const response = await axios.post(`${BASE_URL}/bendita/mantenimientos`, mantenimiento);
    
    console.log('✅ Mantenimiento creado exitosamente');
    console.log('📋 ID del mantenimiento:', response.data.id);
    console.log('👤 Usuario:', response.data.usuario?.nombre || 'N/A');
    console.log('📅 Fecha:', response.data.fechaVisita);
    console.log('🏪 Cliente:', response.data.clienteCodigo);
    console.log('📋 Checklist items:', response.data.respuestasChecklist?.length || 0);
    console.log('🍺 Sensorial items:', response.data.respuestasSensorial?.length || 0);

    // Verificar que se guardó correctamente
    console.log('\n🔍 Verificando que se guardó en la base de datos...');
    const mantenimientos = await axios.get(`${BASE_URL}/bendita/mantenimientos`);
    console.log('✅ Total de mantenimientos:', mantenimientos.data.length);
    
    const mantenimientoCreado = mantenimientos.data.find(m => m.id === response.data.id);
    if (mantenimientoCreado) {
      console.log('✅ Mantenimiento encontrado en la base de datos');
      console.log('🎉 ¡Prueba exitosa! El endpoint funciona con datos simulados');
      console.log('📋 Checklist generado:', mantenimientoCreado.respuestasChecklist?.length || 0, 'items');
      console.log('🍺 Sensorial generado:', mantenimientoCreado.respuestasSensorial?.length || 0, 'items');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Ejecutar prueba
testMantenimientoSimplificado();

