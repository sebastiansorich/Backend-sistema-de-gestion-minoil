# Minoil API - Sistema Simplificado

## 📋 Descripción

Sistema empresarial Minoil refactorizado y simplificado, enfocado únicamente en las funcionalidades básicas de gestión de usuarios, roles, módulos y permisos.

## ✨ Características

### ✅ Funcionalidades Mantenidas
- **Gestión de Usuarios** (`/usuarios`) - CRUD completo
- **Gestión de Roles** (`/roles`) - CRUD completo  
- **Gestión de Módulos** (`/modulos`) - CRUD completo
- **Gestión de Permisos** (`/permisos`) - CRUD completo
- **Validaciones** con class-validator
- **Documentación Swagger** completa
- **Manejo de errores** global
- **Estructura modular** limpia

### ❌ Funcionalidades Eliminadas
- Módulo de Choperas/Mantenimientos (`/bendita`)
- Integración SAP HANA (temporalmente)
- Autenticación LDAP (temporalmente)
- JWT y autenticación compleja (temporalmente)
- Módulos de Sedes, Areas, Cargos (no esenciales)

## 🏗️ Arquitectura

```
src/
├── app.module.ts                 # Módulo principal simplificado
├── main.ts                       # Configuración de la aplicación
├── config/
│   └── prisma.service.ts         # Servicio Prisma simplificado
├── common/
│   ├── interceptors/
│   │   └── error-handler.interceptor.ts  # Interceptor global de errores
│   └── dto/
│       └── base-response.dto.ts  # DTO base para respuestas
├── modules/
│   ├── roles/                    # Gestión de roles
│   ├── usuarios/                 # Gestión de usuarios
│   ├── modulos/                  # Gestión de módulos
│   └── permisos/                 # Gestión de permisos
└── utils/
    └── response.util.ts          # Utilidades para respuestas
```

## 🚀 Instalación y Configuración

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Crear archivo `.env`:
```env
# Base de datos SQL Server
DATABASE_URL="sqlserver://localhost:1433;database=minoil_db;user=sa;password=YourPassword;trustServerCertificate=true"

# Configuración de la aplicación
PORT=3000
NODE_ENV=development

# Variables comentadas temporalmente:
# SAP_HANA_HOST=...
# LDAP_URL=...
```

### 3. Configurar base de datos
```bash
# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones (si es necesario)
npx prisma migrate dev

# O sincronizar esquema (para desarrollo)
npx prisma db push
```

### 4. Ejecutar la aplicación
```bash
# Desarrollo
npm run start:dev

# Producción
npm run start:prod
```

## 📚 API Endpoints

### Usuarios (`/usuarios`)
- `GET /usuarios` - Obtener todos los usuarios
- `GET /usuarios/:id` - Obtener usuario por ID
- `POST /usuarios` - Crear nuevo usuario
- `PATCH /usuarios/:id` - Actualizar usuario
- `DELETE /usuarios/:id` - Eliminar usuario

### Roles (`/roles`)
- `GET /roles` - Obtener todos los roles
- `GET /roles/:id` - Obtener rol por ID
- `POST /roles` - Crear nuevo rol
- `PATCH /roles/:id` - Actualizar rol
- `DELETE /roles/:id` - Eliminar rol

### Módulos (`/modulos`)
- `GET /modulos` - Obtener todos los módulos
- `GET /modulos/sidebar` - Obtener módulos para sidebar
- `GET /modulos/:id` - Obtener módulo por ID
- `POST /modulos` - Crear nuevo módulo
- `PATCH /modulos/:id` - Actualizar módulo
- `DELETE /modulos/:id` - Eliminar módulo

### Permisos (`/permisos`)
- `GET /permisos` - Obtener todos los permisos
- `GET /permisos/rol/:rolId` - Obtener permisos por rol
- `GET /permisos/modulo/:moduloId` - Obtener permisos por módulo
- `GET /permisos/:id` - Obtener permiso por ID
- `POST /permisos` - Crear nuevo permiso
- `PATCH /permisos/:id` - Actualizar permiso
- `DELETE /permisos/:id` - Eliminar permiso

## 📖 Documentación

La documentación completa de la API está disponible en:
- **Swagger UI**: `http://localhost:3000/api`
- **OpenAPI JSON**: `http://localhost:3000/api-json`

## 🔧 Tecnologías Utilizadas

- **Framework**: NestJS con TypeScript
- **Base de Datos**: SQL Server
- **ORM**: Prisma
- **Validación**: class-validator
- **Documentación**: Swagger/OpenAPI
- **Encriptación**: bcryptjs

## 🎯 Objetivos de Calidad

1. **Código limpio**: Eliminada complejidad innecesaria
2. **Mejor mantenibilidad**: Servicios pequeños y enfocados
3. **Fácil debugging**: Logs claros y errores simples
4. **Rendimiento**: Consultas optimizadas con Prisma
5. **Escalabilidad**: Estructura preparada para futuras expansiones

## 🔄 Migración desde el Sistema Complejo

### Cambios Principales:
1. **Eliminación de SAP HANA**: Todos los servicios ahora usan Prisma directamente
2. **Simplificación de respuestas**: Uso de `ResponseUtil` para respuestas estandarizadas
3. **Manejo de errores global**: Interceptor centralizado para errores
4. **Eliminación de módulos no esenciales**: Solo se mantienen los 4 módulos básicos

### Compatibilidad:
- ✅ Mantiene la misma estructura de base de datos
- ✅ Mantiene los mismos endpoints principales
- ✅ Mantiene la misma lógica de negocio básica
- ❌ Elimina funcionalidades complejas de SAP/LDAP

## 🚧 Próximos Pasos

1. **Testing**: Implementar tests unitarios y de integración
2. **Autenticación**: Reintegrar sistema de autenticación simplificado
3. **Logging**: Implementar sistema de logging estructurado
4. **Monitoreo**: Agregar métricas y monitoreo de salud
5. **Expansión**: Agregar nuevas funcionalidades según necesidades

## 📞 Soporte

Para soporte técnico o consultas sobre la refactorización, contactar al equipo de desarrollo.

---

**Versión**: 2.0 - Sistema Simplificado  
**Fecha**: Diciembre 2024  
**Estado**: ✅ Refactorización Completada
