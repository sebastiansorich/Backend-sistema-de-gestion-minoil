-- ============================================================================
-- 🔍 SCRIPT PARA VERIFICAR ESTRUCTURA DE TABLA MANTENIMIENTOS_CHOPERAS
-- ============================================================================

-- 1. Verificar si la tabla existe
SELECT COUNT(*) as tabla_existe 
FROM TABLES 
WHERE TABLE_SCHEMA = 'MINOILDES' AND TABLE_NAME = 'mantenimientos_choperas';

-- 2. Verificar estructura de la tabla
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM COLUMNS 
WHERE TABLE_SCHEMA = 'MINOILDES' AND TABLE_NAME = 'mantenimientos_choperas'
ORDER BY ORDINAL_POSITION;

-- 3. Verificar restricciones de clave foránea
SELECT 
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM REFERENTIAL_CONSTRAINTS 
WHERE CONSTRAINT_SCHEMA = 'MINOILDES' 
AND TABLE_NAME = 'mantenimientos_choperas';

-- 4. Verificar si hay datos en la tabla
SELECT COUNT(*) as total_mantenimientos 
FROM "MINOILDES"."mantenimientos_choperas";

-- 5. Verificar si el usuario 1002 existe en la tabla users
SELECT COUNT(*) as usuario_existe 
FROM "MINOILDES"."users" 
WHERE "id" = 1002;

-- 6. Verificar estructura de la tabla users
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM COLUMNS 
WHERE TABLE_SCHEMA = 'MINOILDES' AND TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;

-- 7. Intentar insertar un registro de prueba (comentado por seguridad)
/*
INSERT INTO "MINOILDES"."mantenimientos_choperas" (
    "usuarioId", "fechaVisita", "clienteCodigo", "ItemCode", "choperaId", 
    "tipoMantenimientoId", "estadoGeneral", "comentarioEstado", "comentarioCalidadCerveza"
) VALUES (
    1002, '2024-12-20', 'CLP03480', '903050', 'UPP2092208M', 
    1, 'BUENO', 'Prueba', 'Prueba'
);
*/
