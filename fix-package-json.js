const fs = require('fs');
const path = require('path');

// Ruta del archivo package.json en el servidor
const packageJsonPath = 'C:\\Proyectos\\bakend\\Backend-sistema-de-gestion-minoil\\package.json';

try {
  // Leer el archivo como buffer para preservar la codificación
  const content = fs.readFileSync(packageJsonPath);
  
  // Eliminar el BOM UTF-8 si existe (los primeros 3 bytes)
  let cleanContent;
  if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    console.log('BOM detectado, eliminando...');
    cleanContent = content.slice(3);
  } else {
    console.log('No se detectó BOM, el archivo está limpio');
    cleanContent = content;
  }
  
  // Escribir el contenido limpio
  fs.writeFileSync(packageJsonPath, cleanContent);
  
  // Verificar que el JSON es válido
  const jsonContent = cleanContent.toString('utf8');
  JSON.parse(jsonContent);
  
  console.log('✅ Archivo package.json limpiado y validado correctamente');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
