const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testUsuarioSistema() {
  console.log('🧪 Probando endpoint con usuario sistema...\n');

  try {
    // 1. Verificar que el usuario sistema existe
    console.log('1️⃣ Verificando usuario sistema...');
    const responseUsuario = await axios.get(`${BASE_URL}/usuarios/1729`);
    console.log('✅ Usuario sistema encontrado:', responseUsuario.data.username);

    // 2. Verificar tipos de mantenimiento
    console.log('\n2️⃣ Verificando tipos de mantenimiento...');
    const responseTipos = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos disponibles:', responseTipos.data.length);

    // 3. Crear mantenimiento de prueba
    console.log('\n3️⃣ Creando mantenimiento de prueba...');
    const mantenimiento = {
      fechaVisita: "2024-12-20",
      clienteCodigo: "CLP03480",
      itemCode: "903050",
      choperaCode: "UPP2092208M",
      tipoMantenimientoId: 1,
      estadoGeneral: "BUENO",
      comentarioEstado: "Prueba con usuario sistema - Equipo funcionando correctamente",
      comentarioCalidadCerveza: "Prueba con usuario sistema - Cerveza con excelente calidad",
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

    const response = await axios.post(`${BASE_URL}/bendita/mantenimientos`, mantenimiento);
    console.log('✅ Mantenimiento creado exitosamente');
    console.log('📋 ID del mantenimiento:', response.data.id);

    // 4. Verificar que se guardó correctamente
    console.log('\n4️⃣ Verificando que se guardó correctamente...');
    const mantenimientos = await axios.get(`${BASE_URL}/bendita/mantenimientos`);
    console.log('✅ Total de mantenimientos:', mantenimientos.data.length);
    
    const mantenimientoCreado = mantenimientos.data.find(m => m.id === response.data.id);
    if (mantenimientoCreado) {
      console.log('✅ Mantenimiento encontrado en la base de datos');
      console.log('👤 Usuario:', mantenimientoCreado.usuario?.nombre || 'N/A');
      console.log('📅 Fecha:', mantenimientoCreado.fechaVisita);
      console.log('🏪 Cliente:', mantenimientoCreado.clienteCodigo);
    }

    // 5. Probar búsqueda por chopera
    console.log('\n5️⃣ Probando búsqueda por chopera...');
    const mantenimientosChopera = await axios.get(`${BASE_URL}/bendita/mantenimientos/chopera/${mantenimiento.itemCode}`);
    console.log('✅ Mantenimientos de la chopera:', mantenimientosChopera.data.length);

    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('✅ El endpoint funciona correctamente con el usuario sistema');

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Ejecutar prueba
testUsuarioSistema();
