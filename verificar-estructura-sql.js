const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function verificarEstructuraSQL() {
  console.log('🔍 Verificando estructura de tablas con consultas SQL...\n');

  try {
    // 1. Verificar usuario específico
    console.log('1️⃣ Verificando usuario 1002...');
    const responseUsuario = await axios.get(`${BASE_URL}/usuarios/1002`);
    console.log('✅ Usuario encontrado:', responseUsuario.data.username);
    console.log('📋 Datos completos:', responseUsuario.data);

    // 2. Verificar tipos de mantenimiento
    console.log('\n2️⃣ Verificando tipos de mantenimiento...');
    const responseTipos = await axios.get(`${BASE_URL}/bendita/tipos-mantenimiento`);
    console.log('✅ Tipos disponibles:', responseTipos.data.length);
    
    responseTipos.data.forEach(tipo => {
      console.log(`   - ID: ${tipo.id}, Nombre: ${tipo.nombre}`);
    });

    // 3. Verificar si hay mantenimientos existentes
    console.log('\n3️⃣ Verificando mantenimientos existentes...');
    const responseMantenimientos = await axios.get(`${BASE_URL}/bendita/mantenimientos`);
    console.log('✅ Mantenimientos existentes:', responseMantenimientos.data.length);

    // 4. Intentar crear un mantenimiento con datos mínimos
    console.log('\n4️⃣ Intentando crear mantenimiento con datos mínimos...');
    const mantenimientoMinimo = {
      fechaVisita: "2024-12-20",
      clienteCodigo: "CLP03480",
      itemCode: "903050",
      choperaCode: "UPP2092208M",
      tipoMantenimientoId: 1,
      estadoGeneral: "BUENO",
      comentarioEstado: "Prueba mínima",
      comentarioCalidadCerveza: "Prueba mínima",
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
      const response = await axios.post(`${BASE_URL}/bendita/mantenimientos`, mantenimientoMinimo);
      console.log('✅ Mantenimiento creado exitosamente:', response.data.id);
    } catch (error) {
      console.log('❌ Error creando mantenimiento:', error.response?.data?.message);
      
      // Si el error es de clave foránea, intentar con un usuario diferente
      if (error.response?.data?.message?.includes('foreign key constraint violation')) {
        console.log('\n🔄 Intentando con usuario diferente...');
        
        // Obtener lista de usuarios
        const responseUsuarios = await axios.get(`${BASE_URL}/usuarios`);
        const primerUsuario = responseUsuarios.data[0];
        console.log('👤 Usando usuario:', primerUsuario.username, 'ID:', primerUsuario.id);
        
        // Modificar el controlador temporalmente para usar este usuario
        console.log('💡 Sugerencia: Modifica el controlador para usar usuario ID:', primerUsuario.id);
      }
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
verificarEstructuraSQL();
