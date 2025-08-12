# 🍺 Módulo de Choperas - Integración SAP

## Descripción
Módulo para gestión de choperas integrado con SAP Business One. Permite obtener información de todos los artículos/equipos de choperas desde la base de datos de SAP.

## Funcionalidades Implementadas

### ✅ Endpoint de Choperas
- **Ruta**: `GET /sap/choperas`
- **Descripción**: Obtiene todas las choperas activas desde SAP Business One
- **Tabla SAP**: `OITM` (Items/Artículos)
- **Filtro**: Busca artículos que contengan "chop" en su descripción

### 🔧 Características Técnicas

#### Interfaz TypeScript
```typescript
interface ChoperaSAP {
  ItemCode: string;          // Código del artículo
  ItemName: string;          // Nombre/descripción
  ItemType: string;          // Tipo (I=Inventory)
  ItmsGrpCod: number;       // Código grupo artículo
  ItmsGrpNam: string;       // Nombre grupo artículo
  QryGroup1: string;        // Activo (Y/N)
  InvntItem: string;        // Es item inventario (Y/N)
  SellItem: string;         // Es item venta (Y/N)
  PrchseItem: string;       // Es item compra (Y/N)
  SalUnitMsr: string;       // Unidad medida venta
  PurUnitMsr: string;       // Unidad medida compra
  InvntryUom: string;       // Unidad medida inventario
  LastPurPrc: number;       // Último precio compra
  AvgPrice: number;         // Precio promedio
  FirmCode: number;         // Código fabricante
  FirmName: string;         // Nombre fabricante
  U_Ubicacion?: string;     // Campo usuario - ubicación
  U_Estado?: string;        // Campo usuario - estado
  CreateDate: string;       // Fecha creación
  UpdateDate: string;       // Fecha actualización
}
```

#### Query SAP
```sql
SELECT 
  i."ItemCode",
  i."ItemName",
  i."ItemType",
  i."ItmsGrpCod",
  g."ItmsGrpNam",
  i."QryGroup1",
  i."InvntItem",
  i."SellItem", 
  i."PrchseItem",
  -- ... otros campos
FROM "OITM" i
LEFT JOIN "OITB" g ON i."ItmsGrpCod" = g."ItmsGrpCod"
LEFT JOIN "OMRC" f ON i."FirmCode" = f."FirmCode"
WHERE (
  UPPER(i."ItemName") LIKE '%CHOP%' 
  OR UPPER(i."ItemCode") LIKE '%CHOP%'
  OR UPPER(i."U_TipoEquipo") LIKE '%CHOP%'
)
AND i."frozenFor" = 'N'
AND i."validFor" = 'Y'
ORDER BY i."ItemName"
```

### 📋 Respuesta del Endpoint

```json
{
  "total": 2,
  "choperas": [
    {
      "ItemCode": "CHOP001",
      "ItemName": "Chopera Premium Brahma 10L",
      "ItemType": "I",
      "ItmsGrpCod": 101,
      "ItmsGrpNam": "Equipos de Cerveza",
      "QryGroup1": "Y",
      "InvntItem": "Y",
      "SellItem": "N",
      "PrchseItem": "Y",
      "SalUnitMsr": "UN",
      "PurUnitMsr": "UN",
      "InvntryUom": "UN",
      "LastPurPrc": 2500.00,
      "AvgPrice": 2300.00,
      "FirmCode": 1,
      "FirmName": "Ambev",
      "U_Ubicacion": "Sector A-1",
      "U_Estado": "Operativa",
      "CreateDate": "2024-01-15",
      "UpdateDate": "2024-12-20"
    }
  ],
  "timestamp": "2024-12-20T14:30:00Z",
  "info": "Choperas obtenidas desde tabla OITM (Items) de SAP B1 filtradas por descripción que contenga 'chop'"
}
```

### 🛠️ Modo Simulación
Cuando no hay conexión a SAP, el sistema devuelve datos de prueba con 2 choperas simuladas para desarrollo y testing.

### 🔍 Filtros Aplicados
1. **Descripción**: Busca "chop" en `ItemName`, `ItemCode` y `U_TipoEquipo`
2. **Estado**: Solo artículos activos (`frozenFor` = 'N', `validFor` = 'Y')
3. **Ordenamiento**: Por nombre del artículo

### 📖 Documentación Swagger
El endpoint está completamente documentado en Swagger UI disponible en:
```
http://localhost:3000/api
```

### 🎯 Próximos Pasos Sugeridos
1. **Tablas de Mantenimiento**: Crear modelos para registrar mantenimientos de choperas
2. **Diagnósticos**: Sistema para guardar diagnósticos y reportes
3. **Historial**: Tracking de estado y ubicación de choperas
4. **Alertas**: Notificaciones por mantenimientos vencidos
5. **Dashboard**: Panel de control para gestión de choperas

### 🔗 Endpoints Relacionados
- `GET /sap/connection/test` - Probar conexión SAP
- `GET /sap/empleados` - Empleados activos
- `GET /sap/sedes` - Sedes activas
- `GET /sap/areas` - Áreas activas
- `POST /sap/sync/completo` - Sincronización completa

### 📋 Dependencias
- **SAP HANA Client**: Driver para conexión a SAP Business One
- **NestJS**: Framework backend
- **Swagger**: Documentación automática de API
- **Prisma**: ORM para base de datos local

---

## 🚀 Cómo Usar

1. **Verificar conexión SAP**:
   ```bash
   GET /sap/connection/test
   ```

2. **Obtener choperas**:
   ```bash
   GET /sap/choperas
   ```

3. **Ver documentación completa**:
   ```
   http://localhost:3000/api
   ```

## 📝 Notas Técnicas
- El endpoint funciona tanto con datos reales de SAP como en modo simulación
- Los campos `U_*` son campos definidos por usuario en SAP y pueden no existir en todas las instalaciones
- La consulta incluye JOINs con tablas de grupos de artículos (`OITB`) y fabricantes (`OMRC`)
- Todos los errores son manejados graciosamente y logueados apropiadamente