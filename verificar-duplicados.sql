-- Script para verificar usuarios duplicados en la base de datos
-- Ejecutar después de implementar la solución LDAP-SAP

-- 1. Verificar duplicados por nombre completo similar
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(DISTINCT empleadoSapId) as empleados_sap_unicos,
    COUNT(*) - COUNT(DISTINCT empleadoSapId) as posibles_duplicados
FROM usuarios 
WHERE empleadoSapId IS NOT NULL;

-- 2. Buscar usuarios con nombres muy similares
SELECT 
    u1.id, u1.username, u1.nombre, u1.apellido, u1.empleadoSapId,
    u2.id, u2.username, u2.nombre, u2.apellido, u2.empleadoSapId
FROM usuarios u1
JOIN usuarios u2 ON u1.id < u2.id
WHERE (
    LEVENSHTEIN(CONCAT(u1.nombre, ' ', u1.apellido), CONCAT(u2.nombre, ' ', u2.apellido)) <= 2
    OR (u1.nombre = u2.nombre AND u1.apellido = u2.apellido)
) 
AND u1.empleadoSapId != u2.empleadoSapId;

-- 3. Buscar usuarios con mismo empleadoSapId (no debería existir por UNIQUE)
SELECT empleadoSapId, COUNT(*) as duplicados
FROM usuarios 
WHERE empleadoSapId IS NOT NULL
GROUP BY empleadoSapId 
HAVING COUNT(*) > 1;

-- 4. Verificar usuarios sin empleadoSapId que podrían ser duplicados LDAP
SELECT id, username, nombre, apellido, autenticacion, createdAt
FROM usuarios 
WHERE empleadoSapId IS NULL 
ORDER BY createdAt DESC;

-- 5. Estadísticas generales
SELECT 
    autenticacion,
    COUNT(*) as cantidad,
    COUNT(CASE WHEN empleadoSapId IS NOT NULL THEN 1 END) as con_sap_id,
    COUNT(CASE WHEN empleadoSapId IS NULL THEN 1 END) as sin_sap_id
FROM usuarios 
GROUP BY autenticacion; 