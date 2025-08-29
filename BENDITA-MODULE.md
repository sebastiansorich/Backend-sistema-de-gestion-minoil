# 🍺 Módulo Bendita - Gestión de Choperas y Mantenimientos

## 📋 Descripción
Módulo completo para la gestión de choperas y mantenimientos, integrado con SAP Business One. Permite gestionar el ciclo completo de mantenimiento de choperas desde la identificación del equipo hasta el registro de mantenimientos y evaluaciones.

## 🏗️ Arquitectura del Módulo

### Controllers
- **MantenimientosController** - Gestión de mantenimientos de choperas
- **ChoperasController** - Gestión de información de choperas desde SAP
- **TiposMantenimientoController** - Gestión de tipos de mantenimiento

### Services
- **MantenimientosService** - Lógica de negocio para mantenimientos
- **TiposMantenimientoService** - Gestión de tipos de mantenimiento
- **SapHanaService** - Integración con SAP Business One

## 🚀 Endpoints Disponibles

### 📊 Mantenimientos (`/bendita/mantenimientos`)

#### POST `/bendita/mantenimientos`
**Crear nuevo mantenimiento**
```json
{
  "fechaVisita": "2024-12-20",
  "clienteCodigo": "CLP03480",
  "choperaId": 1,
  "tipoMantenimientoId": 1,
  "estadoGeneral": "BUENO",
  "comentarioEstado": "Estado general bueno",
  "comentarioCalidadCerveza": "Calidad excelente",
  "respuestasChecklist": [
    {
      "itemId": 1,
      "valor": "SI"
    }
  ],
  "respuestasSensorial": [
    {
      "grifo": 1,
      "cerveza": "Brahma",
      "criterio": "Sabor",
      "valor": "EXCELENTE"
    }
  ]
}
```

#### GET `/bendita/mantenimientos`
**Obtener todos los mantenimientos**

#### GET `/bendita/mantenimientos/:id`
**Obtener mantenimiento por ID**

#### GET `/bendita/mantenimientos/chopera/:choperaId`
**Obtener mantenimientos por chopera**

#### GET `/bendita/mantenimientos/usuario/:usuarioId`
**Obtener mantenimientos por usuario**

#### GET `/bendita/mantenimientos/fecha?fechaInicio=2024-01-01&fechaFin=2024-12-31`
**Obtener mantenimientos por rango de fechas**

#### GET `/bendita/mantenimientos/estadisticas`
**Obtener estadísticas de mantenimientos**

#### PUT `/bendita/mantenimientos/:id`
**Actualizar mantenimiento**

#### DELETE `/bendita/mantenimientos/:id`
**Eliminar mantenimiento**

### 🍺 Choperas (`/bendita/choperas`)

#### GET `/bendita/choperas`
**Obtener todas las choperas desde SAP**

#### GET `/bendita/choperas/activas`
**Obtener solo choperas activas**

#### GET `/bendita/choperas/ubicacion/:ubicacion`
**Obtener choperas por ubicación**

#### GET `/bendita/choperas/estado/:estado`
**Obtener choperas por estado**

#### GET `/bendita/choperas/fabricante/:fabricante`
**Obtener choperas por fabricante**

#### GET `/bendita/choperas/buscar?termino=brahma`
**Buscar choperas por término**

#### GET `/bendita/choperas/estadisticas`
**Obtener estadísticas de choperas**

#### GET `/bendita/choperas/:id`
**Obtener chopera por ID**

### 🔧 Tipos de Mantenimiento (`/bendita/tipos-mantenimiento`)

#### GET `/bendita/tipos-mantenimiento`
**Obtener todos los tipos de mantenimiento**

#### GET `/bendita/tipos-mantenimiento/prioridad/:prioridad`
**Obtener tipos por prioridad (BAJA, MEDIA, ALTA)**

#### GET `/bendita/tipos-mantenimiento/estadisticas`
**Obtener estadísticas de tipos**

#### GET `/bendita/tipos-mantenimiento/:id`
**Obtener tipo por ID**

#### POST `/bendita/tipos-mantenimiento`
**Crear nuevo tipo de mantenimiento**

#### PUT `/bendita/tipos-mantenimiento/:id`
**Actualizar tipo de mantenimiento**

#### DELETE `/bendita/tipos-mantenimiento/:id`
**Eliminar tipo de mantenimiento**

## 📊 Tipos de Mantenimiento Predefinidos

1. **Mantenimiento Preventivo** - Mensual, 2-4 horas, Prioridad MEDIA
2. **Mantenimiento Correctivo** - Según necesidad, 4-8 horas, Prioridad ALTA
3. **Mantenimiento Predictivo** - Trimestral, 6-12 horas, Prioridad MEDIA
4. **Inspección General** - Semanal, 1-2 horas, Prioridad BAJA
5. **Limpieza y Sanitización** - Semanal, 2-3 horas, Prioridad MEDIA
6. **Calibración** - Mensual, 3-5 horas, Prioridad ALTA
7. **Cambio de Filtros** - Bimestral, 1-2 horas, Prioridad MEDIA
8. **Revisión Eléctrica** - Trimestral, 4-6 horas, Prioridad ALTA

## 🔍 Funcionalidades Avanzadas

### Validaciones
- ✅ Fecha de visita no puede ser futura
- ✅ Usuario debe existir en SAP HANA
- ✅ Chopera debe existir en SAP HANA
- ✅ Validación de tipos de mantenimiento
- ✅ Validación de respuestas de checklist y sensorial

### Integración SAP HANA
- 🔗 Obtención de usuarios desde SAP
- 🔗 Obtención de choperas desde tabla OITM
- 🔗 Validación de existencia de equipos
- 🔗 Sincronización de datos en tiempo real

### Estadísticas y Reportes
- 📈 Estadísticas por estado de mantenimiento
- 📈 Estadísticas por tipo de mantenimiento
- 📈 Estadísticas por usuario
- 📈 Estadísticas por chopera
- 📈 Estadísticas por rango de fechas
- 📈 Estadísticas de choperas por ubicación y fabricante

## 🛠️ Características Técnicas

### Manejo de Errores
- ❌ Validación de datos de entrada
- ❌ Manejo de errores de conexión SAP
- ❌ Errores de recursos no encontrados
- ❌ Errores de validación de negocio

### Documentación Swagger
- 📖 Documentación completa de todos los endpoints
- 📖 Ejemplos de request/response
- 📖 Códigos de estado HTTP
- 📖 Descripciones detalladas

### Persistencia de Datos
- 💾 Almacenamiento en memoria (para desarrollo)
- 💾 Integración con SAP HANA para datos maestros
- 💾 Estructura preparada para base de datos

## 🎯 Casos de Uso

### 1. Registro de Mantenimiento
1. Usuario selecciona chopera desde SAP
2. Completa formulario de mantenimiento
3. Responde checklist de verificación
4. Evalúa calidad sensorial de cerveza
5. Sistema valida y registra mantenimiento

### 2. Consulta de Historial
1. Filtro por chopera específica
2. Filtro por usuario técnico
3. Filtro por rango de fechas
4. Visualización de estadísticas

### 3. Gestión de Choperas
1. Consulta de choperas activas
2. Filtro por ubicación
3. Filtro por fabricante
4. Búsqueda por término

## 🚀 Próximos Pasos Sugeridos

1. **Base de Datos**: Implementar persistencia con Prisma/PostgreSQL
2. **Autenticación**: Integrar con sistema de autenticación
3. **Notificaciones**: Sistema de alertas para mantenimientos vencidos
4. **Dashboard**: Panel de control con métricas en tiempo real
5. **Reportes**: Generación de reportes PDF/Excel
6. **Mobile**: API para aplicación móvil
7. **Integración**: Sincronización bidireccional con SAP

## 📖 Documentación Swagger
Accede a la documentación completa en:
```
http://localhost:3000/api
```

## 🔧 Configuración
El módulo está configurado para funcionar con:
- NestJS Framework
- SAP HANA Service
- Swagger Documentation
- Class Validator
- TypeScript
