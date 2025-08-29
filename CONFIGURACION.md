# Configuración del Sistema MINOIL BPMS

## Variables de Entorno Requeridas

### Base de Datos (Prisma)
```env
DATABASE_URL="sqlserver://server:port;database=minoil;user=usuario;password=password;trustServerCertificate=true"
```

### JWT
```env
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=24h
```

### LDAP
```env
LDAP_URL=ldap://SRVDC.main.minoil.com.bo
LDAP_BASE_DN=DC=main,DC=minoil,DC=com,DC=bo
LDAP_ADMIN_DN=CN=AdminUser,OU=Users,DC=main,DC=minoil,DC=com,DC=bo
LDAP_ADMIN_PASSWORD=tu_password_admin_ldap
LDAP_USE_STARTTLS=false
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

### SAP HANA
```env
SAP_HANA_HOST=srvhana
SAP_HANA_PORT=30015
SAP_HANA_USERNAME=CONSULTA
SAP_HANA_PASSWORD=tu_password_sap_hana
```

### Aplicación
```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## Instrucciones de Configuración

1. **Crear archivo `.env`** en la raíz del proyecto
2. **Copiar las variables** de arriba al archivo `.env`
3. **Reemplazar los valores** con las credenciales reales
4. **Verificar que todas las variables** estén configuradas antes de ejecutar

## Verificación de Configuración

Para verificar que la configuración es correcta, puedes usar los siguientes endpoints:

- `GET /auth/health` - Verificar estado general
- `POST /sap/sincronizar-usuarios` - Probar sincronización SAP
- `POST /auth/login` - Probar autenticación

## Notas Importantes

- **LDAP_ADMIN_DN** y **LDAP_ADMIN_PASSWORD** son necesarios para obtener usuarios de LDAP
- **SAP_HANA_PASSWORD** es necesario para sincronizar empleados
- **JWT_SECRET** debe ser una cadena segura y única
- Todas las contraseñas deben ser fuertes y seguras
