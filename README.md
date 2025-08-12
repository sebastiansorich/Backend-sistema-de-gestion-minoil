# 🏢 Backend Minoil - Sistema Empresarial

Sistema backend para gestión de usuarios, jerarquías y permisos de acceso a distintos módulos empresariales.

## 🚀 Características

- **Arquitectura modular** basada en dominios (features)
- **Base de datos MySQL** con Prisma ORM
- **Autenticación** local y preparado para LDAP
- **Gestión de jerarquías** de cargos
- **Sistema de permisos** granular por rol y módulo
- **API REST** documentada con Swagger
- **Validación** de datos con class-validator
- **Soft deletes** para mantener integridad referencial

## 📋 Prerrequisitos

- Node.js 18+ 
- MySQL 8.0+
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd backend-minoil
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar las variables según tu configuración
DATABASE_URL="mysql://usuario:password@localhost:3306/minoil_db"
JWT_SECRET="tu-super-secret-jwt-key"

# Variables para integración con SAP HANA B1
SAP_HANA_HOST="tu-servidor-sap-hana"
SAP_HANA_PORT="30015"
SAP_HANA_DATABASE="tu-base-datos-sap"
SAP_HANA_USERNAME="tu-usuario-sap"
SAP_HANA_PASSWORD="tu-password-sap"
SAP_HANA_ENCRYPT="true"
SAP_HANA_TRUST_SERVER_CERTIFICATE="true"

# Configuración de sincronización
SAP_SYNC_ENABLED="true"
SAP_SYNC_CRON="0 */6 * * *"  # Cada 6 horas
```

4. **Configurar la base de datos**
```bash
# Generar el cliente de Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# Poblar con datos iniciales
npm run prisma:seed
```

5. **Iniciar el servidor**
```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## 📚 Documentación de la API

Una vez iniciado el servidor, la documentación Swagger estará disponible en:
```
http://localhost:3000/api
```

## 🏗️ Estructura del Proyecto

```
src/
├── app.module.ts              # Módulo principal
├── main.ts                    # Punto de entrada
├── config/                    # Configuración
│   └── prisma.service.ts      # Servicio de Prisma
├── common/                    # Utilidades compartidas
├── modules/                   # Módulos de features
│   ├── sedes/                # Gestión de sedes
│   ├── areas/                # Gestión de áreas
│   ├── cargos/               # Gestión de cargos y jerarquías
│   ├── roles/                # Gestión de roles
│   ├── usuarios/             # Gestión de usuarios
│   ├── modulos/              # Gestión de módulos del sistema
│   └── permisos/             # Gestión de permisos
├── prisma/                   # Schema y seeds
│   ├── schema.prisma         # Esquema de base de datos
│   └── seed.ts               # Datos iniciales
└── utils/                    # Funciones utilitarias
```

## 🗄️ Modelo de Datos

### Entidades Principales

- **Sedes**: Ubicaciones físicas de la empresa
- **Áreas**: Departamentos dentro de cada sede
- **Cargos**: Posiciones con jerarquía (auto-relación)
- **Roles**: Conjuntos de permisos
- **Usuarios**: Personal con autenticación
- **Módulos**: Funcionalidades del sistema
- **Permisos**: Accesos específicos por rol y módulo

### Relaciones

```
Sede (1) ←→ (N) Area (1) ←→ (N) Cargo (1) ←→ (N) Usuario
Sede (1) ←→ (N) Usuario
Rol (1) ←→ (N) Usuario
Rol (1) ←→ (N) Permiso (N) ←→ (1) Modulo
```

## 🔐 Autenticación y Autorización

### Usuarios de Prueba

El seed crea tres usuarios de ejemplo:

| Usuario | Contraseña | Rol | Descripción |
|---------|------------|-----|-------------|
| `admin` | `admin123` | Administrador | Acceso completo |
| `gerente` | `admin123` | Gerente | Acceso limitado |
| `usuario` | `admin123` | Usuario | Solo lectura |

### Permisos

Cada permiso incluye:
- **Crear**: Crear nuevos registros
- **Leer**: Ver información
- **Actualizar**: Modificar registros existentes
- **Eliminar**: Eliminar registros

## 📡 Endpoints Principales

### Sedes
- `GET /sedes` - Listar todas las sedes
- `POST /sedes` - Crear nueva sede
- `GET /sedes/:id` - Obtener sede específica
- `PATCH /sedes/:id` - Actualizar sede
- `DELETE /sedes/:id` - Eliminar sede

### Cargos
- `GET /cargos` - Listar todos los cargos
- `GET /cargos/hierarchy` - Obtener jerarquía de cargos
- `POST /cargos` - Crear nuevo cargo
- `GET /cargos/area/:areaId` - Cargos por área

### Usuarios
- `GET /usuarios` - Listar todos los usuarios
- `POST /usuarios` - Crear nuevo usuario
- `GET /usuarios/:id` - Obtener usuario específico

### Permisos
- `GET /permisos/rol/:rolId` - Permisos por rol
- `GET /permisos/modulo/:moduloId` - Permisos por módulo

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Servidor en modo desarrollo
npm run start:debug        # Servidor con debug

# Base de datos
npm run prisma:generate    # Generar cliente Prisma
npm run prisma:migrate     # Ejecutar migraciones
npm run prisma:seed        # Poblar datos iniciales
npm run prisma:studio      # Abrir Prisma Studio
npm run db:reset           # Resetear base de datos

# Build y producción
npm run build              # Compilar TypeScript
npm run start:prod         # Servidor en producción

# Testing
npm run test               # Ejecutar tests
npm run test:watch         # Tests en modo watch
npm run test:cov           # Tests con cobertura

# Linting y formato
npm run lint               # Linting con ESLint
npm run format             # Formatear código
```

## 🔧 Configuración

### Variables de Entorno

```env
# Base de datos
DATABASE_URL="mysql://usuario:password@localhost:3306/minoil_db"

# Aplicación
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=tu-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# LDAP (futuro)
LDAP_URL=ldap://localhost:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=admin_password
LDAP_BASE_DN=dc=example,dc=com

# Logging
LOG_LEVEL=debug
```

## 🚀 Despliegue

### Docker (Recomendado)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### Manual

```bash
# Instalar dependencias de producción
npm ci --only=production

# Compilar
npm run build

# Configurar variables de entorno
# Ejecutar migraciones
npm run prisma:migrate:deploy

# Iniciar
npm run start:prod
```

## 🔄 Migración a SAP HANA

La arquitectura está preparada para migrar a SAP HANA:

1. **Cambiar el provider en schema.prisma**:
```prisma
datasource db {
  provider = "sap"
  url      = env("DATABASE_URL")
}
```

2. **Actualizar la URL de conexión**:
```env
DATABASE_URL="sap://usuario:password@hana-server:port/database"
```

3. **Ejecutar migración**:
```bash
npm run prisma:migrate
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

## 🆘 Soporte

Para soporte técnico, contactar al equipo de desarrollo.

---

**Desarrollado con ❤️ para Minoil** 