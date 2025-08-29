const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function verificarUsuarios() {
  console.log('🔍 Verificando usuarios existentes...\n');

  try {
    // 1. Verificar usuarios existentes
    console.log('1️⃣ Obteniendo usuarios existentes...');
    const responseUsuarios = await axios.get(`${BASE_URL}/usuarios`);
    console.log('✅ Usuarios encontrados:', responseUsuarios.data.length);
    
    if (responseUsuarios.data.length > 0) {
      console.log('📋 Usuarios disponibles:');
      responseUsuarios.data.forEach(usuario => {
        console.log(`   - ID: ${usuario.id}, Username: ${usuario.username}, Nombre: ${usuario.nombre} ${usuario.apellido}`);
      });
      
      // Usar el primer usuario disponible
      const primerUsuario = responseUsuarios.data[0];
      console.log(`\n✅ Usando usuario: ${primerUsuario.username} (ID: ${primerUsuario.id})`);
      return primerUsuario.id;
    } else {
      console.log('❌ No hay usuarios. Creando uno básico...');
      
      // 2. Verificar roles existentes
      console.log('\n2️⃣ Verificando roles existentes...');
      const responseRoles = await axios.get(`${BASE_URL}/roles`);
      console.log('✅ Roles encontrados:', responseRoles.data.length);
      
      if (responseRoles.data.length === 0) {
        console.log('❌ No hay roles. Creando rol básico...');
        const nuevoRol = {
          nombre: 'Usuario Básico',
          descripcion: 'Rol por defecto para usuarios del sistema',
          activo: true
        };
        const rolCreado = await axios.post(`${BASE_URL}/roles`, nuevoRol);
        console.log('✅ Rol creado:', rolCreado.data.nombre);
      }
      
      // 3. Crear usuario básico
      console.log('\n3️⃣ Creando usuario básico...');
      const nuevoUsuario = {
        username: 'sistema',
        email: 'sistema@minoil.com.bo',
        nombre: 'Usuario',
        apellido: 'Sistema',
        password: 'sistema123',
        activo: true,
        rolID: 1 // Usar el primer rol disponible
      };
      
      const usuarioCreado = await axios.post(`${BASE_URL}/usuarios`, nuevoUsuario);
      console.log('✅ Usuario creado:', usuarioCreado.data.username);
      return usuarioCreado.data.id;
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('📋 Detalles:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    // Si hay error, sugerir crear usuario manualmente
    console.log('\n💡 Sugerencia: Crea un usuario manualmente usando:');
    console.log('POST /usuarios');
    console.log('{');
    console.log('  "username": "sistema",');
    console.log('  "email": "sistema@minoil.com.bo",');
    console.log('  "nombre": "Usuario",');
    console.log('  "apellido": "Sistema",');
    console.log('  "password": "sistema123",');
    console.log('  "activo": true');
    console.log('}');
    
    return null;
  }
}

// Ejecutar verificación
verificarUsuarios().then(usuarioId => {
  if (usuarioId) {
    console.log(`\n🎯 Usuario ID para usar en mantenimientos: ${usuarioId}`);
  }
});
