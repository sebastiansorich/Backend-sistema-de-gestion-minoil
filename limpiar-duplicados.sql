-- Script para verificar y limpiar usuarios duplicados
-- =====================================================

-- 1️⃣ VERIFICAR si hay usuarios duplicados
SELECT 
    nombre,
    apellido,
    COUNT(*) as total_usuarios,
    STRING_AGG(username, ', ') as usernames,
    STRING_AGG(CASE WHEN "empleadoSapId" IS NOT NULL THEN 'SAP' ELSE 'NO-SAP' END, ', ') as tipos
FROM "Usuario" 
WHERE activo = true
GROUP BY nombre, apellido
HAVING COUNT(*) > 1
ORDER BY total_usuarios DESC;

-- 2️⃣ VER usuarios sin empleadoSapId (posibles duplicados LDAP)
SELECT 
    id, username, nombre, apellido, email, 
    "empleadoSapId", "createdAt", autenticacion
FROM "Usuario" 
WHERE "empleadoSapId" IS NULL 
    AND activo = true
ORDER BY "createdAt" DESC;

-- 3️⃣ SI ENCUENTRAS DUPLICADOS: Eliminar usuarios LDAP que no tienen empleadoSapId
-- (Solo ejecutar DESPUÉS de verificar que son realmente duplicados)
/*
DELETE FROM "Usuario" 
WHERE "empleadoSapId" IS NULL 
    AND activo = true
    AND EXISTS (
        SELECT 1 FROM "Usuario" u2 
        WHERE u2.nombre = "Usuario".nombre 
            AND u2.apellido = "Usuario".apellido
            AND u2."empleadoSapId" IS NOT NULL 
            AND u2.activo = true
    );
*/

-- 4️⃣ Limpiar usernames duplicados (agregar sufijo si es necesario)
/*
UPDATE "Usuario" 
SET username = username || '_duplicado_' || EXTRACT(EPOCH FROM NOW())::bigint
WHERE id IN (
    SELECT u1.id
    FROM "Usuario" u1
    JOIN "Usuario" u2 ON u1.username = u2.username AND u1.id != u2.id
    WHERE u1."empleadoSapId" IS NULL
);
*/ 