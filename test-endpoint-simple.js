const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testEndpointSimple() {
  console.log('🔍 Probando endpoint de usuarios...\n');

  try {
    const response = await axios.get(`${BASE_URL}/usuarios`);
    console.log('✅ Usuarios obtenidos:', response.data.length);
    console.log('📋 Primer usuario:', response.data[0]?.username);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📋 Status:', error.response?.status);
    console.error('📋 Data:', error.response?.data);
  }
}

testEndpointSimple();

