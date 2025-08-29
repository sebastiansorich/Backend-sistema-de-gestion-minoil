# 👤 Rol por Defecto (ID = 3) - Configuración

Este documento describe cómo se ha configurado el sistema para asignar automáticamente el rol con **ID = 3** a todos los usuarios nuevos cuando no se especifica un rol.

## 🔧 **Cambios Implementados**

### 1. **Servicio de Usuarios** (`src/modules/usuarios/usuarios.service.ts`)

- ✅ **Lógica de rol por defecto**: Si no se especifica `rolID`, se asigna automáticamente el rol con `ID = 3`
- ✅ **Validación**: Verifica que el rol con ID = 3 exista antes de crear el usuario
- ✅ **Consistencia**: Mantiene la funcionalidad de especificar un rol diferente si se desea

### 2. **DTO de Usuario** (`src/modules/usuarios/dto/create-usuario.dto.ts`)

- ✅ **Campo opcional**: `rolID` ahora es opcional
- ✅ **Documentación**: Indica que el valor por defecto es 3
- ✅ **Validación**: Mantiene la validación de tipo entero

### 3. **Servicio de Autenticación** (`src/modules/auth/auth.service.ts`)

- ✅ **LDAP**: Usuarios creados desde LDAP usan rol ID = 3 por defecto
- ✅ **Consistencia**: Usa `ROLID` en lugar de `rolId` para mantener estándares

### 4. **Servicio de Sincronización SAP** (`src/modules/sap/sap-sync.service.ts`)

- ✅ **Sincronización**: Usuarios sincronizados desde SAP usan rol ID = 3 por defecto
- ✅ **Múltiples métodos**: Actualizados todos los métodos de creación de usuarios

## 📋 **Comportamiento del Sistema**

### **Crear Usuario SIN especificar rol**
```json
POST /usuarios
{
  "username": "nuevo.usuario",
  "email": "nuevo.usuario@minoil.com.bo",
  "nombre": "Nuevo",
  "apellido": "Usuario",
  "password": "password123",
  "activo": true
}
```

**Resultado**: Se asigna automáticamente el rol con **ID = 3**

### **Crear Usuario ESPECIFICANDO rol**
```json
POST /usuarios
{
  "username": "admin.usuario",
  "email": "admin.usuario@minoil.com.bo",
  "nombre": "Admin",
  "apellido": "Usuario",
  "password": "password123",
  "activo": true,
  "rolID": 1
}
```

**Resultado**: Se asigna el rol especificado (en este caso, ID = 1)

## 🗄️ **Requisitos de Base de Datos**

### **Rol con ID = 3 debe existir**

El sistema requiere que exista un rol con ID = 3 en la tabla `roles`. Si no existe, puedes crearlo con:

```sql
INSERT INTO "MINOILDES"."roles" ("id", "nombre", "descripcion", "activo") 
VALUES (3, 'Usuario Básico', 'Rol por defecto para usuarios nuevos', TRUE)
ON DUPLICATE KEY UPDATE "updatedAt" = CURRENT_TIMESTAMP;
```

### **Verificar roles existentes**

```sql
SELECT "id", "nombre", "descripcion", "activo" 
FROM "MINOILDES"."roles" 
ORDER BY "id";
```

## 🧪 **Pruebas**

### **Ejecutar Script de Pruebas**

```bash
# Instalar axios si no está instalado
npm install axios

# Ejecutar pruebas
node test-rol-por-defecto.js
```

### **Pruebas Manuales**

1. **Crear usuario sin rol**:
   ```bash
   curl -X POST http://localhost:3000/usuarios \
     -H "Content-Type: application/json" \
     -d '{
       "username": "test.defecto",
       "email": "test.defecto@minoil.com.bo",
       "nombre": "Test",
       "apellido": "Defecto",
       "password": "password123"
     }'
   ```

2. **Verificar que tiene rol ID = 3**:
   ```bash
   curl -X GET http://localhost:3000/usuarios/{id_usuario_creado}
   ```

## 🔍 **Verificación**

### **Endpoints de Verificación**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/roles/3` | Verificar que existe el rol con ID = 3 |
| GET | `/roles` | Listar todos los roles disponibles |
| POST | `/usuarios` | Crear usuario (con o sin rol especificado) |

### **Logs del Sistema**

El sistema registra en los logs cuando se asigna el rol por defecto:

```
✅ Usuario creado con rol por defecto (ID = 3): nuevo.usuario
```

## ⚙️ **Configuración Avanzada**

### **Cambiar el Rol por Defecto**

Si necesitas cambiar el rol por defecto de ID = 3 a otro ID, modifica estas líneas:

1. **Servicio de Usuarios** (`usuarios.service.ts`):
   ```typescript
   const rolId = createUsuarioDto.rolID || 3; // Cambiar 3 por el nuevo ID
   ```

2. **Servicio de Autenticación** (`auth.service.ts`):
   ```typescript
   const rolPorDefecto = await this.sapHanaService.obtenerRolPorId(3); // Cambiar 3
   ```

3. **Servicio de Sincronización** (`sap-sync.service.ts`):
   ```typescript
   const rolPorDefecto = await this.sapHanaService.obtenerRolPorId(3); // Cambiar 3
   ```

### **Variables de Entorno**

Puedes agregar una variable de entorno para hacer esto configurable:

```env
# .env
DEFAULT_ROLE_ID=3
```

Y luego usar:
```typescript
const defaultRoleId = parseInt(process.env.DEFAULT_ROLE_ID || '3');
```

## 🚨 **Troubleshooting**

### **Error: "No se encontró el rol por defecto con ID = 3"**

**Causa**: El rol con ID = 3 no existe en la base de datos.

**Solución**:
1. Verificar que existe el rol:
   ```sql
   SELECT * FROM "MINOILDES"."roles" WHERE "id" = 3;
   ```

2. Crear el rol si no existe:
   ```sql
   INSERT INTO "MINOILDES"."roles" ("id", "nombre", "descripcion", "activo") 
   VALUES (3, 'Usuario Básico', 'Rol por defecto', TRUE);
   ```

### **Error: "Rol con ID X no encontrado"**

**Causa**: Se especificó un rol que no existe.

**Solución**:
1. Verificar roles disponibles:
   ```bash
   curl -X GET http://localhost:3000/roles
   ```

2. Usar un rol válido o crear el rol faltante.

## 📊 **Estadísticas**

### **Monitoreo de Asignación de Roles**

Puedes monitorear cuántos usuarios tienen cada rol:

```sql
SELECT 
  r."nombre" as rol,
  COUNT(u."id") as total_usuarios
FROM "MINOILDES"."roles" r
LEFT JOIN "MINOILDES"."users" u ON r."id" = u."rolID"
GROUP BY r."id", r."nombre"
ORDER BY total_usuarios DESC;
```

## 🎯 **Beneficios**

- ✅ **Simplicidad**: No es necesario especificar rol al crear usuarios
- ✅ **Consistencia**: Todos los usuarios nuevos tienen un rol válido
- ✅ **Flexibilidad**: Se puede especificar un rol diferente cuando sea necesario
- ✅ **Mantenibilidad**: Fácil de cambiar el rol por defecto si es necesario

## 🔄 **Próximos Pasos**

1. **Monitoreo**: Implementar logs más detallados de asignación de roles
2. **Configuración**: Hacer el rol por defecto configurable por variables de entorno
3. **Validación**: Agregar validación de permisos mínimos para el rol por defecto
4. **Auditoría**: Registrar cambios de roles en un log de auditoría

