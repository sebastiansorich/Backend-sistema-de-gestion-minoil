const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testTiposMantenimiento() {
  console.log('🧪 Probando tipos de mantenimiento...\n');

  try {
    // 1. Obtener todos los tipos de mantenimiento
    console.log('1️⃣ Obteniendo todos los tipos de mantenimiento...');
    const response1 = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos de mantenimiento obtenidos:', response1.data.length);
    console.log('📋 Tipos disponibles:');
    response1.data.forEach(tipo => {
      console.log(`   - ID: ${tipo.id}, Nombre: ${tipo.nombre}, Prioridad: ${tipo.prioridad}`);
    });

    // 2. Obtener estadísticas
    console.log('\n2️⃣ Obteniendo estadísticas...');
    const response2 = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento/estadisticas`);
    console.log('✅ Estadísticas obtenidas:', response2.data);

    // 3. Obtener tipos por prioridad
    console.log('\n3️⃣ Obteniendo tipos por prioridad MEDIA...');
    const response3 = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento/prioridad/MEDIA`);
    console.log('✅ Tipos con prioridad MEDIA:', response3.data.length);

    // 4. Obtener un tipo específico
    if (response1.data.length > 0) {
      const primerTipo = response1.data[0];
      console.log(`\n4️⃣ Obteniendo tipo específico (ID: ${primerTipo.id})...`);
      const response4 = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento/${primerTipo.id}`);
      console.log('✅ Tipo específico obtenido:', response4.data.nombre);
    }

    // 5. Crear un nuevo tipo de mantenimiento
    console.log('\n5️⃣ Creando nuevo tipo de mantenimiento...');
    const nuevoTipo = {
      nombre: 'Mantenimiento de Emergencia',
      descripcion: 'Mantenimiento urgente para resolver problemas críticos',
      activo: true,
      frecuencia: 'Según emergencia',
      duracionEstimada: '1-3 horas',
      prioridad: 'ALTA'
    };
    
    const response5 = await axios.post(`${BASE_URL}/bendita/tipos-mantenimiento`, nuevoTipo);
    console.log('✅ Nuevo tipo creado:', response5.data.nombre);

    // 6. Actualizar el tipo creado
    console.log('\n6️⃣ Actualizando tipo de mantenimiento...');
    const actualizacion = {
      descripcion: 'Mantenimiento urgente para resolver problemas críticos - ACTUALIZADO',
      prioridad: 'MEDIA'
    };
    
    const response6 = await axios.put(`${BASE_URL}/bendita/tipos-mantenimiento/${response5.data.id}`, actualizacion);
    console.log('✅ Tipo actualizado:', response6.data.descripcion);

    // 7. Verificar que se puede usar en un mantenimiento
    console.log('\n7️⃣ Verificando que se puede usar en mantenimientos...');
    const mantenimientoTest = {
      fechaVisita: new Date().toISOString().split('T')[0],
      clienteCodigo: 'TEST001',
      itemCode: 'CHOP001',
      choperaCode: 'CHOP001',
      tipoMantenimientoId: response5.data.id, // Usar el tipo que acabamos de crear
      estadoGeneral: 'BUENO',
      comentarioEstado: 'Prueba de integración con tipos de mantenimiento',
      comentarioCalidadCerveza: 'Calidad excelente en prueba',
      respuestasChecklist: [
        {
          itemId: 1,
          valor: 'SI'
        }
      ],
      respuestasSensorial: [
        {
          grifo: 1,
          cerveza: 'Brahma',
          criterio: 'Sabor',
          valor: 'EXCELENTE'
        }
      ]
    };

    try {
      const response7 = await axios.post(`${BASE_URL}/bendita/mantenimientos`, mantenimientoTest);
      console.log('✅ Mantenimiento creado exitosamente con el nuevo tipo');
      console.log('   - ID del mantenimiento:', response7.data.id);
      console.log('   - Tipo de mantenimiento usado:', response7.data.tipoMantenimiento?.nombre);
    } catch (error) {
      console.log('❌ Error creando mantenimiento con el nuevo tipo:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Pruebas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.response?.data?.message || error.message);
  }
}

// Ejecutar las pruebas
testTiposMantenimiento();
