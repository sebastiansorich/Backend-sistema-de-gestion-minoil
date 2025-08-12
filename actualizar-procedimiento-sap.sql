-- Script para actualizar el procedimiento almacenado SAP
-- Para incluir información de sedes desde la tabla OUBR
-- =========================================================

-- 1️⃣ VERIFICAR estructura actual del procedimiento
-- Ejecuta esto para ver qué columnas devuelve actualmente:
CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"();

-- 2️⃣ VER estructura de tabla OUBR (Branches/Sedes)
SELECT TOP 5 * FROM "OUBR";

-- 3️⃣ VER si empleados tienen algún campo de sede/branch
SELECT TOP 5 
    "empID",
    "firstName", 
    "lastName",
    "position",
    "dept",
    -- Buscar posibles campos de sede:
    "branch", "Branch", "BRANCH",
    "location", "Location", "LOCATION", 
    "site", "Site", "SITE",
    "office", "Office", "OFFICE"
FROM "OHEM" 
WHERE "empID" IS NOT NULL;

-- 4️⃣ EJEMPLO de cómo debería quedar el procedimiento actualizado:
/*
ALTER PROCEDURE "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"
AS
BEGIN
    SELECT 
        e."empID" as ID_Empleado,
        CONCAT(e."firstName", ' ', e."lastName") as Nombre_Completo,
        COALESCE(e."position", 'SIN CARGO') as Cargo,
        e."dept" as ID_Area,
        d."Name" as Nombre_Area,
        e."manager" as ID_Jefe_Inmediato,
        CONCAT(m."firstName", ' ', m."lastName") as Nombre_Jefe,
        CASE WHEN e."Active" = 'Y' THEN 'Y' ELSE 'N' END as Activo,
        
        -- 🆕 AGREGAR INFORMACIÓN DE SEDE:
        COALESCE(e."branch", e."Branch", e."location", 'PRINCIPAL') as ID_Sede,
        COALESCE(b."Name", 'Sede Principal') as Nombre_Sede,
        COALESCE(b."Code", 'PRINCIPAL') as Codigo_Sede
        
    FROM "OHEM" e
    LEFT JOIN "OUDP" d ON e."dept" = d."Code"
    LEFT JOIN "OHEM" m ON e."manager" = m."empID"
    LEFT JOIN "OUBR" b ON e."branch" = b."Code"  -- 🆕 JOIN con tabla de sedes
    
    WHERE e."Active" = 'Y'
    ORDER BY d."Name", e."position", e."lastName", e."firstName";
END;
*/

-- 5️⃣ INVESTIGAR PRIMERO qué campo relaciona empleados con sedes
-- Ejecuta esto para ver qué campos existen en OHEM que podrían ser sede:
SELECT COLUMN_NAME 
FROM SYS.TABLE_COLUMNS 
WHERE TABLE_NAME = 'OHEM' 
AND SCHEMA_NAME = 'BD_MINOIL_PROD'
AND (
    UPPER(COLUMN_NAME) LIKE '%BRANCH%' OR
    UPPER(COLUMN_NAME) LIKE '%LOCATION%' OR
    UPPER(COLUMN_NAME) LIKE '%SEDE%' OR
    UPPER(COLUMN_NAME) LIKE '%SITE%' OR
    UPPER(COLUMN_NAME) LIKE '%OFFICE%'
);

-- =========================================================
-- 🔥 PROCEDIMIENTO ACTUALIZADO COMPLETO 
-- =========================================================

-- Versión actualizada del procedimiento que incluye información de sede
-- Basada en tu procedimiento actual pero agregando campos de sede

ALTER PROCEDURE "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"()
LANGUAGE SQLSCRIPT
SQL SECURITY INVOKER
AS
BEGIN

  SELECT 
    e."empID" AS "ID_Empleado",
    e."firstName" || ' ' || e."lastName" AS "Nombre_Completo",
    COALESCE(e."jobTitle", e."U_Cargo", 'SIN CARGO') AS "Cargo",
    e."dept" AS "ID_Area",
    dept."Name" AS "Nombre_Area",
    e."manager" AS "ID_Jefe_Inmediato",
    CASE 
      WHEN m."empID" IS NULL THEN NULL
      ELSE m."firstName" || ' ' || m."lastName"
    END AS "Nombre_Jefe",
    e."Active" AS "Activo",
    
    -- 🆕 INFORMACIÓN DE SEDE agregada:
    COALESCE(e."branch", e."Branch", e."location", e."U_Sede", 'PRINCIPAL') AS "ID_Sede",
    COALESCE(b."Name", 'Sede Principal') AS "Nombre_Sede",
    COALESCE(b."Code", 'PRINCIPAL') AS "Codigo_Sede"

  FROM "BD_MINOIL_PROD"."OHEM" e
  LEFT JOIN "BD_MINOIL_PROD"."OHEM" m ON e."manager" = m."empID"
  LEFT JOIN "BD_MINOIL_PROD"."OUDP" dept ON e."dept" = dept."Code"
  LEFT JOIN "BD_MINOIL_PROD"."OUBR" b ON COALESCE(e."branch", e."Branch", e."location", e."U_Sede") = b."Code"

  WHERE e."Active" = 'Y'

  ORDER BY dept."Name", e."jobTitle", e."lastName", e."firstName";

END;

-- =========================================================
-- 📋 INSTRUCCIONES PARA EJECUTAR:
-- =========================================================
/*
1. Primero ejecuta el query para investigar campos de sede (línea 53-63)
2. Luego ejecuta el ALTER PROCEDURE completo (línea 69-95)
3. Después verifica que funcione: CALL "MINOILDES"."SP_OBTENER_DATOS_COMPLETOS_MINOIL"();
4. Los nuevos campos que deberías ver son:
   - ID_Sede
   - Nombre_Sede  
   - Codigo_Sede
*/ 